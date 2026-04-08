---
summary: "Uninstall Alvasta Pro completely (CLI, service, state, workspace)"
read_when:
  - You want to remove Alvasta Pro from a machine
  - The gateway service is still running after uninstall
title: "Uninstall"
---

# Uninstall

Two paths:

- **Easy path** if `alvasta-pro` is still installed.
- **Manual service removal** if the CLI is gone but the service is still running.

## Easy path (CLI still installed)

Recommended: use the built-in uninstaller:

```bash
alvasta-pro uninstall
```

Non-interactive (automation / npx):

```bash
alvasta-pro uninstall --all --yes --non-interactive
npx -y alvasta-pro uninstall --all --yes --non-interactive
```

Manual steps (same result):

1. Stop the gateway service:

```bash
alvasta-pro gateway stop
```

2. Uninstall the gateway service (launchd/systemd/schtasks):

```bash
alvasta-pro gateway uninstall
```

3. Delete state + config:

```bash
rm -rf "${OPENCLAW_STATE_DIR:-$HOME/.alvasta-pro}"
```

If you set `OPENCLAW_CONFIG_PATH` to a custom location outside the state dir, delete that file too.

4. Delete your workspace (optional, removes agent files):

```bash
rm -rf ~/.alvasta-pro/workspace
```

5. Remove the CLI install (pick the one you used):

```bash
npm rm -g alvasta-pro
pnpm remove -g alvasta-pro
bun remove -g alvasta-pro
```

6. If you installed the macOS app:

```bash
rm -rf /Applications/Alvasta Pro.app
```

Notes:

- If you used profiles (`--profile` / `OPENCLAW_PROFILE`), repeat step 3 for each state dir (defaults are `~/.alvasta-pro-<profile>`).
- In remote mode, the state dir lives on the **gateway host**, so run steps 1-4 there too.

## Manual service removal (CLI not installed)

Use this if the gateway service keeps running but `alvasta-pro` is missing.

### macOS (launchd)

Default label is `ai.alvasta-pro.gateway` (or `ai.alvasta-pro.<profile>`; legacy `com.alvasta-pro.*` may still exist):

```bash
launchctl bootout gui/$UID/ai.alvasta-pro.gateway
rm -f ~/Library/LaunchAgents/ai.alvasta-pro.gateway.plist
```

If you used a profile, replace the label and plist name with `ai.alvasta-pro.<profile>`. Remove any legacy `com.alvasta-pro.*` plists if present.

### Linux (systemd user unit)

Default unit name is `alvasta-pro-gateway.service` (or `alvasta-pro-gateway-<profile>.service`):

```bash
systemctl --user disable --now alvasta-pro-gateway.service
rm -f ~/.config/systemd/user/alvasta-pro-gateway.service
systemctl --user daemon-reload
```

### Windows (Scheduled Task)

Default task name is `Alvasta Pro Gateway` (or `Alvasta Pro Gateway (<profile>)`).
The task script lives under your state dir.

```powershell
schtasks /Delete /F /TN "Alvasta Pro Gateway"
Remove-Item -Force "$env:USERPROFILE\.alvasta-pro\gateway.cmd"
```

If you used a profile, delete the matching task name and `~\.alvasta-pro-<profile>\gateway.cmd`.

## Normal install vs source checkout

### Normal install (install.sh / npm / pnpm / bun)

If you used `https://alvasta-pro.ai/install.sh` or `install.ps1`, the CLI was installed with `npm install -g alvasta-pro@latest`.
Remove it with `npm rm -g alvasta-pro` (or `pnpm remove -g` / `bun remove -g` if you installed that way).

### Source checkout (git clone)

If you run from a repo checkout (`git clone` + `alvasta-pro ...` / `bun run alvasta-pro ...`):

1. Uninstall the gateway service **before** deleting the repo (use the easy path above or manual service removal).
2. Delete the repo directory.
3. Remove state + workspace as shown above.
