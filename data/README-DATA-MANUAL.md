# Dataset — War Tiket Konser

Sumber utama: **`DATA_WAR_TIKET_KONSER.xlsx`** (sheet venues, events, seat_categories).

Import:
```bash
npm run data:excel
# atau: python data/import_excel_dataset.py --load
# regenerate Docker seed: npm run data:init-sql
```

## Event (setelah import Excel)

| ID | Code | Artis | Venue | Kota | Kursi |
|----|------|--------|--------|------|------:|
| 1 | EVT001 | TREASURE | KSPO DOME | Seoul | 400 |
| 2 | EVT002 | LYKN | Impact Arena | Bangkok | 280 |
| 3 | EVT003 | BLACKPINK | Seoul World Cup Stadium | Seoul | 500 |
| 4 | EVT004 | NCT DREAM | Gocheok Sky Dome | Seoul | 350 |
| 5 | EVT005 | EXO | Jamsil Indoor | Seoul | 320 |
| 6 | EVT006 | ATEEZ | BEXCO Auditorium | Busan | 380 |
| 7 | EVT007 | BUS | Thunder Dome | Bangkok | 250 |

**Total denah: 2.480 seat codes** (`seats.manual.csv`)

---

### Zona per event (ringkas)

| Event | Kategori (quota) |
|-------|------------------|
| 1 TREASURE | VIP 50 · FLOOR 120 · GOLD 140 · SILVER 90 |
| 2 LYKN | VVIP 40 · A 80 · B 100 · C 60 |
| 3 BLACKPINK | SCVIP 40 · FLOOR 160 · ORANGE 180 · NAVY 120 |
| 4 NCT DREAM | DIA 70 · GOLD 90 · SILVER 110 · BRONZE 80 |
| 5 EXO | R 60 · S 120 · A 140 |
| 6 ATEEZ | PIT 60 · A 110 · B 120 · C 90 |
| 7 BUS | VVIP 30 · A 70 · B 90 · C 60 |

Harga dalam **IDR** untuk lab; di dunia nyata biasanya **KRW** + currency gateway.

---

## File

| File | Peran |
|------|--------|
| `DATA_WAR_TIKET_KONSER.xlsx` | **Sumber kebenaran** events/kategori |
| `events.manual.json` | Master event + kategori (hasil import) |
| `generate-real-seats.js` | Generator denah dari quota kategori |
| `seats.manual.csv` | 2480 baris kursi |
| `categories.manual.json` | Ringkas kategori |
| `data-summary.json` | Verifikasi seats = quota |
| `generate_init_sql.py` | Regenerasi `db/init.sql` untuk Docker |
| `manual-seed.sql` | Backup catalog SQL (tanpa full denah) |

---

## Cara load

```bash
# Postgres + Redis harus hidup
npm run data:excel      # dari Excel (disarankan)
# atau:
npm run data:generate   # ulang denah dari events.manual.json
npm run data:manual     # insert DB + reset Redis kuota
npm start
```

Buka web:
- http://localhost:3000/           → daftar 7 event
- http://localhost:3000/?event=1  → TREASURE
- http://localhost:3000/?event=2  → LYKN
- http://localhost:3000/?event=3  → BLACKPINK
- http://localhost:3000/?event=4  → NCT DREAM
- http://localhost:3000/?event=5  → EXO
- http://localhost:3000/?event=6  → ATEEZ
- http://localhost:3000/?event=7  → BUS

---

## Aturan data (wajib)

1. `sum(categories.quota) === quota_total` per event  
2. `COUNT(seats) === quota_total` setelah generate  
3. `seat_code` unik per `event_id`  
4. Redis `quota:event:{id}` di-set = sisa saat load/seed  
5. Anti-oversell tetap di backend (Lua DECR), bukan di file CSV  

---

## Edit

1. Ubah Excel → `npm run data:excel` (atau edit `events.manual.json`).  
2. Sesuaikan `LAYOUT_BY_EVENT` di `generate-real-seats.js` jika pola baris berubah.  
3. `npm run data:generate && npm run data:manual`  
4. `npm run data:init-sql` agar Docker/Codespace seed ikut terbaru.
