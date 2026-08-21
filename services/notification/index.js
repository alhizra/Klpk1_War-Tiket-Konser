/**
 * notification-service — subscribe ticket.issued, log e-ticket (lab).
 * Port 3004. Tidak dipanggil sinkron oleh payment.
 */
const path = require("path");
const express = require("express");
const { createClient } = require("redis");
const { DatabaseSync } = require("node:sqlite");
const { createLogger, requestIdMiddleware } = require("./_shared/log");

const PORT = Number(process.env.PORT || 3004);
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "notification.db");
const CHANNEL = "ticket.issued";
const log = createLogger("notification");

const app = express();
app.use(express.json());
app.use(requestIdMiddleware);

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id TEXT,
    event_id INTEGER,
    payload TEXT,
    status TEXT,
    created_at TEXT
  );
`);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "notification" });
});

app.get("/v1/notifications/recent", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, payment_id AS paymentId, event_id AS eventId, status, created_at AS createdAt
       FROM deliveries ORDER BY id DESC LIMIT 20`
    )
    .all();
  res.json({ items: rows });
});

async function startSubscriber() {
  const sub = createClient({ url: REDIS_URL });
  sub.on("error", (e) => log("error", "redis", { err: e.message }));
  await sub.connect();
  await sub.subscribe(CHANNEL, (msg) => {
    try {
      const data = JSON.parse(msg);
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO deliveries (payment_id, event_id, payload, status, created_at)
         VALUES (?, ?, ?, 'SENT', ?)`
      ).run(data.paymentId, data.eventId, msg, now);
      console.log(
        `🔔 E-ticket: payment=${data.paymentId} event=${data.eventId} seats=${(data.seatCodes || []).join(",")}`
      );
      log("info", "eticket sent", {
        paymentId: data.paymentId,
        eventId: data.eventId,
      });
    } catch (e) {
      log("error", "handle message", { err: e.message });
    }
  });
  log("info", "subscribed", { channel: CHANNEL });
}

if (require.main === module) {
  startSubscriber()
    .then(() => {
      app.listen(PORT, "0.0.0.0", () => {
        log("info", "listening", { port: PORT });
      });
    })
    .catch((e) => {
      log("error", "fatal", { err: e.message });
      process.exit(1);
    });
}

module.exports = app;
