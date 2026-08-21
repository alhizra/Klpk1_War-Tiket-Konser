const { v4: uuidv4 } = require("uuid");
const config = require("../config");
const db = require("../db");
const { redis, keys } = require("../redis");
const {
  reserveSeats,
  releaseSeats,
  claimSeatCodes,
  releaseSeatCodes,
  ensureQuotaInitialized,
} = require("./quota");
const { getEventView } = require("./eventCache");
const {
  createPaymentSession,
  AUTO_CAPTURE,
  PROVIDER,
} = require("./paymentGateway");

/** Menit sebelum PENDING_PAYMENT expire & kuota dikembalikan */
const PAYMENT_TTL_MIN = Number(process.env.PAYMENT_TTL_MIN || 15);

function normalizeEmail(raw) {
  return String(raw || "").trim().toLowerCase();
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function requireBuyer(email, buyerName) {
  const name = String(buyerName || "").trim();
  const mail = normalizeEmail(email);
  if (!name || name.length < 2) {
    const err = new Error("nama pembeli wajib diisi (min. 2 karakter)");
    err.status = 400;
    throw err;
  }
  if (!mail) {
    const err = new Error("email e-ticket wajib diisi");
    err.status = 400;
    throw err;
  }
  if (!isValidEmail(mail)) {
    const err = new Error("format email tidak valid");
    err.status = 400;
    throw err;
  }
  if (name.length > 120) {
    const err = new Error("nama pembeli maksimal 120 karakter");
    err.status = 400;
    throw err;
  }
  return { email: mail, buyerName: name.slice(0, 120) };
}

/**
 * POST /orders — jalur panas.
 * 1) Validasi qty
 * 2) Reserve kuota atomik Redis
 * 3) Claim seatCodes atomik (jika ada)
 * 4) Persist order + sesi payment
 * 5) AUTO_CAPTURE → settle + enqueue e-ticket
 */
async function createOrder({
  eventId,
  qty,
  clientIp,
  seatCodes,
  email,
  buyerName,
}) {
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

  const buyer = requireBuyer(email, buyerName);

  await ensureQuotaInitialized(eventId, event.quotaTotal);

  const reserved = await reserveSeats(eventId, q);
  if (!reserved.ok) {
    const err = new Error("kuota habis / kursi tidak tersedia");
    err.status = 409;
    err.sisa = reserved.sisa;
    throw err;
  }

  if (seats.length) {
    const claimed = await claimSeatCodes(eventId, seats);
    if (!claimed.ok) {
      await releaseSeats(eventId, q);
      const err = new Error(
        `kursi tidak tersedia: ${claimed.conflict || seats.join(",")}`
      );
      err.status = 409;
      err.sisa = reserved.sisa + q;
      throw err;
    }
  }

  const orderId = uuidv4();
  // Harga per kursi dari denah bila seatCodes ada; fallback price event
  let amountIdr = event.priceIdr * q;
  if (seats.length && Array.isArray(event.seats) && event.seats.length) {
    const byCode = new Map(
      event.seats.map((s) => [String(s.code || s.seat_code).toUpperCase(), s])
    );
    let sum = 0;
    let ok = true;
    for (const code of seats) {
      const row = byCode.get(code);
      const p = Number(row?.priceIdr ?? row?.price_idr);
      if (!Number.isFinite(p) || p < 1) {
        ok = false;
        break;
      }
      sum += p;
    }
    if (ok) amountIdr = sum;
  }
  const buyerEmail = buyer.email;
  const name = buyer.buyerName;

  let payment;
  try {
    payment = await createPaymentSession({
      orderId,
      eventId,
      qty: q,
      amountIdr,
      email: buyerEmail,
      buyerName: name,
      title: event.title,
    });
  } catch (payErr) {
    await releaseSeats(eventId, q);
    if (seats.length) await releaseSeatCodes(eventId, seats);
    throw payErr;
  }

  try {
    await db.insertOrder({
      orderId,
      eventId,
      qty: q,
      amountIdr,
      status: "PENDING_PAYMENT",
      clientIp: clientIp || null,
      buyerEmail,
      buyerName: name,
      paymentId: payment.paymentId,
      paymentProvider: payment.provider || PROVIDER,
      seatCodes: seats,
    });
    await db.audit(orderId, eventId, "ORDER_CREATED", {
      qty: q,
      sisa: reserved.sisa,
      amountIdr,
      seatCodes: seats,
      paymentId: payment.paymentId,
      provider: payment.provider,
    });
  } catch (dbErr) {
    await releaseSeats(eventId, q);
    if (seats.length) await releaseSeatCodes(eventId, seats);
    throw dbErr;
  }

  let status = "PENDING_PAYMENT";
  let mailNote = "menunggu pembayaran — e-ticket setelah PAID";
  let sisaOut = reserved.sisa;

  if (AUTO_CAPTURE) {
    const paid = await confirmPayment(orderId, {
      paymentId: payment.paymentId,
      source: "auto_capture",
    });
    if (paid.ok) {
      status = "CONFIRMED";
      mailNote = "pembayaran auto-capture — e-ticket diantrekan";
    }
  }

  return {
    orderId,
    eventId,
    qty: q,
    seatCodes: seats,
    amountIdr,
    sisa: sisaOut,
    status,
    buyerEmail,
    buyerName: name,
    payment: {
      provider: payment.provider,
      paymentId: payment.paymentId,
      status: status === "CONFIRMED" ? "paid" : payment.status,
      vaNumber: payment.vaNumber || null,
      bank: payment.bank || null,
      redirectUrl: payment.redirectUrl || null,
      token: payment.token || null,
      clientKey: payment.clientKey || null,
      expiresAt: payment.expiresAt || null,
      instructions: payment.instructions || null,
    },
    note: mailNote,
  };
}

/**
 * Konfirmasi bayar (webhook / simulate / auto). Idempotent.
 * Enqueue e-ticket hanya saat transisi pertama ke CONFIRMED.
 */
async function confirmPayment(orderId, { paymentId, source } = {}) {
  const before = await db.getOrder(orderId);
  if (!before) {
    return { ok: false, error: "order tidak ditemukan", status: 404 };
  }
  if (before.status === "CONFIRMED" && before.paid_at) {
    return {
      ok: true,
      alreadyPaid: true,
      orderId,
      status: "CONFIRMED",
    };
  }
  if (before.status !== "PENDING_PAYMENT" && before.status !== "CONFIRMED") {
    return {
      ok: false,
      error: `order status ${before.status} tidak bisa dibayar`,
      status: 409,
    };
  }

  const wasPending = before.status === "PENDING_PAYMENT";
  const { order } = await db.markOrderPaid(orderId, { paymentId });
  if (!order) {
    return { ok: false, error: "gagal update order", status: 500 };
  }

  if (wasPending) {
    await db.audit(orderId, order.event_id, "PAYMENT_SETTLED", {
      paymentId: paymentId || order.payment_id,
      source: source || "webhook",
      amountIdr: order.amount_idr,
    });

    const seats = order.seat_codes
      ? String(order.seat_codes)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    let title = null;
    try {
      const ev = await db.getEvent(order.event_id);
      title = ev?.title || null;
    } catch {
      /* ignore */
    }

    await redis.lpush(
      keys.queueEticket,
      JSON.stringify({
        orderId,
        eventId: order.event_id,
        qty: order.qty,
        seatCodes: seats,
        email: order.buyer_email,
        buyerName: order.buyer_name,
        amountIdr: Number(order.amount_idr),
        title,
        enqueuedAt: new Date().toISOString(),
      })
    );
  }

  return {
    ok: true,
    alreadyPaid: !wasPending,
    orderId,
    status: "CONFIRMED",
    paymentId: paymentId || order.payment_id,
  };
}

/**
 * Expire PENDING_PAYMENT yang lewat TTL — kembalikan kuota + seat.
 * Dipanggil periodik dari worker.
 */
async function expireStalePendingOrders() {
  const rows = await db.listExpiredPending(PAYMENT_TTL_MIN);
  let n = 0;
  for (const row of rows) {
    const ok = await db.expirePendingOrder(row.order_id);
    if (!ok) continue;
    const seats = row.seat_codes
      ? String(row.seat_codes)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    await releaseSeats(row.event_id, row.qty);
    if (seats.length) await releaseSeatCodes(row.event_id, seats);
    await db.audit(row.order_id, row.event_id, "ORDER_EXPIRED", {
      qty: row.qty,
      seatCodes: seats,
      ttlMin: PAYMENT_TTL_MIN,
    });
    n += 1;
  }
  return n;
}

async function getOrderPublic(orderId) {
  const row = await db.getOrder(orderId);
  if (!row) return null;
  return {
    orderId: row.order_id,
    eventId: row.event_id,
    qty: row.qty,
    amountIdr: Number(row.amount_idr),
    status: row.status,
    buyerEmail: row.buyer_email,
    buyerName: row.buyer_name,
    paymentId: row.payment_id,
    paymentProvider: row.payment_provider,
    seatCodes: row.seat_codes
      ? String(row.seat_codes)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

module.exports = {
  createOrder,
  confirmPayment,
  getOrderPublic,
  expireStalePendingOrders,
  PAYMENT_TTL_MIN,
};
