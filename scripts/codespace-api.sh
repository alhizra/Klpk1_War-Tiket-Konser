#!/usr/bin/env bash
# Jalankan API monolit di Codespaces (port 3000).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Postgres + Redis"
docker compose up -d postgres redis

echo "==> Tunggu Postgres..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U wtk -d wtk >/dev/null 2>&1; then
    echo "Postgres OK"
    break
  fi
  sleep 2
done

export DATABASE_URL="${DATABASE_URL:-postgres://wtk:wtk@localhost:5432/wtk}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export PORT="${PORT:-3000}"
export RATE_LIMIT="${RATE_LIMIT:-10000}"

if [ ! -d node_modules ]; then
  echo "==> npm install (root)"
  npm install
fi

# Load dataset bila perlu (best-effort)
node src/load-manual-data.js || true

echo "==> API :$PORT"
echo "    Tab PORTS → $PORT → Visibility PUBLIC"
echo "    Health: https://\${CODESPACE_NAME}-${PORT}.app.github.dev/health"
exec node src/server.js
