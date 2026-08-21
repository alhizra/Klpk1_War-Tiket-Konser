# Endpoint kritis — Microservices

| Method | Path | Service | Auth | Keterangan |
|--------|------|---------|------|------------|
| GET | `/v1/events` | event | — | List catalog |
| GET | `/v1/events/{id}` | event | — | Detail |
| GET | `/v1/events/{id}/seats` | ticket | — | Ketersediaan kursi |
| POST | `/v1/tickets/lock` | ticket | — | **Panas** — kunci kursi |
| POST | `/v1/tickets/confirm` | ticket | — | HELD → SOLD |
| POST | `/v1/tickets/release` | ticket | — | Batal hold |
| POST | `/v1/login` | payment | — | JWT lab |
| POST | `/v1/payments` | payment | **Bearer** | E2E bayar + event |
| GET | `/v1/catalog` | payment | — | Proxy + stale fallback |
| GET | `/v1/notifications/recent` | notification | — | Bukti e-ticket |

Kontrak: `openapi-ms.yaml` · Gateway: `:8080`
