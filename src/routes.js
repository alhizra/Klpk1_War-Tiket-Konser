const express = require("express");
const config = require("./config");
const { getEventView } = require("./services/eventCache");
const {
  createOrder,
  confirmPayment,
  getOrderPublic,
} = require("./services/orders");
const { getQuotaSnapshot, resetQuotaCounters } = require("./services/quota");
const { rateLimit } = require("./middleware/rateLimit");
const db = require("./db");
const { invalidateEventCache } = require("./services/eventCache");
const {
  PROVIDER,
  parseWebhook,
  verifyMidtransSignature,
} = require("./services/paymentGateway");
const { listOutbox, getOutboxByOrder } = require("./services/mail");

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "war-tiket-konser",
    instance: config.instanceId,
    pid: process.pid,
    paymentProvider: PROVIDER,
    ts: new Date().toISOString(),
  });
});

router.get("/events/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "event id tidak valid" });
    }
    const view = await getEventView(id);
    if (!view) return res.status(404).json({ error: "event tidak ditemukan" });
    return res.json(view);
  } catch (e) {
    console.error("[GET /events/:id]", e);
    return res.status(500).json({ error: "internal error" });
  }
});

router.get("/events", async (req, res) => {
  try {
    const size = Math.min(Number(req.query.size) || 20, 50);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const rows = await db.listEvents();
    const start = (page - 1) * size;
    const slice = rows.slice(start, start + size);
    const items = [];
    for (const r of slice) {
      const view = await getEventView(r.event_id);
      if (view) items.push(view);
    }
    return res.json({ page, size, items });
  } catch (e) {
    console.error("[GET /events]", e);
    return res.status(500).json({ error: "internal error" });
  }
});

/**
 * POST /orders — reserve + buat sesi bayar
 * Body: { eventId, qty, seatCodes?, email?, buyerName? }
 */
router.post("/orders", rateLimit(), async (req, res) => {
  try {
    const eventId = Number(req.body?.eventId ?? config.defaultEventId);
    const qty = Number(req.body?.qty ?? 1);
    if (!Number.isInteger(eventId) || eventId < 1) {
      return res.status(400).json({ error: "eventId tidak valid" });
    }
    const order = await createOrder({
      eventId,
      qty,
      clientIp: req.ip,
      seatCodes: req.body?.seatCodes,
      email: req.body?.email,
      buyerName: req.body?.buyerName,
    });
    return res.status(201).json(order);
  } catch (e) {
    if (e.status === 409) {
      return res.status(409).json({
        error: e.message,
        sisa: e.sisa ?? 0,
      });
    }
    if (e.status === 400 || e.status === 404) {
      return res.status(e.status).json({ error: e.message });
    }
    console.error("[POST /orders]", e);
    return res.status(500).json({ error: "internal error", detail: e.message });
  }
});

/** GET /orders/:id */
router.get("/orders/:id", async (req, res) => {
  try {
    const order = await getOrderPublic(req.params.id);
    if (!order) return res.status(404).json({ error: "order tidak ditemukan" });
    return res.json(order);
  } catch (e) {
    console.error("[GET /orders/:id]", e);
    return res.status(500).json({ error: "internal error" });
  }
});

/**
 * POST /payments/webhook — notifikasi gateway (mock / Midtrans)
 * Mock body: { orderId, status: "settlement", paymentId? }
 * Midtrans: body notifikasi resmi + signature_key
 */
router.post("/payments/webhook", async (req, res) => {
  try {
    const body = req.body || {};
    const isMidtrans =
      PROVIDER === "midtrans" ||
      body.signature_key ||
      body.transaction_status;

    if (isMidtrans && body.signature_key) {
      if (!verifyMidtransSignature(body)) {
        return res.status(403).json({ error: "signature tidak valid" });
      }
    }

    const parsed = parseWebhook(
      body,
      isMidtrans && body.transaction_status ? "midtrans" : "mock"
    );
    if (!parsed.orderId) {
      return res.status(400).json({ error: "orderId wajib" });
    }
    if (parsed.status !== "paid") {
      if (parsed.status === "deny") {
        await db.markOrderFailed(parsed.orderId, "FAILED");
        await db.audit(parsed.orderId, 0, "PAYMENT_DENIED", parsed.raw);
      }
      return res.json({ ok: true, handled: parsed.status });
    }

    const result = await confirmPayment(parsed.orderId, {
      paymentId: parsed.paymentId,
      source: "webhook",
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error });
    }
    return res.json({
      ok: true,
      orderId: result.orderId,
      status: result.status,
      alreadyPaid: result.alreadyPaid || false,
    });
  } catch (e) {
    console.error("[webhook]", e);
    return res.status(500).json({ error: "internal error" });
  }
});

/**
 * POST /payments/simulate — lab: settle mock tanpa menunggu bank
 * Body: { orderId }
 */
router.post("/payments/simulate", async (req, res) => {
  try {
    const orderId = req.body?.orderId || req.body?.order_id;
    if (!orderId) return res.status(400).json({ error: "orderId wajib" });
    const result = await confirmPayment(orderId, {
      paymentId: req.body?.paymentId,
      source: "simulate",
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error });
    }
    return res.json(result);
  } catch (e) {
    console.error("[simulate pay]", e);
    return res.status(500).json({ error: "internal error" });
  }
});

/**
 * GET /mail/outbox — kotak e-ticket lab (file lokal)
 * Tanpa SMTP, email tidak ke Gmail; baca di sini / set SMTP_HOST.
 */
router.get("/mail/outbox", (_req, res) => {
  const items = listOutbox(50);
  res.json({
    items,
    hint:
      process.env.SMTP_HOST
        ? "SMTP aktif — cek juga inbox email pembeli"
        : "SMTP belum di-set. Email hanya di outbox ini (bukan Gmail). Isi SMTP_HOST/USER/PASS di .env lalu restart worker.",
  });
});

router.get("/mail/outbox/:orderId", (req, res) => {
  const items = getOutboxByOrder(req.params.orderId);
  if (!items.length) {
    return res.status(404).json({
      error: "belum ada e-ticket untuk order ini (tunggu worker ~1–3s)",
      orderId: req.params.orderId,
    });
  }
  return res.json({ items });
});

router.get("/internal/quota/:id", async (req, res) => {
  const id = Number(req.params.id);
  const snap = await getQuotaSnapshot(id);
  res.json({ eventId: id, ...snap });
});

router.post("/internal/reset-quota/:id", async (req, res) => {
  try {
    const token = req.headers["x-reset-token"] || "";
    const expected = process.env.RESET_TOKEN || "dev-reset";
    if (token !== expected) {
      return res.status(403).json({ error: "forbidden" });
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "event id tidak valid" });
    }
    const event = await db.getEvent(id);
    if (!event) return res.status(404).json({ error: "event tidak ditemukan" });
    const snap = await resetQuotaCounters(id, event.quota_total);
    await invalidateEventCache(id);
    return res.json({
      ok: true,
      eventId: id,
      quotaTotal: event.quota_total,
      ...snap,
    });
  } catch (e) {
    console.error("[reset-quota]", e);
    return res.status(500).json({ error: "internal error" });
  }
});

module.exports = router;
