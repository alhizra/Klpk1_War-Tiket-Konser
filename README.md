# War Tiket Konser — Kelompok1

## war tiket konser dengan kuota kursi atomik (Redis), catalog di PostgreSQL, web Melon-style, dan **mobile Expo** yang diselaraskan fitur/data dengan web.

---

## Kelompok & peran

| Peran | Nama | Fokus |
|-------|------|--------|
| **Arsitek Sistem** | Andi Hilyatul Mar'ah | ADR, diagram [`architecture/DIAGRAMS.md`](./architecture/DIAGRAMS.md), OpenAPI |
| **Backend / API Engineer** | Yusuf Sewang | `src/`, API monolit, web `public/`, anti-oversell |
| **Infrastructure & DevOps** | AL-HIZRA | Docker, Nginx gateway, deploy, Codespaces |
| **Data & Persistence** | Astrid Tiar | Dataset Excel/CSV, `db/`, load seats, poster catalog |
| **QA, Load-Test & Dokumentasi** | Tri Wahyuni | Loadtest, baseline, uji konsistensi, dokumentasi |

Detail file & endpoint PIC: [`PERAN.md`](./PERAN.md).

---

## Arsitektur (monolit lab — jalur utama)

![Monolit lab](./architecture/diagrams/07-monolit.png)

Diagram lengkap (PNG + Mermaid): **[`architecture/DIAGRAMS.md`](./architecture/DIAGRAMS.md)**

| Diagram | Preview |
|---------|---------|
| Container (target MS) | [02-container.png](./architecture/diagrams/02-container.png) |
| Seat lock | [03-seat-lock.png](./architecture/diagrams/03-seat-lock.png) |
| Sequence booking | [05-sequence.png](./architecture/diagrams/05-sequence.png) |
| State kursi | [06-state.png](./architecture/diagrams/06-state.png) |

```mermaid
flowchart TB
  subgraph clients [Klien]
    Web[Web UI<br/>public/]
    Mob[Mobile Expo<br/>mobile/]
    Adm[Admin<br/>web + mobile]
  end

  subgraph monolit [API monolit :3000]
    GW[Express + static]
    Routes[routes: events / orders / payments / admin]
    Cache[eventCache + Redis TTL]
    Quota[quota Lua anti-oversell]
    Orders[orders + seat claim]
    Mail[mail outbox / SMTP]
    Poster[poster upload]
  end

  PG[(PostgreSQL<br/>events seats orders)]
  RD[(Redis<br/>quota · sold seats · cache · queue)]
  Worker[worker e-ticket]

  Web --> GW
  Mob --> GW
  Adm --> GW
  GW --> Routes
  Routes --> Cache
  Routes --> Quota
  Routes --> Orders
  Routes --> Mail
  Routes --> Poster
  Cache --> PG
  Cache --> RD
  Quota --> RD
  Orders --> PG
  Orders --> RD
  Mail --> RD
  Worker --> RD
  Worker --> PG
```

| Lapisan | Isi |
|---------|-----|
| **Klien** | Web `public/` · Mobile Expo `mobile/` · Admin (`/admin.html` + layar Admin mobile) |
| **API** | `src/server.js` + `src/routes.js` — catalog, booking, bayar lab, admin CRUD |
| **Data** | Postgres = truth catalog/order · Redis = **kuota atomik**, sold seats, cache event, antrean mail |
| **Worker** | `src/worker.js` — konsumsi queue e-ticket (async) |

**Sumber daya rebutan = kursi** → dipotong hanya lewat Redis (Lua / claim seat). Lihat [ADR-002](./docs/adr/ADR-002-seat-lock-redis.md).

### Alur booking (web & mobile sama)

```
Pilih peran (User/Admin)
  → Daftar konser (GET /events)
  → Detail + denah (GET /events/:id)  · sisa live dari Redis
  → Pilih max 4 kursi · benefit zona (event-meta)
  → POST /orders { eventId, qty, seatCodes, email, buyerName }
  → POST /payments/simulate (lab settle)
  → E-ticket QR + poll GET /mail/outbox/:orderId
```

---

## Fitur yang sudah fix (status terkini)

### Backend monolit
- [x] `GET /events` paginasi · `GET /events/:id` detail + categories + seats + `soldSeats` + `sisa` live
- [x] `POST /orders` anti-oversell · max 4 · email + buyerName wajib · 409/429
- [x] `POST /payments/simulate` + webhook mock · e-ticket outbox lab
- [x] Admin: CRUD event, reset kuota, **regenerate denah multi-zona**, hapus event
- [x] Poster: path seed + upload base64 → `/posters/uploads/…`
- [x] Migrasi ringan kolom order/event saat start (`ensureOrderColumns` / `ensureEventColumns`)
- [x] Edit harga sinkron ke `seat_categories` / `seats`

### Web (`public/`)
- [x] Role gate User / Admin
- [x] Open sale list + tag/genre (`event-meta.js`)
- [x] Detail: artist, rating, gate, jadwal, deskripsi, harga zona
- [x] Tab Detail · Denah · Benefit · Notice
- [x] Denah berwarna per zona · legend · venue sketch · max 4
- [x] Checkout + bayar lab + receipt + poll outbox
- [x] Admin UI: form lengkap, poster, regenerate seats, orders

### Mobile Expo (`mobile/`)
- [x] Role gate · daftar (tag/genre/artist/poster) · detail bertab (sama web)
- [x] Denah: semua zona / per zona · sketch · legend+harga · live refresh 12s
- [x] Benefit + terms · antrean · bayar + **simulate pay** · e-ticket receipt + QR + outbox
- [x] Offline: cache list/detail · outbox orders
- [x] Admin: field setara web (kota, negara, jadwal, status, deskripsi, denah multi-zona)
- [x] **Upload poster** galeri (`expo-image-picker` → data URL ke API)
- [x] Meta UI: `mobile/data/eventMeta.js` (port dari `public/event-meta.js`)

### Dataset
- [x] **30 event** (EVT001–030) · seats CSV · poster 01–30
- [x] Import Excel OneDrive / `data/import_excel_dataset.py` · `npm run data:manual` / `data:excel`

---

## Context map singkat

```mermaid
graph LR
  Web((Web)) --> API[API monolit :3000]
  Mobile((Expo)) --> API
  API --> PG[(PostgreSQL)]
  API --> RD[(Redis)]
  API -.->|queue eticket| W[worker]
```

Opsional Modul 2 (4 microservices + gateway `:8080`):  
[`docs/MICROSERVICES.md`](./docs/MICROSERVICES.md) · `docker-compose.ms.yml` — **jangan** campur port 8080 dengan monolit full-compose bersamaan tanpa cek.

---

## Stack & port

| Komponen | Port / role | Catatan |
|----------|-------------|---------|
| API monolit + static web | **3000** | `npm start` / container `api` |
| Gateway Nginx (compose full) | **8080** | Proxy ke api |
| PostgreSQL | 5432 (internal/host) | DB `wtk` |
| Redis | 6379 | Kuota + cache + queue |
| Expo Metro | 8081 | Hanya di folder `mobile/` |

Env lab (lihat [`.env.example`](./.env.example)):

```
DATABASE_URL=postgres://wtk:wtk@localhost:5432/wtk
REDIS_URL=redis://localhost:6379
ADMIN_TOKEN=admin-wtk          # header x-admin-token
RESET_TOKEN=dev-reset          # x-reset-token (internal reset)
PAYMENT_PROVIDER=mock
PAYMENT_AUTO_CAPTURE=1
```

---

## Dataset (30 konser)

Sumber: Excel squad + `data/events.manual.json` + `data/seats.manual.csv` + poster di `public/posters/`.

| ID | Contoh | Venue (ringkas) |
|----|--------|-----------------|
| 1–11 | TREASURE … 4EVE | Seoul / Bangkok / Busan / … |
| 12–30 | IU … KATSEYE | Dataset expand + poster iTunes/seed |

```bash
# Generate seats + load Postgres/Redis
npm run data:reload
# atau dari Excel
npm run data:excel
```

---

## Endpoint kritis

Detail: [`docs/ENDPOINTS.md`](./docs/ENDPOINTS.md) · OpenAPI: `openapi.yaml` / `openapi-final.yaml`

| Method | Path | Keterangan |
|--------|------|------------|
| GET | `/health` | Instance + payment provider |
| GET | `/events?page&size` | List + sisa live |
| GET | `/events/:id` | Detail, categories, seats, soldSeats, terms |
| POST | `/orders` | **Panas** — lock kursi · email + buyerName wajib |
| POST | `/payments/simulate` | Lab settle |
| GET | `/mail/outbox/:orderId` | Status e-ticket lab |
| GET/POST/PATCH/DELETE | `/admin/events…` | CRUD + `reset-quota` + `regenerate-seats` |
| GET | `/admin/orders` | Order terbaru |

Alias prefix `/api/*` untuk klien web/mobile.

**Admin header:** `x-admin-token: admin-wtk` (default).

---

## Menjalankan

Panduan panjang: [`docs/CARA-JALANKAN.md`](./docs/CARA-JALANKAN.md)

### A) Dev lokal (paling sering dipakai lab)

```bash
# 1) Infra
docker compose up -d postgres redis

# 2) API
copy .env.example .env
# set DATABASE_URL=postgres://wtk:wtk@localhost:5432/wtk
# set REDIS_URL=redis://localhost:6379
npm install
npm run data:reload
npm start
# → http://localhost:3000/          (user web)
# → http://localhost:3000/admin.html
```

Jika `EADDRINUSE :3000` → API sudah jalan; jangan start dobel.

### B) Docker full (+ gateway 8080)

```bash
docker compose up -d --build
docker compose exec api node data/generate-real-seats.js
docker compose exec api node src/load-manual-data.js
# → http://localhost:8080/
```

Scale API (P2): `docker compose up -d --scale api=3`

### C) Mobile Expo (HP)

```bash
cd mobile
npm install
# edit mobile/config.js → LAN_IP = IPv4 Wi‑Fi laptop (ipconfig)
# contoh: export const LAN_IP = "10.87.96.26";
npx expo start --lan -c
```

Syarat HP:
1. Wi‑Fi **sama** laptop (matikan LTE)
2. Buka dulu di browser HP: `http://<LAN_IP>:3000/api/health`
3. Scan QR **Expo Go**
4. Jalankan Expo **hanya** dari folder `mobile/` (bukan root repo)

Detail: [`mobile/README.md`](./mobile/README.md) · [`mobile/JALANKAN.md`](./mobile/JALANKAN.md)

### D) Microservices (Modul 2, opsional)

```bash
docker compose -f docker-compose.ms.yml up --build -d
curl -s http://localhost:8080/v1/events?size=5
```

---

## Struktur repo

```
├── src/                    # Backend monolit
│   ├── server.js · routes.js · db.js · redis.js
│   ├── services/           # orders, quota, admin, eventCache, mail, poster…
│   ├── middleware/         # rateLimit, adminAuth
│   ├── load-manual-data.js · seed.js · worker.js
├── public/                 # Web UI
│   ├── index.html · app.js · styles.css · event-meta.js
│   ├── admin.html · admin.js · role-gate.js
│   └── posters/            # 01–30 + uploads/
├── mobile/                 # Expo app
│   ├── App.js · config.js · theme.js
│   ├── api/ · screens/ · data/eventMeta.js
│   └── JALANKAN.md
├── data/                   # Excel import, events/seats manual, generate seats
├── db/init.sql
├── docs/                   # ARSITEKTUR, ENDPOINTS, BASEURL, mobile/…
├── nginx/                  # Gateway compose
├── services/               # MS event/ticket/payment/notification (Modul 2)
├── loadtest/
├── docker-compose.yml · docker-compose.ms.yml
├── openapi.yaml · openapi-final.yaml · openapi-ms.yaml
└── .env.example
```

---

## Dokumen terkait

| Dokumen | Isi |
|---------|-----|
| [`docs/ENDPOINTS.md`](./docs/ENDPOINTS.md) | Kontrak monolit |
| [`docs/BACKEND.md`](./docs/BACKEND.md) | Detail backend |
| [`docs/BASEURL.md`](./docs/BASEURL.md) | URL + rate + page size |
| [`docs/DATA.md`](./docs/DATA.md) | Dataset |
| [`docs/mobile/ARSITEKTUR-MOBILE.md`](./docs/mobile/ARSITEKTUR-MOBILE.md) | Arsitektur Expo |
| [`architecture/DIAGRAMS.md`](./architecture/DIAGRAMS.md) | **Diagram Mermaid** (tampil di GitHub) |
| [`architecture/diagrams.html`](./architecture/diagrams.html) | Diagram interaktif (buka lokal) |
| [`docs/adr/`](./docs/adr/) | ADR paginasi, Redis lock, monolit Jumat |
| [`docs/MICROSERVICES.md`](./docs/MICROSERVICES.md) | 4 service Modul 2 |
| [`PERAN.md`](./PERAN.md) · [`AI-LOG.md`](./AI-LOG.md) | Peran squad · log AI |

---

## Uji cepat

```bash
# Health
curl -s http://localhost:3000/api/health

# List
curl -s "http://localhost:3000/api/events?page=1&size=5"

# Admin list (header token)
curl -s -H "x-admin-token: admin-wtk" http://localhost:3000/api/admin/events

# Loadtest anti-oversell (opsional)
# loadtest/oversell-check.ps1  ·  loadtest/run-p1-local.ps1
```

Baseline: [`docs/BASELINE.md`](./docs/BASELINE.md).

---

## AI

Catatan pemakaian AI: [`AI-LOG.md`](./AI-LOG.md)
