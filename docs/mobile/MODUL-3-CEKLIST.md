# Modul 3 — Ceklist & status (Mobile Expo)

**Sumber di repo:** `mobile/JALANKAN.md`, `docs/mobile/LAPORAN.md`, `docs/BASEURL.md`  
**App:** folder `mobile/` (bukan `create-expo-app` blank baru)

---

## A. Isi materi vs kode (status)

| Materi | Wajib? | Status kode | File |
|--------|--------|-------------|------|
| **P1** Expo project + `npx expo start` | Ya | ✅ | `mobile/` Expo 52 |
| **P1** `config.js` satu pintu BASE_URL | Ya | ✅ | `mobile/config.js` |
| **P1** PAGE_SIZE 20 (baseurl) | Ya | ✅ | `PAGE_SIZE = 20` |
| **P1** `fetch` ke API squad | Ya | ✅ | `api/client.js` |
| **P1** Daftar dari API (bukan dummy) | Ya | ✅ | `DaftarScreen` → `GET /events` |
| **P1** IP Wi‑Fi / larang localhost di HP | Ya | ✅ | LAN `10.87.96.26` |
| **P2** Navigasi multi-layar | Ya | ✅ | React Navigation stack |
| **P2** 5 layar alur war | Ya | ✅ | Daftar→Denah→Antrean→Bayar→E-Ticket |
| **P3** 429 exponential backoff | Ya | ✅ | `api/client.js` |
| **P3** 409 pesan ramah + kunci tombol | Ya | ✅ | `PembayaranScreen` |
| **P3** Body order: email + buyerName | Ya (ikut backend) | ✅ | form bayar + `endpoints.js` |
| **P4** Cache list/detail offline | Ya | ✅ | `api/cache.js` |
| **P4** Outbox POST offline | Ya | ✅ | `api/outbox.js` |
| **P4** NetInfo banner luring | Ya | ✅ | `useJaringan.js` |
| **P4** QR e-ticket lokal | Ya | ✅ | `ETicketScreen` |
| **P5** EAS APK + video demo | Opsional | ⬜ belum | `docs/mobile/BUILD.md` |

**Kesimpulan kode P1–P4: sudah lengkap.**  
Yang sering “tidak berubah” = **HP belum memuat bundle baru** (jaringan / cara start Expo), bukan fitur kosong.

---

## B. Yang BELUM / di luar kode

| Item | Keterangan |
|------|------------|
| Demo di HP sukses end-to-end | Butuh **Wi‑Fi sama** + API hidup + restart Expo `-c` |
| Firewall Windows port 3000 | Kadang blok HP → izinkan inbound |
| P5 EAS build APK | Opsional serah CozyLab |
| Video presentasi | Tugas dokumentasi, bukan coding |

---

## C. Kenapa HP biru / “tidak ada perubahan” (penting)

Dari screenshot status bar HP: **LTE / 4G**, bukan Wi‑Fi laptop.

```
Metro (laptop)  ←— butuh Wi‑Fi sama —→  Expo Go (HP)
API :3000       ←— butuh Wi‑Fi sama —→  fetch di app
```

| Situasi HP | Bundle Expo (JS) | API backend |
|------------|------------------|-------------|
| Wi‑Fi **sama** laptop | ✅ load | ✅ fetch |
| **LTE saja** | ❌ gagal / biru | ❌ Failed to fetch |
| Wi‑Fi kampus beda SSID / client isolation | ❌ | ❌ |

**LTE tidak bisa “lihat” IP laptop `10.87.96.26`.**  
Tanpa Wi‑Fi sama, scan QR berapa kali pun **bundle lama / error** tetap tampil → seolah “tidak ada perubahan”.

---

## D. Setting ulang yang BENAR (urut)

### 1) Laptop — API

```bat
cd C:\Users\User\Downloads\War-Tiket-Konser
docker start wtk-pg wtk-redis
set DATABASE_URL=postgres://wtk:wtk@localhost:5432/wtk
set REDIS_URL=redis://localhost:6379
set PORT=3000
node src/server.js
```

Browser laptop: http://127.0.0.1:3000/api/health → `ok: true`

### 2) Laptop — cek IP Wi‑Fi

```bat
ipconfig
```

Adapter **Wi‑Fi** (bukan vEthernet 172.x) → contoh `10.87.96.26`  
Harus sama dengan `LAN_IP` di `mobile/config.js`.

### 3) HP

1. **Matikan data seluler**  
2. Sambung **Wi‑Fi yang sama** dengan laptop  
3. Browser HP buka: `http://10.87.96.26:3000/api/health`  
   - Muncul JSON `ok` → jaringan OK  
   - Timeout → firewall / beda Wi‑Fi  

### 4) Expo (bundle baru)

```bat
cd C:\Users\User\Downloads\War-Tiket-Konser\mobile
npx expo start --lan -c
```

- **Ctrl+C** dulu jika Expo lama masih jalan  
- Di HP: tutup Expo Go total → buka → **scan QR baru**  
- Jangan pakai tab/QR kemarin  

### 5) Firewall (jika browser HP gagal health)

Windows Security → Firewall → Allow app → izinkan **Node.js** private network,  
atau buat inbound rule **TCP 3000**.

---

## E. Uji fitur Modul 3 (setelah HP hijau)

| # | Uji | Hasil diharapkan |
|---|-----|------------------|
| 1 | Layar daftar | 11 konser + poster |
| 2 | Ketuk event | Denah kursi |
| 3 | Pilih 1–4 kursi → lanjut | Antrean countdown |
| 4 | Isi nama + email → Bayar | 201 → E-ticket QR |
| 5 | Kursi habis | Pesan 409 |
| 6 | Airplane / offline list | Cache + banner luring |
| 7 | Offline lalu bayar | Outbox PENDING_SYNC |

---

## F. Ringkas

| Pertanyaan | Jawaban |
|------------|---------|
| Kode Modul 3 P1–P4 kurang? | **Tidak** — sudah ada |
| Perlu `create-expo-app` baru? | **Tidak** |
| Kenapa HP tidak berubah? | Hampir pasti **jaringan** (LTE / beda Wi‑Fi) atau Expo belum `-c` + QR baru |
| P5? | Opsional (EAS APK) |

**Langkah mutlak sekarang:** HP Wi‑Fi sama → buka health di browser HP → `npx expo start --lan -c` → scan QR baru.
