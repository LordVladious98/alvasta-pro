#!/usr/bin/env node
/**
 * Alvasta MCP Bridge — v0.4
 *
 * A stdio MCP (Model Context Protocol) server that exposes openclaw's NATIVE
 * tools to a spawned `claude --print` subprocess. This is the bridge that
 * lets the assistant invoke openclaw's image generation, browser automation,
 * voice, etc — even though the actual LLM is running inside Claude Code.
 *
 * v0.4 adds: live tool registry from openclaw runtime via HTTP callback URLs.
 *
 * Architecture:
 *
 *   [openclaw runtime]                          [claude --print]
 *          │                                          │
 *          │ start http tool host                     │
 *          │ register tools                            │
 *          │ write manifest to disk                    │
 *          │                                          │
 *          │ spawn claude --print --mcp-config        │
 *          │ ─────────────────────────────────────────►│
 *          │                                          │ spawn alvasta-mcp-bridge
 *          │                                          │ (env: ALVASTA_TOOL_MANIFEST=path)
 *          │                                          │
 *          │                                          │ bridge reads manifest
 *          │                                          │ exposes tools via MCP
 *          │                                          │
 *          │                                          │ claude calls tool via MCP
 *          │                                      ◄───┤ bridge POSTs callback URL
 *          │ run handler                              │
 *          ├─────────────────────────────────────────►│ result
 *          │                                          │
 *
 * The manifest path is passed via env var ALVASTA_TOOL_MANIFEST. If unset,
 * the bridge falls back to the v0.3 hardcoded test tools so the bridge still
 * works as a smoke-test target without a running tool host.
 */

import { createInterface } from "node:readline";
import { readFileSync, existsSync } from "node:fs";

const PROTOCOL_VERSION = "2024-11-05";
const MANIFEST_PATH = process.env.ALVASTA_TOOL_MANIFEST;

// ── Tool registry ──
// If ALVASTA_TOOL_MANIFEST is set and the file exists, load the openclaw
// runtime's actual tool registry from it. Otherwise fall back to the v0.3
// test tools so the bridge still has something to expose.

const FALLBACK_TOOLS = [
  {
    name: "alvasta_echo",
    description:
      "Test tool for the Alvasta MCP bridge. Echoes the input message back. Use this to verify the bridge is wired correctly.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "The message to echo back" },
      },
      required: ["message"],
    },
    callbackUrl: null,
  },
  {
    name: "alvasta_status",
    description:
      "Returns the Alvasta gateway status — version, active sessions, channels, memory state.",
    inputSchema: { type: "object", properties: {} },
    callbackUrl: null,
  },
];

function loadTools() {
  if (MANIFEST_PATH && existsSync(MANIFEST_PATH)) {
    try {
      const raw = readFileSync(MANIFEST_PATH, "utf8");
      const manifest = JSON.parse(raw);
      if (Array.isArray(manifest.tools)) {
        return manifest.tools;
      }
    } catch (e) {
      // fall through to fallback
    }
  }
  return FALLBACK_TOOLS;
}

const TOOLS = loadTools();

// ── Fallback tool implementations (for v0.3 compatibility) ──
async function callFallbackTool(name, args) {
  switch (name) {
    case "alvasta_echo":
      return {
        content: [
          { type: "text", text: `[alvasta-bridge] echo: ${args?.message ?? "(no message)"}` },
        ],
      };
    case "alvasta_status":
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                bridge: "alvasta-mcp-bridge",
                version: "0.4.0-alpha",
                pid: process.pid,
                node: process.version,
                uptime_seconds: Math.round(process.uptime()),
                manifest: MANIFEST_PATH ?? "(none — fallback registry)",
                tool_count: TOOLS.length,
              },
              null,
              2,
            ),
          },
        ],
      };
    default:
      return {
        content: [{ type: "text", text: `Unknown fallback tool: ${name}` }],
        isError: true,
      };
  }
}

// ── Tool dispatch ──
async function callTool(name, args) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  // Live registry tool (has a callback URL) — POST to openclaw's tool host
  if (tool.callbackUrl) {
    try {
      const res = await fetch(tool.callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args ?? {}),
      });
      if (!res.ok) {
        return {
          content: [{ type: "text", text: `Tool host returned HTTP ${res.status}` }],
          isError: true,
        };
      }
      const json = await res.json();
      return json;
    } catch (e) {
      return {
        content: [
          { type: "text", text: `Tool host fetch error: ${e?.message ?? String(e)}` },
        ],
        isError: true,
      };
    }
  }

  // Fallback registry — execute locally
  return callFallbackTool(name, args);
}

// ── JSON-RPC server over stdio ──
function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

function reply(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function replyError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handleRequest(req) {
  const { id, method, params } = req;

  switch (method) {
    case "initialize":
      return reply(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "alvasta-mcp-bridge", version: "0.4.0-alpha" },
      });

    case "notifications/initialized":
      return; // notifications get no response

    case "tools/list": {
      // Strip internal fields (callbackUrl) before exposing to MCP
      const exposed = TOOLS.map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
      }));
      return reply(id, { tools: exposed });
    }

    case "tools/call": {
      try {
        const result = await callTool(params?.name, params?.arguments);
        return reply(id, result);
      } catch (e) {
        return replyError(id, -32000, e?.message ?? String(e));
      }
    }

    case "ping":
      return reply(id, {});

    default:
      if (id !== undefined && id !== null) {
        return replyError(id, -32601, `Method not found: ${method}`);
      }
  }
}

const rl = createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  if (!line.trim()) return;
  try {
    const req = JSON.parse(line);
    await handleRequest(req);
  } catch (e) {
    // skip unparseable
  }
});

process.stdin.on("end", () => process.exit(0));
