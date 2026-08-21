# ADR-003: Backend monolit untuk revisi Jumat (bukan 4 service penuh)

- **Status:** Accepted (track Scalable) · Dilengkapi track Microservices terpisah
- **Tanggal:** 2026-08-19 · **Update:** 2026-08-21
- **Deciders:** Arsitek + Backend + Infra

## Konteks

Diagram awal punya event / ticket / payment / notification terpisah. Target Jumat Scalable: **web poster + pilih kursi + info + sisa kursi** + anti-oversell.

## Keputusan (awal)

Gabung **event + ticket + web static** dalam satu proses `api` (Express).

Semula ditunda:

- payment-service + payment gateway eksternal
- notification-service + email/SMS provider eksternal
- message queue broker terpisah (pakai Redis list dulu)

Gateway Nginx tetap di depan untuk pola scale & base URL `:8080`.

## Update implementasi (2026-08-21)

| Track | Isi |
|-------|-----|
| **Monolit** (`docker-compose.yml`) | Mock payment gateway + webhook/simulate; worker e-ticket (outbox lab); Redis queue |
| **Microservices** (`docker-compose.ms.yml`) | 4 service SQLite + Redis pub/sub `ticket.issued` — materi Modul 2 |

Kontrak web monolit tetap `/events`, `/orders` (+ `/payments/*`, `/mail/outbox` lab).

## Konsekuensi

- (+) Demo Scalable cepat, satu `docker compose up`, scale `api=N`
- (+) Track MS tidak memaksa rewrite web monolit
- (−) Dual stack — jangan jalankan monolit gateway + MS gateway di `:8080` bersamaan
- (−) Outbox e-ticket monolit butuh volume shared api↔worker (sudah di-compose)
