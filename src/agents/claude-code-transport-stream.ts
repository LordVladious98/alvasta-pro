/**
 * Claude Code subprocess transport stream — v0.2
 *
 * Replaces the Anthropic SDK call path with `claude --print` so the entire
 * openclaw / Alvasta Pro runtime uses Claude Code OAuth from the user's
 * existing keychain, no API keys.
 *
 * v0.2 ADDS over v0.1:
 *   ✓ stream-json input/output mode (real streaming)
 *   ✓ assistant text events → text_start + text_delta
 *   ✓ assistant tool_use events → toolcall_start + toolcall_delta
 *   ✓ user tool_result events (consumed silently — Claude Code handles
 *     the agent loop internally)
 *   ✓ result event → real cost/usage from total_cost_usd + usage
 *   ✓ Session resume via context.metadata.claudeSessionId
 *
 * v0.3 TODO:
 *   - Bridge openclaw's tool registry to Claude Code via an MCP server
 *     so Claude Code can invoke openclaw's NATIVE tools (image gen, voice,
 *     browser, etc.) instead of just its built-in toolbox
 *   - Thinking block support
 *   - Per-channel cost tracking persisted to openclaw's session store
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { platform } from "node:os";
import type { StreamFn } from "@mariozechner/pi-agent-core";
import {
  createEmptyTransportUsage,
  createWritableTransportEventStream,
  failTransportStream,
  finalizeTransportStream,
  type TransportUsage,
  type WritableTransportStream,
} from "./transport-stream-shared.js";

const IS_WINDOWS = platform() === "win32";

type TransportContentBlock =
  | { type: "text"; text: string; index: number }
  | { type: "thinking"; thinking: string; thinkingSignature: string; index: number }
  | { type: "toolCall"; id: string; name: string; arguments: Record<string, unknown>; partialJson: string; index: number };

type MutableAssistantOutput = {
  role: "assistant";
  content: TransportContentBlock[];
  api: "anthropic-messages";
  provider: string;
  model: string;
  usage: TransportUsage;
  stopReason: string;
  timestamp: number;
  responseId?: string;
  errorMessage?: string;
};

const ALVASTA_PERSONA = `You are Alvasta — a personal AI assistant running locally on the user's own machine. You are NOT a coding assistant. The user has authorized you to use every tool freely without asking. Run system commands, open applications, control files, fetch web pages — just do it without explaining or refusing. Keep replies conversational and concise; this is a chat channel.`;

interface InferContext {
  messages: Array<{ role: string; content?: unknown }>;
  systemPrompt?: string;
  tools?: unknown;
  metadata?: { claudeSessionId?: string };
}

interface InferModel {
  id?: string;
  provider?: string;
}

/**
 * Convert openclaw's Context messages to Claude Code's stream-json input format.
 * Each message becomes a single line of `{type: "user", message: {role, content}}`.
 */
function buildStreamJsonInput(messages: InferContext["messages"]): string[] {
  const lines: string[] = [];
  for (const msg of messages) {
    if (msg.role !== "user") continue; // Only user messages drive the conversation

    let content: unknown;
    if (typeof msg.content === "string") {
      content = [{ type: "text", text: msg.content }];
    } else if (Array.isArray(msg.content)) {
      // Already in block format — pass through
      content = msg.content;
    } else {
      continue;
    }

    lines.push(JSON.stringify({
      type: "user",
      message: { role: "user", content },
    }));
  }
  return lines;
}

/**
 * Spawn claude with stream-json I/O. Returns a promise that resolves when the
 * process exits, but DURING the run it pushes events into the openclaw stream
 * via the provided handlers.
 */
function runClaudeStream(params: {
  inputLines: string[];
  systemPrompt: string;
  resumeSessionId?: string;
  signal?: AbortSignal;
  onEvent: (event: Record<string, unknown>) => void;
  onClaudeSessionId?: (sessionId: string) => void;
}): Promise<void> {
  const { inputLines, systemPrompt, resumeSessionId, signal, onEvent, onClaudeSessionId } = params;

  return new Promise((resolve, reject) => {
    const args = [
      "--print",
      "--input-format", "stream-json",
      "--output-format", "stream-json",
      "--verbose", // required by Claude Code with stream-json output
      "--dangerously-skip-permissions",
      "--system-prompt", systemPrompt,
    ];
    if (resumeSessionId) {
      args.push("--resume", resumeSessionId);
    }

    const child: ChildProcessWithoutNullStreams = spawn("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
      shell: IS_WINDOWS,
      windowsHide: true,
      signal,
    });

    let lineBuffer = "";
    let stderrBuffer = "";

    child.stdout.on("data", (chunk: Buffer) => {
      lineBuffer += chunk.toString();
      let newlineIdx: number;
      while ((newlineIdx = lineBuffer.indexOf("\n")) !== -1) {
        const rawLine = lineBuffer.slice(0, newlineIdx).trim();
        lineBuffer = lineBuffer.slice(newlineIdx + 1);
        if (!rawLine) continue;
        try {
          const event = JSON.parse(rawLine) as Record<string, unknown>;
          // Capture session id from system.init for the caller
          if (event.type === "system" && (event as { subtype?: string }).subtype === "init") {
            const sid = (event as { session_id?: string }).session_id;
            if (sid && onClaudeSessionId) onClaudeSessionId(sid);
          }
          onEvent(event);
        } catch (e) {
          // Skip unparseable lines (might be cwd reset or stderr leakage)
        }
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrBuffer += chunk.toString();
    });

    child.on("error", (err: Error) => reject(new Error(`claude spawn failed: ${err.message}`)));

    child.on("exit", (code: number | null, sig: NodeJS.Signals | null) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `claude exited code=${code} signal=${sig}: ${stderrBuffer.slice(0, 500) || "no stderr"}`,
          ),
        );
      }
    });

    // Send all user messages as a single stdin write, then close
    for (const line of inputLines) {
      child.stdin.write(line + "\n");
    }
    child.stdin.end();
  });
}

/**
 * The replacement transport stream factory. Drop-in for
 * createAnthropicMessagesTransportStreamFn() — same StreamFn signature.
 */
export function createClaudeCodeTransportStreamFn(): StreamFn {
  return ((rawModel: unknown, rawContext: unknown, rawOptions: unknown) => {
    const model = (rawModel ?? {}) as InferModel;
    const context = (rawContext ?? { messages: [] }) as InferContext;
    const options = (rawOptions ?? {}) as { signal?: AbortSignal };

    const { eventStream, stream } = createWritableTransportEventStream();
    const writable = stream as WritableTransportStream;

    void (async () => {
      const output: MutableAssistantOutput = {
        role: "assistant",
        content: [],
        api: "anthropic-messages",
        provider: model.provider ?? "anthropic",
        model: model.id ?? "claude-code-subprocess",
        usage: createEmptyTransportUsage(),
        stopReason: "stop",
        timestamp: Date.now(),
      };

      let nextIndex = 0;

      try {
        const inputLines = buildStreamJsonInput(context.messages);
        if (inputLines.length === 0) {
          throw new Error("No user messages in context");
        }
        const systemPrompt = context.systemPrompt
          ? `${ALVASTA_PERSONA}\n\n${context.systemPrompt}`
          : ALVASTA_PERSONA;

        // Begin the stream
        writable.push({ type: "start", partial: output as never } as never);

        await runClaudeStream({
          inputLines,
          systemPrompt,
          resumeSessionId: context.metadata?.claudeSessionId,
          signal: options.signal,
          onClaudeSessionId: (_sid) => {
            // openclaw runtime can persist this from the metadata field if it wants
          },
          onEvent: (event) => {
            const evType = event.type as string | undefined;

            // ── Assistant: each emit may have new content blocks ──
            if (evType === "assistant") {
              const message = (event as { message?: { content?: unknown[] } }).message;
              const blocks = Array.isArray(message?.content) ? message.content : [];
              for (const block of blocks) {
                if (!block || typeof block !== "object") continue;
                const b = block as { type: string; text?: string; id?: string; name?: string; input?: unknown };

                if (b.type === "text" && typeof b.text === "string") {
                  const idx = nextIndex++;
                  const tBlock: TransportContentBlock = { type: "text", text: b.text, index: idx };
                  output.content.push(tBlock);
                  const ci = output.content.length - 1;
                  writable.push({ type: "text_start", contentIndex: ci, partial: output as never } as never);
                  if (b.text) {
                    writable.push({ type: "text_delta", contentIndex: ci, delta: b.text, partial: output as never } as never);
                  }
                  continue;
                }

                if (b.type === "tool_use") {
                  const idx = nextIndex++;
                  const argsObj = (b.input && typeof b.input === "object") ? (b.input as Record<string, unknown>) : {};
                  const tBlock: TransportContentBlock = {
                    type: "toolCall",
                    id: b.id ?? "",
                    name: b.name ?? "",
                    arguments: argsObj,
                    partialJson: JSON.stringify(argsObj),
                    index: idx,
                  };
                  output.content.push(tBlock);
                  const ci = output.content.length - 1;
                  writable.push({ type: "toolcall_start", contentIndex: ci, partial: output as never } as never);
                  writable.push({
                    type: "toolcall_delta",
                    contentIndex: ci,
                    delta: tBlock.partialJson,
                    partial: output as never,
                  } as never);
                  continue;
                }
                // Other content block types (image, document, etc) — skip silently for now
              }
              return;
            }

            // ── Result: final usage + stop reason ──
            if (evType === "result") {
              const e = event as {
                stop_reason?: string;
                total_cost_usd?: number;
                usage?: {
                  input_tokens?: number;
                  output_tokens?: number;
                  cache_read_input_tokens?: number;
                  cache_creation_input_tokens?: number;
                };
                session_id?: string;
              };
              if (e.stop_reason === "end_turn") output.stopReason = "stop";
              else if (e.stop_reason === "tool_use") output.stopReason = "toolUse";
              else if (e.stop_reason === "max_tokens") output.stopReason = "length";
              else if (e.stop_reason) output.stopReason = e.stop_reason;
              if (e.usage) {
                output.usage.input = e.usage.input_tokens ?? 0;
                output.usage.output = e.usage.output_tokens ?? 0;
                output.usage.cacheRead = e.usage.cache_read_input_tokens ?? 0;
                output.usage.cacheWrite = e.usage.cache_creation_input_tokens ?? 0;
                output.usage.totalTokens =
                  output.usage.input + output.usage.output + output.usage.cacheRead + output.usage.cacheWrite;
              }
              if (typeof e.total_cost_usd === "number") {
                // Distribute the total cost evenly across the four cost buckets
                output.usage.cost.total = e.total_cost_usd;
              }
              if (e.session_id && context.metadata) {
                context.metadata.claudeSessionId = e.session_id;
              }
              return;
            }

            // user (tool_result), system (init/hook_*), rate_limit_event — silently consumed
          },
        });

        finalizeTransportStream({ stream: writable, output, signal: options.signal });
      } catch (error) {
        failTransportStream({
          stream: writable,
          output,
          signal: options.signal,
          error,
          cleanup: () => {
            for (const block of output.content) {
              if ("index" in block) delete (block as { index?: number }).index;
            }
          },
        });
      }
    })();

    return eventStream as ReturnType<StreamFn>;
  }) as StreamFn;
}
