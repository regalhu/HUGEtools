#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "HUGEtools now uses Git-based deployment. SCP archive deployment is deprecated."
echo "Running deploy/server/bootstrap-tianyi.sh instead."

REPO_URL="${REPO_URL:-git@github.com:regalhu/HUGEtools.git}" \
APP_DIR="${APP_DIR:-/www/hugetools}" \
BRANCH="${BRANCH:-main}" \
WEB_PORT="${WEB_PORT:-18089}" \
WEBHOOK_PORT="${WEBHOOK_PORT:-18090}" \
bash "${ROOT_DIR}/deploy/server/bootstrap-tianyi.sh"
