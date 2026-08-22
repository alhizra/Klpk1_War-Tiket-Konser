// Satu pintu BASE_URL API squad.
//
// Expo WEB (browser :8081) → 127.0.0.1:3000
// Expo Go HP               → IP Wi‑Fi laptop di bawah (HP harus Wi‑Fi sama, JANGAN data seluler saja)
//
// Aturan baseurl: page 20, rate 60/menit.

import { Platform } from "react-native";

/** Ganti jika ipconfig Wi‑Fi laptop berubah */
export const LAN_IP = "10.87.96.26";
const LAN_API = `http://${LAN_IP}:3000`;
const LOCAL_API = "http://127.0.0.1:3000";

function envOverride() {
  try {
    if (typeof process === "undefined" || !process.env) return null;
    const u = process.env.EXPO_PUBLIC_API_URL;
    if (u && typeof u === "string" && u.trim()) {
      return u.trim().replace(/\/$/, "");
    }
  } catch {
    /* ignore */
  }
  return null;
}

function resolveBaseUrl() {
  const o = envOverride();
  if (o) return o;

  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined" && window.location) {
        const host = window.location.hostname || "";
        if (host === "localhost" || host === "127.0.0.1") return LOCAL_API;
        if (host) return `http://${host}:3000`;
      }
    } catch {
      /* ignore */
    }
    return LOCAL_API;
  }

  // HP / native → LAN laptop
  return LAN_API;
}

export const BASE_URL = resolveBaseUrl();
export const PAGE_SIZE = 20;
export const RATE_LIMIT_PER_MIN = 60;

export const API_HINT =
  Platform.OS === "web"
    ? "Mode web → API 127.0.0.1:3000"
    : `Mode HP → API ${LAN_API} · HP harus Wi‑Fi SAMA dengan laptop (bukan LTE saja)`;
