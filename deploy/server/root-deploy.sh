#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/www/hugetools}"
BRANCH="${BRANCH:-main}"
REMOTE="${REMOTE:-origin}"
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

if [[ ! -d "$APP_DIR/.git" ]]; then
  log "ERROR: $APP_DIR is not a Git checkout"
  exit 1
fi

cd "$APP_DIR"

before="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
log "deploy start: dir=$APP_DIR remote=$REMOTE branch=$BRANCH before=$before"

git fetch "$REMOTE" "$BRANCH" --prune
git pull --ff-only "$REMOTE" "$BRANCH"

after="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
version="$(python3 - <<'PY'
import json
try:
    with open("data/version-history.json", encoding="utf-8") as fh:
        data = json.load(fh)
    print(data.get("currentVersion", "unknown"))
except Exception:
    print("unknown")
PY
)"

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

log "deploy success: before=$before after=$after version=$version"
