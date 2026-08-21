# ARSITEKTUR.md — Microservices War Tiket Konser

## Kalimat domain
Sistem kami menjaga agar **kursi** tetap konsisten walau ribuan orang menyerbu bersamaan.

## Context map (4 bounded context)

```
┌─────────────┐     GET catalog      ┌──────────────┐
│   Client    │ ───────────────────► │ event-service│  :3001
│  (Mobile/   │                      │  SQLite      │
│   Web/curl) │                      │  events+cats│
└──────┬──────┘                      └──────────────┘
       │                                      ▲
       │ POST /v1/payments (JWT)              │ GET /v1/events/:id
       ▼                                      │
┌──────────────┐   POST lock/confirm   ┌──────────────┐
│payment-service│ ───────────────────► │ticket-service│  :3002
│ SQLite        │                      │ SQLite seats │
│ payments      │ ◄─────────────────── │ HOLD→SOLD    │
└──────┬───────┘   201 / 409           └──────────────┘
       │
       │ PUBLISH ticket.issued (Redis)
       ▼
┌──────────────────┐
│notification-svc  │  :3004  SUBSCRIBE → log e-ticket
│ SQLite deliveries│
└──────────────────┘
```

Gateway Nginx `:8080` merutekan path `/v1/*` ke service terkait.

## Tabel DDD (materi)

| Layanan | Tanggung jawab | Data milik sendiri |
|---------|----------------|-------------------|
| **event-service** | Katalog konser, jadwal, kategori, harga catalog | `events`, `categories` (SQLite) |
| **ticket-service** | Kunci kursi, konfirmasi, lepas hold; **anti-oversell** | `seats`, `holds` (SQLite) |
| **payment-service** | Login JWT, terima bayar, orkestrasi lock→confirm, publish event | `payments` (SQLite) |
| **notification-service** | Kirim e-ticket async dari event | `deliveries` (SQLite) |

**Aturan emas:** service lain tidak menyentuh DB tetangga — hanya REST atau Redis pub/sub.

## Endpoint kritis

| Method | Path | Service | Kenapa kritis |
|--------|------|---------|---------------|
| GET | `/v1/events` | event | Baca catalog |
| POST | `/v1/tickets/lock` | ticket | **Merebut kursi** |
| POST | `/v1/payments` | payment | Bayar + konfirmasi + event |
| POST | `/v1/login` | payment | JWT untuk tulis |

## Komunikasi

| Interaksi | Pola | Alasan |
|-----------|------|--------|
| payment → event (cek event) | REST sinkron | Butuh jawaban sekarang |
| payment → ticket lock/confirm | REST sinkron | Butuh 201/409 |
| payment → notification | **Async** Redis `ticket.issued` | Tidak menunggu email |

## Resiliency (payment)

- Timeout + retry pada **GET** catalog (`panggilTahan`)
- Circuit breaker sederhana + fallback cache pada `GET /v1/catalog`
- POST lock: retry minimal (hindari double-lock)
- Jika confirm gagal setelah bayar lab: **release hold** (kompensasi)

## Menjalankan

```bash
docker compose -f docker-compose.ms.yml up --build
# Gateway http://localhost:8080
```

Dev lokal tanpa Docker service images: lihat `docs/MICROSERVICES.md`.
