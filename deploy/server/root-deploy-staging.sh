#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/www/hugetools-staging}"
BRANCH="${BRANCH:-staging}"
SERVICE_NAME="${SERVICE_NAME:-hugetools-staging}"

APP_DIR="$APP_DIR" BRANCH="$BRANCH" SERVICE_NAME="$SERVICE_NAME" /root/deploy.sh
