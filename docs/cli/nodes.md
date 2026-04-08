---
summary: "CLI reference for `alvasta-pro nodes` (status, pairing, invoke, camera/canvas/screen)"
read_when:
  - You’re managing paired nodes (cameras, screen, canvas)
  - You need to approve requests or invoke node commands
title: "nodes"
---

# `alvasta-pro nodes`

Manage paired nodes (devices) and invoke node capabilities.

Related:

- Nodes overview: [Nodes](/nodes)
- Camera: [Camera nodes](/nodes/camera)
- Images: [Image nodes](/nodes/images)

Common options:

- `--url`, `--token`, `--timeout`, `--json`

## Common commands

```bash
alvasta-pro nodes list
alvasta-pro nodes list --connected
alvasta-pro nodes list --last-connected 24h
alvasta-pro nodes pending
alvasta-pro nodes approve <requestId>
alvasta-pro nodes reject <requestId>
alvasta-pro nodes rename --node <id|name|ip> --name <displayName>
alvasta-pro nodes status
alvasta-pro nodes status --connected
alvasta-pro nodes status --last-connected 24h
```

`nodes list` prints pending/paired tables. Paired rows include the most recent connect age (Last Connect).
Use `--connected` to only show currently-connected nodes. Use `--last-connected <duration>` to
filter to nodes that connected within a duration (e.g. `24h`, `7d`).

Approval note:

- `alvasta-pro nodes pending` only needs pairing scope.
- `alvasta-pro nodes approve <requestId>` inherits extra scope requirements from the
  pending request:
  - commandless request: pairing only
  - non-exec node commands: pairing + write
  - `system.run` / `system.run.prepare` / `system.which`: pairing + admin

## Invoke

```bash
alvasta-pro nodes invoke --node <id|name|ip> --command <command> --params <json>
```

Invoke flags:

- `--params <json>`: JSON object string (default `{}`).
- `--invoke-timeout <ms>`: node invoke timeout (default `15000`).
- `--idempotency-key <key>`: optional idempotency key.
- `system.run` and `system.run.prepare` are blocked here; use the `exec` tool with `host=node` for shell execution.

For shell execution on a node, use the `exec` tool with `host=node` instead of `alvasta-pro nodes run`.
The `nodes` CLI is now capability-focused: direct RPC via `nodes invoke`, plus pairing, camera,
screen, location, canvas, and notifications.
