\# QA Results — War Tiket Konser



\## 1. Health Check



Endpoint:



GET /health



Hasil:



\- HTTP 200

\- ok: true

\- service: war-tiket-konser

\- paymentProvider: mock



Status: PASS



\---



\## 2. Event \& Seat Data



Event 1:



\- quotaTotal: 400

\- jumlah seat: 400

\- sisa awal: 400

\- terjual awal: 0



Status: PASS



\---



\## 3. Manual Order Test



Order:



\- eventId: 1

\- qty: 1

\- seatCodes: FL1-001

\- amountIdr: 3.100.000

\- status: CONFIRMED

\- payment provider: mock



Hasil:



\- HTTP 201 Created

\- sisa: 399

\- terjual: 1

\- soldSeats: FL1-001



Status: PASS



\---



\## 4. Payment \& E-Ticket



Payment:



\- provider: mock

\- status: paid

\- auto-capture: enabled



Worker:



\- queue: queue:eticket

\- e-ticket berhasil diproses

\- email mode: file outbox



Status: PASS



\---



\## 5. Load Test — 20 Requests



Configuration:



\- VUS: 20

\- iterations: 20

\- eventId: 1



Result:



\- order\_ok: 20

\- order\_409: 0

\- order\_5xx: 0

\- p95: 797.63 ms



Status: PASS



\---



\## 6. Load Test — 100 VU / 500 Requests



Configuration:



\- VUS: 100

\- iterations: 500

\- eventId: 1



Result:



\- total requests: 500

\- order\_ok: 379

\- order\_409: 121

\- order\_5xx: 0

\- p95: 1813.62 ms



Event after test:



\- quotaTotal: 400

\- terjual: 400

\- sisa: 0



Validation:



PASS — quota habis tanpa overselling.



Status: PASS



\---



\## 7. Seat Race-Condition Test



Target:



\- eventId: 2

\- seatCode: FL1-002

\- concurrent requests: 20



Expected:



\- hanya satu request memperoleh seat

\- request lainnya ditolak dengan HTTP 409

\- tidak ada HTTP 5xx



Actual:



\- FL1-002 berhasil terjual satu kali

\- event 2 sebelum/after test:

&#x20; - quotaTotal: 280

&#x20; - terjual: 1

&#x20; - sisa: 279

\- soldSeats:

&#x20; - FL1-002



Validation:



PASS — tidak terjadi double booking terhadap seat yang sama.



Status: PASS



\---



\# 8. Overall QA Conclusion



Sistem War Tiket Konser berhasil melewati pengujian fungsional,

payment mock, asynchronous e-ticket processing, load testing,

quota concurrency, dan seat race-condition.



Tidak ditemukan:



\- overselling quota

\- double booking seat

\- HTTP 5xx pada load test



Batas performa baseline:



\- p95 threshold: < 2000 ms

\- hasil 100 VU: 1813.62 ms

\- threshold: PASS



Kesimpulan:



PASS — sistem memenuhi skenario pengujian utama untuk mekanisme

war ticket dan concurrency.

