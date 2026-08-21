# docs/BASELINE.md — Logbook Uji Beban (Scalable)

**Tema:** War Tiket Konser  
**Dataset:** 11 event / 3850 seats (`DATA_WAR_TIKET_KONSER.xlsx`)  
**Base URL dev:** `http://localhost:3000` · **Gateway:** `http://localhost:8080`  
**Endpoint panas:** `POST /orders` · **Baca:** `GET /events/{id}`  
**Aturan baseurl:** 60 req/menit (Mobile) · lab war: `RATE_LIMIT=10000`  
**Detail URL:** [`BASEURL.md`](./BASEURL.md) · **Endpoint:** [`ENDPOINTS.md`](./ENDPOINTS.md)

Isi angka dari output **nyata**. 409 = penolakan kuota **sah** (bukan 5xx).

---

## Perintah acuan

```bash
# API lokal
set BASE=http://127.0.0.1:3000
set RATE_LIMIT=10000
npm start

# Reset kuota event 1
curl -s -X POST %BASE%/internal/reset-quota/1 -H "x-reset-token: dev-reset"

# Uji cepat anti-oversell (PowerShell, tanpa k6)
powershell -File loadtest/oversell-check.ps1
# event kecil: $env:EVENT_ID=11; $env:SHOTS=80; powershell -File loadtest/oversell-check.ps1

# Baseline P1 penuh (butuh npx autocannon)
powershell -File loadtest/run-p1-local.ps1

# k6 (jika terpasang)
k6 run -e BASE=http://127.0.0.1:3000 -e EVENT_ID=1 loadtest/k6-orders.js
```

**Konsistensi setelah serbuan:**

```text
terjual <= quota_total
sisa >= 0
terjual + sisa == quota_total   (ideal; cek Redis vs sold DB bila beda)
```

---

## P1 — Baseline "sebelum" (local :3000, 2026-08-18)

Kuota saat itu: **500** (seed lama). Pola sama untuk dataset 11 event (ganti `eventId` / reset).

### Endpoint baca

| Endpoint | Beban | p50 | p95/p97.5 | p99 | Throughput | Error non-2xx |
|----------|-------|-----|-----------|-----|------------|---------------|
| GET /events/1 | -c 50 -d 15 | 13ms | 33ms | 60ms | ~3349 rps | 0 |

### Endpoint panas `POST /orders`

| Beban | p50 | p99 | Throughput | 201 | non-2xx (≈409) | 5xx | Oversell? |
|-------|-----|-----|------------|-----|-----------------|-----|-----------|
| -c 200 -a 5000 | 164ms | 1620ms | ~714 rps | **500** | 4500 | 0 | **TIDAK** (terjual=500, sisa=0) |

### Titik jenuh (d=10, reset tiap run)

| Concurrency | Throughput | p99 | 201 (max kuota) | Timeouts |
|-------------|------------|-----|-----------------|----------|
| 10 | ~844 rps | 39ms | 500 | 0 |
| 100 | ~1510 rps | 249ms | 500 | 0 |
| 500 | ~1394 rps | 1561ms | 500 | 0 |

**Knee:** concurrency **100→500** — throughput stagnan/turun, p99 meledak.

---

## P1-b — Dataset Excel 11 event (2026-08-21)

| Item | Nilai |
|------|------:|
| Events / seats | 11 / 3850 |
| Event contoh | id=1 TREASURE quota=400 · id=11 4EVE quota=260 |
| Skrip cepat | `loadtest/oversell-check.ps1` |
| Hasil run mesin ini | *Isi setelah API+Redis hidup — lihat tabel di bawah* |

### Hasil oversell-check (mesin lokal, 2026-08-21)

| Tanggal | BASE | eventId | shots | 201 | 409 | 429 | 5xx | terjual | sisa | Oversell | durasi |
|---------|------|--------:|------:|----:|----:|----:|----:|--------:|-----:|----------|-------:|
| 2026-08-21 | http://127.0.0.1:3000 | 1 (TREASURE q=400) | 500 | **400** | 100 | 0 | 0 | 400 | 0 | **TIDAK** | ~12.5s |

**Kesimpulan:** tepat 400× `201` (= kuota), 100× `409` (sah), 0× `5xx`. Anti-oversell OK pada dataset Excel 11 event.

Ulangi:

```powershell
$env:BASE="http://127.0.0.1:3000"
$env:EVENT_ID="1"
$env:SHOTS="500"
powershell -File loadtest/oversell-check.ps1
```

---

## P2 — LB + multi-salinan

| Konfigurasi | Throughput | p99 | 5xx |
|-------------|------------|-----|-----|
| 1 salinan api | (baseline P1) | | 0 |
| 3 salinan `docker compose up -d --scale api=3` | _belum diukur di sesi ini_ | | |

Failover: stop 1 container di tengah beban → catat error rate.

---

## P3 — Cache + antrean

| Teknik | Status di kode | Catatan |
|--------|----------------|---------|
| Cache-aside catalog | Ada (`eventCache.js`) | `sisa` selalu live Redis |
| Antrean e-ticket | Ada (`worker` + Redis list) | Order path tidak block email |
| Rate limit | Ada (default 60/mnt) | Lab war: naikkan `RATE_LIMIT` |

---

## P4/P5 — Capstone (target)

| Metrik | Target |
|--------|--------|
| Oversell | **0** |
| p95 POST /orders (setelah optimasi) | < 500ms |
| 5xx | < 1% |
| 201 count | = kuota setelah reset + serbuan ≥ kuota |

---

## Checklist Scalable rapi

- [x] Dataset Excel 11 event ter-load (`events` / `init.sql` / web)
- [x] `docs/BASEURL.md` + aturan 60/20/50
- [x] `docs/ENDPOINTS.md` selaras routes
- [x] `openapi.yaml` + `openapi-final.yaml` (page/size, orders, 409/429)
- [x] Loadtest scripts: `run-p1-local.ps1`, `k6-orders.js`, `oversell-check.ps1`
- [x] Baseline angka P1 historis tersimpan
- [x] Oversell-check P1-b lulus (201=400, 409=100, 5xx=0 pada TREASURE)
- [ ] Opsional: autocannon penuh `run-p1-local.ps1` + scale api=3 di gateway :8080
