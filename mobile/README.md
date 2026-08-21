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
# HP beda jaringan / cuma LTE → wajib tunnel:
npx expo start --tunnel
# cache rusak:
npx expo start -c
```

Scan QR dengan **Expo Go** (versi SDK **52** — update Expo Go di Play Store bila diminta).

### HP error biru "Something went wrong"
1. Status bar HP harus **Wi‑Fi** (bukan hanya LTE) **satu SSID** dengan laptop — ATAU pakai `--tunnel`.  
2. Di terminal Expo tekan `s` lalu pilih tunnel, atau `npm run start:tunnel`.  
3. Pastikan Expo Go tidak terlalu lama/terlalu baru vs SDK 52.  
4. API tetap harus reachable dari HP: `BASE_URL` = `http://IP-laptop:3000` (bukan localhost).
## Alur uji

1. Daftar 11 event muncul (poster dari `/posters/...` di API)  
2. Pilih event → pilih 1–4 kursi → antrean → bayar  
3. 201 → e-ticket; 409 → pesan kursi habis  

## API yang dipakai

Lihat `../docs/BASEURL.md` dan `../openapi-final.yaml`:

- `GET /events?page&size`  
- `GET /events/{id}`  
- `POST /orders`  

## Fitur P3–P4 (sudah)

- 429 exponential backoff + mapping 409/429 di pembayaran  
- Cache list/detail (AsyncStorage) + banner mode luring  
- Outbox `POST /orders` offline → sinkron saat online  
- E-ticket **QR** lokal (`react-native-qrcode-svg`)  

## P5 (serah CozyLab)

- EAS APK — lihat `docs/mobile/BUILD.md`  
- Demo video ujung-ke-ujung  
- `docs/mobile/LAPORAN.md` (6 bagian)