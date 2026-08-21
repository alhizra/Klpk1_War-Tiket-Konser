const { Pool } = require("pg");
const config = require("./config");

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 10000,
});

async function query(text, params) {
  return pool.query(text, params);
}

/** Kolom pembayaran/email — aman di DB lama (ALTER IF NOT EXISTS via try) */
async function ensureOrderColumns() {
  const alters = [
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_email VARCHAR(255)`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(120)`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_id VARCHAR(80)`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(40)`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS seat_codes TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`,
  ];
  for (const sql of alters) {
    try {
      await query(sql);
    } catch {
      /* ignore */
    }
  }
}

async function getEvent(eventId) {
  const { rows } = await query(
    `SELECT event_id, title, artist, venue, starts_at, sales_opens_at,
            quota_total, price_idr, status
     FROM events WHERE event_id = $1`,
    [eventId]
  );
  return rows[0] || null;
}

async function listSeats(eventId) {
  try {
    const { rows } = await query(
      `SELECT seat_code, category, category_name, row_label, seat_number,
              section, price_idr, color_hex, pos_x, pos_y
       FROM seats WHERE event_id = $1
       ORDER BY category, row_label, seat_number`,
      [eventId]
    );
    return rows;
  } catch {
    return [];
  }
}

async function listCategories(eventId) {
  try {
    const { rows } = await query(
      `SELECT code, name, price_idr, quota, color_hex
       FROM seat_categories WHERE event_id = $1
       ORDER BY price_idr DESC`,
      [eventId]
    );
    return rows;
  } catch {
    return [];
  }
}

async function listEvents() {
  const { rows } = await query(
    `SELECT event_id, title, artist, venue, starts_at, sales_opens_at,
            quota_total, price_idr, status
     FROM events WHERE status = 'PUBLISHED'
     ORDER BY event_id`
  );
  return rows;
}

async function insertOrder({
  orderId,
  eventId,
  qty,
  amountIdr,
  status,
  clientIp,
  buyerEmail,
  buyerName,
  paymentId,
  paymentProvider,
  seatCodes,
}) {
  await query(
    `INSERT INTO orders (
       order_id, event_id, qty, amount_idr, status, client_ip,
       buyer_email, buyer_name, payment_id, payment_provider, seat_codes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      orderId,
      eventId,
      qty,
      amountIdr,
      status,
      clientIp || null,
      buyerEmail || null,
      buyerName || null,
      paymentId || null,
      paymentProvider || null,
      seatCodes?.length ? seatCodes.join(",") : null,
    ]
  );
}

async function getOrder(orderId) {
  const { rows } = await query(
    `SELECT order_id, event_id, qty, amount_idr, status, client_ip,
            buyer_email, buyer_name, payment_id, payment_provider,
            seat_codes, paid_at, created_at
     FROM orders WHERE order_id = $1`,
    [orderId]
  );
  return rows[0] || null;
}

async function getOrderByPaymentId(paymentId) {
  const { rows } = await query(
    `SELECT order_id, event_id, qty, amount_idr, status, client_ip,
            buyer_email, buyer_name, payment_id, payment_provider,
            seat_codes, paid_at, created_at
     FROM orders WHERE payment_id = $1 LIMIT 1`,
    [paymentId]
  );
  return rows[0] || null;
}

/**
 * Mark paid sekali saja (idempotent). return true jika baru di-update.
 */
async function markOrderPaid(orderId, { paymentId } = {}) {
  const { rowCount, rows } = await query(
    `UPDATE orders
     SET status = 'CONFIRMED',
         paid_at = COALESCE(paid_at, now()),
         payment_id = COALESCE($2, payment_id)
     WHERE order_id = $1
       AND status IN ('PENDING_PAYMENT', 'CONFIRMED')
     RETURNING order_id, status, paid_at, event_id, qty, amount_idr,
               buyer_email, buyer_name, seat_codes, payment_id`,
    [orderId, paymentId || null]
  );
  if (!rowCount) return { updated: false, order: null };
  // updated=true hanya jika sebelumnya belum CONFIRMED dengan paid_at
  return { updated: true, order: rows[0] };
}

async function markOrderFailed(orderId, status = "FAILED") {
  await query(
    `UPDATE orders SET status = $2 WHERE order_id = $1 AND status = 'PENDING_PAYMENT'`,
    [orderId, status]
  );
}

async function audit(orderId, eventId, action, detail) {
  await query(
    `INSERT INTO order_events_audit (order_id, event_id, action, detail)
     VALUES ($1, $2, $3, $4)`,
    [orderId, eventId, action, detail ? JSON.stringify(detail) : null]
  );
}

async function countSold(eventId) {
  const { rows } = await query(
    `SELECT COALESCE(SUM(qty), 0)::int AS sold
     FROM orders WHERE event_id = $1
       AND status IN ('CONFIRMED', 'PENDING_PAYMENT')`,
    [eventId]
  );
  return rows[0].sold;
}

module.exports = {
  pool,
  query,
  ensureOrderColumns,
  getEvent,
  listSeats,
  listCategories,
  listEvents,
  insertOrder,
  getOrder,
  getOrderByPaymentId,
  markOrderPaid,
  markOrderFailed,
  audit,
  countSold,
};
