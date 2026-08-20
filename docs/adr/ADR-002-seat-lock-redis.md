# ADR-002: Kunci kuota kursi atomik di Redis (Lua)

- **Status:** Accepted
- **Tanggal:** 2026-08-19
- **Deciders:** Backend + Data

## Konteks

Sumber daya rebutan = kursi. Saat war, banyak request `POST /orders` bersamaan. Read-modify-write biasa menyebabkan **oversell**.

## Keputusan

Kuota runtime di Redis, dipotong dengan **Lua script** (`DECRBY` + rollback `INCRBY` dalam satu evaluasi atomik).

- Key: `quota:event:{id}`, `sold:event:{id}`
- Gagal (sisa < 0) → HTTP **409** (penolakan sah)
- Order sukses di-persist Postgres; e-ticket lewat antrean async

Catalog event boleh di-cache; **sisa kursi tidak di-cache TTL**.

## Konsekuensi

- (+) 0 oversell multi-replika di belakang gateway
- (+) p95 path order tetap rendah
- (-) Perlu Redis + reconcile/seed kuota saat start / `data:manual`
