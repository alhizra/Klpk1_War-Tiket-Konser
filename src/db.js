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

/** Kolom events ekstra (admin / seed baru) — aman di volume DB lama */
async function ensureEventColumns() {
  const alters = [
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS event_code VARCHAR(40)`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS country VARCHAR(80)`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS city VARCHAR(80)`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS gate_open VARCHAR(40)`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS age_rating VARCHAR(80)`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS sales_closes_at TIMESTAMPTZ`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS poster_url VARCHAR(500)`,
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
            quota_total, price_idr, status, poster_url, city, country,
            description, gate_open, age_rating
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
            quota_total, price_idr, status, poster_url
     FROM events WHERE status = 'PUBLISHED'
     ORDER BY event_id`
  );
  return rows;
}

/** Semua event (admin) termasuk DRAFT / CLOSED */
async function listAllEvents() {
  const { rows } = await query(
    `SELECT event_id, event_code, title, artist, venue, starts_at, sales_opens_at,
            sales_closes_at, quota_total, price_idr, status, city, country,
            description, gate_open, age_rating, created_at, poster_url
     FROM events
     ORDER BY event_id DESC`
  );
  return rows;
}

async function createEvent(input) {
  const {
    title,
    artist,
    venue,
    startsAt,
    salesOpensAt,
    salesClosesAt,
    quotaTotal,
    priceIdr,
    status = "PUBLISHED",
    city,
    country,
    description,
    gateOpen,
    ageRating,
    eventCode,
    posterUrl,
  } = input;
  // jaga SERIAL agar tidak bentrok dengan seed manual
  try {
    await query(
      `SELECT setval(pg_get_serial_sequence('events','event_id'),
        COALESCE((SELECT MAX(event_id) FROM events), 1))`
    );
  } catch {
    /* ignore */
  }
  const { rows } = await query(
    `INSERT INTO events (
       event_code, title, artist, venue, starts_at, sales_opens_at, sales_closes_at,
       quota_total, price_idr, status, city, country, description, gate_open, age_rating,
       poster_url
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING event_id, event_code, title, artist, venue, starts_at, sales_opens_at,
               quota_total, price_idr, status, city, country, description, poster_url`,
    [
      eventCode || null,
      title,
      artist,
      venue,
      startsAt,
      salesOpensAt || startsAt,
      salesClosesAt || null,
      quotaTotal,
      priceIdr,
      status,
      city || null,
      country || null,
      description || null,
      gateOpen || "16:00",
      ageRating || "All ages",
      posterUrl || null,
    ]
  );
  return rows[0];
}

async function setEventPoster(eventId, posterUrl) {
  const { rows } = await query(
    `UPDATE events SET poster_url = $2 WHERE event_id = $1
     RETURNING event_id, poster_url`,
    [eventId, posterUrl]
  );
  return rows[0] || null;
}

/**
 * Samakan harga kategori + kursi dengan harga event (admin edit harga).
 * Event 1 kategori: semua di-set ke price baru.
 * Multi kategori: skala proporsional dari harga event lama (jika ada).
 */
async function syncEventSeatPrices(eventId, newPriceIdr, oldPriceIdr) {
  const price = Number(newPriceIdr);
  if (!Number.isFinite(price) || price < 0) return;

  const { rows: cats } = await query(
    `SELECT code, price_idr FROM seat_categories WHERE event_id = $1`,
    [eventId]
  ).catch(() => ({ rows: [] }));

  if (!cats.length) {
    // hanya update seats bila ada
    try {
      await query(`UPDATE seats SET price_idr = $2 WHERE event_id = $1`, [
        eventId,
        price,
      ]);
    } catch {
      /* */
    }
    return;
  }

  if (cats.length === 1) {
    const code = cats[0].code;
    await query(
      `UPDATE seat_categories SET price_idr = $3 WHERE event_id = $1 AND code = $2`,
      [eventId, code, price]
    );
    await query(
      `UPDATE seats SET price_idr = $3 WHERE event_id = $1 AND category = $2`,
      [eventId, code, price]
    );
    return;
  }

  // multi-zona: skala dari harga event lama, fallback set base = newPrice
  const baseOld = Number(oldPriceIdr);
  const ratio =
    Number.isFinite(baseOld) && baseOld > 0 ? price / baseOld : null;

  for (const c of cats) {
    let catPrice;
    if (ratio != null) {
      catPrice = Math.max(0, Math.round(Number(c.price_idr) * ratio));
    } else {
      catPrice = price;
    }
    await query(
      `UPDATE seat_categories SET price_idr = $3 WHERE event_id = $1 AND code = $2`,
      [eventId, c.code, catPrice]
    );
    await query(
      `UPDATE seats SET price_idr = $3 WHERE event_id = $1 AND category = $2`,
      [eventId, c.code, catPrice]
    );
  }
}

/** Hapus event + order terkait (seats/categories CASCADE) */
async function deleteEvent(eventId) {
  const cur = await getEvent(eventId);
  if (!cur) return null;
  await query(`DELETE FROM orders WHERE event_id = $1`, [eventId]);
  try {
    await query(`DELETE FROM seat_categories WHERE event_id = $1`, [eventId]);
  } catch {
    /* */
  }
  try {
    await query(`DELETE FROM seats WHERE event_id = $1`, [eventId]);
  } catch {
    /* */
  }
  const { rowCount } = await query(`DELETE FROM events WHERE event_id = $1`, [
    eventId,
  ]);
  if (!rowCount) return null;
  return {
    eventId: cur.event_id,
    title: cur.title,
    posterUrl: cur.poster_url || null,
  };
}

async function updateEvent(eventId, patch) {
  const cur = await getEvent(eventId);
  if (!cur) return null;
  const title = patch.title ?? cur.title;
  const artist = patch.artist ?? cur.artist;
  const venue = patch.venue ?? cur.venue;
  const startsAt = patch.startsAt ?? cur.starts_at;
  const salesOpensAt = patch.salesOpensAt ?? cur.sales_opens_at;
  const quotaTotal = patch.quotaTotal ?? cur.quota_total;
  const priceIdr = patch.priceIdr ?? cur.price_idr;
  const status = patch.status ?? cur.status;
  const city = patch.city !== undefined ? patch.city : cur.city;
  const country = patch.country !== undefined ? patch.country : cur.country;
  const description =
    patch.description !== undefined ? patch.description : cur.description;
  const gateOpen =
    patch.gateOpen !== undefined ? patch.gateOpen : cur.gate_open;
  const ageRating =
    patch.ageRating !== undefined ? patch.ageRating : cur.age_rating;
  const posterUrl =
    patch.posterUrl !== undefined ? patch.posterUrl : cur.poster_url;
  const { rows } = await query(
    `UPDATE events SET
       title = $2, artist = $3, venue = $4, starts_at = $5, sales_opens_at = $6,
       quota_total = $7, price_idr = $8, status = $9,
       city = $10, country = $11, description = $12,
       gate_open = $13, age_rating = $14, poster_url = $15
     WHERE event_id = $1
     RETURNING event_id, title, artist, venue, starts_at, sales_opens_at,
               quota_total, price_idr, status, city, country, description, poster_url`,
    [
      eventId,
      title,
      artist,
      venue,
      startsAt,
      salesOpensAt,
      quotaTotal,
      priceIdr,
      status,
      city || null,
      country || null,
      description || null,
      gateOpen || null,
      ageRating || null,
      posterUrl || null,
    ]
  );
  return rows[0] || null;
}

/**
 * Template denah multi-zona (mirip event seed) dari harga dasar + kuota total.
 * Proporsi: VIP 10% · FLOOR 20% · GOLD 25% · SILVER 25% · BRONZE 20%
 */
function buildDefaultCategories(priceIdr, quotaTotal) {
  const base = Math.max(0, Number(priceIdr) || 0);
  const total = Math.max(1, Math.min(Number(quotaTotal) || 1, 5000));
  const plan = [
    { code: "VIP", name: "VIP Front", mult: 1.8, share: 0.1, colorHex: "#A855F7" },
    { code: "FLOOR", name: "Floor Standing", mult: 1.4, share: 0.2, colorHex: "#7C3AED" },
    { code: "GOLD", name: "Gold Lower", mult: 1.15, share: 0.25, colorHex: "#EAB308" },
    { code: "SILVER", name: "Silver Bowl", mult: 1.0, share: 0.25, colorHex: "#38BDF8" },
    { code: "BRONZE", name: "Bronze Upper", mult: 0.75, share: 0.2, colorHex: "#F97316" },
  ];

  let allocated = 0;
  const cats = plan.map((p, idx) => {
    let q =
      idx === plan.length - 1
        ? Math.max(1, total - allocated)
        : Math.max(1, Math.round(total * p.share));
    if (allocated + q > total && idx < plan.length - 1) {
      q = Math.max(1, total - allocated - (plan.length - 1 - idx));
    }
    allocated += q;
    const price = Math.max(0, Math.round(base * p.mult / 1000) * 1000) || base;
    return {
      code: p.code,
      name: p.name,
      priceIdr: price,
      quota: q,
      colorHex: p.colorHex,
    };
  });

  // rapikan total quota
  const sum = cats.reduce((s, c) => s + c.quota, 0);
  if (sum !== total) {
    cats[cats.length - 1].quota = Math.max(
      1,
      cats[cats.length - 1].quota + (total - sum)
    );
  }
  return cats;
}

/**
 * Generate kategori + kursi berwarna per zona.
 * categories?: [{ code, name, priceIdr, quota, colorHex }]
 * replace?: hapus denah lama dulu (regenerate)
 */
async function seedEventSeats(
  eventId,
  { priceIdr, quotaTotal, categories, replace = false }
) {
  let cats =
    Array.isArray(categories) && categories.length
      ? categories
      : buildDefaultCategories(priceIdr, quotaTotal);

  const sumQ = cats.reduce((s, c) => s + Number(c.quota || 0), 0);
  if (sumQ < 1) {
    cats = buildDefaultCategories(priceIdr, quotaTotal);
  }

  if (replace) {
    try {
      await query(`DELETE FROM seats WHERE event_id = $1`, [eventId]);
    } catch {
      /* */
    }
    try {
      await query(`DELETE FROM seat_categories WHERE event_id = $1`, [eventId]);
    } catch {
      /* */
    }
  }

  const insCat = `INSERT INTO seat_categories (event_id, code, name, price_idr, quota, color_hex)
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (event_id, code) DO UPDATE SET
      name = EXCLUDED.name, price_idr = EXCLUDED.price_idr,
      quota = EXCLUDED.quota, color_hex = EXCLUDED.color_hex`;
  const insSeat = `INSERT INTO seats (
      event_id, seat_code, category, category_name, row_label, seat_number,
      section, price_idr, color_hex, pos_x, pos_y
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (event_id, seat_code) DO NOTHING`;

  let totalSeats = 0;
  let zoneOffsetY = 0;
  for (const c of cats) {
    const code = String(c.code || "REG").toUpperCase().slice(0, 12);
    const q = Math.max(1, Math.min(Number(c.quota) || 1, 2000));
    const price = Number(c.priceIdr ?? priceIdr) || 0;
    const color = c.colorHex || c.color || "#94A3B8";
    const name = c.name || code;
    await query(insCat, [eventId, code, name, price, q, color]);

    const perRow = 20;
    for (let i = 1; i <= q; i++) {
      const rowNum = Math.ceil(i / perRow);
      const seatNum = ((i - 1) % perRow) + 1;
      const rowLabel = `${code}${rowNum}`;
      const seatCode = `${code}-${String(i).padStart(3, "0")}`;
      const posX = seatNum * 18;
      const posY = zoneOffsetY + (rowNum - 1) * 28;
      await query(insSeat, [
        eventId,
        seatCode,
        code,
        name,
        rowLabel,
        seatNum,
        `${name} section`,
        price,
        color,
        posX,
        posY,
      ]);
      totalSeats += 1;
    }
    zoneOffsetY += Math.ceil(q / perRow) * 28 + 24;
  }
  return totalSeats;
}

async function listRecentOrders(limit = 50) {
  const { rows } = await query(
    `SELECT o.order_id, o.event_id, e.title, o.qty, o.amount_idr, o.status,
            o.buyer_email, o.buyer_name, o.seat_codes, o.paid_at, o.created_at
     FROM orders o
     LEFT JOIN events e ON e.event_id = o.event_id
     ORDER BY o.created_at DESC
     LIMIT $1`,
    [Math.min(Number(limit) || 50, 200)]
  );
  return rows;
}

async function countOrdersByEvent(eventId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n, COALESCE(SUM(qty),0)::int AS tickets
     FROM orders WHERE event_id = $1 AND status = 'CONFIRMED'`,
    [eventId]
  );
  return rows[0];
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

/** PENDING_PAYMENT lebih tua dari ttlMin menit */
async function listExpiredPending(ttlMin = 15) {
  const { rows } = await query(
    `SELECT order_id, event_id, qty, seat_codes, status, created_at
     FROM orders
     WHERE status = 'PENDING_PAYMENT'
       AND created_at < now() - ($1::text || ' minutes')::interval
     ORDER BY created_at
     LIMIT 100`,
    [String(ttlMin)]
  );
  return rows;
}

/** Set EXPIRED hanya jika masih PENDING_PAYMENT. return true jika di-update. */
async function expirePendingOrder(orderId) {
  const { rowCount } = await query(
    `UPDATE orders SET status = 'EXPIRED'
     WHERE order_id = $1 AND status = 'PENDING_PAYMENT'`,
    [orderId]
  );
  return rowCount > 0;
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
  ensureEventColumns,
  getEvent,
  listSeats,
  listCategories,
  listEvents,
  listAllEvents,
  createEvent,
  updateEvent,
  setEventPoster,
  syncEventSeatPrices,
  deleteEvent,
  seedEventSeats,
  listRecentOrders,
  countOrdersByEvent,
  insertOrder,
  getOrder,
  getOrderByPaymentId,
  markOrderPaid,
  markOrderFailed,
  listExpiredPending,
  expirePendingOrder,
  audit,
  countSold,
};
