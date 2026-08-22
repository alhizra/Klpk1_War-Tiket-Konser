const DEFAULT_API = "http://127.0.0.1:3000";

export function getApiBase() {
  const u = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API;
  return String(u).replace(/\/$/, "");
}

export async function apiGet(path) {
  const base = getApiBase();
  const res = await fetch(`${base}${path.startsWith("/") ? path : `/${path}`}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    let msg = t;
    try {
      const j = JSON.parse(t);
      msg = j.error || j.message || t;
    } catch {
      /* plain */
    }
    const err = new Error(msg || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function apiPost(path, body) {
  const base = getApiBase();
  const res = await fetch(`${base}${path.startsWith("/") ? path : `/${path}`}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    let msg = t;
    try {
      const j = JSON.parse(t);
      msg = j.error || j.message || t;
    } catch {
      /* plain */
    }
    const err = new Error(msg || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export function posterUrl(eventId) {
  const map = {
    1: "01-treasure.jpg",
    2: "02-lykn.png",
    3: "03-blackpink.jpg",
    4: "04-nctdream.jpg",
    5: "05-exo.jpg",
    6: "06-ateez.jpg",
    7: "07-bus.jpg",
    8: "08-straykids.jpg",
    9: "09-aespa.jpg",
    10: "10-seventeen.jpg",
    11: "11-4eve.jpg",
  };
  const f = map[eventId];
  if (!f) return null;
  return `${getApiBase()}/posters/${f}`;
}

export function fmtRp(n) {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number(n) || 0);
  } catch {
    return `Rp ${n}`;
  }
}
