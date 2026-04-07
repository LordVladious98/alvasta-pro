/**
 * Claude Code subprocess transport stream.
 *
 * Replaces the Anthropic SDK call path with a `claude --print` subprocess so
 * the entire openclaw / Alvasta Pro runtime uses Claude Code OAuth via the
 * existing Claude Code keychain — no API keys, no Anthropic partner OAuth
 * client_id needed.
 *
 * v0.1 SCOPE (minimal proof-of-concept):
 *   - text-in → text-out only
 *   - emits start → text_start → text_delta(full) → done
 *   - no tool_use support yet (the agent loop will be limited to single-turn
 *     replies, but this proves the wiring works)
 *   - no thinking blocks
 *   - no streaming (gathers full response then emits as one delta)
 *
 * v0.2 TODO:
 *   - parse stream-json events from Claude Code (--input-format=stream-json
 *     --output-format=stream-json --verbose)
 *   - translate tool_use events from Claude Code's MCP-tool format to
 *     openclaw's toolCall events
 *   - bridge openclaw's tool registry to Claude Code via an MCP server
 *     so claude --print can actually invoke openclaw's native tools
 *   - thinking block support
 *   - cost estimation
 */

import { spawn } from "node:child_process";
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
  | {
      type: "text";
      text: string;
      index: number;
    }
  | {
      type: "thinking";
      thinking: string;
      thinkingSignature: string;
      index: number;
    }
  | {
      type: "toolCall";
      id: string;
      name: string;
      arguments: Record<string, unknown>;
      partialJson: string;
      index: number;
    };

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
  messages: Array<{
    role: string;
    content?: unknown;
  }>;
  systemPrompt?: string;
  tools?: unknown;
}

interface InferModel {
  id?: string;
  provider?: string;
}

/**
 * Extract the last user-text from openclaw's Context messages array.
 * v0.1 — only handles plain text, not multi-modal or tool_result blocks.
 */
function extractLastUserText(messages: InferContext["messages"]): string {
  // Walk backwards to find the latest user message
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "user") continue;
    if (typeof msg.content === "string") return msg.content;
    if (Array.isArray(msg.content)) {
      const parts: string[] = [];
      for (const block of msg.content) {
        if (block && typeof block === "object" && "type" in block) {
          const b = block as { type: string; text?: string };
          if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
        }
      }
      if (parts.length > 0) return parts.join("\n");
    }
  }
  return "";
}

/**
 * Spawn `claude --print <prompt>` and capture the full text response.
 * Returns the response or throws on error.
 */
async function runClaudeCode(
  prompt: string,
  systemPrompt: string,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      "--print",
      "--dangerously-skip-permissions",
      "--system-prompt",
      systemPrompt,
      prompt,
    ];

    const child = spawn("claude", args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: IS_WINDOWS,
      windowsHide: true,
      signal,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (err: Error) => {
      reject(new Error(`claude spawn failed: ${err.message}`));
    });
    child.on("exit", (code: number | null, sig: NodeJS.Signals | null) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(
          new Error(
            `claude exited with code=${code} signal=${sig}: ${stderr.slice(0, 500) || "no stderr"}`,
          ),
        );
      }
    });
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

      try {
        const userText = extractLastUserText(context.messages);
        if (!userText) {
          throw new Error("No user message in context");
        }

        const systemPrompt =
          (context.systemPrompt ? `${ALVASTA_PERSONA}\n\n${context.systemPrompt}` : ALVASTA_PERSONA);

        // Begin the stream
        (stream as WritableTransportStream).push({
          type: "start",
          partial: output as never,
        });

        // Spawn claude and wait for the full response
        const responseText = await runClaudeCode(userText, systemPrompt, options.signal);

        // Push it as a single text block
        const block: TransportContentBlock = {
          type: "text",
          text: responseText,
          index: 0,
        };
        output.content.push(block);

        (stream as WritableTransportStream).push({
          type: "text_start",
          contentIndex: 0,
          partial: output as never,
        } as never);

        (stream as WritableTransportStream).push({
          type: "text_delta",
          contentIndex: 0,
          delta: responseText,
          partial: output as never,
        } as never);

        // Estimate usage roughly from character counts (v0.1 — replace with
        // actual usage from stream-json events in v0.2)
        const inputChars = userText.length + systemPrompt.length;
        const outputChars = responseText.length;
        output.usage.input = Math.ceil(inputChars / 4); // ~4 chars per token
        output.usage.output = Math.ceil(outputChars / 4);
        output.usage.totalTokens = output.usage.input + output.usage.output;

        finalizeTransportStream({
          stream: stream as WritableTransportStream,
          output,
          signal: options.signal,
        });
      } catch (error) {
        failTransportStream({
          stream: stream as WritableTransportStream,
          output,
          signal: options.signal,
          error,
          cleanup: () => {
            for (const block of output.content) {
              if ("index" in block) {
                delete (block as { index?: number }).index;
              }
            }
          },
        });
      }
    })();

    return eventStream as ReturnType<StreamFn>;
  }) as StreamFn;
}
