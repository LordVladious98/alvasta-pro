#!/usr/bin/env node
/**
 * Alvasta MCP Bridge — v0.3 alpha
 *
 * A minimal stdio MCP (Model Context Protocol) server that exposes openclaw's
 * native tools to a spawned `claude --print` subprocess. This is the bridge
 * that lets the assistant invoke openclaw's image generation, browser automation,
 * voice, etc. tools — even though the actual LLM is running inside Claude Code.
 *
 * Architecture:
 *   openclaw runtime → spawns claude --print --mcp-config bridge.json
 *                              ↓
 *                       claude --print spawns this MCP bridge as a child
 *                              ↓
 *                       The bridge exposes openclaw tools via the MCP protocol
 *                              ↓
 *                       When the model decides to use a tool, claude calls
 *                       this bridge via JSON-RPC over stdio
 *                              ↓
 *                       The bridge routes the call to openclaw's runtime
 *                       (currently stub — v0.4 wires the actual tool registry)
 *
 * v0.3 SCOPE: prove the bridge wiring with one test tool. Once Claude Code
 * can successfully call this bridge's "alvasta_echo" tool, we know the MCP
 * pipe works and can attach real tools in v0.4.
 *
 * MCP protocol reference:
 *   https://spec.modelcontextprotocol.io/specification/
 */

import { createInterface } from "node:readline";

const PROTOCOL_VERSION = "2024-11-05";

// ── Tool registry ──
// In v0.3 this is a stub. v0.4 will populate it from openclaw's actual tool
// registry passed via env var or a separate channel.
const TOOLS = [
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
  },
  {
    name: "alvasta_status",
    description:
      "Returns the Alvasta gateway status — version, active sessions, channels, memory state.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// ── Tool implementations ──
async function callTool(name, args) {
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
                version: "0.3.0-alpha",
                pid: process.pid,
                node: process.version,
                uptime_seconds: Math.round(process.uptime()),
              },
              null,
              2,
            ),
          },
        ],
      };

    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
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
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "alvasta-mcp-bridge",
          version: "0.3.0-alpha",
        },
      });

    case "notifications/initialized":
      // No response for notifications
      return;

    case "tools/list":
      return reply(id, { tools: TOOLS });

    case "tools/call": {
      try {
        const result = await callTool(params?.name, params?.arguments);
        return reply(id, result);
      } catch (e) {
        return replyError(id, -32000, e.message ?? String(e));
      }
    }

    case "ping":
      return reply(id, {});

    default:
      // Notifications have no id; don't reply.
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
    // Skip unparseable lines
  }
});

// Stay alive until stdin closes
process.stdin.on("end", () => process.exit(0));
