/**
 * Load data real/manual dari folder data/
 * - data/events.manual.json
 * - data/seats.manual.csv  (generate: node data/generate-real-seats.js)
 *
 * Usage: npm run data:manual
 */
const fs = require("fs");
const path = require("path");
const db = require("./db");
const { redis, keys } = require("./redis");

const dataDir = path.join(__dirname, "..", "data");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
}

/** CSV parser sederhana yang hormati tanda kutip */
function parseCsv(text) {
  const rows = [];
  let i = 0;
  const s = text.replace(/^\uFEFF/, "");
  while (i < s.length) {
    const row = [];
    while (i < s.length) {
      if (s[i] === '"') {
        i += 1;
        let cell = "";
        while (i < s.length) {
          if (s[i] === '"' && s[i + 1] === '"') {
            cell += '"';
            i += 2;
          } else if (s[i] === '"') {
            i += 1;
            break;
          } else {
            cell += s[i];
            i += 1;
          }
        }
        row.push(cell);
        if (s[i] === ",") i += 1;
        else if (s[i] === "\r" || s[i] === "\n" || i >= s.length) {
          if (s[i] === "\r") i += 1;
          if (s[i] === "\n") i += 1;
          break;
        }
      } else {
        let cell = "";
        while (i < s.length && s[i] !== "," && s[i] !== "\n" && s[i] !== "\r") {
          cell += s[i];
          i += 1;
        }
        row.push(cell.trim());
        if (s[i] === ",") i += 1;
        else {
          if (s[i] === "\r") i += 1;
          if (s[i] === "\n") i += 1;
          break;
        }
      }
    }
    if (row.length && row.some((c) => c !== "")) rows.push(row);
  }
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cols) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] != null ? cols[idx] : "";
    });
    return obj;
  });
}

function readCsv(name) {
  const p = path.join(dataDir, name);
  return parseCsv(fs.readFileSync(p, "utf8"));
}

async function ensureSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS seats (
      event_id        INT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
      seat_code       VARCHAR(20) NOT NULL,
      category        VARCHAR(40) NOT NULL DEFAULT 'REG',
      category_name   VARCHAR(120),
      row_label       VARCHAR(10) NOT NULL,
      seat_number     INT NOT NULL,
      section         VARCHAR(80),
      price_idr       BIGINT,
      color_hex       VARCHAR(7),
      pos_x           INT,
      pos_y           INT,
      PRIMARY KEY (event_id, seat_code)
    )
  `);
  // kolom tambahan jika tabel lama sudah ada
  const alters = [
    `ALTER TABLE seats ADD COLUMN IF NOT EXISTS category_name VARCHAR(120)`,
    `ALTER TABLE seats ADD COLUMN IF NOT EXISTS section VARCHAR(80)`,
    `ALTER TABLE seats ADD COLUMN IF NOT EXISTS color_hex VARCHAR(7)`,
    `ALTER TABLE seats ADD COLUMN IF NOT EXISTS pos_x INT`,
    `ALTER TABLE seats ADD COLUMN IF NOT EXISTS pos_y INT`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS city VARCHAR(80)`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS gate_open VARCHAR(40)`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS age_rating VARCHAR(80)`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS sales_closes_at TIMESTAMPTZ`,
  ];
  for (const sql of alters) {
    try {
      await db.query(sql);
    } catch {
      /* ignore older PG */
    }
  }
  await db.query(
    `CREATE TABLE IF NOT EXISTS seat_categories (
      event_id   INT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
      code       VARCHAR(20) NOT NULL,
      name       VARCHAR(120) NOT NULL,
      price_idr  BIGINT NOT NULL,
      quota      INT NOT NULL,
      color_hex  VARCHAR(7),
      PRIMARY KEY (event_id, code)
    )`
  );
}

async function upsertEvents(events) {
  for (const e of events) {
    await db.query(
      `INSERT INTO events (
         event_id, title, artist, venue, starts_at, sales_opens_at,
         quota_total, price_idr, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (event_id) DO UPDATE SET
         title = EXCLUDED.title,
         artist = EXCLUDED.artist,
         venue = EXCLUDED.venue,
         starts_at = EXCLUDED.starts_at,
         sales_opens_at = EXCLUDED.sales_opens_at,
         quota_total = EXCLUDED.quota_total,
         price_idr = EXCLUDED.price_idr,
         status = EXCLUDED.status`,
      [
        e.event_id,
        e.title,
        e.artist,
        e.venue,
        e.starts_at,
        e.sales_opens_at,
        Number(e.quota_total),
        Number(e.price_idr),
        e.status || "PUBLISHED",
      ]
    );

    // kolom extended (best-effort)
    try {
      await db.query(
        `UPDATE events SET
           description = $2,
           city = $3,
           gate_open = $4,
           age_rating = $5,
           ends_at = $6,
           sales_closes_at = $7
         WHERE event_id = $1`,
        [
          e.event_id,
          e.description || null,
          e.city || null,
          e.gate_open || null,
          e.age_rating || null,
          e.ends_at || null,
          e.sales_closes_at || null,
        ]
      );
    } catch {
      /* ok */
    }

    // meta JSON di Redis (terms, categories ringkas)
    await redis.set(
      `event:meta:${e.event_id}`,
      JSON.stringify({
        description: e.description,
        terms: e.terms || [],
        city: e.city,
        country: e.country || "South Korea",
        gate_open: e.gate_open,
        age_rating: e.age_rating,
        timezone: e.timezone || "Asia/Seoul",
        categories: e.categories || [],
      }),
      "EX",
      86400 * 7
    );

    // categories table
    if (Array.isArray(e.categories)) {
      for (const c of e.categories) {
        await db.query(
          `INSERT INTO seat_categories (event_id, code, name, price_idr, quota, color_hex)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (event_id, code) DO UPDATE SET
             name = EXCLUDED.name,
             price_idr = EXCLUDED.price_idr,
             quota = EXCLUDED.quota,
             color_hex = EXCLUDED.color_hex`,
          [
            e.event_id,
            c.code,
            c.name,
            Number(c.price_idr),
            Number(c.quota),
            c.color || null,
          ]
        );
      }
    }

    // kuota Redis full dari data real
    await redis.set(keys.quota(e.event_id), String(e.quota_total));
    await redis.set(keys.sold(e.event_id), "0");
    await redis.del(keys.eventCache(e.event_id));
    await redis.del(`seats:sold:${e.event_id}`);

    console.log(
      `[event] #${e.event_id} ${e.artist} @ ${e.city || e.venue} | quota=${e.quota_total}`
    );
  }
}

async function replaceSeats(rows) {
  // hapus seats event yang ada di CSV lalu insert ulang (data real bersih)
  const eventIds = [...new Set(rows.map((r) => Number(r.event_id)).filter(Boolean))];
  for (const id of eventIds) {
    await db.query(`DELETE FROM seats WHERE event_id = $1`, [id]);
  }

  let n = 0;
  for (const r of rows) {
    const eventId = Number(r.event_id);
    const code = String(r.seat_code || "").toUpperCase();
    if (!eventId || !code) continue;
    await db.query(
      `INSERT INTO seats (
         event_id, seat_code, category, category_name, row_label, seat_number,
         section, price_idr, color_hex, pos_x, pos_y
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        eventId,
        code,
        r.category || "REG",
        r.category_name || null,
        r.row_label || code[0],
        Number(r.seat_number) || 0,
        r.section || null,
        r.price_idr ? Number(r.price_idr) : null,
        r.color_hex || null,
        r.pos_x !== "" && r.pos_x != null ? Number(r.pos_x) : null,
        r.pos_y !== "" && r.pos_y != null ? Number(r.pos_y) : null,
      ]
    );
    n += 1;
  }
  console.log(`[seats] insert ${n} kursi real`);
}

async function main() {
  console.log("[load-manual] data dir:", dataDir);
  await db.query("SELECT 1");
  await redis.ping();
  await ensureSchema();

  const events = readJson("events.manual.json");
  const seatsPath = path.join(dataDir, "seats.manual.csv");
  let seats = fs.existsSync(seatsPath) ? readCsv("seats.manual.csv") : [];

  // generate denah hanya jika CSV belum menutupi semua event di JSON
  const eventIds = new Set(events.map((e) => Number(e.event_id)));
  const seatEventIds = new Set(
    seats.map((r) => Number(r.event_id)).filter(Boolean)
  );
  const missingSeatEvents = [...eventIds].filter((id) => !seatEventIds.has(id));
  const gen = path.join(dataDir, "generate-real-seats.js");
  if (missingSeatEvents.length && fs.existsSync(gen)) {
    console.log(
      "[load-manual] generate denah (CSV kurang event:",
      missingSeatEvents.join(","),
      ")"
    );
    require("child_process").execFileSync(process.execPath, [gen], {
      stdio: "inherit",
    });
    seats = readCsv("seats.manual.csv");
  } else {
    console.log(
      `[load-manual] pakai seats.manual.csv yang ada (${seats.length} baris, ${seatEventIds.size} event)`
    );
  }

  await upsertEvents(events);
  await replaceSeats(seats);

  for (const e of events) {
    const { rows } = await db.query(
      `SELECT category, COUNT(*)::int AS c FROM seats WHERE event_id = $1 GROUP BY category ORDER BY category`,
      [e.event_id]
    );
    const detail = rows.map((r) => `${r.category}=${r.c}`).join(", ");
    const total = rows.reduce((a, r) => a + r.c, 0);
    console.log(
      `[ok] event ${e.event_id}: ${total} seats (${detail}) | redis sisa=${e.quota_total}`
    );
    if (total !== Number(e.quota_total)) {
      console.warn(
        `  ⚠ seats (${total}) != quota_total (${e.quota_total}) — cek generate layout`
      );
    }
  }

  console.log("[load-manual] SELESAI. Restart API lalu buka http://localhost:3000/");
  await db.pool.end();
  redis.disconnect();
}

main().catch(async (e) => {
  console.error("[load-manual] GAGAL:", e.message);
  try {
    await db.pool.end();
  } catch {
    /* */
  }
  process.exit(1);
});
