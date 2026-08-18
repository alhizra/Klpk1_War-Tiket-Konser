# War Tiket Konser

Praktikum **Scalable Systems Design** · Tema: penjualan tiket + kuota kursi terbatas.

Jalur: Microservices → **Scalable Systems** → Mobile.

## Endpoint kritis

| Jenis | Method | Path |
|-------|--------|------|
| Panas | `POST` | `/orders` |
| Baca | `GET` | `/events/:id` |
| Health | `GET` | `/health` |

Skenario beban: **5000** permintaan, **500** kursi → wajib **0 oversell**.

## Jalankan

```bash
docker compose up -d --build
docker compose ps
curl -s http://localhost:8080/health
curl -s http://localhost:8080/events/1
```

### Order manual

```bash
curl -s -X POST http://localhost:8080/orders \
  -H "Content-Type: application/json" \
  -d "{\"eventId\":1,\"qty\":1}"
```

### Baseline (P1)

```bash
npx autocannon -c 50 -d 15 http://localhost:8080/events/1

npx autocannon -c 200 -a 5000 \
  -m POST -H "Content-Type: application/json" \
  -b "{\"eventId\":1,\"qty\":1}" \
  http://localhost:8080/orders

curl -s http://localhost:8080/events/1
```

Catat angka di [`docs/BASELINE.md`](docs/BASELINE.md).

### Multi-salinan (P2)

```bash
docker compose up -d --scale api=3
for /L %i in (1,1,6) do @curl -s http://localhost:8080/health
```

## Struktur

```
├── docker-compose.yml
├── nginx.conf
├── openapi.yaml
├── db/init.sql
├── src/                 # Backend API + worker
├── docs/DATA.md         # Strategi data/cache/antrean
├── docs/BASELINE.md     # Logbook load test
├── AI-LOG.md
├── PERAN.md
└── architecture/        # Diagram arsitek
```

## Peran

Lihat [`PERAN.md`](PERAN.md). Backend + Data diimplementasikan di `src/` dan `docs/DATA.md`.

## Artefak Scalable Systems (target P5)

1. `openapi-final` — `openapi.yaml` (naik ke 2.0.0 di P4)
2. `baseurl` — `http://<host>:8080` + rate limit + page size 20
3. `loadtest` — tabel sebelum vs sesudah di `docs/BASELINE.md`
