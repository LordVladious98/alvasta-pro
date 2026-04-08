# Alvasta Pro v1.0 — Release Notes

**Release date:** 2026-04-08
**Tag:** `v2026.5.0-alvasta.1`
**Upstream base:** openclaw `2026.4.6`

---

## What is Alvasta Pro?

Alvasta Pro is a hard fork of [openclaw](https://github.com/openclaw/openclaw) with the Anthropic SDK call path replaced by a **Claude Code subprocess transport**. The practical result: every Anthropic inference in the openclaw runtime now uses the user's existing Claude Code OAuth token from their keychain instead of an API key.

The architecture bet: openclaw is brilliant infrastructure (multi-channel gateway, plugins, agent loop, 23 channel adapters, 50+ CLI commands). What it lacks is a path for users who already pay for Claude Pro / Claude Max and don't want a separate Anthropic API key. Alvasta Pro plugs that gap by spawning `claude --print` as a subprocess every time openclaw's runtime needs inference.

Built in Melbourne by [Alvasta IT Solutions](https://alvasta.com.au).

---

## Headline changes from upstream

### 1. Anthropic SDK → `claude --print` subprocess
Every `anthropic-messages` inference now spawns a `claude --print` child process and streams events back. The user's Claude Code OAuth token (from `claude setup-token`) handles auth. No API keys are set anywhere in the fork.

Files added:
- `src/agents/claude-code-transport-stream.ts` (~290 LOC) — spawns claude, translates stream-json events to openclaw's transport format, supports session resume via `context.metadata.claudeSessionId`
- `src/agents/alvasta-tool-host.ts` (~180 LOC) — HTTP server that exposes openclaw's native tools to the spawned subprocess
- `src/agents/alvasta-mcp-bridge.mjs` (~180 LOC) — stdio MCP server the subprocess loads via `--mcp-config`; routes tool calls back to the tool host via HTTP callback URLs
- `src/agents/alvasta-bridge-openclaw-tools.ts` (~280 LOC) — adapter that converts openclaw `AnyAgentTool[]` to the tool host's shape

Wiring:
- `src/agents/provider-transport-stream.ts` — the `anthropic-messages` case returns `createClaudeCodeTransportStreamFn()` instead of `createAnthropicMessagesTransportStreamFn()` (gated on `ALVASTA_USE_SDK=1` env var for debugging)
- `src/agents/pi-tools.ts` — calls `registerToolArray(withDeferredFollowupDescriptions)` at the end of the tool assembly function, so every native openclaw tool is exposed to the spawned subprocess via MCP

### 2. Brand-visible rebrand (v0.6)
The CLI, package metadata, banner, taglines, README, and 553 markdown files (docs/, skills/, extensions/) now say "Alvasta Pro" instead of "OpenClaw". The lobster emoji and crab jokes are gone. 7,106 brand mentions rewritten in a single sweep while preserving:
- `LICENSE` file (MIT requires original copyright retention)
- `OpenClawConfig` TypeScript type identifier (load-bearing in 1,308 files)
- `@openclaw/*` npm package imports (external dependencies)
- `OPENCLAW_*` environment variable names (backward compat for upgraders)
- `ai.openclaw.*` daemon service labels (would orphan existing installs)

Alvasta Pro daemon label constants (`ALVASTA_PRO_GATEWAY_LAUNCH_AGENT_LABEL`, etc.) are exported alongside for future wiring.

### 3. Version bump: `2026.5.0-alvasta.1`
Semver-higher than upstream `2026.4.6` so bundled plugins' `>=2026.4.6` compatibility constraint passes. The `-alvasta.1` suffix identifies this as our fork's prerelease track.

### 4. Install script
`install.sh` clones, installs dependencies, bundles the A2UI canvas, runs `pnpm build:docker`, and smoke-tests the CLI. One command on Linux/macOS:
```bash
curl -fsSL https://raw.githubusercontent.com/LordVladious98/alvasta-pro/main/install.sh | bash
```

---

## Verified end-to-end

Six contract tests prove the transport wiring at every layer, all passing on Linux ARM64:

| Test | What it verifies |
|---|---|
| `test-transport.ts` (v0.1) | text-in → text-out via `claude --print` |
| `test-transport-v2.ts` (v0.2) | stream-json events, tool_use translation, real usage from Anthropic billing |
| `test-transport-v3.ts` (v0.3) | MCP bridge exposes tools to spawned claude |
| `test-transport-v4.ts` (v0.4) | live tool host via HTTP callback — handler runs in openclaw process |
| `test-transport-v5.ts` (v0.5) | `createOpenClawTools()` output bridged to MCP host end-to-end |
| `test-transport-v7.ts` (v0.7) | `createBoundaryAwareStreamFnForModel()` chokepoint routes through our transport |

Gateway boot also verified (`node openclaw.mjs gateway run --port 19001`):
- 6 plugins loaded cleanly
- Canvas host mounted
- MCP loopback server listening
- Ready in ~20 seconds
- No plugin compatibility warnings

---

## Known limitations (v1.0)

**1. Not yet published to npm.**
`pnpm prepack` runs a full plugin runtime deps staging that fails on ARM64 (amazon-bedrock plugin doesn't ship arm64 prebuilds). v1.0 ships as a git-clone install via `install.sh`. npm publish is deferred to v1.1 after fixing the prepack for arm.

**2. `OpenClawConfig` type identifier not renamed.**
1,308 files reference it. Users never see it — it's internal TypeScript. Cosmetic-only rename with high cascade risk. Parked.

**3. `OPENCLAW_*` environment variables not renamed.**
User-facing config. Backward-compatible renaming (accept both names) is possible but adds complexity for zero UX benefit. Parked.

**4. Daemon service labels still say `openclaw-gateway`.**
Alvasta Pro alternatives are exported as constants but not yet wired into `systemd.ts` / `launchd.ts` / `schtasks.ts` because the wiring requires updating ~20 test files with hardcoded expectations. Parked for v1.1 with backward-compat so existing `openclaw-gateway` installs keep working.

**5. CLI commands that require gateway daemon may hang on first boot.**
Commands like `openclaw capability list` assume a gateway is already running. The gateway boots cleanly via `openclaw gateway run`, but the inter-command handshake with an existing gateway occasionally hangs. Not an Alvasta-introduced issue (reproduces without the fork changes), but worth documenting.

**6. Cross-platform verification is Linux-only.**
Tested on Linux ARM64 (Raspberry Pi 5). The code uses cross-platform Node primitives and `IS_WINDOWS` branches copied from the lean `alvasta-gateway` sibling project, so Windows and macOS should work. Not verified on those platforms yet.

---

## Who should use this

- **Claude Pro / Claude Max subscribers** who want openclaw's surface area without an additional Anthropic API key
- **Claude-loyal power users** orphaned by openclaw's rumored OpenAI alignment
- **Melbourne / Australian users** who want a product backed by a local IT consultancy
- **Developers** who want a ~10-file bridge layer they can read in an hour, plus the full openclaw runtime underneath

---

## Install

```bash
# One-line install (Linux/macOS):
curl -fsSL https://raw.githubusercontent.com/LordVladious98/alvasta-pro/main/install.sh | bash

# Manual install:
git clone https://github.com/LordVladious98/alvasta-pro.git ~/alvasta-pro
cd ~/alvasta-pro
pnpm install
pnpm canvas:a2ui:bundle
pnpm build:docker
node openclaw.mjs --help
```

Prerequisites: Node 22.12+, pnpm, git, Claude Code (`npm install -g @anthropic-ai/claude-code && claude setup-token`).

---

## Thank you

Huge respect to the OpenClaw maintainers for building the runtime we're forking. MIT license + deep architectural care = a fork like this is even possible. If you're one of them and want the Claude Code transport merged upstream, we're happy to contribute it.

Alvasta Pro is MIT-licensed. Fork it, break it, improve it.

Built in Melbourne. ⚡
