# ADR-003: Backend monolit untuk revisi Jumat (bukan 4 service penuh)

- **Status:** Accepted (sementara praktikum)
- **Tanggal:** 2026-08-19
- **Deciders:** Arsitek + Backend + Infra

## Konteks

Diagram awal punya event / ticket / payment / notification terpisah. Target Jumat hanya: **web poster + pilih kursi + info + sisa kursi**.

## Keputusan

Gabung **event + ticket + web static** dalam satu proses `api` (Express).

Ditunda dulu:

- payment-service + payment gateway
- notification-service + email/SMS provider
- message queue terpisah (pakai Redis list dulu)

Gateway Nginx tetap ada di depan untuk pola scale & base URL `:8080`.

## Konsekuensi

- (+) Demo Jumat cepat, satu `docker compose up`
- (+) Tetap bisa `--scale api=N` + Redis shared
- (-) Belum murni database-per-service
- (-) Pemisahan service bisa dilakukan belakangan tanpa ubah kontrak web (`/events`, `/orders`)
