# ADR Template — War Tiket Konser

Salin file ini per keputusan. Nama file: `ADR-00X-judul-singkat.md`

---

# ADR-001: Mekanisme kunci kursi (seat lock)

- **Status:** Proposed | Accepted | Deprecated
- **Tanggal:** YYYY-MM-DD
- **Deciders:** Arsitek Sistem (+ Backend, Data)

## Context

Satu kursi hanya boleh terjual satu kali. Banyak user bisa request hold kursi yang sama bersamaan (race condition).

## Options

1. **Hanya database** — `SELECT FOR UPDATE` / unique constraint  
2. **Redis SET NX EX** + status di PostgreSQL  
3. **Optimistic locking** (version column) saja  

## Decision

*(pilih salah satu dan tulis alasan)*

**Pilihan usulan praktikum:** Redis `SET seat:{eventId}:{seatId} NX EX 600` sebagai fast atomic lock, lalu persist `HELD` di PostgreSQL. Confirm bayar → `SOLD`. TTL habis → worker/release → `AVAILABLE`.

## Consequences

- (+) Cepat di peak traffic  
- (+) TTL bawaan Redis  
- (−) Harus jaga konsistensi Redis ↔ DB (release path, startup reconcile)  
- (−) Infra wajib sediakan Redis  

## Alternatif ditolak

- Optimistic only: banyak retry conflict saat war, UX buruk  

---

# ADR-002: Antrean virtual di edge

- **Status:** Proposed
- **Tanggal:**
- **Deciders:**

## Context

Spike traffic saat jam buka jual bisa meruntuhkan service & DB.

## Decision

Virtual queue / waiting room di API Gateway (atau service kecil di depan). User dapat token posisi; hanya N concurrent admitted yang boleh hit `ticket-service`.

## Consequences

- (+) Melindungi seat lock path  
- (−) Perlu UI waiting room + poll/websocket  

---

# ADR-003: Komunikasi payment → ticket (confirm)

- **Status:** Proposed

## Context

Setelah bayar sukses, kursi harus jadi SOLD. Webhook gateway bisa duplikat / out-of-order.

## Decision

`payment-service` panggil `ticket-service` confirm secara sync **ber-idempotency-key** (`paymentId` / `holdId`). Notifikasi dikirim async via queue setelah confirm sukses.

## Consequences

- (+) Alur jelas untuk praktikum  
- (−) Coupling sync payment→ticket (mitigasi: timeout + retry idempotent)  
