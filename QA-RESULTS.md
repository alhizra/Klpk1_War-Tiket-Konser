# QA REPORT
# War Tiket Konser

## 1. Informasi Pengujian

| Item | Keterangan |
|---|---|
| Project | War Tiket Konser |
| Environment | Local / Docker Compose |
| Gateway | Nginx |
| API | Node.js / Express |
| Database | PostgreSQL 16 |
| Cache / Queue | Redis 7 |
| Worker | Node.js Worker |
| Load Test Tool | k6 |
| Functional Test Tool | curl / PowerShell |
| Base URL | http://localhost:8080 |
| Event utama pengujian | Event ID 1 - TREASURE |
| Quota event | 400 |
| Payment Provider | mock |

---

# 2. Tujuan QA

Pengujian Quality Assurance dilakukan untuk memastikan sistem War Tiket Konser:

1. Dapat diakses melalui gateway.
2. API dapat memberikan response sesuai fungsi.
3. Endpoint order dapat menangani request.
4. Sistem dapat mencegah overselling.
5. Kuota tidak menjadi negatif.
6. Jumlah tiket terjual tidak melebihi kuota.
7. Request ketika kuota habis mendapatkan HTTP 409.
8. Endpoint admin hanya dapat diakses menggunakan token admin.
9. Request tanpa autentikasi admin ditolak.
10. Sistem dapat menangani concurrent request menggunakan k6.
11. Sistem tidak menghasilkan HTTP 5xx selama pengujian beban.
12. Komponen Docker Compose berjalan dengan baik.
13. Redis, PostgreSQL, API, Worker dan Gateway dapat berjalan secara bersamaan.

---

# 3. Environment Pengujian

Arsitektur environment pengujian:

Client
  |
  v
Nginx Gateway :8080
  |
  v
API :3000
  |
  +---- Redis :6379
  |
  +---- PostgreSQL :5432
  |
  v
Worker

Container yang terdeteksi:

- klpk1_war-tiket-konser-api-1
- klpk1_war-tiket-konser-gateway-1
- klpk1_war-tiket-konser-postgres-1
- klpk1_war-tiket-konser-redis-1
- klpk1_war-tiket-konser-worker-1

# 4. Hasil Health Check 

Endpoint : GET /health
Hasil : 
{
  "ok": true,
  "service": "war-tiket-konser",
  "instance": "bccf0fe2dae8",
  "pid": 1,
  "paymentProvider": "mock"
}

Status : PASS 
Sistem API dapat merespons melalui gateaway localhost:8080

# 5. Pengujian Event 

Endpoint: GET /events
ditemukan 11 event :

| Event ID | Event      | Quota | Sisa | Terjual |
| -------: | ---------- | ----: | ---: | ------: |
|        1 | TREASURE   |   400 |    0 |    1220 |
|        2 | LYKN       |   280 |  280 |       0 |
|        3 | BLACKPINK  |   500 |  500 |       0 |
|        4 | NCT DREAM  |   350 |  350 |       0 |
|        5 | EXO        |   320 |  320 |       0 |
|        6 | ATEEZ      |   380 |  380 |       0 |
|        7 | BUS        |   250 |  250 |       0 |
|        8 | Stray Kids |   360 |  360 |       0 |
|        9 | aespa      |   300 |  300 |       0 |
|       10 | SEVENTEEN  |   450 |  450 |       0 |
|       11 | 4EVE       |   260 |  260 |       0 |

# 6. Pengujian Anti-Overselling

Script:

loadtest/oversell-check.ps1

Konfigurasi:

BASE=http://localhost:8080
EVENT_ID=1
SHOTS=450

Hasil:

201 = 400
409 = 50
429 = 0
5xx = 0
other = 0

Kondisi akhir:

quotaTotal = 400
terjual     = 400
sisa        = 0

Validasi:

400 tiket berhasil
50 request ditolak
0 request 5xx
0 oversell
Kesimpulan

Pengujian anti-overselling:

PASS

Sistem berhasil membatasi penjualan sampai quota 400 tiket. Request ke-401 sampai request berikutnya yang tidak mendapatkan kuota ditolak dengan HTTP 409.

# 7. Pengujian Load Test k6

# 7.1 Test 20 VU / 100 Iterasi

Konfigurasi:

VUS = 20
ITERATIONS = 100

Hasil:

p95        = 273.5901 ms
order_ok   = 100
order_409  = 0
order_5xx  = 0

Status:
PASS

# 7.2 Test 100 VU / 400 Iterasi

Konfigurasi:

VUS = 100
ITERATIONS = 400

Hasil:

p95        = 1078.33016 ms
order_ok   = 400
order_409  = 0
order_5xx  = 0

Status:

PASS untuk correctness, tetapi performa p95 sudah melewati target baseline 500 ms.

Catatan:

Pengujian tetap menghasilkan seluruh 400 order berhasil dan tidak menghasilkan HTTP 5xx.

# 7.3 Test 200 VU / 500 Iterasi

Konfigurasi:

VUS = 200
ITERATIONS = 500

Hasil:

p95        = 1745.624995 ms
order_ok   = 400
order_409  = 100
order_5xx  = 0

Hasil kuota:

quotaTotal = 400
terjual     = 400
sisa        = 0

Status:

PASS untuk anti-overselling dan correctness.

Namun:
PERFORMANCE WARNING
karena p95 mencapai sekitar 1,75 detik.

# 8 Ringkasan Load Test 

|  VU | Iterasi | 201 | 409 | 5xx |        p95 |
| --: | ------: | --: | --: | --: | ---------: |
|  20 |     100 | 100 |   0 |   0 |  273.59 ms |
| 100 |     400 | 400 |   0 |   0 | 1078.33 ms |
| 200 |     500 | 400 | 100 |   0 | 1745.62 ms |

Analisis
Pada concurrency rendah, sistem masih memiliki response time yang relatif rendah.

Ketika concurrency dinaikkan:

20 VU  → 273.59 ms
100 VU → 1078.33 ms
200 VU → 1745.62 ms

Terlihat adanya peningkatan latency seiring peningkatan concurrency.

Walaupun demikian, sistem tetap:

tidak menghasilkan 5xx;
tidak menghasilkan overselling;
tidak membuat sisa quota negatif;
membatasi tiket pada 400;
mengembalikan 409 ketika quota habis.

# 9. Pengujian Admin
Endpoint:
GET /admin/events
Token valid

Request:
-H "x-admin-token: admin-wtk"

Response:
HTTP/1.1 200 OK

Status:
PASS

Tanpa token
Request:
GET /admin/events

Response:
HTTP/1.1 401 Unauthorized

Response body:
{
  "error": "unauthorized — sertakan header x-admin-token"
}

Status:
PASS

Token salah

Request:
-H "x-admin-token: salah"

Response:
HTTP/1.1 401 Unauthorized

Status:
PASS

Kesimpulan
Endpoint admin telah menerapkan validasi token. Akses tanpa token dan dengan token yang salah ditolak.

# 10. Pengujian Invalid Requast
Beberapa request invalid diuji:
{"eventId":1,"qty":0}
{"eventId":99999,"qty":1}
{"eventId":1,"qty":999}

Hasil yang diperoleh:
HTTP 400 Bad Request
{"error":"JSON body tidak valid"}
Catatan QA

Request di atas dikirim menggunakan PowerShell/curl dengan format JSON yang mengalami masalah escaping pada command line.

Oleh karena itu hasil ini belum cukup untuk menyimpulkan validasi business rule qty dan eventId secara spesifik.

Untuk dokumentasi final, pengujian invalid request sebaiknya diulang menggunakan file JSON:

Set-Content .\loadtest\invalid-order.json '{"eventId":1,"qty":0}' -Encoding ascii

kemudian:
curl.exe -i -X POST http://localhost:8080/orders `
-H "Content-Type: application/json" `
--data-binary "@.\loadtest\invalid-order.json"

# 11. Pengujian Infrastruktur
Perintah:
docker compose ps

menunjukkan container:
api       Up
gateway   Up
postgres  Up (healthy)
redis     Up (healthy)
worker    Up

Status:
PASS

Komponen utama sistem berhasil berjalan melalui Docker Compose.

# 12. Resource Usage 
pada pemeriksaan docker start diperoleh antara lain : 
| Service    |   CPU |    Memory |
| ---------- | ----: | --------: |
| API        | 0.00% | 63.23 MiB |
| Worker     | 0.04% | 26.90 MiB |
| Gateway    | 0.00% |  8.29 MiB |
| PostgreSQL | 2.29% | 41.24 MiB |
| Redis      | 0.89% |  8.67 MiB |
Pengujian ini merupakan snapshot setelah load test dan bukan pengukuran CPU peak selama keseluruhan test.

# 13. Status Akhir QA

| Area                                 | Status      |
| ------------------------------------ | ----------- |
| Health Check                         | PASS        |
| Event API                            | PASS        |
| Order API                            | PASS        |
| Admin Authentication                 | PASS        |
| Anti-Overselling                     | PASS        |
| HTTP 409 ketika quota habis          | PASS        |
| No HTTP 5xx pada load test           | PASS        |
| Docker Compose                       | PASS        |
| Resource usage                       | PASS        |
| Performance concurrency rendah       | PASS        |
| Performance concurrency tinggi       | WARNING     |
| Validasi business rule invalid order | NEED RETEST |


