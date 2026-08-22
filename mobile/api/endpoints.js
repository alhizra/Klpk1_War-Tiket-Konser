import { api } from "./client";
import { baca, simpan } from "./cache";
import { BASE_URL, PAGE_SIZE } from "../config";

const POSTER_FILE = {
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

/** GET /events?page&size — cache halaman 1 untuk offline */
export async function ambilDaftarKonser(halaman = 1) {
  const kunci = `events_p${halaman}`;
  try {
    const json = await api.get(`/events?page=${halaman}&size=${PAGE_SIZE}`);
    await simpan(kunci, json);
    if (halaman === 1) await simpan("events_last", json);
    return { data: json, dariCache: false };
  } catch (e) {
    const cache = await baca(kunci);
    const fallback =
      cache || (halaman === 1 ? await baca("events_last") : null);
    if (fallback) return { data: fallback.data, dariCache: true };
    throw e;
  }
}

/** GET /events/:id — cache detail */
export async function ambilDetailKonser(id) {
  const kunci = `event_${id}`;
  try {
    const json = await api.get(`/events/${id}`);
    await simpan(kunci, json);
    return { data: json, dariCache: false };
  } catch (e) {
    const cache = await baca(kunci);
    if (cache) return { data: cache.data, dariCache: true };
    throw e;
  }
}

/**
 * POST /orders
 * Backend wajib: email + buyerName (selain eventId, qty)
 */
export function buatPesanan({ eventId, qty = 1, seatCodes, email, buyerName }) {
  const body = {
    eventId,
    qty,
    email: String(email || "").trim(),
    buyerName: String(buyerName || "").trim(),
  };
  if (seatCodes?.length) body.seatCodes = seatCodes;
  return api.post("/orders", body);
}

export function posterUrl(eventId) {
  const f = POSTER_FILE[eventId];
  if (!f) return null;
  return `${BASE_URL}/posters/${f}`;
}
