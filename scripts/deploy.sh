#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DEPLOY_HOST="${DEPLOY_HOST:-124.243.149.183}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/superfinance}"
SSH_KEY="${SSH_KEY:-/Users/zhanglun/Downloads/demo-zhanglun.pem}"
PM2_APP="${PM2_APP:-superfinance}"
NEXT_PORT="${NEXT_PORT:-3000}"
HEALTH_URL="${HEALTH_URL:-https://www.cofundonline.com/}"
RUN_TESTS="${RUN_TESTS:-0}"
RUN_LOCAL_BUILD="${RUN_LOCAL_BUILD:-1}"
SYNC_ENV="${SYNC_ENV:-0}"
REQUIRE_CLEAN_GIT="${REQUIRE_CLEAN_GIT:-0}"

REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
SSH_OPTS=(
  -i "$SSH_KEY"
  -o BatchMode=yes
  -o StrictHostKeyChecking=accept-new
)

log() {
  printf '\n\033[1;34m==>\033[0m %s\n' "$*"
}

fail() {
  printf '\n\033[1;31mERROR:\033[0m %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

quote() {
  printf '%q' "$1"
}

require_command git
require_command npm
require_command rsync
require_command ssh
require_command curl

if [[ ! -f "$SSH_KEY" ]]; then
  fail "SSH key not found: $SSH_KEY. Override with SSH_KEY=/path/to/key npm run deploy"
fi

chmod 600 "$SSH_KEY" 2>/dev/null || true

cd "$ROOT_DIR"

log "Deploy target"
printf 'Host: %s\nUser: %s\nRemote dir: %s\nPM2 app: %s\nHealth URL: %s\n' \
  "$DEPLOY_HOST" "$DEPLOY_USER" "$DEPLOY_DIR" "$PM2_APP" "$HEALTH_URL"

if [[ "$REQUIRE_CLEAN_GIT" == "1" ]] && [[ -n "$(git status --porcelain)" ]]; then
  git status --short
  fail "Working tree is not clean. Commit/stash changes or set REQUIRE_CLEAN_GIT=0."
fi

if [[ "$RUN_TESTS" == "1" ]]; then
  log "Running tests"
  npm test
fi

if [[ "$RUN_LOCAL_BUILD" == "1" ]]; then
  log "Running local production build"
  npm run build
fi

log "Preparing remote directory"
ssh "${SSH_OPTS[@]}" "$REMOTE" "mkdir -p $(quote "$DEPLOY_DIR")"

if [[ "$SYNC_ENV" != "1" ]]; then
  log "Checking remote .env.local"
  ssh "${SSH_OPTS[@]}" "$REMOTE" "test -f $(quote "$DEPLOY_DIR")/.env.local" || fail \
    "Remote .env.local is missing. Either create $DEPLOY_DIR/.env.local on the server or run SYNC_ENV=1 npm run deploy once."
fi

log "Syncing files"
RSYNC_EXCLUDES=(
  --exclude '.git'
  --exclude 'node_modules'
  --exclude '.next'
  --exclude 'coverage'
  --exclude 'test-results'
  --exclude 'playwright-report'
  --exclude '.DS_Store'
  --exclude '.worktrees'
  --exclude '.claude'
  --exclude '.ccg/.sessions'
  --exclude '.ccg/kick.log'
  --exclude '.ccg/__pycache__'
  --exclude '.ccg/.DS_Store'
)

if [[ "$SYNC_ENV" != "1" ]]; then
  RSYNC_EXCLUDES+=(--exclude '.env.local' --exclude '.env*.local')
fi

rsync -az --delete "${RSYNC_EXCLUDES[@]}" \
  -e "ssh -i $(quote "$SSH_KEY") -o BatchMode=yes -o StrictHostKeyChecking=accept-new" \
  "$ROOT_DIR/" "$REMOTE:$DEPLOY_DIR/"

log "Installing, building, and restarting on remote"
ssh "${SSH_OPTS[@]}" "$REMOTE" \
  "DEPLOY_DIR=$(quote "$DEPLOY_DIR") PM2_APP=$(quote "$PM2_APP") NEXT_PORT=$(quote "$NEXT_PORT") bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

cd "$DEPLOY_DIR"

npm ci
npm run build
npm prune --omit=dev

if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP" --update-env
else
  PORT="$NEXT_PORT" NODE_ENV=production pm2 start npm --name "$PM2_APP" -- start -- -p "$NEXT_PORT"
fi

pm2 save
sleep 3
curl -fsSI --max-time 15 "http://127.0.0.1:${NEXT_PORT}/" >/dev/null
pm2 status "$PM2_APP"
REMOTE_SCRIPT

log "Checking public health URL"
curl -fsSI --max-time 20 "$HEALTH_URL" >/dev/null

log "Deploy complete"
printf 'Deployed %s to %s\n' "$(git rev-parse --short HEAD)" "$HEALTH_URL"
