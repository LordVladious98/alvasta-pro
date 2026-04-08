#!/usr/bin/env bash
# Alvasta Pro install script — v1.0
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/LordVladious98/alvasta-pro/main/install.sh | bash
#   # or from a checkout:
#   ./install.sh
#
# What it does:
#   1. Verifies Node 22.12+ and pnpm are installed (installs pnpm if missing)
#   2. Clones or updates the alvasta-pro repo in ~/alvasta-pro
#   3. Runs pnpm install --frozen-lockfile
#   4. Runs the A2UI canvas bundle
#   5. Runs pnpm build:docker (the lean build that skips plugin runtime staging)
#   6. Verifies `node openclaw.mjs --help` runs
#   7. Prints next steps
#
# Post-install:
#   The binary is at ~/alvasta-pro/openclaw.mjs — either add that to a wrapper
#   script on PATH, or npm link it locally to get `alvasta-pro` and `openclaw`
#   on your PATH.

set -euo pipefail

# ── Colors ──
if [[ -t 1 ]]; then
  O='\033[1;38;5;208m'  # orange
  G='\033[32m'
  R='\033[31m'
  D='\033[2m'
  B='\033[1m'
  N='\033[0m'
else
  O='' G='' R='' D='' B='' N=''
fi

log()   { printf '%b→%b %s\n' "$O" "$N" "$*"; }
ok()    { printf '%b✓%b %s\n' "$G" "$N" "$*"; }
fail()  { printf '%b✗%b %s\n' "$R" "$N" "$*" >&2; }
banner() { printf '%b⚡ ALVASTA PRO INSTALLER%b\n' "$B$O" "$N"; printf '%b%s%b\n' "$D" '=========================' "$N"; }

banner
echo

# ── 1. Node check ──
log "checking node..."
if ! command -v node >/dev/null 2>&1; then
  fail "node not found. Install Node 22.12+ from https://nodejs.org/ and re-run."
  exit 1
fi
NODE_VER=$(node -v | sed 's/^v//')
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
NODE_MINOR=$(echo "$NODE_VER" | cut -d. -f2)
if [[ "$NODE_MAJOR" -lt 22 || ( "$NODE_MAJOR" -eq 22 && "$NODE_MINOR" -lt 12 ) ]]; then
  fail "node $NODE_VER is too old. Alvasta Pro needs >= 22.12. Upgrade from https://nodejs.org/"
  exit 1
fi
ok "node $NODE_VER"

# ── 2. pnpm check ──
log "checking pnpm..."
if ! command -v pnpm >/dev/null 2>&1; then
  log "pnpm not found — installing via npm..."
  npm install -g pnpm >/dev/null 2>&1 || { fail "npm install -g pnpm failed"; exit 1; }
fi
PNPM_VER=$(pnpm -v)
ok "pnpm $PNPM_VER"

# ── 3. claude check (optional) ──
log "checking claude code..."
if ! command -v claude >/dev/null 2>&1; then
  echo
  printf '%bWARNING: Claude Code is not installed.%b\n' "$R" "$N"
  printf '%b  Alvasta Pro uses Claude Code to handle OAuth and spawn inference.%b\n' "$D" "$N"
  printf '%b  Install it with:%b\n' "$D" "$N"
  printf '    %bnpm install -g @anthropic-ai/claude-code%b\n' "$O" "$N"
  printf '    %bclaude setup-token%b\n' "$O" "$N"
  echo
else
  ok "claude $(claude --version 2>&1 | head -1)"
fi

# ── 4. Clone or update ──
REPO_DIR="${ALVASTA_INSTALL_DIR:-$HOME/alvasta-pro}"
if [[ -d "$REPO_DIR/.git" ]]; then
  log "updating existing checkout at $REPO_DIR..."
  git -C "$REPO_DIR" fetch origin main >/dev/null 2>&1
  git -C "$REPO_DIR" reset --hard origin/main >/dev/null 2>&1
  ok "updated"
else
  log "cloning to $REPO_DIR..."
  git clone --depth 1 https://github.com/LordVladious98/alvasta-pro.git "$REPO_DIR" >/dev/null 2>&1
  ok "cloned"
fi

# ── 5. Install deps ──
log "installing dependencies (this takes 2-3 minutes)..."
cd "$REPO_DIR"
pnpm install --prefer-offline >/tmp/alvasta-install.log 2>&1 || {
  fail "pnpm install failed. See /tmp/alvasta-install.log"
  exit 1
}
ok "dependencies installed"

# ── 6. Build ──
log "bundling A2UI canvas..."
pnpm canvas:a2ui:bundle >>/tmp/alvasta-install.log 2>&1 || {
  fail "canvas bundle failed. See /tmp/alvasta-install.log"
  exit 1
}
ok "canvas bundled"

log "building alvasta-pro (this takes 1-2 minutes)..."
pnpm build:docker >>/tmp/alvasta-install.log 2>&1 || {
  fail "build failed. See /tmp/alvasta-install.log"
  exit 1
}
ok "build complete"

# ── 7. Smoke test ──
log "running smoke test..."
if node openclaw.mjs --help >/dev/null 2>&1; then
  ok "alvasta-pro CLI is working"
else
  fail "smoke test failed"
  exit 1
fi

# ── 8. Next steps ──
echo
printf '%b=========================%b\n' "$B$G" "$N"
printf '%b⚡ ALVASTA PRO INSTALLED%b\n' "$B$G" "$N"
printf '%b=========================%b\n' "$B$G" "$N"
echo
printf '%bInstallation path:%b %s\n' "$B" "$N" "$REPO_DIR"
echo
printf '%bQuick start:%b\n' "$B" "$N"
printf "  cd %s\n" "$REPO_DIR"
printf "  node openclaw.mjs onboard       %b# interactive setup wizard%b\n" "$D" "$N"
printf "  node openclaw.mjs gateway run   %b# start the gateway%b\n" "$D" "$N"
printf "  node openclaw.mjs --help        %b# see all commands%b\n" "$D" "$N"
echo
printf '%bPut `alvasta-pro` on your PATH:%b\n' "$B" "$N"
printf "  cd %s && pnpm link --global\n" "$REPO_DIR"
echo
printf '%bGetting updates:%b\n' "$B" "$N"
printf "  cd %s && git pull && pnpm build:docker\n" "$REPO_DIR"
echo
printf '%bDocs:%b https://github.com/LordVladious98/alvasta-pro\n' "$B" "$N"
echo
