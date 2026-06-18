#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-git@github.com:regalhu/HUGEtools.git}"
APP_DIR="${APP_DIR:-/www/hugetools}"
BRANCH="${BRANCH:-main}"
WEB_PORT="${WEB_PORT:-18089}"
WEBHOOK_PORT="${WEBHOOK_PORT:-18090}"
ENABLE_WEBHOOK="${ENABLE_WEBHOOK:-1}"
SSH_ALLOW_IP="${SSH_ALLOW_IP:-166.0.17.12}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-}"

if [[ "$(id -u)" != "0" ]]; then
  echo "ERROR: run as root" >&2
  exit 1
fi

if [[ -z "$WEBHOOK_SECRET" && "$ENABLE_WEBHOOK" == "1" ]]; then
  WEBHOOK_SECRET="$(openssl rand -hex 32)"
fi

apt-get update
apt-get install -y git nginx python3 fail2ban ufw

install -d -m 0755 /www
if [[ ! -d "$APP_DIR/.git" ]]; then
  if [[ -e "$APP_DIR" ]]; then
    backup="${APP_DIR}-backup-$(date +%Y%m%d%H%M%S)"
    mv "$APP_DIR" "$backup"
    echo "Moved existing non-Git directory to $backup"
  fi
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
git remote set-url origin "$REPO_URL"
git fetch origin "$BRANCH" --prune
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

install -D -m 0755 "$APP_DIR/deploy/server/root-deploy.sh" /root/deploy.sh
install -D -m 0755 "$APP_DIR/deploy/server/rollback.sh" /root/rollback-hugetools.sh
install -D -m 0755 "$APP_DIR/deploy/server/hugetools-reload.sh" /usr/local/bin/hugetools-reload.sh

install -D -m 0644 "$APP_DIR/deploy/systemd/huge-tools.service" /etc/systemd/system/huge-tools.service
install -D -m 0644 "$APP_DIR/deploy/systemd/hugetools-webhook.service" /etc/systemd/system/hugetools-webhook.service

install -D -m 0644 "$APP_DIR/deploy/nginx-hugetools-git.conf" /etc/nginx/conf.d/hugetools-mainland.conf
sed -i "s/listen 18089;/listen ${WEB_PORT};/" /etc/nginx/conf.d/hugetools-mainland.conf

install -d -m 0755 /var/log/hugetools /etc/hugetools
cat > /etc/hugetools/webhook.env <<EOF
WEBHOOK_HOST=0.0.0.0
WEBHOOK_PORT=${WEBHOOK_PORT}
GITHUB_WEBHOOK_SECRET=${WEBHOOK_SECRET}
DEPLOY_SCRIPT=/root/deploy.sh
DEPLOY_BRANCH=${BRANCH}
WEBHOOK_LOG_FILE=/var/log/hugetools/webhook.log
EOF
chmod 0600 /etc/hugetools/webhook.env

SSH_ALLOW_IP="$SSH_ALLOW_IP" bash "$APP_DIR/deploy/server/ssh-hardening.sh"
ufw allow "${WEB_PORT}/tcp"
if [[ "$ENABLE_WEBHOOK" == "1" ]]; then
  ufw allow "${WEBHOOK_PORT}/tcp"
fi

nginx -t
systemctl daemon-reload
systemctl enable --now huge-tools.service
systemctl restart huge-tools.service

if [[ "$ENABLE_WEBHOOK" == "1" ]]; then
  systemctl enable --now hugetools-webhook.service
  systemctl restart hugetools-webhook.service
fi

bash /root/deploy.sh

cat <<EOF
HUGEtools bootstrap complete.

Project: ${APP_DIR}
Deploy script: /root/deploy.sh
Rollback script: /root/rollback-hugetools.sh
Public URL: http://113.249.104.188:${WEB_PORT}/hugetools/
Webhook URL: http://113.249.104.188:${WEBHOOK_PORT}/webhook
Webhook secret: ${WEBHOOK_SECRET}

Add the webhook URL and secret to GitHub repository settings.
EOF
