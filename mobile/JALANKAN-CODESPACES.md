# Jalankan di GitHub Codespaces saja

Tanpa laptop IP, tanpa `ipconfig`. Semua dari browser Codespace.

---

## Cara paling mudah: **Expo Web** (disarankan)

Tidak perlu akun Expo, tidak perlu tunnel, tidak perlu HP.

### Terminal 1 — API

```bash
cd /workspaces/Klpk1_War-Tiket-Konser
git pull origin main
bash scripts/codespace-api.sh
```

Tab **PORTS**:
- Port **3000** → ⋮ → **Port Visibility** → **Public**
- Klik ikon globe / Open in Browser → harus muncul health/web

### Terminal 2 — Mobile (web)

```bash
cd /workspaces/Klpk1_War-Tiket-Konser
bash scripts/codespace-mobile-web.sh
```

Tab **PORTS**:
- Port **8081** → **Public** → **Open in Browser**

Browser menampilkan app mobile (daftar konser → booking).

`config.js` di-set otomatis ke:
`https://<nama-codespace>-3000.app.github.dev`

---

## Manual (tanpa skrip)

```bash
# Terminal 1
cd /workspaces/Klpk1_War-Tiket-Konser
docker compose up -d postgres redis
export DATABASE_URL=postgres://wtk:wtk@localhost:5432/wtk
export REDIS_URL=redis://localhost:6379
export PORT=3000
npm start
# PORTS 3000 → Public

# Terminal 2
cd /workspaces/Klpk1_War-Tiket-Konser/mobile
node scripts/set-codespace-url.js
cat config.js    # cek BASE_URL
npm install
npx expo install react-dom react-native-web @expo/metro-runtime
npx expo start --web --port 8081
# PORTS 8081 → Public → Open in Browser
```

---

## Opsional: HP + Expo Go (masih di GitHub API)

Hanya jika butuh Expo Go di HP:

1. API tetap Codespace, port **3000 Public**
2. `node scripts/set-codespace-url.js`
3. Tunnel sering gagal di Codespace. Alternatif:
   ```bash
   npx expo login          # akun expo.dev
   npx expo start --tunnel
   ```
   Kalau timeout → pakai **Expo Web** di atas (lebih andal).

---

## Yang dilarang di Codespace

| Jangan | Kenapa |
|--------|--------|
| `ipconfig` | Hanya Windows |
| `localhost` di HP | HP tidak ke container |
| `BASE_URL` `http://10.x` | IP laptop, bukan Codespace |
| Port Private | HP/browser luar tidak bisa akses |

---

## Checklist

- [ ] `...-3000.app.github.dev/health` → `ok: true`
- [ ] `config.js` BASE_URL = URL **https** port 3000
- [ ] `...-8081.app.github.dev` buka UI mobile
- [ ] Daftar 11 event tampil
