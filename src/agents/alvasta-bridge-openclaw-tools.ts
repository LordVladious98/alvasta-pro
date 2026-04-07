/**
 * Alvasta Bridge: openclaw native tools → AlvastaToolHost — v0.5
 *
 * This file is the connector between openclaw's existing tool registry
 * and the new AlvastaToolHost. When openclaw's runtime starts, this
 * function walks the tool registry and registers each tool with the
 * host so the alvasta-mcp-bridge can expose them to claude --print.
 *
 * IMPORTANT: This file is intentionally a thin layer. The hard part is
 * understanding openclaw's tool registry shape and translating it. Each
 * tool's input schema, name, description, and handler must match what
 * AlvastaToolHost expects.
 *
 * Some openclaw tools may need special handling because they depend on
 * runtime context (the gateway, current session, channel state). For
 * those tools we either:
 *   1. Capture the context at registration time and bind it into the handler
 *   2. Skip the tool and document why
 *   3. Add a per-tool adapter function in this file
 */

import { getAlvastaToolHost, type ToolDefinition, type ToolHandler } from "./alvasta-tool-host.js";

/**
 * Walk openclaw's tool registry and register every native tool with the
 * AlvastaToolHost. Idempotent — safe to call multiple times.
 *
 * v0.5 SCOPE: scaffolding only. The actual registry walk is filled in
 * once we know openclaw's tool registry API (see investigation findings).
 *
 * Returns the number of tools registered.
 */
export async function bridgeOpenclawTools(): Promise<number> {
  const host = getAlvastaToolHost();
  await host.start();

  // ── PLACEHOLDER ──
  // The investigation agent's findings will tell us:
  // - Which file exports the tool registry (e.g. src/tools/registry.ts)
  // - The function or constant to import (e.g. getAllNativeTools())
  // - The shape of each tool definition (e.g. { name, description, schema, run })
  //
  // Once known, the actual implementation looks like:
  //
  //   const tools = getAllNativeTools();
  //   let count = 0;
  //   for (const tool of tools) {
  //     try {
  //       host.register(adaptToolDefinition(tool), adaptToolHandler(tool));
  //       count++;
  //     } catch (e) {
  //       console.warn(`[alvasta] failed to bridge tool ${tool.name}: ${e.message}`);
  //     }
  //   }
  //   return count;

  // For now, return 0. The bridge falls back to its hardcoded test tools.
  return 0;
}

/**
 * Register a single openclaw tool with the host. Use this when the runtime
 * has reasons to register tools individually (e.g. plugin-loaded tools that
 * arrive after startup).
 */
export function bridgeSingleTool(definition: ToolDefinition, handler: ToolHandler): void {
  const host = getAlvastaToolHost();
  host.register(definition, handler);
}
