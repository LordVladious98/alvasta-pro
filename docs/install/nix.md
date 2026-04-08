---
summary: "Install Alvasta Pro declaratively with Nix"
read_when:
  - You want reproducible, rollback-able installs
  - You're already using Nix/NixOS/Home Manager
  - You want everything pinned and managed declaratively
title: "Nix"
---

# Nix Installation

Install Alvasta Pro declaratively with **[nix-alvasta-pro](https://github.com/alvasta-pro/nix-alvasta-pro)** -- a batteries-included Home Manager module.

<Info>
The [nix-alvasta-pro](https://github.com/alvasta-pro/nix-alvasta-pro) repo is the source of truth for Nix installation. This page is a quick overview.
</Info>

## What You Get

- Gateway + macOS app + tools (whisper, spotify, cameras) -- all pinned
- Launchd service that survives reboots
- Plugin system with declarative config
- Instant rollback: `home-manager switch --rollback`

## Quick Start

<Steps>
  <Step title="Install Determinate Nix">
    If Nix is not already installed, follow the [Determinate Nix installer](https://github.com/DeterminateSystems/nix-installer) instructions.
  </Step>
  <Step title="Create a local flake">
    Use the agent-first template from the nix-alvasta-pro repo:
    ```bash
    mkdir -p ~/code/alvasta-pro-local
    # Copy templates/agent-first/flake.nix from the nix-alvasta-pro repo
    ```
  </Step>
  <Step title="Configure secrets">
    Set up your messaging bot token and model provider API key. Plain files at `~/.secrets/` work fine.
  </Step>
  <Step title="Fill in template placeholders and switch">
    ```bash
    home-manager switch
    ```
  </Step>
  <Step title="Verify">
    Confirm the launchd service is running and your bot responds to messages.
  </Step>
</Steps>

See the [nix-alvasta-pro README](https://github.com/alvasta-pro/nix-alvasta-pro) for full module options and examples.

## Nix Mode Runtime Behavior

When `OPENCLAW_NIX_MODE=1` is set (automatic with nix-alvasta-pro), Alvasta Pro enters a deterministic mode that disables auto-install flows.

You can also set it manually:

```bash
export OPENCLAW_NIX_MODE=1
```

On macOS, the GUI app does not automatically inherit shell environment variables. Enable Nix mode via defaults instead:

```bash
defaults write ai.alvasta-pro.mac alvasta-pro.nixMode -bool true
```

### What changes in Nix mode

- Auto-install and self-mutation flows are disabled
- Missing dependencies surface Nix-specific remediation messages
- UI surfaces a read-only Nix mode banner

### Config and state paths

Alvasta Pro reads JSON5 config from `OPENCLAW_CONFIG_PATH` and stores mutable data in `OPENCLAW_STATE_DIR`. When running under Nix, set these explicitly to Nix-managed locations so runtime state and config stay out of the immutable store.

| Variable               | Default                                 |
| ---------------------- | --------------------------------------- |
| `OPENCLAW_HOME`        | `HOME` / `USERPROFILE` / `os.homedir()` |
| `OPENCLAW_STATE_DIR`   | `~/.alvasta-pro`                           |
| `OPENCLAW_CONFIG_PATH` | `$OPENCLAW_STATE_DIR/alvasta-pro.json`     |

## Related

- [nix-alvasta-pro](https://github.com/alvasta-pro/nix-alvasta-pro) -- full setup guide
- [Wizard](/start/wizard) -- non-Nix CLI setup
- [Docker](/install/docker) -- containerized setup
