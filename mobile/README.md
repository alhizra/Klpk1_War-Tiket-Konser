# WTK Mobile (Expo)

Klien mobile **War Tiket Konser** — diselaraskan dengan web monolit (`public/`) untuk data event, denah, benefit, bayar lab, e-ticket, dan admin (termasuk upload poster).

Panduan langkah: [`JALANKAN.md`](./JALANKAN.md) · arsitektur: [`../docs/mobile/ARSITEKTUR-MOBILE.md`](../docs/mobile/ARSITEKTUR-MOBILE.md)

---

## Arsitektur singkat

```
RoleGate → User: Daftar → Denah (tabs) → Antrean → Pembayaran → ETicket
         → Admin: form CRUD + poster + denah regenerate + orders
                ↓
         api/*  →  BASE_URL (monolit :3000)
                ↓
    cache / outbox (AsyncStorage)  ·  eventMeta (tag/genre/benefit)
```

| Modul | File |
|-------|------|
| Config | `config.js` — `LAN_IP`, `BASE_URL`, `ADMIN_TOKEN` |
| Tema | `theme.js` — Melon light (hijau) |
| API | `api/client.js`, `endpoints.js`, `admin.js`, `cache.js`, `outbox.js` |
| Meta UI | `data/eventMeta.js` (port `public/event-meta.js`) |
| Layar | `screens/*Screen.js` |

---

## Layar

| # | Layar | Isi (parity web) |
|---|--------|------------------|
| 0 | **RoleGate** | Pilih User / Admin |
| 1 | **Daftar** | 30 event · poster · tag/genre/artist · harga min · sisa |
| 2 | **Denah** | Tabs Detail / Denah / Benefit / Notice · artist, gate, rating, jadwal, terms · harga zona · sketch · semua/per-zona · legend · max 4 · refresh 12s |
| 3 | **Antrean** | Virtual queue singkat |
| 4 | **Pembayaran** | Nama + email wajib · benefit · `POST /orders` · `POST /payments/simulate` |
| 5 | **ETicket** | Receipt (kode, total, email, benefit) · QR lokal · poll outbox |
| A | **Admin** | Field = web: kota, negara, startsAt, salesOpensAt, status, deskripsi, generate seats · **upload poster** · reset · regenerate denah · orders |

---

## Setup

```bat
cd mobile
npm install

REM 1) Pastikan monolit jalan di laptop: http://localhost:3000/api/health
REM 2) ipconfig → IPv4 Wi‑Fi → isi LAN_IP di config.js
REM 3) HP: Wi‑Fi SAMA laptop, matikan LTE
REM 4) Browser HP buka http://<LAN_IP>:3000/api/health dulu

npx expo start --lan -c
```

- **Expo Go** scan QR  
- Gagal LAN: `npx expo start --tunnel` (lihat `TUNNEL.md`)  
- Jangan jalankan `expo` dari **root** repo — dependency ada di `mobile/` saja  

### `config.js` (penting)

```js
export const LAN_IP = "10.x.x.x";  // ganti tiap ganti Wi‑Fi
export const ADMIN_TOKEN = "admin-wtk"; // sama .env monolit
// BASE_URL = http://LAN_IP:3000  (native) · http://127.0.0.1:3000 (web)
```

---

## API yang dipakai

| Method | Path | Dipakai di |
|--------|------|------------|
| GET | `/health` | (opsional cek) |
| GET | `/events?page&size` | Daftar + cache |
| GET | `/events/:id` | Denah/detail + cache |
| POST | `/orders` | Pembayaran (`email`, `buyerName`, `seatCodes`) |
| POST | `/payments/simulate` | Settle lab setelah order |
| GET | `/mail/outbox/:orderId` | Status e-ticket |
| GET/POST/PATCH/DELETE | `/admin/events…` | Admin CRUD |
| POST | `/admin/events/:id/reset-quota` | Reset stok |
| POST | `/admin/events/:id/regenerate-seats` | Denah multi-zona ulang |
| GET | `/admin/orders` | Order terbaru |

Header admin: `x-admin-token: <ADMIN_TOKEN>`.  
Poster create/update: body `poster` = data URL base64 (sama web).

---

## Fitur offline / resiliency

- Cache halaman list + detail (AsyncStorage)
- Banner offline / mode cache
- Outbox `POST /orders` saat jaringan putus → sinkron otomatis
- Client: retry 429 (backoff), mapping 400/409 di UI bayar
- E-ticket QR tetap di HP setelah dibuka sekali

---

## Alur uji demo

1. Role **User** → daftar **30 event** + poster  
2. Buka event → tab Detail (deskripsi/jadwal) → Denah → pilih 1–4 kursi  
3. Benefit zona terlihat → Lanjut → Antrean → isi nama+email → Bayar  
4. E-ticket: kode, total, QR, status mail outbox  
5. Role **Admin** → tambah konser + **Pilih gambar** poster → Buat  
6. Edit / Reset / Denah (regenerate) / Hapus · cek order list  

---

## Skrip npm

| Script | Arti |
|--------|------|
| `npm start` / `npx expo start` | Metro default |
| `npm run start:lan` | `--lan -c` (HP satu Wi‑Fi) |
| `npm run start:tunnel` | Tunnel ngrok |
| `npm run android` / `ios` / `web` | Target native/web |

---

## Dependensi penting

- Expo SDK ~52 · React Navigation native-stack  
- `expo-image-picker` — upload poster admin  
- `expo-file-system` — fallback baca base64  
- `react-native-qrcode-svg` — e-ticket  
- `@react-native-async-storage/async-storage` · NetInfo  

---

## P5 / serah

- EAS APK: [`../docs/mobile/BUILD.md`](../docs/mobile/BUILD.md)  
- Laporan: [`../docs/mobile/LAPORAN.md`](../docs/mobile/LAPORAN.md)  
- Ceklist modul: [`../docs/mobile/MODUL-3-CEKLIST.md`](../docs/mobile/MODUL-3-CEKLIST.md)  
