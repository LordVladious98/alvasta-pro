# Alvasta Pro

> **The Claude-faithful personal AI. Runs on your own machine. Uses your existing Claude Code OAuth. No API keys.**

Alvasta Pro is a fork of [openclaw](https://github.com/openclaw/openclaw) (MIT-licensed) with the LLM transport layer rewritten to use **Claude Code subprocess + OAuth** instead of the Anthropic SDK with API keys. The result is a heavyweight personal AI assistant with all of openclaw's capabilities (multi-channel messaging, image generation, voice, browser automation, native tools) — but powered by your existing Claude subscription, not your wallet.

Built in Melbourne by [Alvasta IT Solutions](https://alvasta.com.au).

---

## Why this exists

**OpenClaw** is a brilliant personal AI gateway. 23 channel adapters, native image generation, voice, browser automation, the works. But it was built around the Anthropic SDK pattern: you give it an API key, it bills your account directly. And in early 2026 the project was acquired and put under the OpenAI umbrella, putting the Claude-loyal user community in an awkward spot.

**Alvasta Pro** is the answer for users who:
- Already pay for Claude Pro / Claude Max
- Don't want a separate Anthropic API key
- Don't want their tools running on top of OpenAI infrastructure
- Want a working personal AI assistant on their own machine NOW, not after waiting for a partner OAuth approval that may never come

We fork openclaw, swap the LLM transport, and ride on top of Claude Code's existing OAuth flow.

---

## How it works

```
                ┌──────────────────────────────────────────────────┐
                │            ALVASTA PRO RUNTIME                   │
                │       (forked openclaw, ~13k files of TS)        │
                │                                                  │
                │   channels   ←→   gateway   ←→   agent loop      │
                │       │              │             │             │
                │       └──────────────┴─────────────┘             │
                │                      ↓                            │
                │       openclaw native tools (image, voice,        │
                │       browser, file ops, web fetch, etc.)         │
                │                      │                            │
                │              ┌───────┴───────┐                    │
                │              │               │                    │
                │   AlvastaToolHost      ClaudeCodeTransport        │
                │   (HTTP server)        (replaces Anthropic SDK)   │
                │       │                       │                    │
                └───────┼───────────────────────┼───────────────────┘
                        │                       │
                        │           spawns ───→ │
                        │                       ↓
                        │       ┌────────────────────────────┐
                        │       │   claude --print --print   │
                        │       │   --input-format=stream-json│
                        │       │   --mcp-config <bridge>    │
                        │       │                            │
                        │       │  Claude Code subprocess    │
                        │       │  (uses YOUR OAuth token    │
                        │       │   from your keychain)      │
                        │       └─────────────┬──────────────┘
                        │                     │
                        │             spawns child:
                        │                     ↓
                        │       ┌────────────────────────────┐
                        │       │  alvasta-mcp-bridge.mjs    │
                        │       │  (stdio MCP server)        │
                        │       │                            │
                        │       │  exposes openclaw tools to │
                        │       │  the spawned Claude Code   │
                        │       │  via the MCP protocol      │
                        │       └─────────────┬──────────────┘
                        │                     │
                        │           HTTP POST callback
                        ↓                     │
                ←───────┴─────────────────────┘
                    handler runs in
                    openclaw runtime
```

The flow:
1. A user message arrives via a channel (Telegram, Discord, web, voice, etc.)
2. openclaw's runtime routes it to the agent loop
3. The agent loop calls our `claude-code-transport-stream.ts` instead of the Anthropic SDK
4. The transport spawns `claude --print` as a subprocess with `--mcp-config` pointing at the Alvasta MCP bridge
5. Claude Code authenticates using your existing OAuth token from the keychain
6. The model runs the conversation, using either Claude Code's built-in tools (Bash, Read, Write, WebFetch) **or** openclaw's native tools (image gen, voice, etc.) via the MCP bridge
7. When the model calls an openclaw tool, the bridge POSTs to a local HTTP callback URL
8. The handler runs **inside the openclaw runtime process** (not in the bridge subprocess), so it has access to the gateway, sessions, and channel context
9. The result flows back through the chain to the model
10. The transport translates Claude Code's stream-json events into openclaw's expected event shape
11. The agent loop sees a normal text + tool_use response and completes the turn
12. The channel adapter sends the reply

**No API keys.** **No partner OAuth client_id.** **No Anthropic.com signup.** Just `claude setup-token` once, then everything works.

---

## Status

This is a fork in active development. As of v0.4-alpha:

| Layer | Status |
|---|---|
| Build on Linux ARM64 (Pi 5) | ✓ |
| `node openclaw.mjs --help` shows full CLI | ✓ |
| Replace Anthropic SDK with `claude --print` | ✓ |
| Stream-json events translation | ✓ |
| Tool use → openclaw events | ✓ |
| Real cost/usage from Anthropic billing | ✓ |
| Session resume (`--resume <sid>`) | ✓ |
| MCP bridge for openclaw tools | ✓ (v0.3) |
| Live tool registry via HTTP callback | ✓ (v0.4) |
| Wire openclaw's actual native tool registry | ⏳ v0.5 |
| Test through openclaw's full channel pipe | ⏳ v0.7 |
| Rebrand `openclaw` → `alvasta-pro` | ⏳ v0.6 |
| Documentation site | ⏳ v1.0 |
| npm publish | ⏳ v1.0 |

---

## Install (for developers)

```bash
git clone https://github.com/LordVladious98/alvasta-pro.git
cd alvasta-pro
npm install -g pnpm
pnpm install
pnpm canvas:a2ui:bundle
pnpm build:docker
node openclaw.mjs --help
```

You'll need:
- Node 22.12+
- pnpm 10+
- Claude Code installed and authenticated (`claude setup-token`)
- ~5 GB free disk for `node_modules`

Once a release is cut, install will be `npm install -g @alvasta/pro` (TBD).

---

## Configuration

Alvasta Pro uses `~/.alvasta-pro/` for its own config, alongside (not replacing) openclaw's own state at `~/.openclaw/`. After v0.6 rebranding, the openclaw paths will be removed.

The two state directories:

- `~/.alvasta-pro/alvasta-mcp.json` — MCP config that points Claude Code at our bridge
- `~/.alvasta-pro/tools-manifest.json` — Live tool registry written by the runtime, read by the bridge

---

## Companion: Alvasta Gateway

For users who want a **lean** version without openclaw's full surface area, see [alvasta-gateway](https://github.com/LordVladious98/alvasta-gateway). It's a from-scratch ~30-file implementation that covers ~70% of the openclaw use case (Telegram + Web channels, multi-session, voice in/out, PWA, daemon installer) with no fork dependency.

Use **Alvasta Gateway** if you want minimal code you can read in an afternoon.
Use **Alvasta Pro** if you want every openclaw feature on the Claude-faithful path.

---

## Credits

This is a hard fork of [openclaw](https://github.com/openclaw/openclaw) by the OpenClaw maintainers. All openclaw runtime code, channels, gateway architecture, and tooling are their work, used under the MIT license. The transport replacement layer (`src/agents/claude-code-transport-stream.ts`, `src/agents/alvasta-tool-host.ts`, `src/agents/alvasta-mcp-bridge.mjs`) and the rebranding are Alvasta IT Solutions.

If you're an openclaw maintainer reading this: huge respect for what you've built. We forked because the OAuth path matters for our specific user base, not because of any quality issue. We're happy to upstream the Claude Code transport if you'd like it back.

---

## License

MIT — same as upstream openclaw.

Copyright (c) 2026 OpenClaw maintainers (original work)
Copyright (c) 2026 Alvasta IT Solutions, Melbourne (transport, tool host, bridge, rebranding)
