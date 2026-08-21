/**
 * notification-service — subscribe ticket.issued, kirim e-ticket email.
 * Port 3004. Tidak dipanggil sinkron oleh payment.
 */
const path = require("path");
const express = require("express");
const { createClient } = require("redis");
const { DatabaseSync } = require("node:sqlite");
const { createLogger, requestIdMiddleware } = require("./_shared/log");
const { sendETicket } = require("./mail");

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
    mail_mode TEXT,
    mail_to TEXT,
    created_at TEXT
  );
`);
try {
  db.exec(`ALTER TABLE deliveries ADD COLUMN mail_mode TEXT`);
} catch {
  /* ok */
}
try {
  db.exec(`ALTER TABLE deliveries ADD COLUMN mail_to TEXT`);
} catch {
  /* ok */
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "notification" });
});

app.get("/v1/notifications/recent", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, payment_id AS paymentId, event_id AS eventId, status,
              mail_mode AS mailMode, mail_to AS mailTo, created_at AS createdAt
       FROM deliveries ORDER BY id DESC LIMIT 20`
    )
    .all();
  res.json({ items: rows });
});

async function handleIssued(msg) {
  const data = JSON.parse(msg);
  const now = new Date().toISOString();
  let mailResult = { mode: "none", to: null };
  try {
    mailResult = await sendETicket(data);
  } catch (e) {
    log("error", "mail failed", { err: e.message });
    mailResult = { mode: "error", to: null, error: e.message };
  }
  db.prepare(
    `INSERT INTO deliveries (payment_id, event_id, payload, status, mail_mode, mail_to, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    data.paymentId,
    data.eventId,
    msg,
    mailResult.mode === "error" ? "MAIL_FAILED" : "SENT",
    mailResult.mode || null,
    mailResult.to || null,
    now
  );
  console.log(
    `🔔 E-ticket: payment=${data.paymentId} event=${data.eventId} seats=${(data.seatCodes || []).join(",")} mail=${mailResult.mode}→${mailResult.to}`
  );
  log("info", "eticket sent", {
    paymentId: data.paymentId,
    eventId: data.eventId,
    mode: mailResult.mode,
  });
}

async function startSubscriber() {
  const sub = createClient({ url: REDIS_URL });
  sub.on("error", (e) => log("error", "redis", { err: e.message }));
  await sub.connect();
  await sub.subscribe(CHANNEL, (msg) => {
    handleIssued(msg).catch((e) =>
      log("error", "handle message", { err: e.message })
    );
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
