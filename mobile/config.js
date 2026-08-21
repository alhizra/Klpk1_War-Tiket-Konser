// Materi P1 Langkah 6 — satu-satunya tempat alamat API squad.
// Ganti nilai ini dengan base URL dari lapisan Scalable (artefak baseurl).
//
// JANGAN localhost / 127.0.0.1 di HP (materi: localhost = HP itu sendiri).
// Windows: ipconfig → IPv4 adapter Wi-Fi (bukan 172.x vEthernet/WSL).
//
// Aturan baseurl: 20 data per halaman, batas 60 permintaan/menit.

export const BASE_URL = "http://10.87.96.26:3000";

export const PAGE_SIZE = 20;
export const RATE_LIMIT_PER_MIN = 60;
