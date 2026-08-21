# Email e-ticket — sesuai modul (lab)

## Yang diminta modul

| Stack | Bukti e-ticket |
|-------|----------------|
| **Monolit** | Worker konsumsi Redis queue → tulis outbox + audit `ETICKET_SENT` |
| **MS** | `notification` SUBSCRIBE `ticket.issued` → simpan `deliveries` + log |

**Tidak wajib** kirim ke Gmail sungguhan. Cukup:

```text
POST /orders (atau MS POST /v1/payments)
  → status PAID/CONFIRMED
  → GET /api/mail/outbox          (monolit)
  → GET /v1/notifications/recent  (MS)
  → log worker / notification
```

## Cara cek (demo)

```bash
# monolit
curl -s http://localhost:3000/api/mail/outbox

# MS
curl -s http://localhost:8080/v1/notifications/recent
docker compose -f docker-compose.ms.yml logs notification --tail 10
```

## Opsional (di luar modul)

Kalau ingin inbox Gmail: set `SMTP_*` di `.env` (App Password). Bukan syarat kelulusan lab.
