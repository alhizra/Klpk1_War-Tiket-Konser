# PERAN.md — Kelompok1 War Tiket Konser

| Peran | Nama | Fokus file |
|-------|------|------------|
| Arsitek Sistem | Andi Hilyatul Mar'ah | `docs/adr/`, `architecture/`, `openapi*.yaml` |
| Backend/API Engineer | Yusuf sewang | `src/`, `public/`, `docs/BACKEND.md` |
| Infrastructure & DevOps | AL-HIZRA | `docker-compose.yml`, `nginx/`, `services/api/Dockerfile`, `docs/DEPLOY.md` |
| Data & Persistence | ASTRID TIAR | `data/`, `db/`, `docs/DATA.md`, `src/load-manual-data.js` |
| QA, Load-Test & Dokumentasi | TRI WAHYUNI | `loadtest/`, `docs/BASELINE.md`, `README.md` uji |

## Tema data
War tiket Asia — TREASURE, LYKN, BLACKPINK, NCT DREAM, EXO, ATEEZ, BUS, Stray Kids, aespa, SEVENTEEN, 4EVE  
Sumber: `data/DATA_WAR_TIKET_KONSER.xlsx` → `data/events.manual.json` (11 event, 3850 seats).

## Endpoint kritis
| Method | Path | PIC |
|--------|------|-----|
| GET | `/events`, `/events/{id}` | Backend + Data |
| POST | `/orders` | Backend (anti-oversell) |
| GET | `/health` | Backend + Infra |
