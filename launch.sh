#!/usr/bin/env bash
# Starts the MyWork dev server (if not already running) and opens it in Chrome.
set -e

PORT=3000
URL="http://localhost:${PORT}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR"

if ! curl -sf "${URL}/health" >/dev/null 2>&1; then
  echo "Starting dev server..."
  nohup npm run dev > /tmp/mywork_dev.log 2>&1 &
  disown

  for i in $(seq 1 30); do
    if curl -sf "${URL}/health" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if ! curl -sf "${URL}/health" >/dev/null 2>&1; then
    echo "Server did not come up - check /tmp/mywork_dev.log" >&2
    exit 1
  fi
else
  echo "Server already running on port ${PORT}."
fi

echo "Opening ${URL} in Chrome..."
if [[ "$OSTYPE" == "darwin"* ]]; then
  open -a "Google Chrome" "$URL"
elif command -v google-chrome >/dev/null 2>&1; then
  google-chrome "$URL" >/dev/null 2>&1 &
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL"
else
  echo "Could not find a way to launch Chrome - open ${URL} manually." >&2
fi
