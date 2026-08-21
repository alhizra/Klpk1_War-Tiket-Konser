# Microservices — cara jalankan & uji

## Stack

| Service | Port | DB file |
|---------|-----:|---------|
| event | 3001 | `event.db` |
| ticket | 3002 | `ticket.db` |
| payment | 3003 | `payment.db` |
| notification | 3004 | `notification.db` |
| redis | 6379 | — |
| gateway | 8080 | — |

Compose file: **`docker-compose.ms.yml`** (terpisah dari monolit `docker-compose.yml`).

## Docker (disarankan)

```bash
# hentikan monolit di 8080 jika bentrok
docker compose -f docker-compose.ms.yml up --build -d
docker compose -f docker-compose.ms.yml ps

curl -s http://localhost:8080/health
curl -s http://localhost:8080/svc/event/health
curl -s "http://localhost:8080/v1/events?size=5"
```

## Alur E2E (materi)

```bash
# 1) login JWT
TOKEN=$(curl -s -X POST http://localhost:8080/v1/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"mhs-1\"}" | node -pe "JSON.parse(require('fs').readFileSync(0)).token")

# 2) bayar = lock + gateway (default auto-capture PAID) + ticket.issued
curl -s -X POST http://localhost:8080/v1/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"eventId\":1,\"qty\":1,\"email\":\"mhs@example.com\",\"buyerName\":\"Mhs 1\"}"

# 3) notifikasi modul (deliveries + log — tanpa Gmail)
curl -s http://localhost:8080/v1/notifications/recent
docker compose -f docker-compose.ms.yml logs notification --tail 8
```

## Payment & notif env (MS lab)

| Var | Default | Arti |
|-----|---------|------|
| `PAYMENT_PROVIDER` | `mock` | Gateway lab |
| `PAYMENT_AUTO_CAPTURE` | `1` | Settle langsung (E2E materi) |
| `SMTP_*` | kosong | Opsional; default = file outbox + log |


## Uji anti-oversell (ticket)

```bash
# tanpa token — langsung lock di ticket (lab)
for i in 1 2 3; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/v1/tickets/lock \
    -H "Content-Type: application/json" \
    -d "{\"eventId\":11,\"qty\":1}"
done
# setelah kuota event 11 habis → 409
```

## Dev Node lokal (4 terminal + Redis)

```bash
docker start wtk-redis   # atau: docker run -d -p 6379:6379 redis:7-alpine

cd services/event && npm i && set PORT=3001&& node index.js
cd services/ticket && npm i && set PORT=3002&& set EVENT_URL=http://localhost:3001&& node index.js
cd services/payment && npm i && set PORT=3003&& set EVENT_URL=http://localhost:3001&& set TICKET_URL=http://localhost:3002&& set REDIS_URL=redis://localhost:6379&& node index.js
cd services/notification && npm i && set PORT=3004&& set REDIS_URL=redis://localhost:6379&& node index.js
```

## Test otomatis

```bash
cd services/payment && npm test
cd services/ticket && npm test
```

## Monolit vs MS

| | Monolit (`docker-compose.yml`) | MS (`docker-compose.ms.yml`) |
|--|-------------------------------|------------------------------|
| Port web/API | 8080 / 3000 | Gateway 8080 path `/v1` |
| Mobile dev | monolit OK | set BASE ke gateway MS + path `/v1` |
| Praktikum Scalable | monolit | — |
| Praktikum Microservices | — | **MS** |
