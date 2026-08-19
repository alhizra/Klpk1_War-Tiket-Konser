const { v4: uuidv4 } = require("uuid");
const config = require("../config");
const db = require("../db");
const { redis, keys } = require("../redis");
const { reserveSeats, ensureQuotaInitialized } = require("./quota");
const { getEventView, invalidateEventCache } = require("./eventCache");

/**
 * POST /orders — jalur panas.
 * 1) Validasi qty
 * 2) Ambil harga dari catalog (cache ok)
 * 3) Reserve kursi atomik di Redis
 * 4) Persist order ke Postgres
 * 5) Enqueue e-ticket (async)
 */
async function createOrder({ eventId, qty, clientIp, seatCodes }) {
  const q = Number(qty);
  if (!Number.isInteger(q) || q < 1 || q > config.maxQtyPerOrder) {
    const err = new Error(`qty harus 1–${config.maxQtyPerOrder}`);
    err.status = 400;
    throw err;
  }

  let seats = Array.isArray(seatCodes)
    ? seatCodes.map((s) => String(s).trim().toUpperCase()).filter(Boolean)
    : [];
  if (seats.length && seats.length !== q) {
    const err = new Error("jumlah seatCodes harus sama dengan qty");
    err.status = 400;
    throw err;
  }
  if (seats.length !== new Set(seats).size) {
    const err = new Error("seatCodes duplikat");
    err.status = 400;
    throw err;
  }

  const event = await getEventView(eventId);
  if (!event) {
    const err = new Error("event tidak ditemukan");
    err.status = 404;
    throw err;
  }
  if (event.status !== "PUBLISHED") {
    const err = new Error("event tidak dibuka untuk penjualan");
    err.status = 409;
    throw err;
  }

  await ensureQuotaInitialized(eventId, event.quotaTotal);

  const reserved = await reserveSeats(eventId, q);
  if (!reserved.ok) {
    const err = new Error("kuota habis / kursi tidak tersedia");
    err.status = 409;
    err.sisa = reserved.sisa;
    throw err;
  }

  const orderId = uuidv4();
  const amountIdr = event.priceIdr * q;

  try {
    await db.insertOrder({
      orderId,
      eventId,
      qty: q,
      amountIdr,
      status: "CONFIRMED",
      clientIp: clientIp || null,
    });
    await db.audit(orderId, eventId, "ORDER_CONFIRMED", {
      qty: q,
      sisa: reserved.sisa,
      amountIdr,
      seatCodes: seats,
    });
    // simpan label kursi untuk denah web (best-effort)
    if (seats.length) {
      await redis.sadd(`seats:sold:${eventId}`, ...seats);
    }
  } catch (dbErr) {
    await redis.incrby(keys.quota(eventId), q);
    await redis.decrby(keys.sold(eventId), q);
    throw dbErr;
  }

  await redis.lpush(
    keys.queueEticket,
    JSON.stringify({
      orderId,
      eventId,
      qty: q,
      seatCodes: seats,
      email: `buyer-${orderId.slice(0, 8)}@example.com`,
      enqueuedAt: new Date().toISOString(),
    })
  );

  return {
    orderId,
    eventId,
    qty: q,
    seatCodes: seats,
    amountIdr,
    sisa: reserved.sisa,
    status: "CONFIRMED",
    note: "e-ticket menyusul",
  };
}

module.exports = { createOrder };
