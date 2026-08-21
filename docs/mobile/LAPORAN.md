# LAPORAN — War Tiket Konser (Squad Klpk1)

## Ringkasan Produk

Sistem war tiket konser Asia (11 event) dengan anti-oversell kursi di backend monolit + Redis, web Melon-style, dan aplikasi Expo sebagai wajah pengguna.

## Lapisan Microservices — Apa yang Dirancang

Monolit revisi Jumat: event catalog + order + worker e-ticket. Context map dan ADR di `architecture/` + `docs/adr/`. Pemecahan 4 service penuh (event/ticket/payment/notification) adalah backlog modul Microservices.

## Lapisan Scalable — Apa yang Diukur

- Dataset: 11 event / 3850 seats  
- Anti-oversell: Redis atomik — uji 500 shot event TREASURE → **201=400, 409=100, oversell=TIDAK** (`docs/BASELINE.md`)  
- Base URL rules: 60 req/menit, page 20/max 50 (`docs/BASEURL.md`)  
- Loadtest: `loadtest/oversell-check.ps1`, `run-p1-local.ps1`, `k6-orders.js`

## Lapisan Mobile — Wajah untuk Pengguna

- Folder: `mobile/` (Expo)  
- BASE_URL: lihat `mobile/config.js`  
- Lima layar: Daftar → Denah → Antrean → Pembayaran → E-Ticket  
- API layer: `mobile/api/client.js`, `endpoints.js`  
- Transaksi: `POST /orders` + penanganan 409/429  

## Apa yang Dipelajari

- Poster eksternal sering diblokir hotlink → simpan di `public/posters/`  
- Rate limit 60/mnt untuk Mobile; lab war naikkan `RATE_LIMIT` agar 409 terlihat  
- `localhost` tidak valid dari HP  

## Pembagian Peran & Kontribusi

Lihat `PERAN.md`.
