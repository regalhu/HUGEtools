#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
PROJECT_ROOT="${SCRIPT_DIR:h}"
cd "$PROJECT_ROOT"

PYTHON_BIN="$(command -v python3 || command -v python || true)"
if [[ -z "$PYTHON_BIN" ]]; then
  echo "Python is required. Install Python 3 or run this project from a machine with python3 available."
  exit 1
fi

PORT="${1:-8765}"
while lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

URL="http://127.0.0.1:${PORT}/"
echo "Starting HUGEtools at ${URL}"
echo "Project root: ${PROJECT_ROOT}"
open "$URL"
"$PYTHON_BIN" -m http.server "$PORT" --bind 127.0.0.1
