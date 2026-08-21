import { api } from "./client";
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

/** GET /events?page&size */
export function ambilDaftarKonser(halaman = 1) {
  return api.get(`/events?page=${halaman}&size=${PAGE_SIZE}`);
}

/** GET /events/:id */
export function ambilDetailKonser(id) {
  return api.get(`/events/${id}`);
}

/** POST /orders */
export function buatPesanan({ eventId, qty = 1, seatCodes }) {
  const body = { eventId, qty };
  if (seatCodes?.length) body.seatCodes = seatCodes;
  return api.post("/orders", body);
}

export function posterUrl(eventId) {
  const f = POSTER_FILE[eventId];
  if (!f) return null;
  return `${BASE_URL}/posters/${f}`;
}
