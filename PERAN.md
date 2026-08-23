# PERAN.md — Kelompok 1 · War Tiket Konser

| Label | Peran formal | Nama | Fokus file |
|-------|--------------|------|------------|
| **Add Arsitektur** | Arsitek Sistem | Andi Hilyatul Mar'ah | `docs/adr/`, `architecture/`, `openapi*.yaml`, diagram PNG |
| **Add Backend** | Backend / API Engineer | Yusuf Sewang | `src/`, `public/`, `docs/BACKEND.md`, mobile API client |
| **Add Infra** | Infrastructure & DevOps | AL-HIZRA | `docker-compose.yml`, `nginx/`, Dockerfile, `docs/DEPLOY.md`, Codespaces |
| **Add Data** | Data & Persistence | Astrid Tiar | `data/`, `db/`, `docs/DATA.md`, `src/load-manual-data.js`, poster catalog |
| **Add QA** | QA, Load-Test & Dokumentasi | Tri Wahyuni | `loadtest/`, `docs/BASELINE.md`, uji README, skenario demo |

## Tema data (Add Data)

War tiket Asia — **30 konser** (TREASURE … KATSEYE) · **10.890 kursi**  
Sumber: Excel squad → `data/events.manual.json` + `data/seats.manual.csv` + `public/posters/`.

## Endpoint kritis

| Method | Path | PIC |
|--------|------|-----|
| GET | `/events`, `/events/{id}` | Add Backend + Add Data |
| POST | `/orders` | Add Backend (anti-oversell) |
| POST | `/payments/simulate`, `/mail/outbox/*` | Add Backend |
| GET/POST/PATCH/DELETE | `/admin/*` | Add Backend + Add Infra (token) |
| GET | `/health` | Add Backend + Add Infra |
