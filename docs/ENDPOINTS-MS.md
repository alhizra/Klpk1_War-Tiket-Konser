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
| POST | `/v1/payments` | payment | **Bearer** | Lock + gateway; default auto-settle PAID + `ticket.issued`. Body opsional `email`, `buyerName` |
| POST | `/v1/payments/{id}/settle` | payment | **Bearer** | Settle manual bila `PAYMENT_AUTO_CAPTURE=0` |
| POST | `/v1/payments/webhook` | payment | — | Webhook mock/Midtrans |
| GET | `/v1/payments/{id}` | payment | — | Status bayar |
| GET | `/v1/catalog` | payment | — | Proxy + stale fallback |
| GET | `/v1/notifications/recent` | notification | — | Bukti e-ticket (+ `mailMode`, `mailTo`) |

Kontrak: `openapi-ms.yaml` · Gateway: `:8080`

## Email (notification)

Tanpa `SMTP_*`: outbox file di container + log. Set `SMTP_HOST`/`USER`/`PASS` agar masuk inbox nyata. `MAIL_USE_ETHEREAL=1` hanya untuk preview Ethereal (bukan Gmail).
