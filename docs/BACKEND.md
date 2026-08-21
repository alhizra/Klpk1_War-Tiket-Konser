# docs/BACKEND.md — Backend/API Engineer

## Tanggung jawab
- Endpoint panas `POST /orders` anti-oversell
- Endpoint baca `GET /events/:id` + list pagination
- Rate limiting header standar
- Worker e-ticket tidak memblokir path order (async Redis queue)
- Payment lab: mock gateway + auto-capture; webhook/simulate untuk alur PAID
- E-ticket modul: worker → outbox `data/outbox-mail/` + audit; `GET /api/mail/outbox` (SMTP opsional)
- Seat codes atomik (Lua SADD); PENDING_PAYMENT expire → lepas kuota (`PAYMENT_TTL_MIN`)
- Docker: volume shared `outbox-mail` api↔worker; healthcheck api sebelum gateway
- Tes: `npm test` (quota Lua + payment mock)

## Alur POST /orders
1. Validasi `eventId`, `qty` (1–4)
2. Ambil catalog (cache-aside OK)
3. `DECRBY quota:event:{id} qty` atomik
4. Jika sisa < 0 → rollback `INCRBY` → **409**
5. Persist order Postgres
6. `LPUSH queue:eticket`
7. **201** + `sisa`

## File inti
| File | Isi |
|------|-----|
| `src/routes.js` | Routing HTTP |
| `src/services/orders.js` | Orkestrasi order |
| `src/services/quota.js` | DECR atomik |
| `src/services/eventCache.js` | Cache catalog |
| `src/middleware/rateLimit.js` | 429 + headers |
| `src/worker.js` | Consumer antrean |

## Kontrak error
| Kode | Arti |
|------|------|
| 201 | Order OK |
| 400 | Body invalid |
| 404 | Event tidak ada |
| 409 | Kuota habis (sah) |
| 429 | Rate limit |
| 5xx | Gagal sistem |

## Uji cepat
```bash
curl -s http://localhost:8080/health
curl -s -X POST http://localhost:8080/orders \
  -H "Content-Type: application/json" \
  -d '{"eventId":1,"qty":1}'
```
