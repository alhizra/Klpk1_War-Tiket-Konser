# LOAD TEST RESULT
# War Tiket Konser

## 1. Tujuan

Load testing dilakukan untuk mengetahui kemampuan sistem War Tiket Konser dalam menangani request pembelian tiket secara bersamaan.

Pengujian difokuskan pada:

- throughput;
- latency;
- concurrent users;
- HTTP status;
- HTTP 5xx;
- anti-overselling;
- konsistensi quota.

---

# 2. Tool
Tool yang digunakan:

k6 v2.2.0
Script:
loadtest/k6-orders.js

Base URL:
http://localhost:8080

Event:
Event ID = 1
TREASURE (트레저) Live
Quota = 400

# 3. Skenario
Script k6 menggunakan:
shared-iterations

Parameter yang diuji:
20 VU / 100 iterasi
100 VU / 400 iterasi
200 VU / 500 iterasi

Status HTTP yang diperhatikan:
201 = order berhasil
409 = quota tidak tersedia
5xx = server error

HTTP 409 dianggap sebagai response bisnis yang valid ketika quota sudah habis.

# 4. Hasil Test 20 VU
Command:

k6 run `
-e BASE=http://localhost:8080 `
-e EVENT_ID=1 `
-e VUS=20 `
-e ITERS=100 `
.\loadtest\k6-orders.js

Result:

p95 = 273.5901 ms
order_ok = 100
order_409 = 0
order_5xx = 0

Status:
PASS

# 5. Hasil Test 100 vu

Command:

k6 run `
-e BASE=http://localhost:8080 `
-e EVENT_ID=1 `
-e VUS=100 `
-e ITERS=400 `
.\loadtest\k6-orders.js

Result:

p95 = 1078.33016 ms
order_ok = 400
order_409 = 0
order_5xx = 0

Status:
PASS untuk correctness.

# 6. Hasil Test 200 VU

Command:
k6 run `
-e BASE=http://localhost:8080 `
-e EVENT_ID=1 `
-e VUS=200 `
-e ITERS=500 `
.\loadtest\k6-orders.js

Result:
p95 = 1745.624995 ms
order_ok = 400
order_409 = 100
order_5xx = 0

Quota:
quota = 400
terjual = 400
sisa = 0

Status:
PASS untuk correctness dan anti-overselling.

# 7. Anti-Overselling Load Test

Script:
loadtest/oversell-check.ps1

Configuration:
SHOTS = 450
EVENT_ID = 1

Result:
201 = 400
409 = 50
429 = 0
5xx = 0
other = 0

Final:
terjual = 400
sisa = 0
quotaTotal = 400

Kesimpulan:
Tidak ditemukan overselling.

# 8. Perbandingan
|  VU | Iterasi | 201 | 409 | 5xx |        p95 |
| --: | ------: | --: | --: | --: | ---------: |
|  20 |     100 | 100 |   0 |   0 |  273.59 ms |
| 100 |     400 | 400 |   0 |   0 | 1078.33 ms |
| 200 |     500 | 400 | 100 |   0 | 1745.62 ms |

# 9. Analisis
Peningkatan concurrency menyebabkan peningkatan latency.

Perubahan p95:
20 VU  : 273.59 ms
100 VU : 1078.33 ms
200 VU : 1745.62 ms

Pada 200 VU, hanya 400 dari 500 request yang berhasil karena quota event hanya 400.

100 request sisanya mendapatkan HTTP 409.

Hal tersebut merupakan behavior yang diharapkan.

Tidak ditemukan HTTP 5xx pada seluruh pengujian load test yang dilakukan.






