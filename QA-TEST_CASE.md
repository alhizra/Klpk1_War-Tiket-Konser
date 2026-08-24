# QA TEST CASE
# War Tiket Konser

## A. Functional Test

| ID | Test Case | Request | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| TC-001 | Health check | GET /health | HTTP 200 | HTTP 200 | PASS |
| TC-002 | Get events | GET /events | Daftar event | 11 event tampil | PASS |
| TC-003 | Get event detail | GET /events/1 | Detail event | Event TREASURE tampil | PASS |
| TC-004 | Get quota | GET /internal/quota/1 | Informasi quota | Response quota tersedia | PASS |
| TC-005 | Reset quota | POST /internal/reset-quota/1 | Quota kembali penuh | 400/400 | PASS |
| TC-006 | Order normal | POST /orders | HTTP 201 | Berhasil pada load test | PASS |
| TC-007 | Quota habis | POST /orders | HTTP 409 | 409 pada oversell test | PASS |

---

## B. Anti-Overselling Test

| ID | Test | Input | Expected | Actual | Status |
|---|---|---|---|---|---|
| TC-008 | 20 order | 20 request | 20 sukses | 20 sukses | PASS |
| TC-009 | 100 order | 100 request | 100 sukses | 100 sukses | PASS |
| TC-010 | 400 order | 400 request | 400 sukses | 400 sukses | PASS |
| TC-011 | 450 order | 450 request | Maksimal 400 sukses | 400 sukses + 50 x 409 | PASS |
| TC-012 | Check final quota | Event 1 | terjual <= 400 | terjual 400 | PASS |
| TC-013 | Check remaining quota | Event 1 | sisa >= 0 | sisa 0 | PASS |

---

## C. Admin Authentication Test

| ID | Test | Header | Expected | Actual | Status |
|---|---|---|---|---|---|
| TC-014 | Admin valid token | x-admin-token: admin-wtk | HTTP 200 | HTTP 200 | PASS |
| TC-015 | Admin tanpa token | Tidak ada token | HTTP 401 | HTTP 401 | PASS |
| TC-016 | Admin token salah | x-admin-token: salah | HTTP 401 | HTTP 401 | PASS |

---

## D. Load Test

| ID | VU | Iterasi | Expected | Actual | Status |
|---|---:|---:|---|---|---|
| TC-017 | 20 | 100 | Tidak ada 5xx | 0 5xx | PASS |
| TC-018 | 100 | 400 | Tidak ada 5xx | 0 5xx | PASS |
| TC-019 | 200 | 500 | Maksimal 400 order | 400 sukses + 100 x 409 | PASS |

---

## E. Invalid Request

| ID | Test | Input | Expected | Actual | Status |
|---|---|---|---|---|---|
| TC-020 | qty = 0 | eventId=1, qty=0 | 4xx | 400 | NEED RETEST |
| TC-021 | event tidak ada | eventId=99999 | 4xx | 400 | NEED RETEST |
| TC-022 | qty melebihi quota | eventId=1, qty=999 | 4xx | 400 | NEED RETEST |

---

# F. Infrastructure Test

| ID | Test | Expected | Actual | Status |
|---|---|---|---|---|
| TC-023 | Docker API | Container Up | Up | PASS |
| TC-024 | Gateway | Port 8080 aktif | Aktif | PASS |
| TC-025 | PostgreSQL | Healthy | Healthy | PASS |
| TC-026 | Redis | Healthy | Healthy | PASS |
| TC-027 | Worker | Container Up | Up | PASS |