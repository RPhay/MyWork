#!/usr/bin/env bash
# macOS-only launcher: checks/installs prerequisites, starts the MyWork dev
# server (if not already running), and opens it in Chrome.
# Windows: use launch.ps1 instead.
set -e

PORT=3000
URL="http://localhost:${PORT}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR"

if [[ "$OSTYPE" != "darwin"* ]]; then
  echo "launch-mac.sh is macOS-only. On Windows, run launch.ps1 instead." >&2
  exit 1
fi

# --- Dependencies ------------------------------------------------------

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  if command -v brew >/dev/null 2>&1; then
    echo "Installing Node.js via Homebrew..."
    brew install node
  else
    echo "Homebrew isn't installed either. Install it from https://brew.sh, then run:" >&2
    echo "  brew install node" >&2
    exit 1
  fi
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm isn't available even though Node.js is installed - your Node install looks broken." >&2
  echo "Try: brew reinstall node" >&2
  exit 1
fi

if [ ! -d node_modules ] || [ package.json -nt node_modules ] || [ package-lock.json -nt node_modules ]; then
  echo "Installing npm dependencies..."
  npm install
fi

# --- Start the server ----------------------------------------------------

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
open -a "Google Chrome" "$URL"
