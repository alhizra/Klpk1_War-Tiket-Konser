# Jalankan Mobile di GitHub Codespaces (Modul 3)

Codespace = **Linux**. Jangan pakai `ipconfig` (hanya Windows).

---

## 1. Base URL = URL publik port API Codespace

Bukan IP Wi‑Fi laptop.

1. Di Codespace, jalankan API monolit (terminal 1):

```bash
cd /workspaces/Klpk1_War-Tiket-Konser
# Postgres+Redis dari compose monolit (jika belum)
docker compose up -d postgres redis
export DATABASE_URL=postgres://wtk:wtk@localhost:5432/wtk
export REDIS_URL=redis://localhost:6379
export PORT=3000
npm start
# atau: node src/server.js
```

2. Tab **PORTS** → port **3000**  
   - Klik kanan → **Port Visibility** → **Public**  
   - Salin URL, contoh:  
     `https://vigilant-eureka-x5596556jrvgcr49-3000.app.github.dev`

3. Edit `mobile/config.js`:

```js
export const BASE_URL = "https://vigilant-eureka-x5596556jrvgcr49-3000.app.github.dev";
// tanpa slash di akhir
export const PAGE_SIZE = 20;
```

4. Uji di browser laptop:
   `https://...-3000.app.github.dev/health`  
   harus `{"ok":true,...}`

---

## 2. Expo di Codespace (materi: tunnel jika beda jaringan)

HP di rumah ≠ jaringan internal Codespace → materi: pakai **tunnel**.

```bash
cd /workspaces/Klpk1_War-Tiket-Konser/mobile
git pull origin main
npm install

# akun Expo gratis (sekali) — dibutuhkan tunnel
npx expo login

npx expo start --tunnel
```

- Jangan: `ipconfig` / `npx start`  
- Benar: `npx expo start --tunnel`  
- Scan QR dengan **Expo Go** di HP

Kalau error `@expo/ngrok`:

```bash
npm install @expo/ngrok@^4.1.0 --save-dev
npx expo start --tunnel
```

---

## 3. Cek IP di Linux (opsional, jarang dipakai di Codespace)

```bash
hostname -I
# atau
ip addr
```

Di Codespace, IP internal **tidak** bisa dijangkau HP. Selalu pakai **URL port Public** GitHub.

---

## Ringkas

| Langkah | Perintah / aksi |
|---------|------------------|
| API | `npm start` di root, port **3000 Public** |
| config.js | `BASE_URL = https://<codespace>-3000.app.github.dev` |
| Expo | `cd mobile && npx expo login && npx expo start --tunnel` |
| HP | Expo Go → scan QR tunnel |

Lihat juga `docs/BASEURL.md` dan materi P1 (tunnel jika beda jaringan).
