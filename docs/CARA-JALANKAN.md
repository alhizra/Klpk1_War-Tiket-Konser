# Cara menjalankan War Tiket Konser

Repo: https://github.com/alhizra/Klpk1_War-Tiket-Konser

Ada **2 cara**: laptop lokal, atau **GitHub Codespaces**.

---

## A) GitHub Codespaces (disarankan untuk teman)

### Buat / buka Codespace
1. Buka https://github.com/alhizra/Klpk1_War-Tiket-Konser  
2. Klik hijau **Code** → tab **Codespaces**  
3. **Create codespace on main** (atau buka yang sudah ada)  
4. Tunggu setup otomatis (Docker + dataset Excel 7 event) — bisa 3–8 menit pertama kali  

### Buka web
1. Di Codespace, buka tab **PORTS** (bawah / panel)  
2. Cari port **8080** (Gateway)  
3. Klik kanan / ⋮ → **Port Visibility** → **Public**  
   - Agar teman lain / kamu dari HP bisa buka link-nya  
4. Klik ikon **Open in Browser** pada port 8080  

URL mirip:
`https://<nama-codespace>-8080.app.github.dev/`

Event:
- `/?event=1` TREASURE  
- `/?event=2` LYKN  
- `/?event=3` BLACKPINK  
- `/?event=4` NCT DREAM  
- `/?event=5` EXO  
- `/?event=6` ATEEZ  
- `/?event=7` BUS  

### Kalau web kosong / error
Di terminal Codespace:
```bash
docker compose ps
docker compose up -d --build
docker compose exec api node data/generate-real-seats.js
docker compose exec api node src/load-manual-data.js
```

### Dev mode (hot reload) di Codespace
```bash
# Postgres+Redis dari compose; API di Node
docker compose up -d postgres redis
export DATABASE_URL=postgres://wtk:wtk@localhost:5432/wtk
export REDIS_URL=redis://localhost:6379
export PORT=3000
# expose postgres/redis ke host codespace dulu:
docker compose up -d
# API lewat gateway 8080 sudah jalan; atau:
npm start
# lalu buka port 3000 (Public)
```

> Catatan: default `docker-compose.yml` **tidak** mem-publish 5432/6379 ke host.  
> Untuk `npm start` murni di Codespace, pakai full compose (gateway 8080) saja — lebih mudah.

### Stop biaya Codespace
- Codespace → **Stop codespace** saat tidak dipakai (kuota gratis terbatas).

---

## B) Laptop lokal (Docker Desktop)

### Syarat
- Docker Desktop **Running**
- Git

### Perintah
```bash
git clone https://github.com/alhizra/Klpk1_War-Tiket-Konser.git
cd Klpk1_War-Tiket-Konser
copy .env.example .env

docker compose up -d --build
docker compose exec api node data/generate-real-seats.js
docker compose exec api node src/load-manual-data.js
```

Buka: **http://localhost:8080/**

### Windows tanpa full compose (Node + DB container)
```bash
npm install
docker run -d --name wtk-pg -e POSTGRES_USER=wtk -e POSTGRES_PASSWORD=wtk -e POSTGRES_DB=wtk -p 5432:5432 -v "%cd%/db/init.sql:/docker-entrypoint-initdb.d/01-init.sql:ro" postgres:16-alpine
docker run -d --name wtk-redis -p 6379:6379 redis:7-alpine

set DATABASE_URL=postgres://wtk:wtk@localhost:5432/wtk
set REDIS_URL=redis://localhost:6379
set PORT=3000
npm run data:excel
npm start
```
Buka: **http://localhost:3000/**

---

## C) Kamu di laptop, teman di Codespace

| Siapa | Di mana | URL |
|--------|---------|-----|
| Teman | Codespace | `https://xxxx-8080.app.github.dev/` (port **Public**) |
| Kamu | Browser laptop/HP | pakai **URL Public** milik Codespace teman |

Tidak perlu install Docker di laptopmu jika hanya mau **lihat** web teman — cukup link Public port 8080.

Kalau **kamu** yang mau host:
1. Kamu buka Codespace di akun yang punya akses repo  
2. Port 8080 → Public  
3. Kirim link ke teman  

---

## Troubleshooting

| Gejala | Perbaikan |
|--------|-----------|
| Port 8080 tidak muncul | `docker compose up -d` lalu refresh Ports |
| 502 Bad Gateway | `docker compose logs api` — tunggu api healthy, restart `docker compose restart api gateway` |
| Event kosong / sisa aneh | jalankan lagi `load-manual-data.js` |
| Codespace lambat first build | normal; next start lebih cepat |
| Tidak bisa diakses dari luar | Port Visibility harus **Public**, bukan Private |

---

## Ringkas chat ke teman (copy-paste)

```
1. Buka https://github.com/alhizra/Klpk1_War-Tiket-Konser
2. Code → Codespaces → Create / Open
3. Tunggu setup selesai
4. Tab PORTS → 8080 → Visibility: Public → Open in Browser
5. Web war tiket (TREASURE/LYKN/BLACKPINK/NCT/EXO/ATEEZ/BUS) siap
Kalau error, di terminal:
docker compose up -d --build
docker compose exec api node src/load-manual-data.js
```
