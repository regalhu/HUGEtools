#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-git@github.com:regalhu/HUGEtools.git}"
APP_DIR="${APP_DIR:-/www/hugetools}"
BRANCH="${BRANCH:-main}"
PUBLIC_PORT="${PUBLIC_PORT:-${WEB_PORT:-18089}}"
APP_PORT="${APP_PORT:-18088}"
WEBHOOK_PORT="${WEBHOOK_PORT:-18090}"
STAGING_PORT="${STAGING_PORT:-18091}"
ENABLE_WEBHOOK="${ENABLE_WEBHOOK:-1}"
SSH_ALLOW_IP="${SSH_ALLOW_IP:-166.0.17.12}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-}"
DOMAIN="${DOMAIN:-your-domain.com}"

if [[ "$(id -u)" != "0" ]]; then
  echo "ERROR: run as root" >&2
  exit 1
fi

if [[ -z "$WEBHOOK_SECRET" && "$ENABLE_WEBHOOK" == "1" ]]; then
  WEBHOOK_SECRET="$(openssl rand -hex 32)"
fi

apt-get update
apt-get install -y git nginx python3 fail2ban ufw nodejs npm

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

if git ls-remote --exit-code --heads origin staging >/dev/null 2>&1; then
  STAGING_DIR="${STAGING_DIR:-/www/hugetools-staging}"
  if [[ ! -d "$STAGING_DIR/.git" ]]; then
    if [[ -e "$STAGING_DIR" ]]; then
      backup="${STAGING_DIR}-backup-$(date +%Y%m%d%H%M%S)"
      mv "$STAGING_DIR" "$backup"
      echo "Moved existing non-Git staging directory to $backup"
    fi
    git clone "$REPO_URL" "$STAGING_DIR"
  fi
  git -C "$STAGING_DIR" fetch origin staging --prune
  git -C "$STAGING_DIR" checkout staging
  git -C "$STAGING_DIR" pull --ff-only origin staging
fi

install -D -m 0755 "$APP_DIR/deploy/server/root-deploy.sh" /root/deploy.sh
install -D -m 0755 "$APP_DIR/deploy/server/root-deploy-staging.sh" /root/deploy-staging.sh
install -D -m 0755 "$APP_DIR/deploy/server/rollback.sh" /root/rollback.sh

install -D -m 0644 "$APP_DIR/deploy/systemd/hugetools.service" /etc/systemd/system/hugetools.service
install -D -m 0644 "$APP_DIR/deploy/systemd/hugetools-staging.service" /etc/systemd/system/hugetools-staging.service
install -D -m 0644 "$APP_DIR/deploy/systemd/hugetools-webhook.service" /etc/systemd/system/hugetools-webhook.service
sed -i "s/PORT=18088/PORT=${APP_PORT}/" /etc/systemd/system/hugetools.service
sed -i "s/PORT=18091/PORT=${STAGING_PORT}/" /etc/systemd/system/hugetools-staging.service

install -D -m 0644 "$APP_DIR/deploy/nginx-hugetools-saas.conf" /etc/nginx/conf.d/hugetools-saas.conf
sed -i "s/your-domain.com/${DOMAIN}/g" /etc/nginx/conf.d/hugetools-saas.conf
sed -i "s/listen 18089;/listen ${PUBLIC_PORT};/" /etc/nginx/conf.d/hugetools-saas.conf
sed -i "s/127.0.0.1:18088/127.0.0.1:${APP_PORT}/" /etc/nginx/conf.d/hugetools-saas.conf

install -d -m 0755 /var/log/hugetools /etc/hugetools
cat > /etc/hugetools/webhook.env <<EOF
WEBHOOK_HOST=0.0.0.0
WEBHOOK_PORT=${WEBHOOK_PORT}
GITHUB_WEBHOOK_SECRET=${WEBHOOK_SECRET}
PROD_DEPLOY_SCRIPT=/root/deploy.sh
STAGING_DEPLOY_SCRIPT=/root/deploy-staging.sh
WEBHOOK_LOG_FILE=/var/log/hugetools/webhook.log
EOF
chmod 0600 /etc/hugetools/webhook.env

SSH_ALLOW_IP="$SSH_ALLOW_IP" bash "$APP_DIR/deploy/server/ssh-hardening.sh"
ufw allow "${PUBLIC_PORT}/tcp"

nginx -t
systemctl daemon-reload
systemctl enable --now hugetools.service
systemctl restart hugetools.service

if [[ -d "${STAGING_DIR:-/www/hugetools-staging}/.git" ]]; then
  systemctl enable --now hugetools-staging.service
  systemctl restart hugetools-staging.service
fi

if [[ "$ENABLE_WEBHOOK" == "1" ]]; then
  systemctl enable --now hugetools-webhook.service
  systemctl restart hugetools-webhook.service
fi

bash /root/deploy.sh

cat <<EOF
HUGEtools bootstrap complete.

Project: ${APP_DIR}
Deploy script: /root/deploy.sh
Staging deploy script: /root/deploy-staging.sh
Rollback script: /root/rollback.sh
Public URL: http://${DOMAIN}:${PUBLIC_PORT}/
Public port: ${PUBLIC_PORT}
Internal app: http://127.0.0.1:${APP_PORT}/
Internal webhook: http://127.0.0.1:${WEBHOOK_PORT}/webhook
Webhook secret: ${WEBHOOK_SECRET}

Add the webhook URL and secret to GitHub repository settings.
EOF
