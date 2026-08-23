# PERAN.md — Kelompok 1 · War Tiket Konser

## Anggota & peran formal

| Peran | Nama | Folder utama |
|-------|------|--------------|
| Arsitek Sistem | Andi Hilyatul Mar'ah | `architecture/`, `docs/adr/`, `openapi*.yaml` |
| Backend / API Engineer | Yusuf Sewang | `src/`, `public/`, `docs/BACKEND.md` |
| Infrastructure & DevOps | AL-HIZRA | `docker-compose.yml`, `nginx/`, `docs/DEPLOY.md` |
| Data & Persistence | Astrid Tiar | `data/`, `db/`, `docs/DATA.md` |
| QA, Load-Test & Dokumentasi | Tri Wahyuni | `loadtest/`, `docs/BASELINE.md` |

## Tag tugas (bukan ganti nama peran)

Setiap pekerjaan ditandai terpisah:

| Tag | Arti | PIC |
|-----|------|-----|
| `add arsitektur` | ADR, diagram, kontrak OpenAPI, batasan monolit/MS | Arsitek |
| `add backend` | API, anti-oversell, payment lab, admin API, worker | Backend |
| `add data` | Excel/CSV, seed seats, skema DB, kuota Redis seed | Data |
| `add infra` | Docker, Nginx, deploy, Codespaces, firewall | Infra |
| `add qa` | Loadtest, baseline, skenario demo, ceklist | QA |
| `add mobile` | Expo screens, config LAN, offline/outbox | (mobile / squad) |
| `add web` | UI `public/`, role gate, admin HTML | Backend + UI |

## Endpoint kritis + tag

| Method | Path | Tag |
|--------|------|-----|
| GET | `/events`, `/events/{id}` | `add backend` + `add data` |
| POST | `/orders` | `add backend` |
| POST | `/payments/simulate`, `/mail/outbox/*` | `add backend` |
| GET/POST/PATCH/DELETE | `/admin/*` | `add backend` (+ token `add infra`) |
| GET | `/health` | `add backend` + `add infra` |

## Dataset

**30 konser** · **10.890 kursi** — sumber Excel → `data/events.manual.json` + `data/seats.manual.csv` · tag: `add data`
