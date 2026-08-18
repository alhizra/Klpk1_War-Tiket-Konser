# docs/ENDPOINTS.md — Endpoint kritis

| Method | Path | Jenis | Keterangan |
|--------|------|-------|------------|
| GET | `/health` | ops | instance + pid (bukti replika) |
| GET | `/events` | baca | pagination `page`, `size` (max 50) |
| GET | `/events/:id` | baca | cache catalog + sisa live |
| POST | `/orders` | **panas** | body `{ eventId, qty }` anti-oversell |
| GET | `/internal/quota/:id` | debug | snapshot Redis |

Lihat `openapi.yaml` untuk skema lengkap.
