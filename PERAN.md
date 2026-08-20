# PERAN.md — Klpk1 War Tiket Konser

| Peran | Nama | Fokus file |
|-------|------|------------|
| Arsitek Sistem | Andi Hilyatul Mar'ah | `docs/adr/`, `architecture/`, `openapi*.yaml` |
| Backend/API Engineer | (Milikmu) | `src/`, `public/`, `docs/BACKEND.md` |
| Infrastructure & DevOps | AL-HIZRA | `docker-compose.yml`, `nginx/`, `services/api/Dockerfile`, `docs/DEPLOY.md` |
| Data & Persistence | ASTRID TIAR | `data/`, `db/`, `docs/DATA.md`, `src/load-manual-data.js` |
| QA, Load-Test & Dokumentasi | TRI WAHYUNI | `loadtest/`, `docs/BASELINE.md`, `README.md` uji |

## Tema data
K-pop Korea — BTS Busan, SEVENTEEN KSPO, NewJeans Incheon, IU Jamsil (`data/events.manual.json`).

## Endpoint kritis
| Method | Path | PIC |
|--------|------|-----|
| GET | `/events`, `/events/{id}` | Backend + Data |
| POST | `/orders` | Backend (anti-oversell) |
| GET | `/health` | Backend + Infra |
