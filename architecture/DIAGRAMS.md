# War Tiket Konser — Diagram Arsitek Sistem

**Penjualan tiket + antrean virtual + kursi terbatas** (satu kursi hanya terjual sekali)

> Gambar PNG di folder [`diagrams/`](./diagrams/) · sumber Mermaid live: blok di bawah · HTML lokal: [`diagrams.html`](./diagrams.html)

| # | Diagram | PNG |
|---|---------|-----|
| 1 | Langkah arsitek | [01-langkah.png](./diagrams/01-langkah.png) |
| 2 | Container | [02-container.png](./diagrams/02-container.png) |
| 3 | Seat lock | [03-seat-lock.png](./diagrams/03-seat-lock.png) |
| 4 | Virtual queue | [04-virtual-queue.png](./diagrams/04-virtual-queue.png) |
| 5 | Sequence | [05-sequence.png](./diagrams/05-sequence.png) |
| 6 | State kursi | [06-state.png](./diagrams/06-state.png) |
| 7 | Monolit lab | [07-monolit.png](./diagrams/07-monolit.png) |

---

## 1. Langkah kerja Arsitek Sistem

![Langkah arsitek](./diagrams/01-langkah.png)

1. Pahami domain & constraint (kursi = sumber daya rebutan)
2. Definisikan NFR (correctness seat, latency, peak load)
3. Bagi bounded context → service
4. Gambar Context + Container diagram
5. Desain alur kritis: hold → pay → confirm
6. Data ownership & konsistensi
7. Sync vs async (REST + queue notifikasi)
8. Antrean virtual & rate limit
9. Failure path: timeout bayar → unlock
10. Tulis ADR → handoff Backend / Data / Infra / QA

```mermaid
flowchart TD
    A[1. Domain and constraint] --> B[2. NFR]
    B --> C[3. Service boundary]
    C --> D[4. C4 Context and Container]
    D --> E[5. Flow seat lock]
    E --> F[6. Data ownership]
    F --> G[7. Sync / Async]
    G --> H[8. Virtual Queue]
    H --> I[9. Failure and timeout]
    I --> J[10. ADR]
    J --> K[11. Handoff tim]
    K --> L[12. Review vs implementasi]
```

---

## 2. Container architecture

![Container architecture](./diagrams/02-container.png)

```mermaid
flowchart TB
    subgraph Clients
        WEB[Web / Mobile]
        ADM[Admin]
    end
    subgraph Edge
        LB[Load Balancer]
        GW[API Gateway]
        VQ[Virtual Queue Gate]
    end
    subgraph Services
        ES[event-service]
        TS[ticket-service]
        PS[payment-service]
        NS[notification-service]
    end
    subgraph Data
        PG[(PostgreSQL)]
        RD[(Redis lock and queue)]
        MQ[[Message Queue]]
    end
    subgraph Ext
        PGW[Payment Gateway]
        MAIL[Email/SMS]
    end
    WEB --> LB --> GW --> VQ
    ADM --> LB
    VQ --> ES
    VQ --> TS
    VQ --> PS
    ES --> PG
    TS --> PG
    TS --> RD
    PS --> PG
    PS --> PGW
    TS -.-> MQ
    PS -.-> MQ
    MQ --> NS --> MAIL
```

---

## 3. Flowchart seat lock (inti sistem)

![Seat lock](./diagrams/03-seat-lock.png)

```mermaid
flowchart TD
    START([User pilih kursi]) --> CHK{Status kursi?}
    CHK -->|AVAILABLE| LOCK[Redis claim atomik]
    CHK -->|HELD| REJ[409 SeatUnavailable]
    CHK -->|SOLD| REJ2[410 Gone]
    LOCK --> OK{Berhasil?}
    OK -->|Ya| DB[Hold / order PENDING]
    OK -->|Tidak| REJ
    DB --> PAY{Bayar dalam TTL?}
    PAY -->|Sukses| SOLD[SOLD + e-ticket]
    PAY -->|Gagal / timeout / batal| REL[Release to AVAILABLE]
```

---

## 4. Antrean virtual

![Virtual queue](./diagrams/04-virtual-queue.png)

```mermaid
flowchart TD
    U([Request]) --> RL{Slot terbuka?}
    RL -->|Tidak| WR[Waiting room + posisi]
    WR --> POLL[Poll status]
    POLL --> TURN{Giliran?}
    TURN -->|Belum| POLL
    TURN -->|Ya| ADMIT[Admit + session token]
    RL -->|Ya| ADMIT
    ADMIT --> APP[Akses hold seat API]
```

---

## 5. Sequence happy path

![Sequence](./diagrams/05-sequence.png)

```mermaid
sequenceDiagram
    actor U as Pembeli
    participant VQ as Virtual Queue
    participant ES as event-service
    participant TS as ticket-service
    participant PS as payment-service
    participant NS as notification-service
    U->>VQ: Join antrean
    VQ-->>U: Admitted
    U->>ES: Get event + seat map
    U->>TS: Hold seats
    TS-->>U: holdId + expiry
    U->>PS: Create payment
    PS-->>U: checkout URL
    U->>PS: Bayar sukses webhook
    PS->>TS: Confirm hold
    TS->>NS: TicketConfirmed
    NS-->>U: E-ticket
```

---

## 6. State mesin kursi

![State kursi](./diagrams/06-state.png)

```mermaid
stateDiagram-v2
    [*] --> AVAILABLE
    AVAILABLE --> HELD: hold lock
    HELD --> AVAILABLE: TTL / batal / gagal bayar
    HELD --> SOLD: payment confirmed
    SOLD --> [*]
```

Dokumen: [`01-langkah-arsitek-sistem.md`](./01-langkah-arsitek-sistem.md) · [`02-adr-template.md`](./02-adr-template.md) · [`../docs/adr/`](../docs/adr/)

---

## 7. Monolit lab (implementasi saat ini)

![Monolit lab](./diagrams/07-monolit.png)

Jalur demo Klpk1: **satu API monolit** (`src/`) + Postgres + Redis. Target 4-service tetap di §2–6 dan `docker-compose.ms.yml`.

```mermaid
flowchart TB
  subgraph clients [Klien]
    Web[Web public]
    Mob[Mobile Expo]
    Adm[Admin]
  end
  API[API monolit :3000]
  PG[(PostgreSQL)]
  RD[(Redis kuota + sold + cache)]
  W[worker e-ticket]
  Web --> API
  Mob --> API
  Adm --> API
  API --> PG
  API --> RD
  API -.-> W
  W --> RD
```
