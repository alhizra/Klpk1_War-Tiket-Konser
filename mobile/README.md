# WTK Mobile (Expo) — Lapisan Mobile

Aplikasi wajah untuk API squad **War Tiket Konser**.

## Lima layar (materi)

1. Daftar konser  
2. Denah & pilih kursi  
3. Antrean virtual  
4. Pembayaran (`POST /orders`)  
5. E-ticket (kode order; QR penuh di P4)

## Syarat

- API squad hidup (`npm start` di root repo) + Postgres/Redis  
- Node 18+  
- Expo Go di HP (opsional)

## Setup

```bash
cd mobile
npm install
```

Edit **`config.js`**:

| Di mana jalan | BASE_URL |
|---------------|----------|
| Expo web / mesin sama | `http://localhost:3000` |
| Emulator Android | `http://10.0.2.2:3000` |
| HP fisik (satu Wi‑Fi) | `http://<IPv4-laptop>:3000` |

IPv4 laptop: `ipconfig` → contoh `10.87.96.26`.

```bash
npx expo start
```

Scan QR dengan Expo Go. Android cleartext HTTP diizinkan di `app.json`.

## Alur uji

1. Daftar 11 event muncul (poster dari `/posters/...` di API)  
2. Pilih event → pilih 1–4 kursi → antrean → bayar  
3. 201 → e-ticket; 409 → pesan kursi habis  

## API yang dipakai

Lihat `../docs/BASEURL.md` dan `../openapi-final.yaml`:

- `GET /events?page&size`  
- `GET /events/{id}`  
- `POST /orders`  

## Berikutnya (P3–P5)

- P3: harden 429/409 (sudah sebagian di `api/client.js`)  
- P4: AsyncStorage + QR (`react-native-qrcode-svg`) offline  
- P5: EAS APK + demo + `LAPORAN.md`
