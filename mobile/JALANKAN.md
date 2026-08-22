# Jalankan Mobile — mengikuti panduan Modul 3

Sumber: *Mobile and Cross-Platform Development* — Pertemuan 1–2  
(Expo + `config.js` + `fetch` API squad + satu jaringan / tunnel)

---

## Bekal (materi)

| Bekal | Di repo ini |
|--------|-------------|
| Base URL + aturan | `docs/BASEURL.md` · page **20** · rate **60**/mnt |
| Kontrak API | `openapi-final.yaml` / monolit `GET /events` |
| `config.js` | `mobile/config.js` |

---

## Langkah 1 — Perkakas (materi P1)

- Laptop: Node terpasang (`node -v` ≥ 18)
- HP: aplikasi **Expo Go** (Play Store / App Store)

---

## Langkah 2 — API squad hidup (artefak Scalable)

Di laptop, biarkan terminal ini terbuka:

```bat
cd C:\Users\User\Downloads\War-Tiket-Konser
docker start wtk-pg wtk-redis
set DATABASE_URL=postgres://wtk:wtk@localhost:5432/wtk
set REDIS_URL=redis://localhost:6379
set PORT=3000
node src/server.js
```

Bukti (materi: uji dari laptop dulu):

```bat
curl http://localhost:3000/health
curl "http://localhost:3000/events?page=1&size=20"
```

---

## Langkah 3 — BASE_URL di satu tempat (materi P1 Langkah 6)

Materi: **jangan** `localhost` di HP. Ambil IP laptop:

```bat
ipconfig
```

Cari **IPv4** adapter **Wi‑Fi** (bukan `172.x` vEthernet/WSL).

Edit **hanya** `mobile/config.js`:

```js
// Expo web / emulator di laptop:
export const BASE_URL = "http://127.0.0.1:3000";
// HP fisik Expo Go (ganti IPv4 Wi‑Fi kamu):
// export const BASE_URL = "http://10.87.96.26:3000";
export const PAGE_SIZE = 20; // aturan baseurl materi
```

| Situasi | BASE_URL |
|---------|----------|
| Expo **web** / emulator di laptop | `http://127.0.0.1:3000` |
| HP + laptop Wi‑Fi sama | `http://<IPv4-Wi-Fi>:3000` |
| HP ke **hotspot laptop** | `http://192.168.137.1:3000` (cek `ipconfig`) |
| Dilarang di **HP fisik** | `localhost`, `127.0.0.1` |

Layar **Pembayaran** wajib isi nama + email (backend menolak 400 jika kosong).

---

## Langkah 4 — Nyalakan Expo (materi P1 Langkah 2–3)

```bat
cd C:\Users\User\Downloads\War-Tiket-Konser\mobile
npm install
npx expo start
```

1. Terminal menampilkan **QR** dan `Metro waiting on exp://...`
2. **HP dan laptop satu jaringan Wi‑Fi** (materi: wajib)
3. Buka **Expo Go** → pindai QR
4. Tunggu bundling → layar daftar konser (`GET /events`)

Fast Refresh: ubah teks di app → simpan → HP berubah tanpa scan ulang (materi P1 Langkah 5).

---

## Kalau macet — hanya cara di materi

### Layar tidak memuat / QR tak terbaca (materi P1)

> HP dan laptop wajib **satu jaringan Wi‑Fi yang sama**.  
> Jaringan kampus yang memisahkan perangkat (client isolation) sering gagal.  
> **Jalan pintas materi:** hotspot HP — sambungkan laptop ke hotspot, pindai ulang.  
> **Atau:** tunnel:

```bat
npx expo start --tunnel
```

(Materi: lebih lambat, tembus beda jaringan. Tunnel Expo bisa minta login akun expo.dev.)

### Gagal memuat data (materi P1)

1. `Network request failed` → cek `BASE_URL` di `config.js`  
2. Dari laptop: `curl http://<IP-laptop>:3000/events`  
3. Laptop bisa, HP tidak → IP salah atau **beda jaringan**  
4. `404` → path salah (harus `/events` sesuai openapi)  
5. `429` → kena batas laju (materi P3: backoff — sudah di `api/client.js`)

### Perintah yang salah

| Jangan | Ikuti materi |
|--------|----------------|
| `npx start` | `npx expo start` |
| URL di hardcode di banyak file | Hanya `config.js` |

---

## Langkah 5 — Yang harus tampil (materi P1 selesai)

- Daftar kartu dari API (bukan teks bawaan Expo)
- Field nama: `title` / `artist` (sudah di `DaftarScreen`)
- Ketuk kartu → detail / denah (P2 navigasi — sudah di app)

---

## Commit materi (opsional)

```bat
git add mobile
git commit -m "P1: aplikasi Expo pertama memanggil API squad"
```

---

## Ringkas (copy-paste)

```bat
REM Terminal 1 — API
cd C:\Users\User\Downloads\War-Tiket-Konser
set DATABASE_URL=postgres://wtk:wtk@localhost:5432/wtk
set REDIS_URL=redis://localhost:6379
set PORT=3000
node src/server.js

REM Terminal 2 — Expo (setelah ipconfig + edit config.js)
cd C:\Users\User\Downloads\War-Tiket-Konser\mobile
npx expo start
```

HP: **Wi‑Fi sama** → Expo Go → scan QR.
