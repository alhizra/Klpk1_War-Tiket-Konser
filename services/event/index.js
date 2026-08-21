/**
 * event-service — catalog konser, venue, kategori, kuota catalog.
 * Port 3001. Data milik sendiri (SQLite). Tidak menyimpan status kursi terjual.
 */
const path = require("path");
const express = require("express");
const { DatabaseSync } = require("node:sqlite");
const {
  createLogger,
  requestIdMiddleware,
} = require("./_shared/log");
const seed = require("./seed-data");

const PORT = Number(process.env.PORT || 3001);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "event.db");
const log = createLogger("event");

const app = express();
app.use(express.json());
app.use(requestIdMiddleware);

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    event_id INTEGER PRIMARY KEY,
    event_code TEXT,
    title TEXT NOT NULL,
    artist TEXT,
    venue TEXT,
    city TEXT,
    country TEXT,
    starts_at TEXT,
    quota_total INTEGER NOT NULL,
    price_idr INTEGER NOT NULL,
    status TEXT DEFAULT 'PUBLISHED'
  );
  CREATE TABLE IF NOT EXISTS categories (
    event_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    name TEXT,
    price_idr INTEGER,
    quota INTEGER,
    PRIMARY KEY (event_id, code)
  );
`);

function seedIfEmpty() {
  const n = db.prepare("SELECT COUNT(*) AS c FROM events").get().c;
  if (n > 0) return;
  const insE = db.prepare(
    `INSERT INTO events (event_id, event_code, title, artist, venue, city, country, starts_at, quota_total, price_idr)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insC = db.prepare(
    `INSERT INTO categories (event_id, code, name, price_idr, quota) VALUES (?, ?, ?, ?, ?)`
  );
  for (const e of seed) {
    insE.run(
      e.eventId,
      e.eventCode,
      e.title,
      e.artist,
      e.venue,
      e.city,
      e.country,
      e.startsAt,
      e.quotaTotal,
      e.priceIdr
    );
    for (const c of e.categories || []) {
      insC.run(e.eventId, c.code, c.name, c.priceIdr, c.quota);
    }
  }
  log("info", "seed catalog", { events: seed.length });
}
seedIfEmpty();

function mapEvent(row) {
  if (!row) return null;
  const cats = db
    .prepare(
      "SELECT code, name, price_idr AS priceIdr, quota FROM categories WHERE event_id = ?"
    )
    .all(row.event_id);
  return {
    eventId: row.event_id,
    eventCode: row.event_code,
    title: row.title,
    artist: row.artist,
    venue: row.venue,
    city: row.city,
    country: row.country,
    startsAt: row.starts_at,
    quotaTotal: row.quota_total,
    priceIdr: row.price_idr,
    status: row.status,
    categories: cats,
  };
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "event" });
});

app.get("/v1/events", (req, res) => {
  const size = Math.min(Number(req.query.size) || 20, 50);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const rows = db
    .prepare("SELECT * FROM events WHERE status = 'PUBLISHED' ORDER BY event_id")
    .all();
  const start = (page - 1) * size;
  const items = rows.slice(start, start + size).map(mapEvent);
  log("info", "list events", { rid: req.rid, page, size, n: items.length });
  res.json({ page, size, items });
});

app.get("/v1/events/:id", (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM events WHERE event_id = ?").get(id);
  if (!row) return res.status(404).json({ error: "event tidak ditemukan" });
  log("info", "get event", { rid: req.rid, eventId: id });
  res.json(mapEvent(row));
});

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    log("info", "listening", { port: PORT });
  });
}

module.exports = app;
