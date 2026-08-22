// Satu-satunya tempat alamat API squad.
//
// === Lokal (laptop + Expo web / emulator) ===
//   http://127.0.0.1:3000
//
// === HP Expo Go + laptop satu Wi‑Fi ===
//   ipconfig → IPv4 Wi‑Fi (bukan 172.x WSL)
//   http://192.168.x.x:3000
//
// === Codespaces ===
//   Port 3000 Public → tempel URL HTTPS tanpa slash akhir
//
// JANGAN localhost di HP fisik. Aturan baseurl: page 20, rate 60/menit.

export const BASE_URL = "http://127.0.0.1:3000";

export const PAGE_SIZE = 20;
export const RATE_LIMIT_PER_MIN = 60;
