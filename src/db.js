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

async function insertOrder({ orderId, eventId, qty, amountIdr, status, clientIp }) {
  await query(
    `INSERT INTO orders (order_id, event_id, qty, amount_idr, status, client_ip)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [orderId, eventId, qty, amountIdr, status, clientIp]
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
     FROM orders WHERE event_id = $1 AND status = 'CONFIRMED'`,
    [eventId]
  );
  return rows[0].sold;
}

module.exports = {
  pool,
  query,
  getEvent,
  listSeats,
  listCategories,
  listEvents,
  insertOrder,
  audit,
  countSold,
};
