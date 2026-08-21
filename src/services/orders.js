const { v4: uuidv4 } = require("uuid");
const config = require("../config");
const db = require("../db");
const { redis, keys } = require("../redis");
const { reserveSeats, ensureQuotaInitialized } = require("./quota");
const { getEventView } = require("./eventCache");
const {
  createPaymentSession,
  AUTO_CAPTURE,
  PROVIDER,
} = require("./paymentGateway");

function normalizeEmail(raw, orderId) {
  const e = String(raw || "").trim().toLowerCase();
  if (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return e;
  return `buyer-${String(orderId).slice(0, 8)}@example.com`;
}

/**
 * POST /orders — jalur panas.
 * 1) Validasi qty
 * 2) Reserve kursi atomik Redis
 * 3) Persist order PENDING_PAYMENT
 * 4) Buat sesi payment gateway
 * 5) Jika AUTO_CAPTURE → settle + enqueue e-ticket
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
  const buyerEmail = normalizeEmail(email, orderId);
  const name = String(buyerName || "").trim().slice(0, 120) || "WTK Buyer";

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
    await redis.incrby(keys.quota(eventId), q);
    await redis.decrby(keys.sold(eventId), q);
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
    if (seats.length) {
      await redis.sadd(`seats:sold:${eventId}`, ...seats);
    }
  } catch (dbErr) {
    await redis.incrby(keys.quota(eventId), q);
    await redis.decrby(keys.sold(eventId), q);
    throw dbErr;
  }

  let status = "PENDING_PAYMENT";
  let mailNote = "menunggu pembayaran — e-ticket setelah PAID";

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
    sisa: reserved.sisa,
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

  // Enqueue e-ticket hanya pada transisi pertama PENDING → CONFIRMED
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

module.exports = { createOrder, confirmPayment, getOrderPublic };
