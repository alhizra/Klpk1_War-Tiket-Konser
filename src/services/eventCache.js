const config = require("../config");
const db = require("../db");
const { redis, keys } = require("../redis");
const { getQuotaSnapshot } = require("./quota");

/**
 * Cache-aside untuk catalog event (AMAN di-cache).
 * Sisa kursi SELALU diambil live dari Redis — tidak di-cache (anti-oversell).
 */
function ttlWithJitter() {
  return config.cacheTtlSec + Math.floor(Math.random() * config.cacheJitterSec);
}

async function getEventView(eventId) {
  const cacheKey = keys.eventCache(eventId);
  let catalog = null;
  let from = "db";

  const cached = await redis.get(cacheKey);
  if (cached) {
    catalog = JSON.parse(cached);
    from = "cache";
  } else {
    // single-flight lock sederhana anti-stampede
    const lockKey = keys.lockCache(eventId);
    const gotLock = await redis.set(lockKey, "1", "EX", 5, "NX");
    if (!gotLock) {
      await new Promise((r) => setTimeout(r, 40));
      const again = await redis.get(cacheKey);
      if (again) {
        catalog = JSON.parse(again);
        from = "cache";
      }
    }
    if (!catalog) {
      const row = await db.getEvent(eventId);
      if (!row) return null;
      let description =
        "K-pop war ticket — pilih seat di denah, kuota dipotong atomik di backend.";
      const seatRows = await db.listSeats(eventId);
      const catRows = await db.listCategories(eventId);
      let meta = {};
      try {
        const metaRaw = await redis.get(`event:meta:${eventId}`);
        if (metaRaw) meta = JSON.parse(metaRaw);
      } catch {
        /* */
      }
      if (meta.description) description = meta.description;
      catalog = {
        eventId: row.event_id,
        title: row.title,
        artist: row.artist,
        venue: row.venue,
        startsAt: row.starts_at,
        salesOpensAt: row.sales_opens_at,
        quotaTotal: row.quota_total,
        priceIdr: Number(row.price_idr),
        status: row.status,
        description,
        city: meta.city || null,
        country: meta.country || "South Korea",
        gateOpen: meta.gate_open || null,
        ageRating: meta.age_rating || null,
        terms: meta.terms || [],
        categories: (catRows.length
          ? catRows
          : meta.categories || []
        ).map((c) => ({
          code: c.code,
          name: c.name,
          priceIdr: Number(c.price_idr ?? c.priceIdr),
          quota: Number(c.quota),
          color: c.color_hex || c.color || null,
        })),
        // denah real dari CSV/DB; kosong = web pakai denah bawaan
        seats: seatRows.map((s) => ({
          code: s.seat_code,
          category: s.category,
          categoryName: s.category_name,
          row: s.row_label,
          number: s.seat_number,
          section: s.section,
          priceIdr:
            s.price_idr != null ? Number(s.price_idr) : Number(row.price_idr),
          color: s.color_hex,
          posX: s.pos_x,
          posY: s.pos_y,
        })),
      };
      await redis.set(cacheKey, JSON.stringify(catalog), "EX", ttlWithJitter());
      if (gotLock) await redis.del(lockKey);
      from = "db";
    }
  }

  const snap = await getQuotaSnapshot(eventId);
  const sisa =
    snap.sisa === null || Number.isNaN(snap.sisa)
      ? catalog.quotaTotal
      : snap.sisa;
  const terjual =
    snap.terjual === null || Number.isNaN(snap.terjual)
      ? Math.max(0, catalog.quotaTotal - sisa)
      : snap.terjual;

  const soldSeats = await redis.smembers(`seats:sold:${eventId}`);

  return {
    ...catalog,
    sisa,
    terjual,
    soldSeats,
    from,
  };
}

async function invalidateEventCache(eventId) {
  await redis.del(keys.eventCache(eventId));
}

module.exports = { getEventView, invalidateEventCache };
