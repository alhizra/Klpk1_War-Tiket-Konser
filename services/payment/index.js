/**
 * payment-service — gateway mock/midtrans + konfirmasi ticket + publish ticket.issued.
 * Port 3003. JWT wajib di POST /v1/payments.
 *
 * Alur:
 * 1) lock ticket  2) catat PENDING + sesi gateway
 * 3) settle (auto / webhook / simulate)  4) confirm ticket  5) publish ticket.issued
 */
const path = require("path");
const crypto = require("crypto");
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
const PROVIDER = (process.env.PAYMENT_PROVIDER || "mock").toLowerCase();
const AUTO_CAPTURE = process.env.PAYMENT_AUTO_CAPTURE !== "0";
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
    buyer_email TEXT,
    buyer_name TEXT,
    seat_codes TEXT,
    title TEXT,
    provider TEXT,
    va_number TEXT,
    created_at TEXT,
    paid_at TEXT
  );
`);
try {
  db.exec(`ALTER TABLE payments ADD COLUMN buyer_email TEXT`);
} catch {
  /* exists */
}
try {
  db.exec(`ALTER TABLE payments ADD COLUMN buyer_name TEXT`);
} catch {
  /* exists */
}
try {
  db.exec(`ALTER TABLE payments ADD COLUMN seat_codes TEXT`);
} catch {
  /* exists */
}
try {
  db.exec(`ALTER TABLE payments ADD COLUMN title TEXT`);
} catch {
  /* exists */
}
try {
  db.exec(`ALTER TABLE payments ADD COLUMN provider TEXT`);
} catch {
  /* exists */
}
try {
  db.exec(`ALTER TABLE payments ADD COLUMN va_number TEXT`);
} catch {
  /* exists */
}
try {
  db.exec(`ALTER TABLE payments ADD COLUMN paid_at TEXT`);
} catch {
  /* exists */
}

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

function mockSession(paymentId, amountIdr) {
  const va = `8808${String(Date.now()).slice(-10)}`;
  return {
    provider: "mock",
    paymentId,
    amountIdr,
    status: "pending",
    vaNumber: va,
    bank: "Mock Bank WTK",
    redirectUrl: null,
    instructions: [
      "Transfer VA (simulasi) atau POST /v1/payments/:id/settle",
      "Webhook: POST /v1/payments/webhook { paymentId, status: settlement }",
    ],
  };
}

async function midtransSession(orderRef, amountIdr, email, name, title) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) throw new Error("MIDTRANS_SERVER_KEY belum di-set");
  const isProd = process.env.MIDTRANS_IS_PRODUCTION === "1";
  const host = isProd
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";
  const auth = Buffer.from(`${serverKey}:`).toString("base64");
  const res = await fetch(`${host}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      transaction_details: { order_id: orderRef, gross_amount: amountIdr },
      customer_details: {
        email: email || "buyer@example.com",
        first_name: name || "WTK",
      },
      item_details: [
        {
          id: "ticket",
          price: amountIdr,
          quantity: 1,
          name: (title || "Tiket").slice(0, 50),
        },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.error_messages?.join(", ") || data.message || "Midtrans error"
    );
  }
  return {
    provider: "midtrans",
    paymentId: data.token,
    token: data.token,
    redirectUrl: data.redirect_url,
    clientKey: process.env.MIDTRANS_CLIENT_KEY || "",
    status: "pending",
    amountIdr,
  };
}

async function settlePayment(paymentId, rid) {
  const row = db
    .prepare(`SELECT * FROM payments WHERE payment_id = ?`)
    .get(paymentId);
  if (!row) return { ok: false, status: 404, error: "payment tidak ada" };
  if (row.status === "PAID") {
    return {
      ok: true,
      alreadyPaid: true,
      paymentId,
      status: "PAID",
    };
  }
  if (row.status !== "PENDING") {
    return {
      ok: false,
      status: 409,
      error: `status ${row.status} tidak bisa di-settle`,
    };
  }

  const conf = await panggilTahan(`${TICKET_URL}/v1/tickets/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": rid || "",
    },
    body: JSON.stringify({ holdId: row.hold_id }),
    retries: 2,
  });

  if (!conf.ok) {
    await panggilTahan(`${TICKET_URL}/v1/tickets/release`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": rid || "",
      },
      body: JSON.stringify({ holdId: row.hold_id }),
      retries: 1,
    });
    db.prepare(`UPDATE payments SET status = 'FAILED' WHERE payment_id = ?`).run(
      paymentId
    );
    return {
      ok: false,
      status: 503,
      error: "gagal konfirmasi kursi — hold dilepas",
      paymentId,
    };
  }

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE payments SET status = 'PAID', paid_at = ? WHERE payment_id = ?`
  ).run(now, paymentId);

  const seatCodes = conf.data?.seatCodes
    || (row.seat_codes ? String(row.seat_codes).split(",").filter(Boolean) : []);

  const payload = {
    paymentId,
    holdId: row.hold_id,
    eventId: row.event_id,
    seatCodes,
    amountIdr: row.amount_idr,
    user: row.user_sub,
    email: row.buyer_email,
    buyerName: row.buyer_name,
    title: row.title,
    issuedAt: now,
  };

  try {
    const r = await ensureRedis();
    await r.publish("ticket.issued", JSON.stringify(payload));
    log("info", "published ticket.issued", { rid, paymentId });
  } catch (e) {
    log("error", "publish failed", { err: e.message });
  }

  return {
    ok: true,
    paymentId,
    status: "PAID",
    ticket: {
      holdId: row.hold_id,
      eventId: row.event_id,
      seatCodes,
      amountIdr: row.amount_idr,
      status: "CONFIRMED",
    },
    note: "e-ticket dikirim async (ticket.issued)",
  };
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "payment",
    provider: PROVIDER,
    autoCapture: AUTO_CAPTURE,
  });
});

app.post("/v1/login", (req, res) => {
  const sub = String(req.body?.username || "mhs-1");
  const token = jwt.sign({ sub, role: "mahasiswa" }, JWT_SECRET, {
    expiresIn: "2h",
  });
  res.json({ token, expiresIn: "2h" });
});

/**
 * Buat pembayaran: lock kursi + sesi gateway.
 * Body: { eventId, seatCodes?, qty?, email?, buyerName? }
 * Default AUTO_CAPTURE=1 → settle langsung (kompat E2E lama).
 */
app.post("/v1/payments", butuhAuth, async (req, res) => {
  const eventId = Number(req.body?.eventId);
  const seatCodes = req.body?.seatCodes;
  const qty = Number(req.body?.qty || (seatCodes?.length ?? 1));
  const email =
    String(req.body?.email || "").trim() ||
    `${req.user.sub}@example.com`;
  const buyerName = String(req.body?.buyerName || req.user.sub).slice(0, 120);

  if (!Number.isInteger(eventId) || eventId < 1) {
    return res.status(400).json({ error: "eventId tidak valid" });
  }

  const ev = await panggilTahan(`${EVENT_URL}/v1/events/${eventId}`, {
    headers: { "x-request-id": req.rid },
  });
  if (!ev.ok && ev.status === 404) {
    return res.status(404).json({ error: "event tidak ada" });
  }
  if (!ev.ok) {
    return res.status(503).json({ error: "event-service tidak tersedia" });
  }

  const lock = await panggilTahan(`${TICKET_URL}/v1/tickets/lock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": req.rid,
    },
    body: JSON.stringify({ eventId, seatCodes, qty }),
    retries: 1,
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
    return res
      .status(lock.status || 502)
      .json(lock.data || { error: "lock gagal" });
  }

  const hold = lock.data;
  const paymentId = uuid();
  const now = new Date().toISOString();
  const title = ev.data?.title || null;
  const seatsStr = (hold.seatCodes || seatCodes || []).join(",");

  let session;
  try {
    if (PROVIDER === "midtrans") {
      session = await midtransSession(
        paymentId,
        hold.amountIdr,
        email,
        buyerName,
        title
      );
      session.paymentId = paymentId;
    } else {
      session = mockSession(paymentId, hold.amountIdr);
    }
  } catch (e) {
    await panggilTahan(`${TICKET_URL}/v1/tickets/release`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": req.rid,
      },
      body: JSON.stringify({ holdId: hold.holdId }),
      retries: 1,
    });
    return res.status(502).json({ error: e.message || "gateway error" });
  }

  db.prepare(
    `INSERT INTO payments (
       payment_id, hold_id, event_id, amount_idr, status, user_sub,
       buyer_email, buyer_name, seat_codes, title, provider, va_number, created_at
     ) VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    paymentId,
    hold.holdId,
    eventId,
    hold.amountIdr,
    req.user.sub,
    email,
    buyerName,
    seatsStr,
    title,
    session.provider,
    session.vaNumber || null,
    now
  );

  if (AUTO_CAPTURE) {
    const settled = await settlePayment(paymentId, req.rid);
    if (!settled.ok) {
      return res.status(settled.status || 503).json(settled);
    }
    return res.status(201).json({
      paymentId,
      status: "PAID",
      ticket: settled.ticket,
      payment: {
        provider: session.provider,
        vaNumber: session.vaNumber || null,
        redirectUrl: session.redirectUrl || null,
        token: session.token || null,
      },
      buyerEmail: email,
      note: settled.note,
    });
  }

  res.status(201).json({
    paymentId,
    status: "PENDING",
    holdId: hold.holdId,
    eventId,
    amountIdr: hold.amountIdr,
    seatCodes: hold.seatCodes || seatCodes || [],
    buyerEmail: email,
    payment: session,
    note: "selesaikan bayar via settle/webhook",
  });
});

/** Lab: settle manual */
app.post("/v1/payments/:id/settle", butuhAuth, async (req, res) => {
  const result = await settlePayment(req.params.id, req.rid);
  if (!result.ok) {
    return res.status(result.status || 400).json(result);
  }
  res.json(result);
});

/** Webhook gateway */
app.post("/v1/payments/webhook", async (req, res) => {
  const body = req.body || {};
  let paymentId = body.paymentId || body.payment_id || body.order_id;
  let st = String(body.status || body.transaction_status || "settlement").toLowerCase();

  if (body.signature_key && process.env.MIDTRANS_SERVER_KEY) {
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const raw =
      (body.status_code || "") +
      (body.order_id || "") +
      (body.gross_amount || "") +
      serverKey;
    const expect = crypto.createHash("sha512").update(raw).digest("hex");
    if (body.signature_key !== expect) {
      return res.status(403).json({ error: "signature invalid" });
    }
    paymentId = body.order_id;
    const fraud = String(body.fraud_status || "").toLowerCase();
    if (st === "settlement" || (st === "capture" && fraud === "accept")) {
      st = "settlement";
    }
  }

  if (!paymentId) {
    return res.status(400).json({ error: "paymentId wajib" });
  }
  if (st !== "settlement" && st !== "paid" && st !== "success") {
    return res.json({ ok: true, handled: st });
  }

  const result = await settlePayment(paymentId, req.rid);
  if (!result.ok) {
    return res.status(result.status || 400).json(result);
  }
  res.json(result);
});

app.get("/v1/payments/:id", (req, res) => {
  const row = db
    .prepare(
      `SELECT payment_id AS paymentId, hold_id AS holdId, event_id AS eventId,
              amount_idr AS amountIdr, status, user_sub AS user,
              buyer_email AS buyerEmail, provider, va_number AS vaNumber,
              created_at AS createdAt, paid_at AS paidAt
       FROM payments WHERE payment_id = ?`
    )
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "tidak ditemukan" });
  res.json(row);
});

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
    log("info", "listening", { port: PORT, provider: PROVIDER });
  });
}

module.exports = app;
