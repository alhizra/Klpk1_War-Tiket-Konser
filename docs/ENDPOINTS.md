# docs/ENDPOINTS.md — Endpoint kritis (final Scalable / monolit)

> Microservices (4 service): lihat [`ENDPOINTS-MS.md`](./ENDPOINTS-MS.md) + `openapi-ms.yaml`.

**Tema:** War Tiket Konser · **Sumber daya rebutan:** kursi (kuota per event)  
**Base URL:** lihat [`BASEURL.md`](./BASEURL.md) · **Kontrak:** `openapi.yaml` / `openapi-final.yaml` v2

| Method | Path | Jenis | Keterangan |
|--------|------|-------|------------|
| GET | `/health` | ops | `ok`, `instance`, `pid`, `paymentProvider` |
| GET | `/events` | baca | Paginasi `page`/`size`. Response `{ page, size, items }` |
| GET | `/events/{id}` | baca | Catalog + denah + **sisa live Redis** |
| POST | `/orders` | **panas** | Body `{ eventId, qty, seatCodes?, email?, buyerName? }`. **201** + sesi bayar · **409** kuota · **429** rate limit · max qty **4** |
| GET | `/orders/{id}` | baca | Status order / paidAt |
| POST | `/payments/webhook` | gateway | Mock settlement / Midtrans notify → PAID + enqueue e-ticket |
| POST | `/payments/simulate` | lab | Settle manual `{ orderId }` |
| GET | `/mail/outbox` | lab | Daftar e-ticket file (tanpa SMTP = bukan Gmail) |
| GET | `/mail/outbox/{orderId}` | lab | Isi e-ticket per order |
| GET | `/internal/quota/{id}` | debug | Snapshot Redis |
| POST | `/internal/reset-quota/{id}` | lab | Header `x-reset-token: dev-reset` |
| GET | `/admin/events` | admin | Semua event + sisa Redis. Header `x-admin-token` |
| POST | `/admin/events` | admin | Buat konser + denah default + init kuota |
| PATCH | `/admin/events/{id}` | admin | Ubah status/judul/kuota/… |
| DELETE | `/admin/events/{id}` | admin | Hapus konser + order/kursi/stok |
| POST | `/admin/events/{id}/reset-quota` | admin | Reset kuota Redis (token admin) |
| POST | `/admin/events/{id}/regenerate-seats` | admin | Buat ulang denah multi-zona (kursi diganti) |
| GET | `/admin/orders` | admin | Order terbaru (`?limit=50`) |

## Admin (lab)

- Header: `x-admin-token: <ADMIN_TOKEN>` (default env `admin-wtk`)
- UI monolit: http://localhost:3000/admin.html
- `POST /admin/events` body minimal: `{ title, artist, venue, startsAt, quotaTotal, priceIdr }` · opsional `status`, `generateSeats`, `categories[]`, `city`, `country`, `description`, `salesOpensAt`, **`poster`** (data URL base64 / path `/posters/…`)
- `PATCH /admin/events/{id}` field sama + `poster` untuk ganti gambar
- UI monolit: `/admin.html` · Mobile: layar Admin (upload galeri)

## Alias

Semua path di atas juga tersedia di prefix `/api` (contoh: `/api/events`, `/api/orders`) untuk static web. Halaman mock bayar: `/pay/mock.html`. Admin: `/admin.html`.

## Payment & email (modul lab)

| Env | Default | Arti |
|-----|---------|------|
| `PAYMENT_PROVIDER` | `mock` | Gateway lab (mock). `midtrans` opsional |
| `PAYMENT_AUTO_CAPTURE` | `1` | Settle langsung — cocok loadtest & demo |
| (tanpa SMTP) | default | **Sesuai modul:** e-ticket di outbox + `GET /api/mail/outbox` |
| `SMTP_*` | kosong | Opsional di luar modul (inbox nyata) |

## Kenapa kritis

| Endpoint | Alasan |
|----------|--------|
| `POST /orders` | Memotong kursi atomik — target loadtest; salah = **oversell** |
| `POST /payments/*` | Webhook bisa double — handler idempotent |
| `GET /events*` | Traffic baca tinggi; sisa kursi tidak di-TTL sebagai truth |
| `GET /health` | Bukti scale-out |

## Skenario uji beban (ringkas)

1. **Baca:** autocannon/k6 → `GET /events/1`  
2. **War:** N× `POST /orders` `{ "eventId": 1, "qty": 1 }` setelah reset kuota  
3. **Konsistensi:** `terjual + sisa == quota_total` dan `terjual <= quota_total`  
4. **409** dihitung terpisah dari **5xx** (409 = bisnis OK)

Perintah: `loadtest/run-p1-local.ps1` atau `loadtest/k6-orders.js`.  
Angka: [`BASELINE.md`](./BASELINE.md).
