// Satu-satunya tempat alamat API squad (materi Mobile).
// JANGAN localhost di HP.
// JANGAN IP vEthernet/WSL (172.x) — HP tidak bisa ke situ.
//
// Pakai IPv4 adapter Wi‑Fi laptop (ipconfig → "Wi-Fi" / "Wireless LAN").
// Saat ini Wi‑Fi laptop: 10.87.96.26
//
// Hotspot Windows: nyalakan Mobile hotspot dulu, lalu ipconfig lagi
//   → sering 192.168.137.1 (bukan 172.28.128.1)

export const BASE_URL = "http://10.87.96.26:3000";

export const PAGE_SIZE = 20;
export const RATE_LIMIT_PER_MIN = 60;
