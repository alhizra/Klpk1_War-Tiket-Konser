# Expo tunnel — tanpa Next.js

## Salah kaprah

| Salah | Benar |
|-------|--------|
| “Harus Next.js supaya `expo start --tunnel`” | **Tidak.** Tunnel milik **Expo**, bukan Next.js |
| Buat project Next.js baru | App Modul 3 sudah di `mobile/` (Expo 52) |
| Format code harus Next.js | Format yang benar: **React Native + Expo** |

Next.js = framework **web** (React di browser/server).  
Expo = framework **mobile** (React Native + Expo Go).  
Keduanya **beda**. Modul 3 = Expo.

---

## Perintah tunnel (sudah tersedia)

```bat
cd C:\Users\User\Downloads\War-Tiket-Konser\mobile
npx expo login
npx expo start --tunnel -c
```

atau double-click: **`start-tunnel.bat`**

Script npm: `npm run start:tunnel`

Dependency tunnel: `@expo/ngrok` (sudah di `package.json`).

---

## Apa yang tunnel perbaiki / tidak

| | Tunnel bantu? |
|--|----------------|
| HP load **bundle JS** app (beda Wi‑Fi / kampus susah LAN) | ✅ Ya |
| HP fetch **API** `http://10.87.96.26:3000` | ❌ Tidak otomatis |

Jadi setelah tunnel:

1. App di Expo Go **bisa terbuka** (tidak biru karena gagal Metro)  
2. Daftar konser tetap butuh **API terjangkau**:
   - HP Wi‑Fi sama laptop → `LAN_IP` di `config.js` OK  
   - HP cuma LTE → API LAN **tidak** kebaca; perlu API public (ngrok/Codespace) di `EXPO_PUBLIC_API_URL`

---

## Alur disarankan demo HP

### A. Satu Wi‑Fi (paling stabil)

```bat
REM terminal 1
cd War-Tiket-Konser
npm start

REM terminal 2
cd mobile
npx expo start --lan -c
```

HP: Wi‑Fi sama, matikan LTE, scan QR.

### B. Tunnel (bundle saja)

```bat
cd mobile
npx expo login
npx expo start --tunnel -c
```

API tetap `http://10.87.96.26:3000` — HP tetap sebaiknya bisa ping IP itu (Wi‑Fi sama).

---

## Jangan lakukan

- `npx create-next-app` untuk ganti mobile  
- `npx create-expo-app` project baru (duplikat)  
- Harap tunnel menggantikan backend monolit  

---

## Ringkas

> **Pakai Expo yang ada + `npx expo start --tunnel`.**  
> Bukan Next.js. Kode Modul 3 sudah format Expo yang benar.
