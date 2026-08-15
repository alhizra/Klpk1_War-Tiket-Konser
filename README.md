# Langkah-Langkah Arsitek Sistem — War Tiket Konser

**Tema:** Penjualan tiket dengan antrean virtual dan kursi terbatas  
**Sumber daya rebutan:** Kursi — satu kursi hanya boleh terjual satu kali  
**Mata kuliah:** Praktikum Scalable Systems Design  
**Peran terkait:** Arsitek Sistem (Andi Hilyatul Mar'ah) → lalu diserahkan ke Backend, Data, Infra, QA

---

## Ringkasan peran layanan (dari brief)

| Layanan | Tanggung jawab | Data yang dimiliki |
|---------|----------------|--------------------|
| `event-service` | Kelola konser, jadwal, kategori kursi, harga | Event, venue, denah kursi, kuota per kategori |
| `ticket-service` | Kunci kursi sementara, konfirmasi, lepas kunci saat kedaluwarsa | Status tiap kursi, kunci sementara + waktu kedaluwarsa |
| `payment-service` | Terima pembayaran, konfirmasi, batalkan bila gagal/lewat waktu | Transaksi, status bayar, riwayat pembayaran |
| `notification-service` | Kirim e-ticket, pengingat, pemberitahuan gagal bayar | Antrean pesan keluar dan riwayat pengiriman |

---

# BAGIAN A — Langkah kerja Arsitek Sistem (urutan wajib)

```mermaid
flowchart TD
    A[1. Pahami domain & constraint] --> B[2. Definisikan requirement non-fungsional]
    B --> C[3. Identifikasi bounded context / service]
    C --> D[4. Gambar C4 Context + Container]
    D --> E[5. Desain alur bisnis kritis seat lock]
    E --> F[6. Desain data ownership & consistency]
    F --> G[7. Desain komunikasi sync/async]
    G --> H[8. Desain antrean virtual & rate limit]
    H --> I[9. Desain failure & timeout]
    I --> J[10. Tulis ADR keputusan arsitektur]
    J --> K[11. Serahkan ke Backend / Data / Infra / QA]
    K --> L[12. Review implementasi vs diagram]
```

### Detail tiap langkah

| No | Langkah | Output yang harus ada |
|----|---------|------------------------|
| 1 | Domain & constraint | Satu kursi = 1 penjualan; peak traffic saat buka jual |
| 2 | NFR | Latency, throughput, availability, consistency seat |
| 3 | Service boundary | 4 service di atas + API Gateway + Queue + Cache |
| 4 | Diagram C4 | Context, Container (file ini) |
| 5 | Flow kritis | Sequence: join queue → pilih kursi → lock → bayar → confirm |
| 6 | Data ownership | Siapa master data seat/payment; no dual-write sembarangan |
| 7 | Sync vs async | REST untuk request user; event/queue untuk notifikasi & timeout |
| 8 | Virtual queue | FIFO / token bucket; cegah stampede ke DB |
| 9 | Failure | Payment timeout → unlock seat; idempotency key |
| 10 | ADR | Keputusan: Redis lock? DB row lock? Outbox pattern? |
| 11 | Handoff | Backend endpoint, Data schema, Infra docker/compose, QA skenario load |
| 12 | Review | Diagram = source of truth; ubah kode → update diagram |

---

# BAGIAN B — Diagram arsitektur

## B1. System Context (C4 Level 1)

```mermaid
C4Context
    title War Tiket Konser — System Context

    Person(pembeli, "Pembeli", "User yang war tiket konser")
    Person(admin, "Admin Event", "Kelola konser & denah kursi")

    System(wtk, "War Tiket Konser", "Penjualan tiket + antrean virtual + seat lock")

    System_Ext(pgw, "Payment Gateway", "Midtrans / Xendit / mock gateway")
    System_Ext(mail, "Email/SMS Provider", "Kirim e-ticket & notifikasi")

    Rel(pembeli, wtk, "Browse event, antre, pilih kursi, bayar")
    Rel(admin, wtk, "CRUD event, venue, kategori, harga")
    Rel(wtk, pgw, "Charge / cek status pembayaran")
    Rel(wtk, mail, "Kirim e-ticket & pengingat")
```

## B2. Container Diagram (C4 Level 2) — inti arsitektur

```mermaid
flowchart TB
    subgraph Clients
        WEB[Web / Mobile Client]
        ADMIN_UI[Admin Dashboard]
    end

    subgraph Edge
        LB[Load Balancer]
        GW[API Gateway]
        VQ[Virtual Queue Gate<br/>rate limit + waiting room]
    end

    subgraph Services
        ES[event-service]
        TS[ticket-service]
        PS[payment-service]
        NS[notification-service]
    end

    subgraph Data
        PG[(PostgreSQL)]
        RD[(Redis<br/>seat lock + queue token)]
        MQ[[Message Queue<br/>RabbitMQ / Redis Stream]]
    end

    subgraph External
        PGW[Payment Gateway]
        MAIL[Email/SMS]
    end

    WEB --> LB --> GW
    ADMIN_UI --> LB
    GW --> VQ
    VQ --> ES
    VQ --> TS
    VQ --> PS
    ES --> PG
    TS --> PG
    TS --> RD
    PS --> PG
    PS --> PGW
    ES -.-> MQ
    TS -.-> MQ
    PS -.-> MQ
    MQ --> NS
    NS --> MAIL
    NS --> PG
```

## B3. Component per service (ringkas)

```mermaid
flowchart LR
    subgraph event-service
        E1[Event CRUD]
        E2[Venue & Seat Map]
        E3[Category & Price]
        E4[Quota Catalog]
    end

    subgraph ticket-service
        T1[Seat Inventory]
        T2[Hold / Lock Seat]
        T3[Confirm / Release]
        T4[Expiry Worker]
    end

    subgraph payment-service
        P1[Create Charge]
        P2[Webhook Handler]
        P3[Timeout Canceller]
        P4[Idempotency Store]
    end

    subgraph notification-service
        N1[Outbox Consumer]
        N2[Template Engine]
        N3[Delivery Log]
    end

    T2 --> T3
    T4 --> T3
    P2 --> T3
    P3 --> T3
    T3 --> N1
    P2 --> N1
```

---

# BAGIAN C — Flowchart / sequence alur bisnis kritis

## C1. Happy path: dari buka halaman sampai e-ticket

```mermaid
sequenceDiagram
    actor U as Pembeli
    participant VQ as Virtual Queue
    participant ES as event-service
    participant TS as ticket-service
    participant RD as Redis
    participant PS as payment-service
    participant PGW as Payment Gateway
    participant MQ as Message Queue
    participant NS as notification-service

    U->>VQ: Masuk waiting room
    VQ-->>U: Token antrean + estimasi
    VQ->>U: Giliran masuk (admit)
    U->>ES: GET event + denah kursi
    ES-->>U: Seat map + harga
    U->>TS: POST hold seats [A12, A13]
    TS->>RD: SET seat lock TTL 10m (NX)
    alt Lock berhasil
        TS-->>U: holdId + expiry
        U->>PS: POST pay(holdId)
        PS->>PGW: create charge
        PGW-->>PS: pending + payment URL
        PS-->>U: redirect bayar
        U->>PGW: Bayar
        PGW->>PS: webhook PAID
        PS->>TS: confirm(holdId)
        TS->>RD: mark SOLD / delete lock
        TS->>MQ: TicketConfirmed
        MQ->>NS: consume
        NS-->>U: e-ticket email
    else Kursi sudah dikunci orang lain
        TS-->>U: 409 SeatUnavailable
    end
```

## C2. Flowchart keputusan seat lock (sumber daya rebutan)

```mermaid
flowchart TD
    START([User pilih kursi]) --> CHK{Kursi status?}
    CHK -->|AVAILABLE| LOCK[Redis SET key seat:id NX EX 600]
    CHK -->|HELD orang lain| REJ1[Tolak 409]
    CHK -->|SOLD| REJ2[Tolak 410]
    LOCK --> OK{NX success?}
    OK -->|Ya| DB[(Update DB status=HELD<br/>hold_until=now+10m)]
    OK -->|Tidak| REJ1
    DB --> WAIT[User bayar dalam TTL]
    WAIT --> PAY{Pembayaran?}
    PAY -->|SUCCESS sebelum TTL| SOLD[Status=SOLD<br/>emit TicketConfirmed]
    PAY -->|GAGAL / TIMEOUT| REL[Release lock<br/>status=AVAILABLE]
    PAY -->|User batal| REL
    SOLD --> END1([Selesai + e-ticket])
    REL --> END2([Kursi kembali available])
    REJ1 --> END3([Pilih kursi lain])
    REJ2 --> END3
```

## C3. Flowchart antrean virtual (cegah stampede)

```mermaid
flowchart TD
    U([Request masuk]) --> RL{Rate limit / slot terbuka?}
    RL -->|Tidak| WR[Masuk Waiting Room]
    WR --> POS[Dapat queue position + token]
    POS --> POLL[Client poll / websocket status]
    POLL --> TURN{Giliran?}
    TURN -->|Belum| POLL
    TURN -->|Ya| ADMIT[Admit + session token singkat]
    RL -->|Ya| ADMIT
    ADMIT --> APP[Akses event & ticket API]
    APP --> DONE([Lanjut hold seat])
```

## C4. Flowchart payment timeout & kompensasi

```mermaid
flowchart TD
    P([Payment created]) --> T{Status dalam window?}
    T -->|PAID| C[ticket-service.confirm]
    T -->|FAILED| X[ticket-service.release]
    T -->|EXPIRED timer| X
    C --> E1[Event: PaymentSucceeded]
    X --> E2[Event: PaymentCancelled]
    E1 --> N[notification: e-ticket]
    E2 --> N2[notification: gagal bayar]
```

## C5. State machine status kursi

```mermaid
stateDiagram-v2
    [*] --> AVAILABLE
    AVAILABLE --> HELD: hold(NX lock)
    HELD --> AVAILABLE: TTL habis / batal / bayar gagal
    HELD --> SOLD: payment confirmed
    SOLD --> [*]
    note right of HELD
      hold_until = now + TTL
      hanya 1 holder
    end note
    note right of SOLD
      immutable
      satu kursi satu kali jual
    end note
```

---

# BAGIAN D — Data ownership & consistency

```mermaid
flowchart TB
    subgraph Owned by event-service
        E_EVT[(events)]
        E_VEN[(venues)]
        E_SEAT_CAT[(seat_categories)]
        E_MAP[(seat_map template)]
    end

    subgraph Owned by ticket-service
        T_INV[(seat_inventory)]
        T_HOLD[(holds)]
        T_TIX[(tickets)]
    end

    subgraph Owned by payment-service
        P_TX[(transactions)]
        P_PAY[(payment_attempts)]
    end

    subgraph Owned by notification-service
        N_OUT[(outbox / jobs)]
        N_LOG[(delivery_logs)]
    end

    E_MAP -.seed inventory.-> T_INV
    T_HOLD --> P_TX
    P_TX -->|confirm event| T_TIX
    T_TIX --> N_OUT
```

### Aturan konsistensi (wajib ditulis di ADR)

1. **Seat = single source of truth di `ticket-service`** (+ Redis lock sebagai fast path).
2. **Lock harus atomic** (`SET NX EX` atau DB `SELECT FOR UPDATE SKIP LOCKED`).
3. **Confirm pembayaran idempotent** (webhook bisa double-delivery).
4. **Never trust client** untuk status kursi; selalu cek server.
5. **Komunikasi antar service:**  
   - Sync (HTTP): hold, pay, get event  
   - Async (queue): notifikasi, eventual side-effects  
6. **Saga/kompensasi sederhana:** pay fail → release hold (bukan 2PC distributed).

---

# BAGIAN E — Deployment view (untuk handoff Infra/DevOps)

```mermaid
flowchart TB
    subgraph Docker Compose / K8s
        GW[api-gateway :8080]
        ES[event-service :8001]
        TS[ticket-service :8002]
        PS[payment-service :8003]
        NS[notification-service :8004]
        PG[(postgres :5432)]
        RD[(redis :6379)]
        MQ[(rabbitmq :5672)]
    end

    GW --> ES & TS & PS
    ES --> PG
    TS --> PG & RD
    PS --> PG
    NS --> PG & MQ
    TS --> MQ
    PS --> MQ
```

---

# BAGIAN F — Checklist deliverable Arsitek Sistem

- [ ] Context diagram (siapa user, sistem eksternal)
- [ ] Container diagram (service + DB + cache + queue)
- [ ] Sequence happy path war tiket
- [ ] Flowchart seat lock & race condition handling
- [ ] State diagram status kursi
- [ ] Virtual queue flowchart
- [ ] Payment timeout / kompensasi
- [ ] Data ownership per service
- [ ] NFR tertulis (contoh di bawah)
- [ ] Minimal 2 ADR (contoh template di file `02-adr-template.md`)
- [ ] API contract outline (endpoint utama)
- [ ] Handoff notes ke tiap peran

---

# BAGIAN G — NFR awal (boleh disesuaikan kelompok)

| Aspek | Target usulan |
|-------|----------------|
| Correctness seat | 0 double-sell (properti paling kritis) |
| Hold TTL | 5–15 menit (default 10 menit) |
| p95 hold seat | < 200 ms (dengan Redis) |
| Peak concurrent | sesuai skenario load test QA |
| Availability path baca event | tinggi (boleh cache) |
| Payment | at-least-once webhook + idempotent handler |
| Observability | request-id, metrics hold success/fail, queue wait time |

---

# BAGIAN H — Outline API (untuk Backend)

### event-service
- `GET /events` — daftar konser
- `GET /events/{id}` — detail + kategori harga
- `GET /events/{id}/seat-map` — denah & status ringkas
- `POST /admin/events` — buat event (admin)

### ticket-service
- `POST /holds` — body: `eventId`, `seatIds[]` → `holdId`, `expiresAt`
- `DELETE /holds/{holdId}` — batalkan manual
- `POST /holds/{holdId}/confirm` — internal, dipanggil payment-service
- `GET /seats?eventId=` — status kursi (available/held/sold)

### payment-service
- `POST /payments` — body: `holdId` → `paymentId`, `checkoutUrl`
- `POST /payments/webhook` — callback gateway
- `GET /payments/{id}` — status

### notification-service
- internal consumer only (+ optional `GET /notifications/health`)

### Virtual queue / gateway
- `POST /queue/join` → `queueToken`, `position`
- `GET /queue/status` → `admitted`, `position`
- Header wajib setelah admit: `X-Queue-Token` / session

---

# BAGIAN I — Handoff ke peran lain

| Peran | Yang diterima dari Arsitek |
|-------|----------------------------|
| **Backend/API** | Sequence + endpoint + aturan lock/confirm |
| **Data & Persistence** | Ownership tabel, indeks seat, TTL hold, migrasi |
| **Infrastructure & DevOps** | Container diagram, port, Redis/Postgres/MQ, healthcheck |
| **QA / Load-test** | Skenario: 1000 user hold kursi sama; webhook double; TTL expiry |

---

# BAGIAN J — Urutan kerja kelompok (rekomendasi sprint)

```mermaid
gantt
    title Sprint arsitektur → implementasi
    dateFormat  YYYY-MM-DD
    section Arsitek
    Diagram + ADR           :a1, 2026-08-15, 3d
    Review bareng tim       :a2, after a1, 1d
    section Data
    Schema + Redis key      :d1, after a2, 3d
    section Backend
    event + ticket core     :b1, after a2, 5d
    payment + notif         :b2, after b1, 3d
    section Infra
    compose + gateway       :i1, after a2, 4d
    section QA
    test case + load test   :q1, after b2, 3d
```

---

## Catatan penting untuk Arsitek

1. **Jangan over-engineering** di praktikum: 4 service + gateway + Redis + Postgres + 1 queue sudah cukup.
2. Fokus demo yang dinilai: **tidak ada double-sell** + **antrean virtual** + **hold timeout**.
3. Setiap keputusan besar → 1 halaman ADR (mengapa Redis lock, mengapa TTL 10 menit, dll).
4. Diagram di file ini = kontrak; kalau implementasi beda, **update diagram dulu atau bareng**.
