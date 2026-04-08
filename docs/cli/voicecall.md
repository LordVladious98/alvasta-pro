---
summary: "CLI reference for `alvasta-pro voicecall` (voice-call plugin command surface)"
read_when:
  - You use the voice-call plugin and want the CLI entry points
  - You want quick examples for `voicecall call|continue|status|tail|expose`
title: "voicecall"
---

# `alvasta-pro voicecall`

`voicecall` is a plugin-provided command. It only appears if the voice-call plugin is installed and enabled.

Primary doc:

- Voice-call plugin: [Voice Call](/plugins/voice-call)

## Common commands

```bash
alvasta-pro voicecall status --call-id <id>
alvasta-pro voicecall call --to "+15555550123" --message "Hello" --mode notify
alvasta-pro voicecall continue --call-id <id> --message "Any questions?"
alvasta-pro voicecall end --call-id <id>
```

## Exposing webhooks (Tailscale)

```bash
alvasta-pro voicecall expose --mode serve
alvasta-pro voicecall expose --mode funnel
alvasta-pro voicecall expose --mode off
```

Security note: only expose the webhook endpoint to networks you trust. Prefer Tailscale Serve over Funnel when possible.
