import { BASE_URL } from "../config";

function tidur(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function minta(path, opsi = {}, percobaan = 0) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(opsi.headers || {}),
    },
    ...opsi,
  });

  // 429 = batas laju — mundur teratur (max 3x)
  if (res.status === 429 && percobaan < 3) {
    const saran = Number(res.headers.get("Retry-After"));
    const jeda =
      Number.isFinite(saran) && saran > 0
        ? saran * 1000
        : 1000 * 2 ** percobaan;
    await tidur(jeda);
    return minta(path, opsi, percobaan + 1);
  }

  if (!res.ok) {
    const teks = await res.text().catch(() => "");
    const err = new Error(teks || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path) => minta(path),
  post: (path, body) =>
    minta(path, { method: "POST", body: JSON.stringify(body) }),
};
