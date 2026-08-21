#!/usr/bin/env bash
# Jalankan Expo WEB di Codespaces — buka di browser (tanpa tunnel, tanpa HP).
set -euo pipefail
cd "$(dirname "$0")/../mobile"

if [ -z "${CODESPACE_NAME:-}" ]; then
  echo "Jalankan di GitHub Codespaces."
  exit 1
fi

echo "==> Set BASE_URL dari Codespace"
node scripts/set-codespace-url.js

echo "==> npm install mobile"
npm install
npx expo install react-dom react-native-web @expo/metro-runtime || true

export EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0
export PORT=8081

echo ""
echo "=============================================="
echo "  Expo WEB akan listen :8081"
echo "  Tab PORTS → 8081 → Visibility: PUBLIC"
echo "  Lalu Open in Browser"
echo "  API harus sudah jalan di :3000 (Public)"
echo "=============================================="
echo ""

export CI=1
exec npx expo start --web --port 8081
