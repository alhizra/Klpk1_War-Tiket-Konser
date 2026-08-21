# docs/ENDPOINTS.md — Endpoint kritis (final Scalable / monolit)

> Microservices (4 service): lihat [`ENDPOINTS-MS.md`](./ENDPOINTS-MS.md) + `openapi-ms.yaml`.

**Tema:** War Tiket Konser · **Sumber daya rebutan:** kursi (kuota per event)  
**Base URL:** lihat [`BASEURL.md`](./BASEURL.md) · **Kontrak:** `openapi.yaml` / `openapi-final.yaml` v2

| Method | Path | Jenis | Keterangan |
|--------|------|-------|------------|
| GET | `/health` | ops | `ok`, `instance`, `pid` (bukti multi-replika) |
| GET | `/events` | baca | Paginasi `page` (default 1), `size` (default 20, max 50). Response `{ page, size, items }` |
| GET | `/events/{id}` | baca | Catalog + denah seats + **sisa/terjual live Redis**. Field `from`: `cache` \| `db` (catalog saja) |
| POST | `/orders` | **panas** | Body `{ eventId, qty, seatCodes? }`. **201** sukses · **409** kuota habis (sah) · **429** rate limit · max qty **4** |
| GET | `/internal/quota/{id}` | debug | Snapshot Redis (bukan untuk Mobile) |
| POST | `/internal/reset-quota/{id}` | lab | Header `x-reset-token: dev-reset` — reset sisa = `quota_total` untuk ulang loadtest |

## Alias

Semua path di atas juga tersedia di prefix `/api` (contoh: `/api/events`, `/api/orders`) untuk static web.

## Kenapa kritis

| Endpoint | Alasan |
|----------|--------|
| `POST /orders` | Memotong kursi atomik — target utama loadtest; salah implementasi = **oversell** |
| `GET /events`, `GET /events/{id}` | Traffic baca tinggi; cache catalog OK, **sisa kursi tidak boleh di-TTL-cache sebagai truth** |
| `GET /health` | Bukti scale-out (`instance` beda per replika di belakang gateway) |

## Skenario uji beban (ringkas)

1. **Baca:** autocannon/k6 → `GET /events/1`  
2. **War:** N× `POST /orders` `{ "eventId": 1, "qty": 1 }` setelah reset kuota  
3. **Konsistensi:** `terjual + sisa == quota_total` dan `terjual <= quota_total`  
4. **409** dihitung terpisah dari **5xx** (409 = bisnis OK)

Perintah: `loadtest/run-p1-local.ps1` atau `loadtest/k6-orders.js`.  
Angka: [`BASELINE.md`](./BASELINE.md).
