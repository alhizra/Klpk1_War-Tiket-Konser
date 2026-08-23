# Base URL + aturan pemakaian

Artefak lapisan **Scalable Systems** — dipakai Mobile, loadtest, dan demo.

## Base URL

| Lingkungan | URL | Keterangan |
|------------|-----|------------|
| Dev Node lokal | `http://localhost:3000` | `npm start` + Postgres/Redis |
| Gateway Docker | `http://localhost:8080` | `docker compose up` → Nginx |
| Codespace / demo publik | `https://<codespace>-8080.app.github.dev` | Port **8080** Visibility **Public** |
| HP (Expo / Mobile) | `http://<IPv4-laptop>:8080` | **Jangan** `localhost` dari HP |

Ganti `<IPv4-laptop>` lewat `ipconfig` (Windows) → IPv4 Address jaringan Wi‑Fi yang sama dengan HP.

## Aturan kontrak (`openapi-final.yaml` → `x-baseurl-rules`)

| Aturan | Nilai | Implementasi |
|--------|------:|--------------|
| Rate limit | **60** req / menit / IP | `RATE_LIMIT=60` (default `src/config.js`) |
| Page size default | **20** | `GET /events?page=1&size=20` |
| Page size max | **50** | `Math.min(size, 50)` di `src/routes.js` |
| Max qty per order | **4** | `maxQtyPerOrder` + validasi order |

### Lab / loadtest

Saat uji 5000× `POST /orders`, rate limit sengaja dinaikkan agar **409 kuota** tidak tertutup **429**:

```bash
set RATE_LIMIT=10000
npm start
```

Atau di `docker-compose.yml`: `RATE_LIMIT: ${RATE_LIMIT:-10000}` untuk skenario war.

**Produksi / Mobile demo:** kembalikan ke **60**/menit agar sesuai aturan baseurl.

## Endpoint yang boleh dipanggil klien

| Method | Path | Catatan |
|--------|------|---------|
| GET | `/health` | Health + `instance` |
| GET | `/events` | Paginasi `page`, `size` |
| GET | `/events/{id}` | Detail + seats + **sisa live** |
| POST | `/orders` | Body `{ eventId, qty, seatCodes? }` — **panas** |

Alias `/api/...` tersedia (web monolit).  
Internal lab saja: `POST /internal/reset-quota/{id}` + header `x-reset-token: dev-reset`.

## Dataset (sumber daya rebutan = kursi)

- **30 event** / **10.890** seat codes
- Sumber: `data/DATA_WAR_TIKET_KONSER.xlsx`  
- Anti-oversell: Redis atomik (`src/services/quota.js`) — **409 = penolakan sah**

## Verifikasi cepat

```bash
curl -s http://localhost:3000/health
curl -s "http://localhost:3000/events?page=1&size=20"
curl -s -X POST http://localhost:3000/orders -H "Content-Type: application/json" -d "{\"eventId\":1,\"qty\":1}"
```
