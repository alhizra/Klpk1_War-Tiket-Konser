#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> npm install"
npm install

echo "==> Docker compose build (api + postgres + redis + gateway)"
docker compose up -d --build

echo "==> Tunggu Postgres sehat..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U wtk -d wtk >/dev/null 2>&1; then
    echo "Postgres OK"
    break
  fi
  sleep 2
done

echo "==> Load dataset Excel (7 events + 2480 seats)"
docker compose exec -T api node data/generate-real-seats.js || true
docker compose exec -T api node src/load-manual-data.js || {
  echo "Retry load data setelah api siap..."
  sleep 5
  docker compose exec -T api node src/load-manual-data.js
}

echo ""
echo "Setup selesai."
echo "  Web (gateway): port 8080 → Ports tab → Open in Browser (Public)"
echo "  Atau jalankan: npm start  → port 3000"
