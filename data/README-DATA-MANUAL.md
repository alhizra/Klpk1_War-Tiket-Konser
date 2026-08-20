# Data Real — War Tiket Konser Korea

Dataset katalog + denah untuk skenario **war tiket K-pop** (gaya Weverse / Ticketlink / Melon Ticket).

## Event

| ID | Artis | Venue | Kota | Kursi |
|----|--------|--------|------|------:|
| 1 | **BTS** (방탄소년단) | Busan Asiad Main Stadium | Busan | **500** |
| 2 | **SEVENTEEN** (세븐틴) | KSPO DOME, Olympic Park | Seoul | **400** |
| 3 | **NewJeans** (뉴진스) | Inspire Arena | Incheon | **300** |
| 4 | **IU** (아이유) | Jamsil Indoor Stadium | Seoul | **280** |

**Total denah: 1.480 seat codes** (`seats.manual.csv`)

---

### Event 1 — BTS @ Busan Asiad (stadium war)
| Zone | Harga (IDR demo) | Qty | Tipe |
|------|----------------:|----:|------|
| SCVIP Soundcheck | 4.500.000 | 40 | Reserved SC1–SC4 |
| Purple Floor | 3.200.000 | 160 | Standing P1/P2 |
| Orange Lower | 2.500.000 | 180 | Numbered O1–O9 |
| Navy Upper | 1.800.000 | 120 | Numbered N1–N6 |

### Event 2 — SEVENTEEN @ KSPO DOME
| DIA Standing 80 | GOLD 100 | SILVER 120 | BRONZE 100 |

### Event 3 — NewJeans @ Inspire Arena
| PIT 50 | Seat A 90 | Seat B 100 | Seat C 60 |

### Event 4 — IU @ Jamsil (R/S/A Korea style)
| R 60 | S 100 | A 120 | full reserved |

Harga dalam **IDR** untuk lab; di dunia nyata biasanya **KRW** + currency gateway.

---

## File

| File | Peran |
|------|--------|
| `events.manual.json` | Master event + kategori + syarat |
| `generate-real-seats.js` | Generator denah dari quota kategori |
| `seats.manual.csv` | 1480 baris kursi (output generate) |
| `categories.manual.json` | Ringkas kategori |
| `data-summary.json` | Verifikasi seats = quota |

---

## Cara load

```bash
# Postgres + Redis harus hidup
npm run data:generate   # ulang denah (opsional)
npm run data:manual     # insert DB + reset Redis kuota
npm start
```

Buka web:
- http://localhost:3000/           → default event 1 (BTS)
- http://localhost:3000/?event=2  → SEVENTEEN
- http://localhost:3000/?event=3  → NewJeans
- http://localhost:3000/?event=4  → IU

---

## Aturan data (wajib)

1. `sum(categories.quota) === quota_total` per event  
2. `COUNT(seats) === quota_total` setelah generate  
3. `seat_code` unik per `event_id`  
4. Redis `quota:event:{id}` di-set = `quota_total` saat `data:manual`  
5. Anti-oversell tetap di backend (Lua DECR), bukan di file CSV  

---

## Edit

1. Ubah `events.manual.json` (artis, venue, harga, quota).  
2. Sesuaikan `LAYOUT_BY_EVENT` di `generate-real-seats.js` jika pola baris berubah.  
3. `npm run data:manual`.
