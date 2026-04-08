---
summary: "CLI reference for `alvasta-pro pairing` (approve/list pairing requests)"
read_when:
  - You’re using pairing-mode DMs and need to approve senders
title: "pairing"
---

# `alvasta-pro pairing`

Approve or inspect DM pairing requests (for channels that support pairing).

Related:

- Pairing flow: [Pairing](/channels/pairing)

## Commands

```bash
alvasta-pro pairing list telegram
alvasta-pro pairing list --channel telegram --account work
alvasta-pro pairing list telegram --json

alvasta-pro pairing approve <code>
alvasta-pro pairing approve telegram <code>
alvasta-pro pairing approve --channel telegram --account work <code> --notify
```

## `pairing list`

List pending pairing requests for one channel.

Options:

- `[channel]`: positional channel id
- `--channel <channel>`: explicit channel id
- `--account <accountId>`: account id for multi-account channels
- `--json`: machine-readable output

Notes:

- If multiple pairing-capable channels are configured, you must provide a channel either positionally or with `--channel`.
- Extension channels are allowed as long as the channel id is valid.

## `pairing approve`

Approve a pending pairing code and allow that sender.

Usage:

- `alvasta-pro pairing approve <channel> <code>`
- `alvasta-pro pairing approve --channel <channel> <code>`
- `alvasta-pro pairing approve <code>` when exactly one pairing-capable channel is configured

Options:

- `--channel <channel>`: explicit channel id
- `--account <accountId>`: account id for multi-account channels
- `--notify`: send a confirmation back to the requester on the same channel

## Notes

- Channel input: pass it positionally (`pairing list telegram`) or with `--channel <channel>`.
- `pairing list` supports `--account <accountId>` for multi-account channels.
- `pairing approve` supports `--account <accountId>` and `--notify`.
- If only one pairing-capable channel is configured, `pairing approve <code>` is allowed.
