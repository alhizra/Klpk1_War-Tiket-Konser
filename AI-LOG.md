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

---

## QA + Backend — Rapikan Scalable (2026-08-21)

### Entri 6 — Base URL vs loadtest rate limit
- **Konteks:** Menyelaraskan artefak baseurl (60 req/menit) dengan skenario war 5000 POST.
- **Prompt:** "Samakan RATE_LIMIT compose ke 60 agar cocok openapi-final."
- **Diterima:** default app `config.rateLimit = 60` untuk Mobile/demo; dokumentasi di `docs/BASEURL.md`.
- **Ditolak:** memaksa compose production-like 60 saat loadtest P1. Ditolak karena 429 akan menutupi 409 kuota dan merusak bukti anti-oversell. Lab memakai `RATE_LIMIT=10000` eksplisit.
- **Verifikasi:** openapi-final `x-baseurl-rules.rateLimitPerMinute: 60`; compose tetap override lab.

### Entri 7 — Skrip oversell tanpa mengklaim race k6 palsu
- **Konteks:** Butuh cek konsistensi kursi cepat di Windows tanpa k6.
- **Prompt:** "Loop 500 POST /orders paralel dengan Start-Job."
- **Diterima:** `loadtest/oversell-check.ps1` berurutan + hitung 201/409 + cek `terjual <= quota`.
- **Ditolak:** mengklaim loop paralel PowerShell sebagai pengganti load test profesional. Ditolak — ceiling jujur berurutan; race/peak tetap autocannon/k6 di `run-p1-local.ps1` / `k6-orders.js`.
- **Verifikasi:** skrip exit 2 jika oversell; baseline historis P1 tetap di `docs/BASELINE.md`.

---

## Backend/API + Data — Mobile offline (2026-08-21)

### Entri 8 — BASE_URL WSL ditolak
- **Konteks:** HP tidak memuat data meski IPv4 diisi.
- **Prompt:** "Pakai IP dari ipconfig apa saja."
- **Diterima:** dokumentasi pilih adapter **Wi‑Fi** / hotspot.
- **Ditolak:** `172.28.128.1` (vEthernet WSL). Ditolak karena bukan interface yang di-route ke HP di LAN/hotspot.
- **Verifikasi:** `config.js` → `10.87.96.26` (Wi‑Fi); API listen `0.0.0.0:3000`.

### Entri 9 — Outbox tidak menghapus semua saat gagal
- **Konteks:** sinkron order offline (materi P4).
- **Prompt:** "Kosongkan outbox setelah loop kirim."
- **Diterima:** hapus hanya item yang POST sukses; 409 di-drop; error jaringan ditahan.
- **Ditolak:** clear seluruh array setelah satu putaran. Ditolak — aksi gagal hilang permanen.
- **Verifikasi:** logika di `mobile/api/outbox.js`.

### Entri 10 — QR lokal bukan fetch ulang
- **Konteks:** e-ticket tanpa internet.
- **Prompt:** "Generate QR dari GET /orders/:id saat buka layar."
- **Diterima:** QR dari `orderId` + metadata yang sudah di hand; simpan AsyncStorage.
- **Ditolak:** wajib online untuk menggambar QR. Ditolak — melanggar kemampuan wajib tema (QR luring).
- **Verifikasi:** `ETicketScreen` + `tickets.js`.
