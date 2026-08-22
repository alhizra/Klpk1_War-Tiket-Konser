// Satu pintu BASE_URL API squad.
//
// - Expo WEB (browser laptop :8081) → otomatis 127.0.0.1:3000
// - Expo Go / native (HP)           → IP Wi‑Fi laptop (ganti bila beda)
//
// JANGAN pakai 172.x (WSL/vEthernet) untuk HP.
// Aturan baseurl: page 20, rate 60/menit.

import { Platform } from "react-native";

/** IPv4 Wi‑Fi laptop — dari ipconfig (adapter Wi‑Fi), untuk HP Expo Go */
const LAN_API = "http://10.87.96.26:3000";

/** API di mesin yang sama (Expo web / emulator) */
const LOCAL_API = "http://127.0.0.1:3000";

function resolveBaseUrl() {
  // Override manual (opsional): EXPO_PUBLIC_API_URL=http://...
  if (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) {
    return String(process.env.EXPO_PUBLIC_API_URL).replace(/\/$/, "");
  }

  // Browser di laptop membuka localhost:8081 → API harus localhost:3000
  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined" && window.location) {
        const host = window.location.hostname || "";
        if (host === "localhost" || host === "127.0.0.1") {
          return LOCAL_API;
        }
        // Expo web dibuka lewat IP LAN (jarang) → API di host yang sama :3000
        if (host && host !== "localhost") {
          return `http://${host}:3000`;
        }
      }
    } catch {
      /* ignore */
    }
    return LOCAL_API;
  }

  // Android emulator → 10.0.2.2 = host machine
  // (biarkan LAN dulu; emulator jarang dipakai di lab)
  return LAN_API;
}

export const BASE_URL = resolveBaseUrl();

export const PAGE_SIZE = 20;
export const RATE_LIMIT_PER_MIN = 60;

/** Untuk debug di UI */
export const API_HINT =
  Platform.OS === "web"
    ? "Mode web → API 127.0.0.1:3000 (jalankan node src/server.js)"
    : `Mode HP → API ${LAN_API} (Wi‑Fi sama + firewall port 3000)`;
