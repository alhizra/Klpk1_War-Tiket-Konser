# docs/DATA.md — Strategi Data & Persistence

**Peran:** Data & Persistence Engineer  
**Tema:** War Tiket Konser  
**Sumber daya rebutan:** Kursi — satu unit kuota hanya boleh terjual satu kali.

---

## Data manual (paling gampang untuk praktikum)

Edit file di folder `data/`, **tidak perlu coding**:

| File | Editor | Isi |
|------|--------|-----|
| `data/events.manual.json` | VS Code / Notepad | Daftar konser |
| `data/seats.manual.csv` | **Excel** → Save CSV | Denah kursi |
| `data/DATA_WAR_TIKET_KONSER.xlsx` | Excel | Sumber master |
| `db/init.sql` | Docker first boot | Schema + seed penuh |

Load ke DB + Redis:
```bash
npm run data:excel
# atau: npm run data:manual
```

Panduan lengkap: `data/README-DATA-MANUAL.md`

---

## 1. Prinsip

| Data | Penyimpanan | Konsistensi |
|------|-------------|-------------|
| Catalog event (judul, harga, jadwal) | Postgres + cache Redis | AP / eventual OK |
| **Sisa kursi / kuota** | **Redis counter atomik** | **CP — harus akurat** |
| Order (audit) | Postgres | Durable setelah reserve sukses |
| E-ticket job | Redis list `queue:eticket` | At-least-once + worker |

**Jangan** cache sisa kursi dengan TTL. Cache basi → oversell.

---

## 2. Skema Postgres (`db/init.sql`)

- `events` — catalog + `quota_total` (seed Excel: 7 event, event_id=1 TREASURE quota=400)
- `orders` — setiap pemesanan sukses (`CONFIRMED`)
- `order_events_audit` — jejak ORDER_CONFIRMED / ETICKET_SENT
- Index: `idx_orders_event`, `idx_orders_created`

Migrasi awal dijalankan otomatis oleh volume init Postgres saat first boot.

---

## 3. Redis key design

| Key | Tipe | TTL | Kegunaan |
|-----|------|-----|----------|
| `quota:event:{id}` | string (int) | — | Sisa kursi; diubah hanya lewat `DECRBY`/`INCRBY` |
| `sold:event:{id}` | string (int) | — | Terjual kumulatif |
| `cache:event:{id}` | string (JSON) | 60–74s (jitter) | Catalog saja |
| `lock:cache:event:{id}` | string | 5s | Single-flight isi cache |
| `queue:eticket` | list | — | Antrean worker |
| `rl:{ip}:{window}` | string | window | Rate limit |

Seed saat API start: `src/seed.js` mengisi `quota` = `quota_total - sold_db`.

---

## 4. Anti-oversell (inti Data + Backend)

```
sisa = DECRBY quota:event:1 qty
if sisa < 0:
  INCRBY quota:event:1 qty   # rollback
  return 409
else:
  INCRBY sold:event:1 qty
  INSERT order ...
  LPUSH queue:eticket ...
```

- Atomik di Redis → aman multi-replika di belakang Nginx.
- Jika insert Postgres gagal → kompensasi `INCRBY` kuota kembali.
- Setelah serbuan: `terjual + sisa == quota_total` dan `terjual <= quota_total`.

---

## 5. Cache-aside (endpoint baca)

`GET /events/:id`:

1. GET `cache:event:{id}` → hit catalog  
2. Miss → query Postgres → SET EX ttl+jitter  
3. **Selalu** merge `sisa`/`terjual` dari Redis live  
4. Response field `from`: `cache` | `db` (hanya untuk catalog)

Invalidasi: hapus `cache:event:{id}` saat admin ubah catalog (belum ada admin API di starter).

---

## 6. Antrean

- Producer: `POST /orders` → `LPUSH queue:eticket` → response cepat (`note: e-ticket menyusul`)
- Consumer: service `worker` → `BRPOP` → simulasikan kirim + audit `ETICKET_SENT`
- Scale worker: `docker compose up -d --scale worker=3`

---

## 7. Connection pooling

`pg.Pool` max 20 di `src/db.js` — hindari 1 koneksi baru per request saat peak.

---

## 8. Checklist verifikasi Data

- [ ] `docker compose up -d --build` → Postgres init seed 7 event (Excel), total 2480 seats  
- [ ] `curl /events/1` → TREASURE, `sisa` ≈ quota, panggilan ke-2 `from: cache`  
- [ ] Load test `POST /orders` qty=1 → `terjual <= quota_total`, sisa >= 0  
- [ ] Banyak 409 setelah kuota habis = **benar**, bukan bug  
- [ ] Panjang `LLEN queue:eticket` naik lalu turun saat worker hidup  

---

## 9. Hubungan dengan Excel dataset

Sumber kebenaran: **`data/DATA_WAR_TIKET_KONSER.xlsx`** (7 event / 2480 seats).

```bash
npm run data:excel       # import + load DB/Redis
npm run data:init-sql    # regenerate db/init.sql untuk Docker/Codespace
```

Artefak turunan: `events.manual.json`, `seats.manual.csv`, `categories.manual.json`, `db/init.sql`.  
Kuota runtime tetap di Redis (anti-oversell); Excel/CSV hanya catalog + denah.
