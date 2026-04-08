/**
 * Alvasta Bridge: openclaw native tools → AlvastaToolHost — v0.5
 *
 * Walks openclaw's tool registry (createOpenClawTools) and registers each
 * tool with the AlvastaToolHost so the alvasta-mcp-bridge can expose them
 * to claude --print.
 *
 * Architecture (recap):
 *   openclaw runtime (this process)
 *     ↓ createOpenClawTools(options) → AnyAgentTool[]
 *     ↓ for each tool: host.register(definition, handler)
 *     ↓ host writes manifest with callback URLs
 *     ↓ spawn claude --print --mcp-config <bridge>
 *     ↓ claude spawns alvasta-mcp-bridge
 *     ↓ bridge reads manifest, exposes tools via MCP
 *     ↓ when model calls a tool:
 *     ↓   bridge POSTs to callback URL
 *     ↓   our handler invokes tool.execute() in this process
 *     ↓   handler returns result
 *
 * Tool shape (from @mariozechner/pi-agent-core):
 *   interface AgentTool<TParams, TDetails> {
 *     name: string;
 *     description: string;
 *     parameters: TSchema;  // TypeBox schema
 *     label: string;
 *     execute(toolCallId, params, signal?, onUpdate?): Promise<{
 *       content: (TextContent | ImageContent)[];
 *       details: TDetails;
 *     }>;
 *   }
 */

import { randomBytes } from "node:crypto";
import {
  getAlvastaToolHost,
  type ToolDefinition,
  type ToolHandler,
  type ToolResult,
} from "./alvasta-tool-host.js";

// We import dynamically to avoid forcing this module into the wrong load order
// during build. The actual openclaw tool factory is in src/agents/openclaw-tools.ts
// and pulls in a lot of runtime context.

interface AnyAgentTool {
  name: string;
  description?: string;
  label?: string;
  parameters?: unknown;
  execute(
    toolCallId: string,
    params: unknown,
    signal?: AbortSignal,
    onUpdate?: (partial: unknown) => void,
  ): Promise<{
    content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
    details?: unknown;
  }>;
}

/**
 * Convert a TypeBox schema (from openclaw tools) into the JSON Schema shape
 * AlvastaToolHost expects. TypeBox schemas ARE JSON Schema-compatible — they
 * extend JSON Schema with the Static<> type-extraction marker. We just strip
 * the TypeBox-specific metadata and pass the rest through.
 */
function typeBoxToJsonSchema(parameters: unknown): ToolDefinition["inputSchema"] {
  if (!parameters || typeof parameters !== "object") {
    return { type: "object", properties: {} };
  }
  const p = parameters as Record<string, unknown>;
  // TypeBox schemas have Symbol("Kind") metadata that doesn't survive JSON.stringify
  // so we just use them directly with a few defaults.
  const schemaType = (p.type as string) ?? "object";
  if (schemaType !== "object") {
    // Wrap non-object schemas in a single-property object
    return {
      type: "object",
      properties: { value: p as Record<string, unknown> },
      required: ["value"],
    };
  }
  return {
    type: "object",
    properties: (p.properties as Record<string, unknown> | undefined) ?? {},
    required: Array.isArray(p.required) ? (p.required as string[]) : [],
  };
}

/**
 * Convert openclaw's AgentTool result to AlvastaToolHost's ToolResult shape.
 * openclaw tools may return text and/or image content. We flatten everything
 * to text (text blocks pass through; image blocks become a placeholder string
 * because the MCP text-only protocol can't carry binary inline).
 */
function toolResultToHostResult(
  result: { content: Array<{ type: string; text?: string; mimeType?: string }> },
): ToolResult {
  const content: Array<{ type: "text"; text: string }> = [];
  for (const block of result.content ?? []) {
    if (block.type === "text" && typeof block.text === "string") {
      content.push({ type: "text", text: block.text });
    } else if (block.type === "image") {
      // v0.5 limitation: MCP text-mode bridge can't carry image bytes inline.
      // Real image-gen tools should return a path or URL in the text content
      // of the result, not the raw bytes.
      content.push({
        type: "text",
        text: `[image content: ${block.mimeType ?? "unknown mime"} — not transferable via text MCP bridge]`,
      });
    } else {
      content.push({
        type: "text",
        text: JSON.stringify(block),
      });
    }
  }
  if (content.length === 0) {
    content.push({ type: "text", text: "(empty result)" });
  }
  return { content };
}

/**
 * Wrap an openclaw AgentTool as an AlvastaToolHost handler.
 */
function wrapTool(tool: AnyAgentTool): ToolHandler {
  return async (args) => {
    // Generate a tool call id; openclaw expects something unique per call
    const toolCallId = `alvasta-${randomBytes(8).toString("hex")}`;
    try {
      const raw = await tool.execute(toolCallId, args);
      return toolResultToHostResult(raw);
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: `[alvasta-bridge] tool ${tool.name} failed: ${
              e instanceof Error ? e.message : String(e)
            }`,
          },
        ],
        isError: true,
      };
    }
  };
}

/**
 * Walk openclaw's tool registry and register every tool with the
 * AlvastaToolHost. Idempotent — safe to call multiple times.
 *
 * This function is async because openclaw-tools.ts may need to be dynamically
 * imported and the tool factory may be async itself.
 *
 * @param createTools optional override for testing — defaults to importing
 *                    createOpenClawTools from openclaw-tools.js at runtime
 * @param toolOptions options to pass to createOpenClawTools (config, sessionKey, etc)
 * @returns the number of tools successfully bridged
 */
export async function bridgeOpenclawTools(
  createTools: (options?: unknown) => AnyAgentTool[] | Promise<AnyAgentTool[]>,
  toolOptions?: unknown,
): Promise<number> {
  const host = getAlvastaToolHost();
  await host.start();

  // Caller must supply the factory. We don't dynamically import openclaw-tools.ts
  // ourselves because pi-tools.ts already statically imports it, and openclaw's
  // build guards treat mixed dynamic+static imports as errors. Use
  // registerToolArray() instead if you have a pre-built tool array.
  const tools = await createTools(toolOptions);

  let count = 0;
  for (const tool of tools) {
    if (!tool || typeof tool.name !== "string") continue;
    try {
      const definition: ToolDefinition = {
        name: `openclaw_${tool.name}`, // namespaced to avoid collisions with built-in claude tools
        description: tool.description ?? tool.label ?? `OpenClaw native tool: ${tool.name}`,
        inputSchema: typeBoxToJsonSchema(tool.parameters),
      };
      host.register(definition, wrapTool(tool));
      count++;
    } catch (e) {
      console.warn(
        `[alvasta] skipping tool ${tool.name}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  console.log(`[alvasta] bridged ${count} openclaw native tools to the MCP host`);
  return count;
}

/**
 * Synchronous fire-and-forget registration of an already-assembled tool
 * array. Use this when the runtime has already called createOpenClawTools()
 * and wants to expose those tools to the spawned claude --print subprocess
 * via the Alvasta MCP bridge.
 *
 * Kicks off host.start() if needed (non-blocking — the host is lazy and
 * very fast to spin up). Idempotent: re-calling with updated tools replaces
 * the registrations.
 *
 * Wire point: src/agents/pi-tools.ts at the end of the tool assembly
 * function, where openclaw's runtime has just built the tool array for
 * the current agent turn.
 */
let bridgeStarted = false;
export function registerToolArray(tools: AnyAgentTool[]): number {
  const host = getAlvastaToolHost();
  if (!bridgeStarted) {
    bridgeStarted = true;
    void host.start().catch((e) => {
      bridgeStarted = false;
      console.warn(
        `[alvasta] tool host failed to start: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    });
  }

  let count = 0;
  for (const tool of tools) {
    if (!tool || typeof tool.name !== "string") continue;
    try {
      const definition: ToolDefinition = {
        name: `openclaw_${tool.name}`,
        description: tool.description ?? tool.label ?? `OpenClaw native tool: ${tool.name}`,
        inputSchema: typeBoxToJsonSchema(tool.parameters),
      };
      host.register(definition, wrapTool(tool));
      count++;
    } catch {
      // fire-and-forget: skip bad tools silently
    }
  }
  return count;
}

/**
 * Register a single tool manually. Useful when openclaw's runtime adds tools
 * after the initial bridge call (e.g. plugin-loaded tools, gateway-mediated
 * tools that arrive at session start).
 */
export function bridgeSingleTool(tool: AnyAgentTool): boolean {
  const host = getAlvastaToolHost();
  try {
    const definition: ToolDefinition = {
      name: `openclaw_${tool.name}`,
      description: tool.description ?? tool.label ?? `OpenClaw native tool: ${tool.name}`,
      inputSchema: typeBoxToJsonSchema(tool.parameters),
    };
    host.register(definition, wrapTool(tool));
    return true;
  } catch (e) {
    console.warn(
      `[alvasta] bridgeSingleTool failed for ${tool.name}: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
    return false;
  }
}
