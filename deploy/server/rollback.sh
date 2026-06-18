#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/www/hugetools}"
TARGET="${1:-HEAD~1}"
SERVICE_NAME="${SERVICE_NAME:-huge-tools}"
LOG_DIR="${LOG_DIR:-/var/log/hugetools}"
LOG_FILE="${LOG_FILE:-${LOG_DIR}/deploy.log}"
LOCK_FILE="${LOCK_FILE:-/tmp/hugetools-deploy.lock}"

mkdir -p "$LOG_DIR"
touch "$LOG_FILE"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S %z')" "$*" | tee -a "$LOG_FILE"
}

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "another deployment is running; exiting"
  exit 1
fi

cd "$APP_DIR"

before="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "rolling back..." | tee -a "$LOG_FILE"
git log --oneline -5 | tee -a "$LOG_FILE"
log "rollback start: target=$TARGET before=$before"

git fetch --all --tags --prune
git reset --hard "$TARGET"

after="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

if systemctl list-unit-files --type=service --no-legend "${SERVICE_NAME}.service" | grep -q "${SERVICE_NAME}.service"; then
  systemctl restart "$SERVICE_NAME"
  log "service restarted: $SERVICE_NAME"
elif systemctl list-unit-files nginx.service >/dev/null 2>&1; then
  nginx -t
  systemctl reload nginx
  log "nginx reloaded"
else
  log "WARNING: no ${SERVICE_NAME}.service or nginx.service found; skipped service restart"
fi

log "rollback success: before=$before after=$after target=$TARGET"
echo "rollback done" | tee -a "$LOG_FILE"
