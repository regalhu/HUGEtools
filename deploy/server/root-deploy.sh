#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/www/hugetools}"
BRANCH="${BRANCH:-main}"
REMOTE="${REMOTE:-origin}"
SERVICE_NAME="${SERVICE_NAME:-hugetools}"
PUBLIC_PORT="${PUBLIC_PORT:-${WEB_PORT:-18089}}"
APP_PORT="${APP_PORT:-18088}"
DOMAIN="${DOMAIN:-your-domain.com}"
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

echo "===== DEPLOY START =====" | tee -a "$LOG_FILE"
before="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
log "deploy start: dir=$APP_DIR remote=$REMOTE branch=$BRANCH before=$before"

git fetch "$REMOTE" --prune
git checkout "$BRANCH"
git pull --ff-only "$REMOTE" "$BRANCH"

npm install --omit=dev || true

if [[ "$(id -u)" == "0" ]]; then
  if [[ -f deploy/server/root-deploy.sh ]]; then
    install -D -m 0755 deploy/server/root-deploy.sh /root/deploy.sh
    log "deploy script refreshed: /root/deploy.sh"
  fi

  if [[ -f deploy/systemd/hugetools.service ]]; then
    install -D -m 0644 deploy/systemd/hugetools.service "/etc/systemd/system/${SERVICE_NAME}.service"
    sed -i "s/PORT=18088/PORT=${APP_PORT}/" "/etc/systemd/system/${SERVICE_NAME}.service"
    systemctl daemon-reload
    systemctl enable "${SERVICE_NAME}.service" >/dev/null 2>&1 || true
    log "systemd service synced: ${SERVICE_NAME}.service on 127.0.0.1:${APP_PORT}"
  fi

  if [[ -f deploy/nginx-hugetools-saas.conf ]]; then
    install -D -m 0644 deploy/nginx-hugetools-saas.conf /etc/nginx/conf.d/hugetools-saas.conf
    sed -i "s/your-domain.com/${DOMAIN}/g" /etc/nginx/conf.d/hugetools-saas.conf
    sed -i "s/listen 18089;/listen ${PUBLIC_PORT};/" /etc/nginx/conf.d/hugetools-saas.conf
    sed -i "s/127.0.0.1:18088/127.0.0.1:${APP_PORT}/" /etc/nginx/conf.d/hugetools-saas.conf

    while IFS= read -r default_conf; do
      disabled="${default_conf}.disabled-by-hugetools-$(date +%Y%m%d%H%M%S)"
      mv "$default_conf" "$disabled"
      log "disabled default nginx site on ${PUBLIC_PORT}: ${default_conf} -> ${disabled}"
    done < <(
      grep -RIlE "listen[[:space:]]+${PUBLIC_PORT}([[:space:];]| default_server)" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null \
        | grep -v "/etc/nginx/conf.d/hugetools-saas.conf" \
        | while IFS= read -r conf; do
            if grep -q "root /var/www/html" "$conf"; then
              printf '%s\n' "$conf"
            fi
          done
    )

    nginx -t
    log "nginx gateway synced: public ${PUBLIC_PORT} -> 127.0.0.1:${APP_PORT}"
  fi
fi

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
echo "===== DEPLOY SUCCESS =====" | tee -a "$LOG_FILE"
