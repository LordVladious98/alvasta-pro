/**
 * Alvasta Tool Host — v0.4
 *
 * Runs an HTTP server in the openclaw runtime process that exposes a tool
 * registry to the spawned Claude Code subprocess (via the alvasta-mcp-bridge).
 *
 * Architecture:
 *
 *   [openclaw runtime]                          [claude --print]
 *          │                                          │
 *          │ 1. start HTTP server :PORT/random        │
 *          │    register tools (name → handler)       │
 *          │ 2. write manifest file with tool defs    │
 *          │    + callback URL                         │
 *          │ 3. spawn claude --print                   │
 *          │ ─────────────────────────────────────────►│
 *          │                                          │ 4. spawn alvasta-mcp-bridge
 *          │                                          │    (env: ALVASTA_TOOL_MANIFEST=path)
 *          │                                          │
 *          │                                          │ 5. bridge reads manifest
 *          │                                          │    exposes tools via MCP
 *          │                                          │
 *          │                                          │ 6. claude calls tool via MCP
 *          │                                      ◄───┤ 7. bridge POSTs callback URL
 *          │ 8. handler runs openclaw native code     │
 *          ├─────────────────────────────────────────►│ 9. result returns via JSON
 *          │                                          │
 *          │                                          │ 10. bridge returns MCP result
 *          │                                          │
 *
 * v0.4 SCOPE: tool host server + manifest writing + bridge fetch path.
 * v0.5 will wire openclaw's actual tool registry into this host.
 */

import { createServer, type Server } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";

export interface ToolDefinition {
  /** Tool name as exposed to the model (must match MCP naming rules) */
  name: string;
  /** Human-readable description shown to the model */
  description: string;
  /** JSON Schema for the tool's input arguments */
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult> | ToolResult;

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export class AlvastaToolHost {
  private server: Server | null = null;
  private port = 0;
  private tools = new Map<string, RegisteredTool>();
  private secret = randomBytes(16).toString("hex");
  private manifestPath: string;

  constructor() {
    const dir = resolve(homedir(), ".alvasta-pro");
    mkdirSync(dir, { recursive: true });
    this.manifestPath = resolve(dir, "tools-manifest.json");
  }

  /** Register a tool. Idempotent — re-registering replaces the handler. */
  register(definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.name, { definition, handler });
    if (this.server) {
      this.writeManifest();
    }
  }

  /** Start the HTTP server (idempotent). Returns the manifest path. */
  async start(): Promise<string> {
    if (this.server) return this.manifestPath;

    return new Promise((resolvePromise, reject) => {
      this.server = createServer(async (req, res) => {
        // Auth check via secret in path: /<secret>/tools/<name>
        const pathParts = (req.url || "").split("/").filter(Boolean);
        if (pathParts[0] !== this.secret) {
          res.writeHead(403, { "Content-Type": "text/plain" });
          res.end("forbidden");
          return;
        }

        // GET /<secret>/health
        if (req.method === "GET" && pathParts[1] === "health") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, tools: this.tools.size }));
          return;
        }

        // POST /<secret>/tools/<name>
        if (req.method === "POST" && pathParts[1] === "tools" && pathParts[2]) {
          const toolName = decodeURIComponent(pathParts[2]);
          const tool = this.tools.get(toolName);
          if (!tool) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: `Unknown tool: ${toolName}` }));
            return;
          }

          // Read body
          let body = "";
          for await (const chunk of req) body += chunk.toString();
          let args: Record<string, unknown>;
          try {
            args = body ? JSON.parse(body) : {};
          } catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON body" }));
            return;
          }

          try {
            const result = await tool.handler(args);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result));
          } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                content: [
                  { type: "text", text: `Tool execution error: ${(e as Error).message ?? String(e)}` },
                ],
                isError: true,
              }),
            );
          }
          return;
        }

        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("not found");
      });

      this.server.on("error", reject);
      this.server.listen(0, "127.0.0.1", () => {
        const addr = this.server!.address();
        if (typeof addr === "object" && addr) {
          this.port = addr.port;
          this.writeManifest();
          resolvePromise(this.manifestPath);
        } else {
          reject(new Error("Failed to bind tool host server"));
        }
      });
    });
  }

  /** Stop the server. */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  /** Write the manifest file with current tool list and callback URLs. */
  private writeManifest(): void {
    const baseUrl = `http://127.0.0.1:${this.port}/${this.secret}`;
    const manifest = {
      version: 1,
      baseUrl,
      tools: [...this.tools.values()].map((t) => ({
        name: t.definition.name,
        description: t.definition.description,
        inputSchema: t.definition.inputSchema,
        callbackUrl: `${baseUrl}/tools/${encodeURIComponent(t.definition.name)}`,
      })),
    };
    writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2));
  }

  getManifestPath(): string {
    return this.manifestPath;
  }

  getPort(): number {
    return this.port;
  }
}

// ── Singleton ──
// One tool host per process. The transport stream module pulls this in
// and starts it lazily on first inference call.
let singleton: AlvastaToolHost | null = null;

export function getAlvastaToolHost(): AlvastaToolHost {
  if (!singleton) {
    singleton = new AlvastaToolHost();
  }
  return singleton;
}

export async function ensureAlvastaToolHostStarted(): Promise<string> {
  const host = getAlvastaToolHost();
  return host.start();
}
