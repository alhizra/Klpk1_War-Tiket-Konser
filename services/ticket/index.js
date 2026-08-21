/**
 * ticket-service — pemilik sumber daya rebutan: status kursi.
 * Lock sementara + konfirmasi bayar. UPDATE atomik WHERE status='AVAILABLE'.
 * Port 3002.
 */
const path = require("path");
const express = require("express");
const { DatabaseSync } = require("node:sqlite");
const { v4: uuid } = require("uuid");
const {
  createLogger,
  requestIdMiddleware,
  panggilTahan,
} = require("./_shared/log");
const catalog = require("./seed-data");

const PORT = Number(process.env.PORT || 3002);
const EVENT_URL = process.env.EVENT_URL || "http://localhost:3001";
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "ticket.db");
const HOLD_TTL_MS = Number(process.env.HOLD_TTL_MS || 5 * 60 * 1000);
const log = createLogger("ticket");

const app = express();
app.use(express.json());
app.use(requestIdMiddleware);

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS seats (
    event_id INTEGER NOT NULL,
    seat_code TEXT NOT NULL,
    category TEXT,
    price_idr INTEGER,
    status TEXT NOT NULL DEFAULT 'AVAILABLE',
    hold_id TEXT,
    hold_until TEXT,
    PRIMARY KEY (event_id, seat_code)
  );
  CREATE TABLE IF NOT EXISTS holds (
    hold_id TEXT PRIMARY KEY,
    event_id INTEGER NOT NULL,
    seat_codes TEXT NOT NULL,
    amount_idr INTEGER,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
`);

function seedSeats() {
  const n = db.prepare("SELECT COUNT(*) AS c FROM seats").get().c;
  if (n > 0) return;
  const ins = db.prepare(
    `INSERT INTO seats (event_id, seat_code, category, price_idr, status)
     VALUES (?, ?, ?, ?, 'AVAILABLE')`
  );
  // Lab MS: kuota diperkecil agar seed cepat (anti-oversell tetap diuji).
  // Full Excel 3850 seats = monolit; di sini max 40/kategori.
  const MAX_PER_CAT = Number(process.env.SEED_MAX_PER_CAT || 40);
  let total = 0;
  // node:sqlite — pakai BEGIN/COMMIT (db.transaction belum stabil di semua versi)
  db.exec("BEGIN");
  try {
    for (const e of catalog) {
      for (const cat of e.categories || []) {
        const q = Math.min(Number(cat.quota) || 0, MAX_PER_CAT);
        for (let i = 1; i <= q; i++) {
          const code = `${cat.code}-${String(i).padStart(3, "0")}`;
          ins.run(e.eventId, code, cat.code, cat.priceIdr);
          total += 1;
        }
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  log("info", "seed seats", { total, maxPerCat: MAX_PER_CAT });
}
seedSeats();

function expireHolds() {
  const now = new Date().toISOString();
  const expired = db
    .prepare(
      `SELECT hold_id FROM holds WHERE status = 'HELD' AND expires_at < ?`
    )
    .all(now);
  for (const h of expired) {
    db.prepare(
      `UPDATE seats SET status = 'AVAILABLE', hold_id = NULL, hold_until = NULL
       WHERE hold_id = ? AND status = 'HELD'`
    ).run(h.hold_id);
    db.prepare(`UPDATE holds SET status = 'EXPIRED' WHERE hold_id = ?`).run(
      h.hold_id
    );
  }
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ticket" });
});

/** Snapshot ketersediaan kursi per event (untuk denah) */
app.get("/v1/events/:id/seats", (req, res) => {
  expireHolds();
  const eventId = Number(req.params.id);
  const seats = db
    .prepare(
      `SELECT seat_code AS code, category, price_idr AS priceIdr, status
       FROM seats WHERE event_id = ? ORDER BY seat_code LIMIT 200`
    )
    .all(eventId);
  const available = db
    .prepare(
      `SELECT COUNT(*) AS c FROM seats WHERE event_id = ? AND status = 'AVAILABLE'`
    )
    .get(eventId).c;
  const sold = db
    .prepare(
      `SELECT COUNT(*) AS c FROM seats WHERE event_id = ? AND status = 'SOLD'`
    )
    .get(eventId).c;
  res.json({ eventId, available, sold, seats });
});

/**
 * POST /v1/tickets/lock
 * Body: { eventId, seatCodes?: string[], qty?: number }
 * Kunci kursi atomik — sumber daya rebutan.
 */
app.post("/v1/tickets/lock", async (req, res) => {
  expireHolds();
  const eventId = Number(req.body?.eventId);
  let seatCodes = Array.isArray(req.body?.seatCodes)
    ? req.body.seatCodes.map((s) => String(s).toUpperCase())
    : [];
  const qty = Number(req.body?.qty || seatCodes.length || 1);

  if (!Number.isInteger(eventId) || eventId < 1) {
    return res.status(400).json({ error: "eventId tidak valid" });
  }
  if (qty < 1 || qty > 4) {
    return res.status(400).json({ error: "qty 1–4" });
  }

  // Validasi event ada di event-service (REST sinkron)
  const ev = await panggilTahan(`${EVENT_URL}/v1/events/${eventId}`, {
    headers: { "x-request-id": req.rid },
    retries: 2,
  });
  if (!ev.ok) {
    if (ev.status === 404) {
      return res.status(404).json({ error: "event tidak ada" });
    }
    return res.status(503).json({ error: "event-service tidak tersedia" });
  }

  if (!seatCodes.length) {
    const free = db
      .prepare(
        `SELECT seat_code FROM seats WHERE event_id = ? AND status = 'AVAILABLE'
         ORDER BY seat_code LIMIT ?`
      )
      .all(eventId, qty);
    seatCodes = free.map((r) => r.seat_code);
  }
  if (seatCodes.length !== qty) {
    return res.status(409).json({ error: "kursi tidak cukup / tidak tersedia" });
  }

  const holdId = uuid();
  const now = new Date();
  const exp = new Date(now.getTime() + HOLD_TTL_MS);
  let amount = 0;
  const locked = [];

  const lockOne = db.prepare(
    `UPDATE seats SET status = 'HELD', hold_id = ?, hold_until = ?
     WHERE event_id = ? AND seat_code = ? AND status = 'AVAILABLE'`
  );

  db.exec("BEGIN");
  try {
    for (const code of seatCodes) {
      const r = lockOne.run(holdId, exp.toISOString(), eventId, code);
      if (r.changes !== 1) {
        db.exec("ROLLBACK");
        return res.status(409).json({
          error: "kursi sudah diambil orang lain",
          seatCode: code,
        });
      }
      const seat = db
        .prepare(
          `SELECT price_idr FROM seats WHERE event_id = ? AND seat_code = ?`
        )
        .get(eventId, code);
      amount += seat?.price_idr || 0;
      locked.push(code);
    }
    db.prepare(
      `INSERT INTO holds (hold_id, event_id, seat_codes, amount_idr, status, created_at, expires_at)
       VALUES (?, ?, ?, ?, 'HELD', ?, ?)`
    ).run(
      holdId,
      eventId,
      JSON.stringify(locked),
      amount,
      now.toISOString(),
      exp.toISOString()
    );
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    log("error", "lock failed", { rid: req.rid, err: e.message });
    return res.status(500).json({ error: "gagal mengunci kursi" });
  }

  log("info", "seats locked", { rid: req.rid, holdId, eventId, locked });
  res.status(201).json({
    holdId,
    eventId,
    seatCodes: locked,
    amountIdr: amount,
    expiresAt: exp.toISOString(),
    status: "HELD",
  });
});

/** Konfirmasi setelah bayar sukses — HELD → SOLD */
app.post("/v1/tickets/confirm", (req, res) => {
  const holdId = String(req.body?.holdId || "");
  if (!holdId) return res.status(400).json({ error: "holdId wajib" });

  expireHolds();
  const hold = db.prepare(`SELECT * FROM holds WHERE hold_id = ?`).get(holdId);
  if (!hold) return res.status(404).json({ error: "hold tidak ditemukan" });
  if (hold.status === "CONFIRMED") {
    return res.json({
      holdId,
      status: "CONFIRMED",
      seatCodes: JSON.parse(hold.seat_codes),
      amountIdr: hold.amount_idr,
      eventId: hold.event_id,
    });
  }
  if (hold.status !== "HELD") {
    return res.status(409).json({ error: `hold status ${hold.status}` });
  }

  db.exec("BEGIN");
  try {
    const r = db
      .prepare(
        `UPDATE seats SET status = 'SOLD'
         WHERE hold_id = ? AND status = 'HELD'`
      )
      .run(holdId);
    if (r.changes < 1) {
      db.exec("ROLLBACK");
      return res.status(409).json({ error: "hold kedaluwarsa atau tidak valid" });
    }
    db.prepare(
      `UPDATE holds SET status = 'CONFIRMED' WHERE hold_id = ?`
    ).run(holdId);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    return res.status(500).json({ error: e.message });
  }

  const seatCodes = JSON.parse(hold.seat_codes);
  log("info", "seats confirmed", { rid: req.rid, holdId });
  res.json({
    holdId,
    eventId: hold.event_id,
    seatCodes,
    amountIdr: hold.amount_idr,
    status: "CONFIRMED",
  });
});

/** Lepas hold (batal bayar) */
app.post("/v1/tickets/release", (req, res) => {
  const holdId = String(req.body?.holdId || "");
  const hold = db.prepare(`SELECT * FROM holds WHERE hold_id = ?`).get(holdId);
  if (!hold) return res.status(404).json({ error: "hold tidak ditemukan" });
  if (hold.status !== "HELD") {
    return res.json({ holdId, status: hold.status });
  }
  db.prepare(
    `UPDATE seats SET status = 'AVAILABLE', hold_id = NULL, hold_until = NULL
     WHERE hold_id = ? AND status = 'HELD'`
  ).run(holdId);
  db.prepare(`UPDATE holds SET status = 'RELEASED' WHERE hold_id = ?`).run(
    holdId
  );
  res.json({ holdId, status: "RELEASED" });
});

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    log("info", "listening", { port: PORT });
  });
}

module.exports = app;
