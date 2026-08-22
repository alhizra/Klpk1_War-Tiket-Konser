/**
 * Modul 3 P1 — satu pintu BASE_URL (jangan hardcode di banyak file).
 *
 * WEB (browser laptop)  → http://127.0.0.1:3000
 * HP Expo Go            → http://LAN_IP:3000  (HP HARUS Wi‑Fi sama laptop, BUKAN LTE)
 *
 * Ganti LAN_IP jika ipconfig Wi‑Fi berubah.
 */

import { Platform } from "react-native";

/** ← ipconfig → Wireless LAN adapter Wi‑Fi → IPv4 Address */
export const LAN_IP = "10.87.96.26";

const PORT = 3000;
const LAN_API = `http://${LAN_IP}:${PORT}`;
const LOCAL_API = `http://127.0.0.1:${PORT}`;

function resolveBaseUrl() {
  try {
    if (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) {
      return String(process.env.EXPO_PUBLIC_API_URL).replace(/\/$/, "");
    }
  } catch {
    /* ignore */
  }

  if (Platform.OS === "web") {
    return LOCAL_API;
  }

  return LAN_API;
}

export const BASE_URL = resolveBaseUrl();
export const PAGE_SIZE = 20;
export const RATE_LIMIT_PER_MIN = 60;

export const API_HINT =
  Platform.OS === "web"
    ? "Web: API http://127.0.0.1:3000 — jalankan node src/server.js"
    : `HP: API ${LAN_API} — matikan LTE, Wi‑Fi SAMA laptop, buka URL ini di browser HP dulu`;
