# BUILD — Expo / APK

## Dev (materi P1–P4)

```bash
# terminal 1 — API
cd War-Tiket-Konser
docker start wtk-pg wtk-redis
set DATABASE_URL=postgres://wtk:wtk@localhost:5432/wtk
set REDIS_URL=redis://localhost:6379
set PORT=3000
node src/server.js

# terminal 2 — Expo
cd mobile
# config.js → BASE_URL = http://<IPv4-Wi-Fi-laptop>:3000
npx expo start -c
# beda jaringan: npx expo login && npx expo start --tunnel
```

## BASE_URL

| Lingkungan | Nilai |
|------------|--------|
| HP + Wi‑Fi sama | `http://<ipconfig Wi-Fi>:3000` |
| HP + hotspot laptop | `http://192.168.137.1:3000` (cek ipconfig) |
| Emulator Android | `http://10.0.2.2:3000` |
| Jangan | `localhost`, IP `172.x` WSL/vEthernet |

## APK (P5 — EAS)

```bash
npm i -g eas-cli
cd mobile
eas login
eas build:configure
# eas.json profile preview → buildType apk
eas build -p android --profile preview
```

Pastikan `config.js` mengarah ke base URL yang HP demo bisa jangkau **sebelum** build.
