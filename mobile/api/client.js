import { BASE_URL } from "../config";

function tidur(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pesanError(teks, status) {
  if (!teks) return `HTTP ${status}`;
  try {
    const j = JSON.parse(teks);
    if (j.error) return j.error;
    if (j.message) return j.message;
  } catch {
    /* plain text */
  }
  return teks.length > 200 ? teks.slice(0, 200) + "…" : teks;
}

async function minta(path, opsi = {}, percobaan = 0) {
  const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  let res;
  try {
    const { headers: extraHeaders, ...rest } = opsi;
    res = await fetch(url, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(extraHeaders || {}),
      },
    });
  } catch (e) {
    const err = new Error(
      e.message ||
        `Tidak bisa hubungi API (${BASE_URL}). Cek server & config.js`
    );
    err.status = 0;
    throw err;
  }

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
    const err = new Error(pesanError(teks, res.status));
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path, headers) => minta(path, headers ? { headers } : {}),
  post: (path, body, headers) =>
    minta(path, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
      ...(headers ? { headers } : {}),
    }),
  patch: (path, body, headers) =>
    minta(path, {
      method: "PATCH",
      body: JSON.stringify(body ?? {}),
      ...(headers ? { headers } : {}),
    }),
  del: (path, headers) =>
    minta(path, {
      method: "DELETE",
      ...(headers ? { headers } : {}),
    }),
};
