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
  12: "12-iu.jpg",
  13: "13-newjeans.jpg",
  14: "14-seventeen-encore.jpg",
  15: "15-twice.jpg",
  16: "16-lesserafim.jpg",
  17: "17-itzy.jpg",
  18: "18-gidle.jpg",
  19: "19-enhypen.jpg",
  20: "20-ive.jpg",
  21: "21-bts.jpg",
  22: "22-txt.jpg",
  23: "23-riize.jpg",
  24: "24-boynextdoor.jpg",
  25: "25-zerobaseone.jpg",
  26: "26-kissoflife.jpg",
  27: "27-nmixx.jpg",
  28: "28-babymonster.jpg",
  29: "29-illit.jpg",
  30: "30-katseye.jpg",
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

/** poster dari API (posterUrl) atau file bawaan seed */
export function posterUrl(eventId, eventObj) {
  const fromApi = eventObj?.posterUrl || eventObj?.poster;
  if (fromApi) {
    if (/^https?:\/\//i.test(fromApi)) return fromApi;
    return `${BASE_URL}${fromApi.startsWith("/") ? "" : "/"}${fromApi}`;
  }
  const f = POSTER_FILE[eventId];
  if (!f) return null;
  return `${BASE_URL}/posters/${f}`;
}

/** GET /health */
export function cekHealth() {
  return api.get("/health");
}

/**
 * POST /payments/simulate — lab settle mock (sama web)
 */
export function simulasikanBayar(orderId) {
  return api.post("/payments/simulate", { orderId });
}

/** GET /mail/outbox/:orderId — status e-ticket email lab */
export function ambilOutboxTiket(orderId) {
  return api.get(`/mail/outbox/${encodeURIComponent(orderId)}`);
}
