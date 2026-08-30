#!/usr/bin/env bash
# Start the ASTRO FLY dev server, reachable on this machine's LAN IP.
# Usage (from project root):  ./serve.sh
set -euo pipefail
cd "$(dirname "$0")"

PORT=8000

# Stop a previous instance of the game server on this port (if any).
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
  sleep 0.5
fi

echo "Serving $(pwd) at http://0.0.0.0:${PORT}/"
exec python3 -m http.server "${PORT}" --bind 0.0.0.0
