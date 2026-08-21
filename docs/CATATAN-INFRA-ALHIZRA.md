# Catatan kerja Infra — AL-HIZRA

Update: 2026-08-21

---

## Status stack (Mac lokal)

| Item | Status |
|------|--------|
| `docker compose up` monolit | OK |
| postgres / redis / api / worker / gateway | Running |
| `GET http://localhost:8080/health` | OK |
| Scale `api=3` | OK — instance id berganti (bukti LB nginx) |
| `docs/DEPLOY.md` | Sudah dilengkapi |

Bukti scale (contoh instance id berbeda):
- `23e155ce29b0`
- `99b30c24a53b`
- `6b564b1ed8b2`

---

## Backlog bug (bukan Infra — diteruskan ke tim)

### B1. Validasi email + nama pembeli (Backend + UI)
- **Gejala:** tombol Pesan tetap booking meski email e-ticket & nama pembeli kosong.
- **PIC:** Yusuf (Backend) ± form di `public/`
- **Perbaikan yang diminta:**
  1. Frontend: jangan submit jika kosong; tampilkan error
  2. Backend `POST /orders`: 400 jika email/nama kosong atau email invalid
- **Status:** menunggu respons Backend
- **Catatan Infra:** tidak diubah di nginx/compose

### B2. (isi nanti)

---

## Checklist Infra tersisa

- [ ] Pastikan seed 11 event lengkap di browser (`/?event=1` … `11`)
- [ ] Screenshot `docker compose ps` (api×3) untuk laporan
- [ ] Uji kill 1 container api → request masih 200
- [ ] Baca ulang MS compose (jangan tabrakan port dengan monolit)
- [ ] Commit & push `docs/DEPLOY.md` + catatan ini (jika disepakati tim)
- [ ] Koordinasi QA: base URL + cara scale sebelum loadtest

---

## Perintah yang sering dipakai

```bash
cd ~/Documents/Klpk1_War-Tiket-Konser

docker compose ps
docker compose logs -f api gateway worker

# scale
docker compose up -d --scale api=3
docker compose up -d --scale api=1

# seed (bareng Data)
docker compose exec api npm run data:excel

# health
curl -s http://localhost:8080/health
```
