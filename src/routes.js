const express = require("express");
const config = require("./config");
const { getEventView } = require("./services/eventCache");
const { createOrder } = require("./services/orders");
const { getQuotaSnapshot, resetQuotaCounters } = require("./services/quota");
const { rateLimit } = require("./middleware/rateLimit");
const db = require("./db");
const { invalidateEventCache } = require("./services/eventCache");

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "war-tiket-konser",
    instance: config.instanceId,
    pid: process.pid,
    ts: new Date().toISOString(),
  });
});

/**
 * GET /events/:id — endpoint baca (cache-aside catalog + sisa live)
 * Pagination list disiapkan di GET /events
 */
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
    // starter: satu event; bentuk pagination siap Mobile
    const view = await getEventView(1);
    const items = view ? [view] : [];
    return res.json({ page, size, items: items.slice(0, size) });
  } catch (e) {
    console.error("[GET /events]", e);
    return res.status(500).json({ error: "internal error" });
  }
});

/**
 * POST /orders — endpoint panas (anti-oversell atomik)
 * Body: { "eventId": 1, "qty": 1 }
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
    return res.status(500).json({ error: "internal error" });
  }
});

/** Debug/ops: snapshot kuota Redis (bukan untuk Mobile) */
router.get("/internal/quota/:id", async (req, res) => {
  const id = Number(req.params.id);
  const snap = await getQuotaSnapshot(id);
  res.json({ eventId: id, ...snap });
});

/**
 * POST /internal/reset-quota/:id
 * Reset counter Redis ke quota_total (untuk ulang uji beban).
 * Header opsional: x-reset-token (default dev-reset).
 */
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
