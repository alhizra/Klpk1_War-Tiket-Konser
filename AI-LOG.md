# AI-LOG.md — War Tiket Konser

Wajib: tinjau tiap saran AI. Catat yang **diterima** dan **ditolak** + alasan.  
Minimal 5 entri bermakna per anggota.

---

## Backend/API Engineer + Data & Persistence

### Entri 1 — Anti-oversell atomik
- **Konteks:** Implementasi `POST /orders` agar 5000 request tidak menjual > 500 kursi multi-replika.
- **Prompt:** "Express POST /orders kurangi kuota Redis DECRBY atomik, rollback INCRBY jika sisa < 0, balas 409".
- **Diterima:** pola `DECRBY` → cek `< 0` → `INCRBY` rollback; `sold` di-`INCRBY` terpisah.
- **Ditolak:** saran baca `GET` kuota lalu `SET` sisa baru (read-modify-write). Ditolak karena race antar replika → oversell.
- **Verifikasi:** setelah serbuan, `terjual + sisa == 500` dan `terjual <= 500`.

### Entri 2 — Cache catalog vs sisa kursi
- **Konteks:** cache-aside `GET /events/:id`.
- **Prompt:** "cache-aside redis event detail TTL 60 jitter, merge sisa live".
- **Diterima:** cache JSON catalog + TTL jitter; field `from` cache/db.
- **Ditolak:** cache seluruh response termasuk `sisa` 30 detik. Ditolak karena sisa adalah sumber daya rebutan; cache basi memicu keputusan order salah.
- **Verifikasi:** panggilan ke-2 `from: cache` tetapi `sisa` berubah setelah order.

### Entri 3 — Rate limit key
- **Konteks:** middleware rate limit untuk aturan baseurl.
- **Prompt:** "express rate limit redis 60/menit header remaining 429".
- **Diterima:** `INCR` + `EXPIRE`, header `X-RateLimit-*`, `Retry-After`.
- **Ditolak:** key global `rl:all`. Ditolak karena membatasi seluruh trafik cluster, bukan per klien. Diganti `rl:{ip}:{window}`.
- **Verifikasi:** loadtest memakai `RATE_LIMIT` tinggi di compose agar 409 kuota tidak tertutup 429.

### Entri 4 — Antrean e-ticket
- **Konteks:** jangan biarkan email memblokir latency order.
- **Prompt:** "LPUSH queue eticket setelah order, worker BRPOP terpisah".
- **Diterima:** producer di path order + service `worker` di compose.
- **Ditolak:** kirim email sync di handler order (sleep 3s). Ditolak karena merusak p95 di peak war.
- **Verifikasi:** response order cepat; audit `ETICKET_SENT` muncul async.

### Entri 5 — Nginx upstream statis
- **Konteks:** diskusi dengan Infra soal scale api.
- **Prompt:** "nginx load balance docker compose scale 3 replicas".
- **Diterima:** `resolver 127.0.0.11` + `set $svc` + `proxy_pass http://$svc:3000`.
- **Ditolak:** blok `upstream` berisi IP container statis. Ditolak karena IP berubah saat recreate dan tidak ikut scale.
- **Verifikasi:** `curl /health` beberapa kali → `instance` berbeda setelah `--scale api=3`.

---

## Anggota lain
(Arsitek / Infra / QA isi bagian masing-masing di bawah.)
