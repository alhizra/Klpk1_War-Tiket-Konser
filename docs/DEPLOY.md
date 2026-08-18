# docs/DEPLOY.md — Menjalankan sistem

**PIC utama:** Infrastructure & DevOps (AL-HIZRA)  
Starter compose disiapkan bersama Backend/Data agar bisa diukur dari P1.

## Syarat
- Docker Desktop (engine running)
- Port host **8080** bebas

## Start
```bash
docker compose up -d --build
docker compose ps
curl -s http://localhost:8080/health
```

## Scale API (P2)
```bash
docker compose up -d --scale api=3
# bukti distribusi:
curl -s http://localhost:8080/health
```

## Reset kuota (antar uji)
```bash
docker compose exec api node src/seed.js
# full reset DB volume:
docker compose down -v && docker compose up -d --build
```

## Base URL (calon artefak)
- Local: `http://localhost:8080`
- Aturan (P4): rate limit default 60/menit/IP (di compose loadtest dinaikkan), page size default 20 max 50

## Layanan
| Service | Peran |
|---------|--------|
| nginx :8080 | Load balancer |
| api | Order + event (bisa di-scale) |
| worker | E-ticket queue consumer |
| postgres | Catalog + orders |
| redis | Kuota atomik + cache + queue + RL |
