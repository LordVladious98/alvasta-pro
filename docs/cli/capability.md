---
summary: "Infer-first CLI for provider-backed model, image, audio, TTS, video, web, and embedding workflows"
read_when:
  - Adding or modifying `alvasta-pro infer` commands
  - Designing stable headless capability automation
title: "Inference CLI"
---

# Inference CLI

`alvasta-pro infer` is the canonical headless surface for provider-backed inference workflows.

It intentionally exposes capability families, not raw gateway RPC names and not raw agent tool ids.

## Common tasks

This table maps common inference tasks to the corresponding infer command.

| If the user wants to...         | Use this command                                                       |
| ------------------------------- | ---------------------------------------------------------------------- |
| run a text/model prompt         | `alvasta-pro infer model run --prompt "..." --json`                       |
| list configured model providers | `alvasta-pro infer model providers --json`                                |
| generate an image               | `alvasta-pro infer image generate --prompt "..." --json`                  |
| describe an image file          | `alvasta-pro infer image describe --file ./image.png --json`              |
| transcribe audio                | `alvasta-pro infer audio transcribe --file ./memo.m4a --json`             |
| synthesize speech               | `alvasta-pro infer tts convert --text "..." --output ./speech.mp3 --json` |
| generate a video                | `alvasta-pro infer video generate --prompt "..." --json`                  |
| describe a video file           | `alvasta-pro infer video describe --file ./clip.mp4 --json`               |
| search the web                  | `alvasta-pro infer web search --query "..." --json`                       |
| fetch a web page                | `alvasta-pro infer web fetch --url https://example.com --json`            |
| create embeddings               | `alvasta-pro infer embedding create --text "..." --json`                  |

## Command tree

```text
 alvasta-pro infer
  list
  inspect

  model
    run
    list
    inspect
    providers
    auth login
    auth logout
    auth status

  image
    generate
    edit
    describe
    describe-many
    providers

  audio
    transcribe
    providers

  tts
    convert
    voices
    providers
    status
    enable
    disable
    set-provider

  video
    generate
    describe
    providers

  web
    search
    fetch
    providers

  embedding
    create
    providers
```

## Examples

These examples show the standard command shape across the infer surface.

```bash
alvasta-pro infer list --json
alvasta-pro infer inspect --name image.generate --json
alvasta-pro infer model run --prompt "Reply with exactly: smoke-ok" --json
alvasta-pro infer model providers --json
alvasta-pro infer image generate --prompt "friendly lobster illustration" --json
alvasta-pro infer image describe --file ./photo.jpg --json
alvasta-pro infer audio transcribe --file ./memo.m4a --json
alvasta-pro infer tts convert --text "hello from alvasta-pro" --output ./hello.mp3 --json
alvasta-pro infer video generate --prompt "cinematic sunset over the ocean" --json
alvasta-pro infer video describe --file ./clip.mp4 --json
alvasta-pro infer web search --query "Alvasta Pro docs" --json
alvasta-pro infer embedding create --text "friendly lobster" --json
```

## Additional examples

```bash
alvasta-pro infer audio transcribe --file ./team-sync.m4a --language en --prompt "Focus on names and action items" --json
alvasta-pro infer image describe --file ./ui-screenshot.png --model openai/gpt-4.1-mini --json
alvasta-pro infer tts convert --text "Your build is complete" --output ./build-complete.mp3 --json
alvasta-pro infer web search --query "Alvasta Pro docs infer web providers" --json
alvasta-pro infer embedding create --text "customer support ticket: delayed shipment" --model openai/text-embedding-3-large --json
```

## Transport

Supported transport flags:

- `--local`
- `--gateway`

Default transport is implicit auto at the command-family level:

- Stateless execution commands default to local.
- Gateway-managed state commands default to gateway.

Examples:

```bash
alvasta-pro infer model run --prompt "hello" --json
alvasta-pro infer image generate --prompt "friendly lobster" --json
alvasta-pro infer tts status --json
alvasta-pro infer embedding create --text "hello world" --json
```

## Usage notes

- `alvasta-pro infer ...` is the primary CLI surface for these workflows.
- Use `--json` when the output will be consumed by another command or script.
- Use `--provider` or `--model provider/model` when a specific backend is required.
- For `image describe`, `audio transcribe`, and `video describe`, `--model` must use the form `<provider/model>`.
- The normal local path does not require the gateway to be running.

## JSON output

Capability commands normalize JSON output under a shared envelope:

```json
{
  "ok": true,
  "capability": "image.generate",
  "transport": "local",
  "provider": "openai",
  "model": "gpt-image-1",
  "attempts": [],
  "outputs": []
}
```

Top-level fields are stable:

- `ok`
- `capability`
- `transport`
- `provider`
- `model`
- `attempts`
- `outputs`
- `error`

## Common pitfalls

```bash
# Bad
alvasta-pro infer media image generate --prompt "friendly lobster"

# Good
alvasta-pro infer image generate --prompt "friendly lobster"
```

```bash
# Bad
alvasta-pro infer audio transcribe --file ./memo.m4a --model whisper-1 --json

# Good
alvasta-pro infer audio transcribe --file ./memo.m4a --model openai/whisper-1 --json
```

## Notes

- `model run` reuses the agent runtime so provider/model overrides behave like normal agent execution.
- `tts status` defaults to gateway because it reflects gateway-managed TTS state.
- `alvasta-pro capability ...` is an alias for `alvasta-pro infer ...`.
