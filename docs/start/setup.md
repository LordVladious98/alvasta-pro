---
summary: "Advanced setup and development workflows for Alvasta Pro"
read_when:
  - Setting up a new machine
  - You want “latest + greatest” without breaking your personal setup
title: "Setup"
---

# Setup

<Note>
If you are setting up for the first time, start with [Getting Started](/start/getting-started).
For onboarding details, see [Onboarding (CLI)](/start/wizard).
</Note>

## TL;DR

- **Tailoring lives outside the repo:** `~/.alvasta-pro/workspace` (workspace) + `~/.alvasta-pro/alvasta-pro.json` (config).
- **Stable workflow:** install the macOS app; let it run the bundled Gateway.
- **Bleeding edge workflow:** run the Gateway yourself via `pnpm gateway:watch`, then let the macOS app attach in Local mode.

## Prereqs (from source)

- Node 24 recommended (Node 22 LTS, currently `22.14+`, still supported)
- `pnpm` preferred (or Bun if you intentionally use the [Bun workflow](/install/bun))
- Docker (optional; only for containerized setup/e2e — see [Docker](/install/docker))

## Tailoring strategy (so updates do not hurt)

If you want “100% tailored to me” _and_ easy updates, keep your customization in:

- **Config:** `~/.alvasta-pro/alvasta-pro.json` (JSON/JSON5-ish)
- **Workspace:** `~/.alvasta-pro/workspace` (skills, prompts, memories; make it a private git repo)

Bootstrap once:

```bash
alvasta-pro setup
```

From inside this repo, use the local CLI entry:

```bash
alvasta-pro setup
```

If you don’t have a global install yet, run it via `pnpm alvasta-pro setup` (or `bun run alvasta-pro setup` if you are using the Bun workflow).

## Run the Gateway from this repo

After `pnpm build`, you can run the packaged CLI directly:

```bash
node alvasta-pro.mjs gateway --port 18789 --verbose
```

## Stable workflow (macOS app first)

1. Install + launch **Alvasta Pro.app** (menu bar).
2. Complete the onboarding/permissions checklist (TCC prompts).
3. Ensure Gateway is **Local** and running (the app manages it).
4. Link surfaces (example: WhatsApp):

```bash
alvasta-pro channels login
```

5. Sanity check:

```bash
alvasta-pro health
```

If onboarding is not available in your build:

- Run `alvasta-pro setup`, then `alvasta-pro channels login`, then start the Gateway manually (`alvasta-pro gateway`).

## Bleeding edge workflow (Gateway in a terminal)

Goal: work on the TypeScript Gateway, get hot reload, keep the macOS app UI attached.

### 0) (Optional) Run the macOS app from source too

If you also want the macOS app on the bleeding edge:

```bash
./scripts/restart-mac.sh
```

### 1) Start the dev Gateway

```bash
pnpm install
pnpm gateway:watch
```

`gateway:watch` runs the gateway in watch mode and reloads on relevant source,
config, and bundled-plugin metadata changes.

If you are intentionally using the Bun workflow, the equivalent commands are:

```bash
bun install
bun run gateway:watch
```

### 2) Point the macOS app at your running Gateway

In **Alvasta Pro.app**:

- Connection Mode: **Local**
  The app will attach to the running gateway on the configured port.

### 3) Verify

- In-app Gateway status should read **“Using existing gateway …”**
- Or via CLI:

```bash
alvasta-pro health
```

### Common footguns

- **Wrong port:** Gateway WS defaults to `ws://127.0.0.1:18789`; keep app + CLI on the same port.
- **Where state lives:**
  - Channel/provider state: `~/.alvasta-pro/credentials/`
  - Model auth profiles: `~/.alvasta-pro/agents/<agentId>/agent/auth-profiles.json`
  - Sessions: `~/.alvasta-pro/agents/<agentId>/sessions/`
  - Logs: `/tmp/alvasta-pro/`

## Credential storage map

Use this when debugging auth or deciding what to back up:

- **WhatsApp**: `~/.alvasta-pro/credentials/whatsapp/<accountId>/creds.json`
- **Telegram bot token**: config/env or `channels.telegram.tokenFile` (regular file only; symlinks rejected)
- **Discord bot token**: config/env or SecretRef (env/file/exec providers)
- **Slack tokens**: config/env (`channels.slack.*`)
- **Pairing allowlists**:
  - `~/.alvasta-pro/credentials/<channel>-allowFrom.json` (default account)
  - `~/.alvasta-pro/credentials/<channel>-<accountId>-allowFrom.json` (non-default accounts)
- **Model auth profiles**: `~/.alvasta-pro/agents/<agentId>/agent/auth-profiles.json`
- **File-backed secrets payload (optional)**: `~/.alvasta-pro/secrets.json`
- **Legacy OAuth import**: `~/.alvasta-pro/credentials/oauth.json`
  More detail: [Security](/gateway/security#credential-storage-map).

## Updating (without wrecking your setup)

- Keep `~/.alvasta-pro/workspace` and `~/.alvasta-pro/` as “your stuff”; don’t put personal prompts/config into the `alvasta-pro` repo.
- Updating source: `git pull` + your chosen package-manager install step (`pnpm install` by default; `bun install` for Bun workflow) + keep using the matching `gateway:watch` command.

## Linux (systemd user service)

Linux installs use a systemd **user** service. By default, systemd stops user
services on logout/idle, which kills the Gateway. Onboarding attempts to enable
lingering for you (may prompt for sudo). If it’s still off, run:

```bash
sudo loginctl enable-linger $USER
```

For always-on or multi-user servers, consider a **system** service instead of a
user service (no lingering needed). See [Gateway runbook](/gateway) for the systemd notes.

## Related docs

- [Gateway runbook](/gateway) (flags, supervision, ports)
- [Gateway configuration](/gateway/configuration) (config schema + examples)
- [Discord](/channels/discord) and [Telegram](/channels/telegram) (reply tags + replyToMode settings)
- [Alvasta Pro assistant setup](/start/alvasta-pro)
- [macOS app](/platforms/macos) (gateway lifecycle)
