/**
 * payment-service — terima bayar, konfirmasi ke ticket-service, publish ticket.issued.
 * Port 3003. JWT wajib di POST /v1/payments.
 */
const path = require("path");
const express = require("express");
const jwt = require("jsonwebtoken");
const { createClient } = require("redis");
const { v4: uuid } = require("uuid");
const { DatabaseSync } = require("node:sqlite");
const {
  createLogger,
  requestIdMiddleware,
  panggilTahan,
} = require("./_shared/log");

const PORT = Number(process.env.PORT || 3003);
const TICKET_URL = process.env.TICKET_URL || "http://localhost:3002";
const EVENT_URL = process.env.EVENT_URL || "http://localhost:3001";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const JWT_SECRET = process.env.JWT_SECRET || "wtk-dev-secret-ganti";
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "payment.db");
const log = createLogger("payment");

const app = express();
app.use(express.json());
app.use(requestIdMiddleware);

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS payments (
    payment_id TEXT PRIMARY KEY,
    hold_id TEXT,
    event_id INTEGER,
    amount_idr INTEGER,
    status TEXT,
    user_sub TEXT,
    created_at TEXT
  );
`);

let pub = null;
async function ensureRedis() {
  if (pub?.isOpen) return pub;
  pub = createClient({ url: REDIS_URL });
  pub.on("error", (e) => log("error", "redis", { err: e.message }));
  await pub.connect();
  return pub;
}

function butuhAuth(req, res, next) {
  const header = req.headers.authorization || "";
  try {
    req.user = jwt.verify(header.replace(/^Bearer\s+/i, ""), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "tidak sah — sertakan token" });
  }
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "payment" });
});

/** Lab login — terbitkan JWT (bukan production auth) */
app.post("/v1/login", (req, res) => {
  const sub = String(req.body?.username || "mhs-1");
  const token = jwt.sign({ sub, role: "mahasiswa" }, JWT_SECRET, {
    expiresIn: "2h",
  });
  res.json({ token, expiresIn: "2h" });
});

/**
 * Alur ujung-ke-ujung singkat (materi):
 * body: { eventId, seatCodes?, qty? }
 * 1) lock di ticket  2) catat payment PAID  3) confirm ticket  4) publish ticket.issued
 */
app.post("/v1/payments", butuhAuth, async (req, res) => {
  const eventId = Number(req.body?.eventId);
  const seatCodes = req.body?.seatCodes;
  const qty = Number(req.body?.qty || (seatCodes?.length ?? 1));

  if (!Number.isInteger(eventId) || eventId < 1) {
    return res.status(400).json({ error: "eventId tidak valid" });
  }

  // Optional: pastikan event hidup (fallback baca: cache tidak dipakai di sini)
  const ev = await panggilTahan(`${EVENT_URL}/v1/events/${eventId}`, {
    headers: { "x-request-id": req.rid },
  });
  if (!ev.ok && ev.status === 404) {
    return res.status(404).json({ error: "event tidak ada" });
  }
  if (!ev.ok) {
    return res.status(503).json({ error: "event-service tidak tersedia" });
  }

  // 1) Kunci kursi di ticket-service (sumber daya rebutan)
  const lock = await panggilTahan(`${TICKET_URL}/v1/tickets/lock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": req.rid,
    },
    body: JSON.stringify({ eventId, seatCodes, qty }),
    retries: 1, // tulis: jangan retry agresif
  });

  if (!lock.ok) {
    if (lock.status === 409) {
      return res.status(409).json({
        error: lock.data?.error || "kursi habis",
        detail: lock.data,
      });
    }
    if (lock.status === 503 || lock.status === 502) {
      return res.status(503).json({
        error: "ticket-service tidak tersedia — pembayaran ditolak jujur",
      });
    }
    return res.status(lock.status || 502).json(lock.data || { error: "lock gagal" });
  }

  const hold = lock.data;
  const paymentId = uuid();
  const now = new Date().toISOString();

  // 2) Simulasikan bayar sukses (lab)
  db.prepare(
    `INSERT INTO payments (payment_id, hold_id, event_id, amount_idr, status, user_sub, created_at)
     VALUES (?, ?, ?, ?, 'PAID', ?, ?)`
  ).run(
    paymentId,
    hold.holdId,
    eventId,
    hold.amountIdr,
    req.user.sub,
    now
  );

  // 3) Konfirmasi kursi — titik rawan: payment → ticket
  const conf = await panggilTahan(`${TICKET_URL}/v1/tickets/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": req.rid,
    },
    body: JSON.stringify({ holdId: hold.holdId }),
    retries: 2,
  });

  if (!conf.ok) {
    // kompensasi: lepas hold
    await panggilTahan(`${TICKET_URL}/v1/tickets/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-request-id": req.rid },
      body: JSON.stringify({ holdId: hold.holdId }),
      retries: 1,
    });
    db.prepare(`UPDATE payments SET status = 'FAILED' WHERE payment_id = ?`).run(
      paymentId
    );
    return res.status(503).json({
      error: "gagal konfirmasi kursi setelah bayar — hold dilepas",
      paymentId,
    });
  }

  const ticket = conf.data;
  const payload = {
    paymentId,
    holdId: hold.holdId,
    eventId,
    seatCodes: ticket.seatCodes || hold.seatCodes,
    amountIdr: hold.amountIdr,
    user: req.user.sub,
    title: ev.data?.title,
    issuedAt: now,
  };

  // 4) Event asinkron — payment tidak menunggu notifikasi selesai
  try {
    const r = await ensureRedis();
    await r.publish("ticket.issued", JSON.stringify(payload));
    log("info", "published ticket.issued", { rid: req.rid, paymentId });
  } catch (e) {
    log("error", "publish failed", { err: e.message });
    // bayar tetap sukses; notifikasi best-effort
  }

  res.status(201).json({
    paymentId,
    status: "PAID",
    ticket: {
      holdId: hold.holdId,
      eventId,
      seatCodes: payload.seatCodes,
      amountIdr: hold.amountIdr,
      status: "CONFIRMED",
    },
    note: "e-ticket dikirim async (ticket.issued)",
  });
});

/** Fallback baca katalog lewat payment (materi resiliency — cache last good) */
let cacheKatalog = null;
let gagalBeruntun = 0;
let bukaSampai = 0;

async function lewatBreaker(url, rid) {
  if (Date.now() < bukaSampai) return null;
  const hasil = await panggilTahan(url, {
    headers: { "x-request-id": rid },
    retries: 2,
  });
  if (!hasil.ok) {
    if (++gagalBeruntun >= 3) {
      bukaSampai = Date.now() + 30_000;
      gagalBeruntun = 0;
    }
    return null;
  }
  gagalBeruntun = 0;
  return hasil.data;
}

app.get("/v1/catalog", async (req, res) => {
  const segar = await lewatBreaker(`${EVENT_URL}/v1/events?size=50`, req.rid);
  if (segar) {
    cacheKatalog = segar;
    return res.json({ ...segar, stale: false });
  }
  if (cacheKatalog) {
    return res.json({ ...cacheKatalog, stale: true });
  }
  res.status(503).json({ error: "katalog belum tersedia" });
});

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    log("info", "listening", { port: PORT });
  });
}

module.exports = app;
