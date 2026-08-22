# WTK Mobile (Expo) — mengikuti Modul 3

Panduan langkah demi langkah sesuai materi lab: **[`JALANKAN.md`](./JALANKAN.md)**

## Lima layar (materi tema War Tiket)

1. Daftar konser · 2. Denah & pilih kursi · 3. Antrean · 4. Pembayaran · 5. E-ticket QR  

## Setup singkat (materi P1)

```bat
cd mobile
npm install
REM edit config.js → BASE_URL = http://<IPv4-Wi-Fi-laptop>:3000
npx expo start
```

- HP + laptop **satu Wi‑Fi** (materi) → scan QR di **Expo Go**  
- Gagal jaringan (materi): `npx expo start --tunnel`  
- Jangan `npx start` — yang benar `npx expo start`  
## Alur uji

1. Daftar 11 event muncul (poster dari `/posters/...` di API)  
2. Pilih event → pilih 1–4 kursi → antrean → bayar  
3. Di **Pembayaran**: isi **nama + email** (wajib, sama seperti web)  
4. 201 → e-ticket QR; 400 nama/email; 409 kursi habis  

## API yang dipakai

Lihat `../docs/BASEURL.md` dan `../openapi-final.yaml`:

- `GET /events?page&size`  
- `GET /events/{id}`  
- `POST /orders` body: `eventId`, `qty`, `seatCodes?`, **`email`**, **`buyerName`**  


## Fitur P3–P4 (sudah)

- 429 exponential backoff + mapping 409/429 di pembayaran  
- Cache list/detail (AsyncStorage) + banner mode luring  
- Outbox `POST /orders` offline → sinkron saat online  
- E-ticket **QR** lokal (`react-native-qrcode-svg`)  

## P5 (serah CozyLab)

- EAS APK — lihat `docs/mobile/BUILD.md`  
- Demo video ujung-ke-ujung  
- `docs/mobile/LAPORAN.md` (6 bagian)