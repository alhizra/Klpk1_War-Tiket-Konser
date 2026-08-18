# docs/BASELINE.md — Logbook Uji Beban

**Tema:** War Tiket Konser  
**Base URL:** `http://localhost:8080`  
**Endpoint panas:** `POST /orders`  
**Endpoint baca:** `GET /events/1`  
**Kuota:** 500 kursi  

Isi angka dari output autocannon/k6 yang **nyata**. Jangan menebak.

---

## Perintah acuan

```bash
BASE=http://localhost:8080

# Baca
npx autocannon -c 50 -d 15 $BASE/events/1

# Panas (skenario P1: 5000 request)
npx autocannon -c 200 -a 5000 \
  -m POST -H "Content-Type: application/json" \
  -b "{\"eventId\":1,\"qty\":1}" \
  $BASE/orders

# Cek konsistensi (setelah serbuan)
curl -s $BASE/events/1
# terjual <= 500, sisa >= 0, terjual + sisa == 500
```

**Catatan:** 409 (kuota habis) adalah penolakan **sah**, bukan kegagalan sistem. Hitung error 5xx terpisah dari 409.

Sebelum uji ulang kuota, reset:

```bash
docker compose exec api node src/seed.js
# atau: docker compose down -v && docker compose up -d --build
```

---

## P1 — Baseline "sebelum"

### Endpoint baca

| Endpoint | Beban | p50 | p95/p97.5 | p99 | Throughput (req/s) | Error non-2xx |
|----------|-------|-----|-----------|-----|--------------------|---------------|
| GET /events/1 | -c 50 -d 15 | _isi_ | _isi_ | _isi_ | _isi_ | _isi_ |

### Endpoint panas

| Endpoint | Beban | p50 | p99 | Throughput | 2xx | 409 | 5xx | Oversell? |
|----------|-------|-----|-----|------------|-----|-----|-----|-----------|
| POST /orders | -c 200 -a 5000 | _isi_ | _isi_ | _isi_ | _isi_ | _isi_ | _isi_ | _ya/tidak_ |

### Titik jenuh (concurrency)

| Concurrency | Throughput (req/s) | p99 | Timeouts |
|-------------|--------------------|-----|----------|
| 10 | | | |
| 100 | | | |
| 500 | | | |

**Lutut kurva (knee):** concurrency = ___ (throughput mentok, p99 meledak)

---

## P2 — Sesudah LB + multi-salinan

| Konfigurasi | Throughput | p99 | Error 5xx |
|-------------|------------|-----|-----------|
| 1 salinan | | | |
| 3 salinan (via Nginx) | | | |

Failover (stop 1 container di tengah beban): error rate ≈ ___ %

---

## P3 — Cache + indeks + antrean

| Teknik | p95 | Throughput | Error 5xx | Oversell? |
|--------|-----|------------|-----------|-----------|
| Baseline P1 | | | | |
| + LB & stateless P2 | | | | |
| + Cache baca | | | | |
| + Antrean e-ticket | | | | |

---

## P4/P5 — Capstone (final artefak loadtest)

| Tahap | p95 | Throughput (req/s) | Error 5xx | Oversell |
|-------|-----|--------------------|-----------|----------|
| Sebelum (baseline P1) | | | | |
| Sesudah (produk akhir) | | | | 0 |

**Sasaran lulus:** 0 oversell, p95 < 500ms, 5xx < 1%.
