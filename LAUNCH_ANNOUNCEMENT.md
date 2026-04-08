# Launch Announcement Drafts — Alvasta Pro v1.0

Three draft formats for the v1.0 launch. Pick one or mix.

---

## Hacker News — Show HN post

**Title:** Show HN: Alvasta Pro – a Claude-faithful openclaw fork that uses Claude Code OAuth

**URL:** https://github.com/LordVladious98/alvasta-pro

**Text:**

Alvasta Pro is a hard fork of openclaw with the Anthropic SDK call path replaced by a `claude --print` subprocess, so every inference uses your existing Claude Code OAuth token from your keychain instead of an API key.

Background: openclaw is a brilliant multi-channel personal AI gateway — 23 channel adapters, plugins, agent loop, ~50 CLI commands — but it's built around the standard Anthropic SDK + API key pattern. If you already pay for Claude Pro / Claude Max and don't want a separate Anthropic API key, you're stuck.

The fix turned out to be surprisingly clean: replace one TypeScript file (`src/agents/anthropic-transport-stream.ts`) with a subprocess shim that spawns `claude --print --input-format=stream-json --output-format=stream-json --verbose --dangerously-skip-permissions`, parses the stream events, and translates them back to the shape openclaw's runtime expects.

The trickier part was bridging tools the other direction: openclaw has a bunch of native tools (image generation, web search, cron scheduling, TTS, browser automation via plugins) that the spawned claude subprocess needs to be able to call. Solved with:

1. An HTTP tool host running in the openclaw runtime process (random port, per-process secret in the URL)
2. A stdio MCP server (`alvasta-mcp-bridge.mjs`) that `claude --print` loads via `--mcp-config`
3. The bridge reads the manifest, exposes tools via the MCP protocol, and routes `tools/call` requests back to the host over HTTP

Result: the spawned claude subprocess sees `openclaw_web_search`, `openclaw_image_generate`, etc. as first-class tools and can call them. The actual handler runs in the openclaw runtime process where it has all the session context.

Everything is verified end-to-end with six contract tests (text transport, stream-json events, MCP bridge stub, live tool host, openclaw tool adapter, provider chokepoint integration). Gateway boots cleanly with 6 plugins loaded.

Known limitations documented in the release notes — in short, the rebrand is skin-deep (the internal `OpenClawConfig` type name still exists, env vars still say `OPENCLAW_*`), and npm publish is deferred because `pnpm prepack` fails on arm64 for the amazon-bedrock plugin. v1.0 ships as a git-clone install.

Tech: TypeScript, Node 22.12+, pnpm, rolldown build. ~300 lines of new code for the transport, ~180 for the tool host, ~180 for the MCP bridge, ~280 for the adapter. The rest is upstream openclaw.

Built in Melbourne by [Alvasta IT Solutions](https://alvasta.com.au). MIT licensed. Happy to upstream the Claude Code transport if the openclaw maintainers want it back.

---

## Twitter / X thread

**1/** Just shipped Alvasta Pro v1.0 — a hard fork of @openclaw that uses your existing Claude Code OAuth token instead of a separate Anthropic API key.

If you pay for Claude Pro/Max and don't want to also pay for the API, this is for you.

github.com/LordVladious98/alvasta-pro

**2/** The core trick: replace the Anthropic SDK call path with a `claude --print` subprocess shim. Every inference spawns claude, parses its stream-json output, translates back to openclaw's event format.

~300 lines of TypeScript. No API keys anywhere.

**3/** Harder problem: openclaw has native tools (image gen, voice, browser automation, cron, TTS...) that the spawned claude subprocess needs to call.

Solution: HTTP tool host in the runtime + stdio MCP bridge the subprocess loads via --mcp-config + manifest with per-tool callback URLs.

**4/** The spawned claude sees `openclaw_web_search`, `openclaw_image_generate` etc as first-class tools. When it calls one, the bridge POSTs to the callback URL. The handler runs IN the openclaw runtime process where it has all the session context.

Bidirectional bridge, zero API keys.

**5/** 6 contract tests verify every layer end-to-end:
✓ text in/out
✓ stream-json events
✓ tool_use translation
✓ MCP bridge
✓ live tool host
✓ openclaw tool registry adapter

Gateway boots clean w/ 6 plugins.

**6/** Built in Melbourne 🇦🇺. MIT licensed. Install:

```
curl -fsSL https://raw.githubusercontent.com/LordVladious98/alvasta-pro/main/install.sh | bash
```

v1.1 adds npm publish + full Windows/Mac verification.

⚡ alvasta.com.au

---

## Anthropic Discord / community post

**Title:** Alvasta Pro — a Claude-faithful openclaw fork

Hey all,

Just released v1.0 of Alvasta Pro, a hard fork of openclaw that replaces the Anthropic SDK call path with a `claude --print` subprocess shim so every inference uses your existing Claude Code OAuth token.

**Why this exists**

openclaw is a fantastic personal AI gateway (23 channels, plugins, agent loop, 50+ CLI commands), but it's built around the standard Anthropic API key pattern. If you're already paying for Claude Pro or Claude Max, a separate API key is friction + extra cost. Alvasta Pro plugs that gap.

**How it works**

- `claude-code-transport-stream.ts` replaces the Anthropic SDK call in `provider-transport-stream.ts` for the `anthropic-messages` case
- Spawns `claude --print --input-format=stream-json --output-format=stream-json --verbose --dangerously-skip-permissions --system-prompt <alvasta-persona>` per inference
- Parses stream-json events and translates them to openclaw's expected shape (text deltas, tool_use, usage, done)
- Real usage and cost reported from Anthropic billing (shown in openclaw's UI)
- Session resume via `--resume <session_id>`

**Tool bridge (the harder part)**

openclaw's native tools (image_generate, web_search, cron, tts, etc.) need to be callable from inside the spawned subprocess.

Solution:
1. HTTP tool host runs in the openclaw runtime process — exposes tools via a per-process secret in the URL path, POST `/secret/tools/<name>` to call
2. `alvasta-mcp-bridge.mjs` is a stdio MCP server the claude subprocess loads via `--mcp-config`, reads a manifest file with tool definitions + callback URLs
3. When the model calls a bridged tool, the bridge POSTs to the callback URL and the handler runs in the openclaw runtime

Verified with 6 contract tests. Gateway boots cleanly with 6 plugins loaded.

**Install**

```bash
curl -fsSL https://raw.githubusercontent.com/LordVladious98/alvasta-pro/main/install.sh | bash
```

Prerequisites: Node 22.12+, pnpm, git, Claude Code (`claude setup-token`).

**Status**

v1.0 is git-clone install only (npm publish deferred because `pnpm prepack` fails on arm64 for the amazon-bedrock plugin). Tested on Linux ARM64. Windows and macOS should work — same cross-platform code paths as the lean sibling project `alvasta-gateway` — but not verified yet on this release.

**Happy to contribute upstream**

If the openclaw maintainers want the Claude Code transport back, we'd love to upstream it. The fork is MIT-licensed (same as upstream). Full release notes: [link to RELEASE_NOTES.alvasta-pro-v1.0.md]

Built in Melbourne by [Alvasta IT Solutions](https://alvasta.com.au).

⚡

---

## One-liner for any channel

> ⚡ Alvasta Pro v1.0 — openclaw fork that uses your Claude Code OAuth token instead of an API key. Spawn `claude --print` per inference, HTTP tool host bridges openclaw's native tools back via MCP. 6 contract tests green. MIT. Built in Melbourne. github.com/LordVladious98/alvasta-pro
