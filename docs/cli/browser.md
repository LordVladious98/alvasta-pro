---
summary: "CLI reference for `alvasta-pro browser` (lifecycle, profiles, tabs, actions, state, and debugging)"
read_when:
  - You use `alvasta-pro browser` and want examples for common tasks
  - You want to control a browser running on another machine via a node host
  - You want to attach to your local signed-in Chrome via Chrome MCP
title: "browser"
---

# `alvasta-pro browser`

Manage Alvasta Pro's browser control surface and run browser actions (lifecycle, profiles, tabs, snapshots, screenshots, navigation, input, state emulation, and debugging).

Related:

- Browser tool + API: [Browser tool](/tools/browser)

## Common flags

- `--url <gatewayWsUrl>`: Gateway WebSocket URL (defaults to config).
- `--token <token>`: Gateway token (if required).
- `--timeout <ms>`: request timeout (ms).
- `--expect-final`: wait for a final Gateway response.
- `--browser-profile <name>`: choose a browser profile (default from config).
- `--json`: machine-readable output (where supported).

## Quick start (local)

```bash
alvasta-pro browser profiles
alvasta-pro browser --browser-profile alvasta-pro start
alvasta-pro browser --browser-profile alvasta-pro open https://example.com
alvasta-pro browser --browser-profile alvasta-pro snapshot
```

## Lifecycle

```bash
alvasta-pro browser status
alvasta-pro browser start
alvasta-pro browser stop
alvasta-pro browser --browser-profile alvasta-pro reset-profile
```

Notes:

- For `attachOnly` and remote CDP profiles, `alvasta-pro browser stop` closes the
  active control session and clears temporary emulation overrides even when
  Alvasta Pro did not launch the browser process itself.
- For local managed profiles, `alvasta-pro browser stop` stops the spawned browser
  process.

## If the command is missing

If `alvasta-pro browser` is an unknown command, check `plugins.allow` in
`~/.alvasta-pro/alvasta-pro.json`.

When `plugins.allow` is present, the bundled browser plugin must be listed
explicitly:

```json5
{
  plugins: {
    allow: ["telegram", "browser"],
  },
}
```

`browser.enabled=true` does not restore the CLI subcommand when the plugin
allowlist excludes `browser`.

Related: [Browser tool](/tools/browser#missing-browser-command-or-tool)

## Profiles

Profiles are named browser routing configs. In practice:

- `alvasta-pro`: launches or attaches to a dedicated Alvasta Pro-managed Chrome instance (isolated user data dir).
- `user`: controls your existing signed-in Chrome session via Chrome DevTools MCP.
- custom CDP profiles: point at a local or remote CDP endpoint.

```bash
alvasta-pro browser profiles
alvasta-pro browser create-profile --name work --color "#FF5A36"
alvasta-pro browser create-profile --name chrome-live --driver existing-session
alvasta-pro browser create-profile --name remote --cdp-url https://browser-host.example.com
alvasta-pro browser delete-profile --name work
```

Use a specific profile:

```bash
alvasta-pro browser --browser-profile work tabs
```

## Tabs

```bash
alvasta-pro browser tabs
alvasta-pro browser tab new
alvasta-pro browser tab select 2
alvasta-pro browser tab close 2
alvasta-pro browser open https://docs.alvasta-pro.ai
alvasta-pro browser focus <targetId>
alvasta-pro browser close <targetId>
```

## Snapshot / screenshot / actions

Snapshot:

```bash
alvasta-pro browser snapshot
```

Screenshot:

```bash
alvasta-pro browser screenshot
alvasta-pro browser screenshot --full-page
alvasta-pro browser screenshot --ref e12
```

Notes:

- `--full-page` is for page captures only; it cannot be combined with `--ref`
  or `--element`.
- `existing-session` / `user` profiles support page screenshots and `--ref`
  screenshots from snapshot output, but not CSS `--element` screenshots.

Navigate/click/type (ref-based UI automation):

```bash
alvasta-pro browser navigate https://example.com
alvasta-pro browser click <ref>
alvasta-pro browser type <ref> "hello"
alvasta-pro browser press Enter
alvasta-pro browser hover <ref>
alvasta-pro browser scrollintoview <ref>
alvasta-pro browser drag <startRef> <endRef>
alvasta-pro browser select <ref> OptionA OptionB
alvasta-pro browser fill --fields '[{"ref":"1","value":"Ada"}]'
alvasta-pro browser wait --text "Done"
alvasta-pro browser evaluate --fn '(el) => el.textContent' --ref <ref>
```

File + dialog helpers:

```bash
alvasta-pro browser upload /tmp/alvasta-pro/uploads/file.pdf --ref <ref>
alvasta-pro browser waitfordownload
alvasta-pro browser download <ref> report.pdf
alvasta-pro browser dialog --accept
```

## State and storage

Viewport + emulation:

```bash
alvasta-pro browser resize 1280 720
alvasta-pro browser set viewport 1280 720
alvasta-pro browser set offline on
alvasta-pro browser set media dark
alvasta-pro browser set timezone Europe/London
alvasta-pro browser set locale en-GB
alvasta-pro browser set geo 51.5074 -0.1278 --accuracy 25
alvasta-pro browser set device "iPhone 14"
alvasta-pro browser set headers '{"x-test":"1"}'
alvasta-pro browser set credentials myuser mypass
```

Cookies + storage:

```bash
alvasta-pro browser cookies
alvasta-pro browser cookies set session abc123 --url https://example.com
alvasta-pro browser cookies clear
alvasta-pro browser storage local get
alvasta-pro browser storage local set token abc123
alvasta-pro browser storage session clear
```

## Debugging

```bash
alvasta-pro browser console --level error
alvasta-pro browser pdf
alvasta-pro browser responsebody "**/api"
alvasta-pro browser highlight <ref>
alvasta-pro browser errors --clear
alvasta-pro browser requests --filter api
alvasta-pro browser trace start
alvasta-pro browser trace stop --out trace.zip
```

## Existing Chrome via MCP

Use the built-in `user` profile, or create your own `existing-session` profile:

```bash
alvasta-pro browser --browser-profile user tabs
alvasta-pro browser create-profile --name chrome-live --driver existing-session
alvasta-pro browser create-profile --name brave-live --driver existing-session --user-data-dir "~/Library/Application Support/BraveSoftware/Brave-Browser"
alvasta-pro browser --browser-profile chrome-live tabs
```

This path is host-only. For Docker, headless servers, Browserless, or other remote setups, use a CDP profile instead.

Current existing-session limits:

- snapshot-driven actions use refs, not CSS selectors
- `click` is left-click only
- `type` does not support `slowly=true`
- `press` does not support `delayMs`
- `hover`, `scrollintoview`, `drag`, `select`, `fill`, and `evaluate` reject
  per-call timeout overrides
- `select` supports one value only
- `wait --load networkidle` is not supported
- file uploads require `--ref` / `--input-ref`, do not support CSS
  `--element`, and currently support one file at a time
- dialog hooks do not support `--timeout`
- screenshots support page captures and `--ref`, but not CSS `--element`
- `responsebody`, download interception, PDF export, and batch actions still
  require a managed browser or raw CDP profile

## Remote browser control (node host proxy)

If the Gateway runs on a different machine than the browser, run a **node host** on the machine that has Chrome/Brave/Edge/Chromium. The Gateway will proxy browser actions to that node (no separate browser control server required).

Use `gateway.nodes.browser.mode` to control auto-routing and `gateway.nodes.browser.node` to pin a specific node if multiple are connected.

Security + remote setup: [Browser tool](/tools/browser), [Remote access](/gateway/remote), [Tailscale](/gateway/tailscale), [Security](/gateway/security)
