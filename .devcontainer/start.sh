#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Pastikan stack compose hidup setiap kali Codespace start ulang
if command -v docker >/dev/null 2>&1; then
  docker compose up -d >/dev/null 2>&1 || true
fi

echo "Codespace siap."
echo "Buka tab Ports → 8080 → ⋮ → Port Visibility: Public → Open in Browser"
echo "Atau: npm start (port 3000)"
