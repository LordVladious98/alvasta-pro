---
summary: "CLI reference for `alvasta-pro uninstall` (remove gateway service + local data)"
read_when:
  - You want to remove the gateway service and/or local state
  - You want a dry-run first
title: "uninstall"
---

# `alvasta-pro uninstall`

Uninstall the gateway service + local data (CLI remains).

Options:

- `--service`: remove the gateway service
- `--state`: remove state and config
- `--workspace`: remove workspace directories
- `--app`: remove the macOS app
- `--all`: remove service, state, workspace, and app
- `--yes`: skip confirmation prompts
- `--non-interactive`: disable prompts; requires `--yes`
- `--dry-run`: print actions without removing files

Examples:

```bash
alvasta-pro backup create
alvasta-pro uninstall
alvasta-pro uninstall --service --yes --non-interactive
alvasta-pro uninstall --state --workspace --yes --non-interactive
alvasta-pro uninstall --all --yes
alvasta-pro uninstall --dry-run
```

Notes:

- Run `alvasta-pro backup create` first if you want a restorable snapshot before removing state or workspaces.
- `--all` is shorthand for removing service, state, workspace, and app together.
- `--non-interactive` requires `--yes`.
