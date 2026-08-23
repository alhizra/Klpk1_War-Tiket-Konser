# Backend — War Tiket Konser

**Peran:** Backend / API Engineer (Yusuf Sewang)  
**Tag tugas:** `add backend` (satu tugas = satu baris di checklist README)  
**Tema:** War tiket konser — sumber daya rebutan = **kursi / kuota per event**  
**Tujuan dokumen:** API monolit, file terkait, alur order / anti-oversell.

---

## 1. Apa itu backend di proyek ini?

Backend = **otak di server** yang:

1. Menyimpan daftar konser & denah kursi  
2. Menerima pesanan tiket (`POST /orders`)  
3. **Mencegah oversell** (kursi tidak boleh terjual melebihi kuota)  
4. Mensimulasikan **pembayaran** (mock gateway)  
5. Mengirim **e-ticket** secara async (antrean + worker → outbox lab)  
6. Menyediakan API untuk **web** dan (opsional) **mobile / microservices**

Ada **dua tumpukan** backend:

| Tumpukan | Cara jalan | Untuk apa |
|----------|------------|-----------|
| **Monolit** | `npm start` + `npm run worker` atau `docker compose up` | Praktikum Scalable — satu API + web |
| **Microservices** | `docker compose -f docker-compose.ms.yml up` | Praktikum MS — 4 service terpisah |

Dokumen ini fokus **monolit** (inti backend), lalu ringkas MS di bagian akhir.

---

## 2. Gambar besar (monolit)

```text
  Browser (public/)
        │
        │  HTTP /api/...
        ▼
  ┌─────────────────┐
  │  src/server.js  │  Express hidup di :3000
  │  src/routes.js  │  Semua endpoint
  └────────┬────────┘
           │
     ┌─────┴──────┬──────────────┬─────────────┐
     ▼            ▼              ▼             ▼
 orders.js    quota.js     paymentGateway   eventCache
     │            │              │             │
     │       Redis (kuota)   mock bayar    Postgres
     │            │              │          catalog
     ▼            ▼              ▼
  Postgres order          Redis list queue:eticket
                                 │
                                 ▼
                          src/worker.js
                                 │
                                 ▼
                          mail.js → outbox file
                          (e-ticket lab)
```

**Inti anti-oversell:** potong kuota di **Redis secara atomik (Lua)**. Baru kemudian simpan order di Postgres. Kalau kuota habis → **409** (penolakan bisnis yang sah, bukan crash).

---

## 3. Cara menjalankan (lokal)

```bash
# Pastikan Postgres + Redis jalan (docker monolit atau wtk-pg / wtk-redis)
# Terminal 1 — API + web
npm start

# Terminal 2 — worker e-ticket (wajib kalau mau outbox terisi)
npm run worker
```

- Web: http://localhost:3000  
- Admin: http://localhost:3000/admin.html (`x-admin-token` / env `ADMIN_TOKEN`, default `admin-wtk`)  
- Health: http://localhost:3000/api/health  
- Outbox e-ticket: http://localhost:3000/api/mail/outbox  

Reset kuota lab (setelah banyak uji):

```bash
curl -X POST http://localhost:3000/api/internal/reset-quota/1 ^
  -H "x-reset-token: dev-reset"
```

Buat konser (admin):

```bash
curl -X POST http://localhost:3000/api/admin/events ^
  -H "Content-Type: application/json" ^
  -H "x-admin-token: admin-wtk" ^
  -d "{\"title\":\"Demo Tour\",\"artist\":\"Demo\",\"venue\":\"ICE BSD\",\"startsAt\":\"2026-12-01T19:00:00.000Z\",\"quotaTotal\":50,\"priceIdr\":500000}"
```

Tes otomatis:

```bash
npm test
```

---

## 4. Endpoint penting (monolit)

Prefix `/api` sama dengan tanpa prefix (contoh: `/api/orders` = `/orders`).

| Method | Path | Fungsi singkat |
|--------|------|----------------|
| GET | `/health` | Cek API hidup + `instance` |
| GET | `/events` | Daftar konser (page/size) |
| GET | `/events/{id}` | Detail + denah + **sisa live** |
| POST | `/orders` | **Pesan tiket** (endpoint panas) |
| GET | `/orders/{id}` | Status order |
| POST | `/payments/webhook` | Notifikasi bayar (mock/Midtrans) |
| POST | `/payments/simulate` | Lab: anggap sudah bayar |
| GET | `/mail/outbox` | Daftar e-ticket lab |
| GET | `/mail/outbox/{orderId}` | Isi e-ticket satu order |
| POST | `/internal/reset-quota/{id}` | Reset sisa kursi (lab) |
| GET/POST/PATCH | `/admin/events…` | Panel admin (token `x-admin-token`) |
| GET | `/admin/orders` | Order terbaru (admin) |

### Body `POST /orders` (wajib lengkap)

```json
{
  "eventId": 2,
  "qty": 1,
  "seatCodes": ["B3-16"],
  "email": "pembeli@email.com",
  "buyerName": "Nama Pembeli"
}
```

| Field | Wajib? | Keterangan |
|-------|--------|------------|
| `eventId` | ya | ID konser |
| `qty` | ya | 1–4 |
| `email` | **ya** | Format email valid |
| `buyerName` | **ya** | Min. 2 karakter |
| `seatCodes` | disarankan | Kode kursi; jumlah = qty |

### Kode HTTP yang sering muncul

| Kode | Arti | Contoh |
|------|------|--------|
| **201** | Order sukses (biasanya sudah PAID auto-capture) | Booking OK |
| **400** | Data salah | Nama/email kosong, qty invalid |
| **404** | Event tidak ada | eventId salah |
| **409** | Kuota/kursi tidak tersedia | Sold out / kursi sudah diambil |
| **429** | Terlalu sering request | Rate limit |
| **5xx** | Error server | DB/Redis down |

> **409 bukan bug.** Artinya sistem menolak oversell — itu yang diuji di loadtest.

---

## 5. Alur `POST /orders` (langkah demi langkah)

1. **Validasi** qty, seatCodes, **nama + email**  
2. Ambil data event (cache catalog OK; sisa kursi dari Redis)  
3. **Reserve kuota** di Redis (Lua DECR) — gagal → 409  
4. **Claim seat code** atomik (Lua SADD) — bentrok → 409 + kuota dikembalikan  
5. Hitung **total harga** (jumlah harga tiap kursi, atau fallback harga event)  
6. Buat sesi **payment mock** (VA / redirect lab)  
7. Simpan order Postgres status `PENDING_PAYMENT`  
8. Jika `PAYMENT_AUTO_CAPTURE=1` (default): langsung **CONFIRMED/PAID**  
9. **LPUSH** job ke `queue:eticket` (response cepat, email tidak ditunggu)  
10. Balas **201** + `orderId`, `sisa`, info payment  

Worker (proses lain) kemudian:

- Ambil job dari antrean  
- Tulis e-ticket ke **outbox** (`data/outbox-mail/`) + audit `ETICKET_SENT`  
- (Opsional) kirim SMTP sungguhan jika `SMTP_*` di-set  

---

## 6. Penjelasan per file monolit (`src/`)

### 6.1 Pintu masuk & routing

| File | Peran sederhana |
|------|-----------------|
| **`src/server.js`** | Menyalakan server Express, folder web `public/`, CORS, tunggu DB & Redis siap, panggil seed kuota, listen port. |
| **`src/routes.js`** | “Daftar menu” API: health, events, orders, payments, mail outbox, internal reset. Memanggil service, mengubah error jadi status HTTP. |
| **`src/config.js`** | Membaca pengaturan dari environment (`.env`): URL database, Redis, rate limit, max tiket per order. |
| **`src/middleware/rateLimit.js`** | Membatasi berapa kali satu IP boleh hit API per menit. Lebih → **429**. |

### 6.2 Penyimpanan

| File | Peran sederhana |
|------|-----------------|
| **`src/db.js`** | Bicara ke **Postgres**: ambil event/seats, simpan order, tandai sudah bayar, expire order lama, catat audit. |
| **`src/redis.js`** | Bicara ke **Redis** + nama key standar (`quota:event:1`, `queue:eticket`, dll.). |
| **`src/seed.js`** | Saat API start: setel ulang counter kuota di Redis agar selaras dengan DB (siap war). |

### 6.3 Logika bisnis (paling penting)

| File | Peran sederhana |
|------|-----------------|
| **`src/services/orders.js`** | **Otak pemesanan.** Validasi pembeli, reserve kuota, kunci kursi, hitung harga, panggil payment, simpan order, antre e-ticket, konfirmasi bayar, expire unpaid. |
| **`src/services/quota.js`** | **Anti-oversell.** Script Lua di Redis: potong sisa kursi atomik; kunci `seatCodes` agar dua orang tidak dapat kursi sama. |
| **`src/services/eventCache.js`** | Cache data katalog (judul, poster meta, harga zona) biar baca cepat. **Sisa kursi tidak di-cache** — selalu dari Redis live. |
| **`src/services/paymentGateway.js`** | Gerbang bayar lab: default **mock** (VA + redirect). Bisa Midtrans jika key diisi. Parse webhook “sudah lunas”. |
| **`src/services/mail.js`** | Buat isi e-ticket HTML/teks; simpan ke folder outbox; kirim SMTP hanya jika dikonfigurasi. |

### 6.4 Worker (proses terpisah)

| File | Peran sederhana |
|------|-----------------|
| **`src/worker.js`** | Loop tanpa henti: ambil antrean e-ticket → kirim/simpan mail; sesekali cek order `PENDING_PAYMENT` yang kadaluarsa lalu **kembalikan kuota**. |

Jalankan dengan: `npm run worker` (selain `npm start`).

### 6.5 Tes otomatis

| File | Isi tes |
|------|---------|
| **`src/services/quota.test.js`** | Kuota tidak bisa negatif; kursi bentrok ditolak; release mengembalikan sisa. |
| **`src/services/paymentGateway.test.js`** | Mock payment membuat `paymentId` + VA; webhook settlement = paid. |

---

## 7. File web yang diurus backend (`public/`)

Web Melon-style dipakai demo booking end-to-end.

| File | Peran sederhana |
|------|-----------------|
| **`public/index.html`** | Struktur halaman: list konser, denah, form email/nama (wajib `*`), tombol bayar. |
| **`public/app.js`** | Interaksi: pilih kursi, validasi form, panggil `POST /api/orders`, tampilkan sukses + e-ticket, refresh sisa tanpa menghapus hasil booking. |
| **`public/styles.css`** | Tampilan (warna zona, checkout, toast). |
| **`public/pay/mock.html`** | Halaman bayar simulasi (tombol settle). |
| **`public/event-meta.js`** | Teks benefit & path poster per event (hanya UI). |
| **`public/posters/`** | File gambar poster. |

**Alur user di web:** pilih konser → klik kursi di denah → isi nama & email → Bayar → lihat `orderId` + status CONFIRMED → e-ticket di outbox.

---

## 8. Kontrak API & dokumen terkait

| File | Isi |
|------|-----|
| **`openapi.yaml`** | Spesifikasi OpenAPI monolit (pengembangan). |
| **`openapi-final.yaml`** | Versi **dibekukan v2** — path orders, payments, mail, internal. |
| **`docs/ENDPOINTS.md`** | Tabel endpoint singkat. |
| **`docs/EMAIL-GMAIL.md`** | E-ticket modul = outbox; Gmail opsional. |
| **`docs/BASEURL.md`** | Base URL, rate limit 60/menit (mobile). |
| **`.env.example`** | Contoh variabel lingkungan. |

---

## 9. Environment yang sering dipakai

| Variabel | Default | Arti |
|----------|---------|------|
| `DATABASE_URL` | postgres lokal | Koneksi Postgres |
| `REDIS_URL` | redis lokal | Koneksi Redis |
| `PORT` | 3000 | Port API |
| `RATE_LIMIT` | lab tinggi / produk 60 | Batas request per menit |
| `PAYMENT_PROVIDER` | `mock` | Gateway lab |
| `PAYMENT_AUTO_CAPTURE` | `1` | Langsung lunas setelah order |
| `PAYMENT_TTL_MIN` | 15 | Menit sebelum unpaid expire |
| `SMTP_*` | kosong | Kosong = outbox file saja (cukup modul) |
| `RESET_TOKEN` | `dev-reset` | Token reset kuota lab |

---

## 10. Microservices (ringkas)

Empat service + gateway `:8080` — file di `services/`.

| Service | Port | Tugas |
|---------|-----:|--------|
| **event** | 3001 | Catalog event |
| **ticket** | 3002 | Lock / confirm / release kursi |
| **payment** | 3003 | JWT login, bayar, orkestrasi lock→confirm, publish `ticket.issued` |
| **notification** | 3004 | Dengarkan event → catat e-ticket / outbox |

```bash
docker compose -f docker-compose.ms.yml up --build -d
# E2E: login → POST /v1/payments → GET /v1/notifications/recent
```

Detail: `docs/MICROSERVICES.md`, `docs/ENDPOINTS-MS.md`, `openapi-ms.yaml`.

---

## 11. Apa yang **bukan** cakupan `add backend`

| Area | PIC / folder |
|------|----------------|
| Dataset Excel, `db/init.sql` seed besar | **Data** (`docs/DATA.md`) |
| Docker compose, Nginx, deploy | **DevOps** (`docs/DEPLOY.md`) |
| Angka loadtest p50/p99, skrip k6 | **QA** (`docs/BASELINE.md`, `loadtest/`) |
| Diagram ADR tingkat sistem | **Arsitek** |
| Aplikasi **Expo** `mobile/` | Mobile (bukan backend) |

Backend **menyediakan API**; mobile/web **memakai** API itu.

---

## 12. Checklist `add backend` sudah benar

- [ ] `GET /api/health` → `ok: true`  
- [ ] `GET /api/events` → ada 30 event  
- [ ] `POST /api/orders` tanpa nama/email → **400**  
- [ ] `POST /api/orders` lengkap → **201**, `status: CONFIRMED`  
- [ ] Order kursi yang sama dua kali → kedua **409**  
- [ ] Setelah kuota habis, banyak **409**, bukan 500  
- [ ] Worker jalan → muncul file di outbox / `GET /api/mail/outbox`  
- [ ] `npm test` lulus  

---

## 13. Satu kalimat penutup

> Backend monolit (`add backend`) memastikan **setiap kursi hanya terjual sekali** (Redis atomik), menerima pesanan dengan **identitas pembeli wajib**, mensimulasikan **bayar**, lalu menerbitkan **e-ticket async** lewat worker — siap diuji beban dan didemo lewat web di port 3000.

---

**Lihat juga**

- Endpoint: [`ENDPOINTS.md`](./ENDPOINTS.md)  
- Data & Redis key: [`DATA.md`](./DATA.md)  
- MS: [`MICROSERVICES.md`](./MICROSERVICES.md)  
- Base URL: [`BASEURL.md`](./BASEURL.md)  
