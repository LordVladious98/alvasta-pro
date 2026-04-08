---
summary: "Platform support overview (Gateway + companion apps)"
read_when:
  - Looking for OS support or install paths
  - Deciding where to run the Gateway
title: "Platforms"
---

# Platforms

Alvasta Pro core is written in TypeScript. **Node is the recommended runtime**.
Bun is not recommended for the Gateway (WhatsApp/Telegram bugs).

Companion apps exist for macOS (menu bar app) and mobile nodes (iOS/Android). Windows and
Linux companion apps are planned, but the Gateway is fully supported today.
Native companion apps for Windows are also planned; the Gateway is recommended via WSL2.

## Choose your OS

- macOS: [macOS](/platforms/macos)
- iOS: [iOS](/platforms/ios)
- Android: [Android](/platforms/android)
- Windows: [Windows](/platforms/windows)
- Linux: [Linux](/platforms/linux)

## VPS & hosting

- VPS hub: [VPS hosting](/vps)
- Fly.io: [Fly.io](/install/fly)
- Hetzner (Docker): [Hetzner](/install/hetzner)
- GCP (Compute Engine): [GCP](/install/gcp)
- Azure (Linux VM): [Azure](/install/azure)
- exe.dev (VM + HTTPS proxy): [exe.dev](/install/exe-dev)

## Common links

- Install guide: [Getting Started](/start/getting-started)
- Gateway runbook: [Gateway](/gateway)
- Gateway configuration: [Configuration](/gateway/configuration)
- Service status: `alvasta-pro gateway status`

## Gateway service install (CLI)

Use one of these (all supported):

- Wizard (recommended): `alvasta-pro onboard --install-daemon`
- Direct: `alvasta-pro gateway install`
- Configure flow: `alvasta-pro configure` → select **Gateway service**
- Repair/migrate: `alvasta-pro doctor` (offers to install or fix the service)

The service target depends on OS:

- macOS: LaunchAgent (`ai.alvasta-pro.gateway` or `ai.alvasta-pro.<profile>`; legacy `com.alvasta-pro.*`)
- Linux/WSL2: systemd user service (`alvasta-pro-gateway[-<profile>].service`)
- Native Windows: Scheduled Task (`Alvasta Pro Gateway` or `Alvasta Pro Gateway (<profile>)`), with a per-user Startup-folder login item fallback if task creation is denied
