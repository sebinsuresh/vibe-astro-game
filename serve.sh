#!/usr/bin/env bash
# Start the ASTRO FLY dev server, reachable on this machine's LAN IP.
# Usage (from project root):  ./serve.sh
#
# Serves with Cache-Control: no-store so browser tabs ALWAYS pick up the
# latest js/ files on reload (plain http.server + Chrome's heuristic
# Last-Modified caching would otherwise serve stale modules during dev).
set -euo pipefail
cd "$(dirname "$0")"

PORT=8000

# Stop a previous instance of the game server on this port (if any).
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
  sleep 0.5
fi

echo "Serving $(pwd) at http://0.0.0.0:${PORT}/  (no-cache dev mode)"
exec python3 - "${PORT}" <<'PY'
import sys, http.server

port = int(sys.argv[1])

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

http.server.ThreadingHTTPServer(("0.0.0.0", port), NoCacheHandler).serve_forever()
PY
