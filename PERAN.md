# PERAN.md — Squad War Tiket Konser

| Peran | Nama | Status |
|-------|------|--------|
| Arsitek Sistem | Andi Hilyatul Mar'ah | Diklaim |
| Backend/API Engineer | (kamu) | Diklaim — Milikmu |
| Infrastructure & DevOps | AL-HIZRA | Diklaim |
| Data & Persistence Engineer | Astrid Tiar | Diambil — skema, cache, antrean, konsistensi kursi |
| QA, Load-Test & Dokumentasi | TRI WAHYUNI | Diklaim |

## Tema
War Tiket Konser — penjualan tiket + antrean beban + kursi terbatas (1 kursi = 1 penjualan).

## Endpoint kritis
| Jenis | Method | Path |
|-------|--------|------|
| Panas | POST | `/orders` |
| Baca | GET | `/events/:id` |
| Hidup | GET | `/health` |
