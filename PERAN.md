# PERAN.md — Kelompok 1 · War Tiket Konser

| Peran | Nama | Fokus file |
|-------|------|------------|
| Arsitek Sistem | Andi Hilyatul Mar'ah | `docs/adr/`, `architecture/`, `openapi*.yaml` |
| Backend / API Engineer | Yusuf Sewang | `src/`, `public/`, `docs/BACKEND.md`, mobile API client |
| Infrastructure & DevOps | AL-HIZRA | `docker-compose.yml`, `nginx/`, Dockerfile, `docs/DEPLOY.md`, Codespaces |
| Data & Persistence | Astrid Tiar | `data/`, `db/`, `docs/DATA.md`, `src/load-manual-data.js`, poster catalog |
| QA, Load-Test & Dokumentasi | Tri Wahyuni | `loadtest/`, `docs/BASELINE.md`, uji README, skenario demo |

## Tema data
War tiket Asia — 30 konser (TREASURE … KATSEYE, dll.)  
Sumber: Excel squad → `data/events.manual.json` + `data/seats.manual.csv` + `public/posters/`.

## Endpoint kritis
| Method | Path | PIC |
|--------|------|-----|
| GET | `/events`, `/events/{id}` | Backend + Data |
| POST | `/orders` | Backend (anti-oversell) |
| POST | `/payments/simulate`, `/mail/outbox/*` | Backend |
| GET/POST/PATCH/DELETE | `/admin/*` | Backend + Infra (token) |
| GET | `/health` | Backend + Infra |
