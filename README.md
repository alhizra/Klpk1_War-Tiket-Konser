# War Tiket Konser — Klpk1



---

## Context Map

```mermaid
graph LR
  Web((Web UI)) --> GW[Gateway :8080]
  Mobile((Mobile later)) --> GW
  GW --> API[api monolit<br/>event + ticket + static]
  API --> PG[(PostgreSQL)]
  API --> RD[(Redis kuota atomik)]
  API -.->|queue eticket| W[worker]
```

> Panah penuh = request sinkron. Putus-putus = async Redis list.

---

## Services (mapping)

| Komponen | Port / role | Tanggung jawab | Data |
|----------|-------------|----------------|------|
| `gateway` (Nginx) | **8080** | Entry Web/API, siap scale | — |
| `api` | 3000 internal | Event catalog, denah, **POST /orders** anti-oversell, web UI | events, seats, orders |
| `worker` | — | Konsumsi antrean e-ticket | audit |
| `postgres` | internal | Persist catalog + order | `wtk` DB |
| `redis` | internal | **Kuota kursi atomik** + cache + queue | keys `quota:*` |

Aturan: **sumber daya rebutan = kursi** → hanya dipotong atomik di Redis (lihat ADR-002).

Ditunda (sesuai revisi Jumat): `payment-service`, `notification-service` eksternal, payment gateway.

---

## Data domain (Excel — milik squad ini)

| ID | Artis | Venue | Kursi |
|----|--------|--------|------:|
| 1 | TREASURE | KSPO DOME, Seoul | 400 |
| 2 | LYKN | Impact Arena, Bangkok | 280 |
| 3 | BLACKPINK | Seoul World Cup Stadium | 500 |
| 4 | NCT DREAM | Gocheok Sky Dome, Seoul | 350 |
| 5 | EXO | Jamsil Indoor Stadium | 320 |
| 6 | ATEEZ | BEXCO Auditorium, Busan | 380 |
| 7 | BUS | Thunder Dome, Bangkok | 250 |

Total denah: **2480** seat codes · sumber `data/DATA_WAR_TIKET_KONSER.xlsx`.

```bash
npm run data:excel   # import Excel → JSON/CSV + load Postgres/Redis
```

---

## Kontrak API

| File | Versi | Status |
|------|-------|--------|
| [`openapi.yaml`](./openapi.yaml) | 1.0.0 | Development |
| [`openapi-final.yaml`](./openapi-final.yaml) | 2.0.0 | Draft beku (P4) |

### Endpoint kritis

| Endpoint | Keterangan |
|----------|------------|
| `GET /events` | Daftar konser + paginasi |
| `GET /events/{id}` | Detail + seats + **sisa live** |
| `POST /orders` | **Panas** — lock kuota, 409 jika habis |
| `GET /health` | Instance id (bukti replika) |

Web UI: `http://localhost:8080/` · API sama host.

---

## ADR

| ADR | Keputusan |
|-----|-----------|
| [ADR-001](./docs/adr/ADR-001-pagination.md) | Paginasi wajib |
| [ADR-002](./docs/adr/ADR-002-seat-lock-redis.md) | Redis Lua anti-oversell |
| [ADR-003](./docs/adr/ADR-003-monolit-revisi-jumat.md) | Monolit dulu untuk Jumat |

---

## Menjalankan

Panduan lengkap (laptop + **GitHub Codespaces**): [`docs/CARA-JALANKAN.md`](./docs/CARA-JALANKAN.md)

### GitHub Codespaces (teman / demo online)
1. Repo → **Code** → **Codespaces** → Create / Open  
2. Tunggu `postCreate` (compose + dataset Excel 7 event)  
3. Tab **PORTS** → **8080** → Visibility **Public** → Open in Browser  

### Laptop (Docker)
```bash
copy .env.example .env
docker compose up -d --build
docker compose exec api node data/generate-real-seats.js
docker compose exec api node src/load-manual-data.js
# browser → http://localhost:8080/
```

### Scale API (P2)
```bash
docker compose up -d --scale api=3
```

### Dev Node lokal (+ Postgres/Redis dari compose)
```bash
docker compose up -d postgres redis
npm install
set DATABASE_URL=postgres://wtk:wtk@localhost:5432/wtk
set REDIS_URL=redis://localhost:6379
npm run data:excel
npm start
# http://localhost:3000/
```

---

## Struktur repo

```
├── docker-compose.yml
├── .env.example
├── openapi.yaml / openapi-final.yaml
├── nginx/default.conf          # gateway
├── services/api/Dockerfile     # build context = root
├── src/                        # kode backend
├── public/                     # web Jumat
├── data/                       # Excel dataset + events/seats (7 event)
├── db/init.sql
├── docs/adr/
├── loadtest/
├── AI-LOG.md
└── PERAN.md
```

---

## Peran

Lihat [`PERAN.md`](./PERAN.md). AI usage: [`AI-LOG.md`](./AI-LOG.md).
