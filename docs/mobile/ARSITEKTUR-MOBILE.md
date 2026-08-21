# ARSITEKTUR-MOBILE — War Tiket Konser

## Navigasi (5 layar materi)

```
Daftar → Denah (pilih kursi) → Antrean → Pembayaran → E-Ticket (QR)
```

Stack: `@react-navigation/native-stack`.

## Folder

```
mobile/
  App.js                 # NavigationContainer + SafeArea + ErrorBoundary
  config.js              # BASE_URL + PAGE_SIZE (satu pintu baseurl)
  api/
    client.js            # fetch + 429 backoff
    endpoints.js         # mirror openapi-final
    cache.js             # AsyncStorage baca
    outbox.js            # antre POST offline
    tickets.js           # simpan e-ticket lokal
  hooks/
    useJaringan.js
    useSinkronOtomatis.js
  screens/
```

## ADR singkat: React Navigation stack

**Keputusan:** native stack untuk alur linear war tiket.  
**Alasan:** alur beli berurutan (daftar→bayar→tiket); tab belum perlu di P1–P4.  
**Alternatif ditolak:** bottom-tabs dulu — menambah kompleksitas tanpa layar “home” terpisah.

## Pemetaan layar ↔ endpoint

| Layar | API |
|-------|-----|
| Daftar | `GET /events?page&size` |
| Denah | `GET /events/{id}` |
| Pembayaran | `POST /orders` |
| E-Ticket | lokal QR + AsyncStorage (tidak butuh jaringan untuk tampil) |
