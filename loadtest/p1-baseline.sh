#!/usr/bin/env bash
# P1 baseline — War Tiket Konser
set -euo pipefail
BASE="${BASE:-http://localhost:8080}"

echo "=== BASE=$BASE ==="
curl -s "$BASE/health"; echo
curl -s "$BASE/events/1"; echo

echo "=== Baca -c 50 -d 15 ==="
npx --yes autocannon -c 50 -d 15 "$BASE/events/1"

echo "=== Reset kuota ==="
docker compose exec -T api node src/seed.js || true

echo "=== Panas 5000 POST /orders ==="
npx --yes autocannon -c 200 -a 5000 \
  -m POST -H 'Content-Type: application/json' \
  -b '{"eventId":1,"qty":1,"email":"loadtest@wtk.local","buyerName":"Load Test"}' \
  "$BASE/orders"

echo "=== Konsistensi ==="
curl -s "$BASE/events/1"; echo

echo "=== Titik jenuh ==="
for C in 10 100 500; do
  echo "=== concurrency $C ==="
  docker compose exec -T api node src/seed.js || true
  npx --yes autocannon -c "$C" -d 10 \
    -m POST -H 'Content-Type: application/json' \
    -b '{"eventId":1,"qty":1,"email":"loadtest@wtk.local","buyerName":"Load Test"}' \
    "$BASE/orders"
done

echo "Salin angka ke docs/BASELINE.md"
