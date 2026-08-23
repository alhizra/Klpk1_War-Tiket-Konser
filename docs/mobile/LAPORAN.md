# LAPORAN — War Tiket Konser (Squad Klpk1)

## 1. Ringkasan Produk

Sistem war tiket konser Asia (**30 event**, **10.890 kursi**) dengan anti-oversell di backend monolit + Redis, web Melon-style, dan aplikasi Expo (5 layar) sebagai wajah pengguna. Sumber daya rebutan: **kursi/kuota per event**.

## 2. Lapisan Microservices — Apa yang Dirancang

Monolit revisi Jumat: catalog event, `POST /orders`, worker e-ticket. ADR & arsitektur di `docs/adr/`, `architecture/`. Pemecahan 4 service penuh (event/ticket/payment/notification) = backlog modul Microservices bila diminta terpisah.

## 3. Lapisan Scalable — Apa yang Diukur

| Item | Hasil |
|------|--------|
| Dataset | 30 event / 10.890 seats |
| Anti-oversell | 500× POST event TREASURE → **201=400, 409=100, oversell=TIDAK** |
| Base URL rules | 60 req/menit, page 20 / max 50 |
| Dokumen | `docs/BASEURL.md`, `docs/BASELINE.md`, `docs/ENDPOINTS.md` |
| Loadtest | `loadtest/oversell-check.ps1`, `run-p1-local.ps1`, `k6-orders.js` |

## 4. Lapisan Mobile — Wajah untuk Pengguna

| Fitur | Status |
|-------|--------|
| Expo app `mobile/` | Ya |
| 5 layar materi | Daftar → Denah → Antrean → Bayar → E-Ticket QR |
| `config.js` BASE_URL | Ya (IPv4 Wi‑Fi, bukan localhost/WSL) |
| `api/client` + 429 backoff | Ya |
| Paginasi 20 | Ya |
| POST /orders + kunci tombol | Ya |
| Offline cache list/detail | Ya (AsyncStorage) |
| Outbox order offline | Ya |
| QR e-ticket lokal | Ya (`react-native-qrcode-svg`) |
| Banner mode luring | Ya (NetInfo) |

Detail: `docs/mobile/ARSITEKTUR-MOBILE.md`, `DATA-MOBILE.md`, `BUILD.md`.  
**Ceklist Modul 3 + troubleshooting HP:** [`MODUL-3-CEKLIST.md`](./MODUL-3-CEKLIST.md).

## 5. Apa yang Dipelajari

- Poster CDN sering diblokir → simpan di `public/posters/`.  
- IP `172.x` (WSL/vEthernet) **bukan** untuk HP; pakai IPv4 Wi‑Fi / hotspot.  
- Tunnel Expo butuh akun Expo; LAN cukup jika satu jaringan.  
- Rate limit lab vs Mobile: lab naikkan `RATE_LIMIT` agar 409 kuota terlihat.

## 6. Pembagian Peran & Kontribusi

Lihat `PERAN.md`. Setiap peran mengisi AI-LOG minimal 5 entri bermakna.
