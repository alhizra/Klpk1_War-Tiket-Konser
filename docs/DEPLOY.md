# docs/DEPLOY.md — Infrastructure & DevOps

**Label:** **Add Infra** · PIC AL-HIZRA (Infrastructure & DevOps)  
**Repo:** https://github.com/alhizra/Klpk1_War-Tiket-Konser  
**Fokus file:** `docker-compose.yml`, `docker-compose.ms.yml`, `nginx/`, `services/api/Dockerfile`, `.env.example`

---

## 1. Prasyarat

| Item | Keterangan |
|------|------------|
| Docker Desktop | Status **Running** (ikon paus di menu bar) |
| Git | Untuk clone/pull |
| Port host | **8080** (gateway), opsional 5432/6379 untuk debug |
| RAM | Disarankan ≥ 4 GB free untuk compose + scale |

---

## 2. Environment

```bash
cd ~/Documents/Klpk1_War-Tiket-Konser   # sesuaikan path clone kamu
cp .env.example .env
# edit .env hanya jika perlu; JANGAN commit .env
```

Variabel penting (lihat `.env.example`):

| Variabel | Default lab | Fungsi |
|----------|-------------|--------|
| `POSTGRES_USER/PASSWORD/DB` | wtk / wtk / wtk | DB |
| `DATABASE_URL` | postgres://…@postgres:5432/wtk | API & worker |
| `REDIS_URL` | redis://redis:6379 | Kuota atomik + queue |
| `RATE_LIMIT` | 10000 (lab) | Rate limit / jendela |
| `RESET_TOKEN` | dev-reset | Reset lab (jika dipakai) |
| `PAYMENT_PROVIDER` | mock | Tanpa gateway eksternal |
| `SMTP_*` | kosong | E-ticket → outbox file lab |

---

## 3. Start monolit (jalur utama demo)

```bash
docker compose up -d --build
docker compose ps
curl -s http://localhost:8080/health
curl -s "http://localhost:8080/events?size=5"
```

Browser: **http://localhost:8080/**

### Urutan service (compose)

| Service | Image / build | Port host | Health |
|---------|---------------|-----------|--------|
| `postgres` | postgres:16-alpine | 5432 | `pg_isready` |
| `redis` | redis:7-alpine | 6379 | `PING` |
| `api` | `services/api/Dockerfile` | internal 3000 | `GET /health` |
| `worker` | same image, `node src/worker.js` | — | restart policy |
| `gateway` | nginx:1.27-alpine | **8080→80** | depends api healthy |

---

## 4. Seed data (koordinasi Data)

Setelah container **healthy**:

```bash
# Dataset Excel / manual (30 event)
docker compose exec api npm run data:excel
# ATAU pipeline manual yang ada di README:
docker compose exec api node data/generate-real-seats.js
docker compose exec api node src/load-manual-data.js
```

Cek:

```bash
curl -s "http://localhost:8080/events?size=20" | head -c 400
# Web: http://localhost:8080/?event=1 … ?event=11
```

| event | Artis |
|------:|--------|
| 1 | TREASURE |
| 2 | LYKN |
| 3 | BLACKPINK |
| 4 | NCT DREAM |
| 5 | EXO |
| 6 | ATEEZ |
| 7 | BUS |
| 8 | Stray Kids |
| 9 | aespa |
| 10 | SEVENTEEN |
| 11 | 4EVE |

---

## 5. Scale API (P2 — bukti load balancer)

Nginx memakai Docker DNS (`resolver 127.0.0.11` + `proxy_pass` ke service `api`) agar scale bekerja.

```bash
docker compose up -d --scale api=3
docker compose ps
# instance id boleh berganti antar request:
for i in 1 2 3 4 5; do curl -s http://localhost:8080/health; echo; done
```

Kembali ke 1 replica:

```bash
docker compose up -d --scale api=1
```

---

## 6. Logs & troubleshooting

```bash
docker compose logs -f gateway api worker
docker compose logs --tail=100 api
```

| Gejala | Cek | Perbaikan |
|--------|-----|-----------|
| Port 8080 already in use | `lsof -i :8080` | Stop proses lain / ganti ports di compose |
| `api` unhealthy | `docker compose logs api` | DB/Redis belum ready; tunggu / `compose up -d` lagi |
| Web kosong / 0 event | Seed belum jalan | Jalankan perintah seed §4 |
| 502 Bad Gateway | api mati | `docker compose ps` → `up -d api` |
| Redis kuota salah setelah uji | Reset lab | Seed ulang / `down -v` (hapus data) |
| Docker daemon error | Desktop tidak running | Buka Docker Desktop, tunggu Ready |

### Reset penuh (hapus volume DB — hati-hati)

```bash
docker compose down -v
docker compose up -d --build
# lalu seed lagi (§4)
```

Stop tanpa hapus data:

```bash
docker compose down
```

---

## 7. Microservices (modul terpisah)

**Jangan** jalankan monolit + MS gateway di port 8080 bersamaan.

```bash
# matikan monolit dulu
docker compose down

docker compose -f docker-compose.ms.yml up -d --build
curl -s "http://localhost:8080/v1/events?size=5"
```

Detail: [`MICROSERVICES.md`](./MICROSERVICES.md) · nginx: `nginx/ms.conf`

Kembali ke monolit:

```bash
docker compose -f docker-compose.ms.yml down
docker compose up -d --build
```

---

## 8. GitHub Codespaces (demo online)

1. Repo → **Code** → **Codespaces** → Create/Open  
2. Tunggu setup / jalankan `docker compose up -d --build` + seed  
3. Tab **PORTS** → **8080** → Visibility **Public** → Open in Browser  
4. **Stop codespace** saat tidak dipakai (kuota)

Panduan user-facing: [`CARA-JALANKAN.md`](./CARA-JALANKAN.md)

---

## 9. Uji ketahanan (untuk laporan Infra)

| Uji | Perintah | Diharapkan |
|-----|----------|------------|
| Cold start | `compose up -d --build` | Semua healthy / running |
| Health | `curl localhost:8080/health` | `"ok":true` |
| Scale out | `--scale api=3` | Health tetap 200 |
| Kill 1 api | `docker kill $(docker compose ps -q api \| head -1)` | Request lain masih 200 |
| Restart | `compose down && up -d` | Volume PG tetap ada |

---

## 10. Handoff ke QA (Tri Wahyuni)

| Item | Nilai |
|------|--------|
| Base URL | `http://localhost:8080` |
| Health | `GET /health` |
| Events | `GET /events` |
| Order panas | `POST /orders` |
| Scale sebelum loadtest | `docker compose up -d --scale api=3` |
| Logs saat 5xx | `docker compose logs -f api gateway` |

Loadtest scripts: folder `loadtest/` · angka: [`BASELINE.md`](./BASELINE.md)

---

## 11. Batas peran Infra

| Dilakukan Infra | Bukan Infra |
|-----------------|-------------|
| Docker, compose, nginx, env, scale | Logika bisnis order/hold |
| Menjalankan & menstabilkan stack | Isi dataset Excel |
| Docs deploy & troubleshooting | Skrip angka loadtest & laporan QA |
| Koordinasi seed “setelah up” | Validasi form email/nama (Backend/UI) |

---

## 12. Checklist selesai (PIC Infra)

- [x] Compose monolit up (postgres, redis, api, worker, gateway)
- [x] `GET /health` via :8080
- [ ] Seed 30 event terverifikasi di browser
- [ ] `--scale api=3` + health multi-instance
- [ ] `docs/DEPLOY.md` (file ini) dibaca tim
- [ ] Screenshot `docker compose ps` untuk laporan
- [ ] MS compose didokumentasikan (port tidak tabrakan)
- [ ] Catatan bug UI/API diteruskan ke Backend (validasi email/nama)
