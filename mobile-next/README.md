# WTK Ticket — Next.js (mobile web)

Client **Next.js App Router** yang memanggil **API monolit** yang sama (`POST /api/orders`, dll.).

> **Bukan Expo.**  
> Perintah `npx expo start --tunnel` **tidak** dipakai di folder ini.  
> Folder Expo lama tetap di `../mobile/`.

## Menjalankan

**Terminal 1 — API monolit (wajib):**
```bat
cd C:\Users\User\Downloads\War-Tiket-Konser
npm start
```

**Terminal 2 — Next.js:**
```bat
cd mobile-next
copy .env.local.example .env.local
npm install
npm run dev
```

Buka: **http://localhost:3001**

### HP (browser Chrome/Safari)

1. Laptop & HP **Wi‑Fi sama**  
2. `.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://10.87.96.26:3000
   ```
3. `npm run dev` (listen `0.0.0.0:3001`)  
4. HP buka: `http://10.87.96.26:3001`

### “Tunnel” ala Next (beda dari Expo)

Expo tunnel ≠ Next. Untuk Next + HP beda jaringan, contoh:

```bat
npx --yes localtunnel --port 3001
```

atau ngrok ke port **3001** (UI) dan pastikan API juga public jika HP di LTE.

## Alur layar

```
/  daftar konser
/event/[id]  denah + pilih kursi
/checkout/[id]  nama + email + POST /orders
/ticket  e-ticket ringkas
```

## Env

| Variabel | Contoh |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:3000` |

Body order sama backend: `eventId`, `qty`, `seatCodes`, `email`, `buyerName`.
