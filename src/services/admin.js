const db = require("../db");
const { invalidateEventCache } = require("./eventCache");
const { resetQuotaCounters, ensureQuotaInitialized } = require("./quota");
const { redis, keys } = require("../redis");
const { savePosterInput } = require("./poster");

function bad(msg, status = 400) {
  const e = new Error(msg);
  e.status = status;
  return e;
}

function parseDate(v, field) {
  if (v == null || v === "") return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw bad(`${field} tanggal tidak valid`);
  return d.toISOString();
}

/**
 * Admin: buat konser + denah kursi default + init kuota Redis
 */
async function adminCreateEvent(body) {
  const title = String(body?.title || "").trim();
  const artist = String(body?.artist || "").trim();
  const venue = String(body?.venue || "").trim();
  if (!title || title.length < 2) throw bad("title wajib (min 2 karakter)");
  if (!artist) throw bad("artist wajib");
  if (!venue) throw bad("venue wajib");

  const quotaTotal = Number(body?.quotaTotal ?? body?.quota_total);
  if (!Number.isInteger(quotaTotal) || quotaTotal < 1 || quotaTotal > 5000) {
    throw bad("quotaTotal harus bilangan 1–5000");
  }
  const priceIdr = Number(body?.priceIdr ?? body?.price_idr);
  if (!Number.isFinite(priceIdr) || priceIdr < 0) {
    throw bad("priceIdr tidak valid");
  }

  const startsAt = parseDate(body?.startsAt || body?.starts_at, "startsAt");
  if (!startsAt) throw bad("startsAt wajib (ISO date)");
  const salesOpensAt =
    parseDate(body?.salesOpensAt || body?.sales_opens_at, "salesOpensAt") ||
    startsAt;

  const status = String(body?.status || "PUBLISHED").toUpperCase();
  if (!["PUBLISHED", "DRAFT", "CLOSED"].includes(status)) {
    throw bad("status harus PUBLISHED | DRAFT | CLOSED");
  }

  // poster: data-URL base64 / path / URL — simpan setelah dapat eventId
  let posterPending = body?.poster || body?.posterUrl || body?.poster_url || null;

  const row = await db.createEvent({
    title,
    artist,
    venue,
    startsAt,
    salesOpensAt,
    salesClosesAt: parseDate(
      body?.salesClosesAt || body?.sales_closes_at,
      "salesClosesAt"
    ),
    quotaTotal,
    priceIdr,
    status,
    city: body?.city,
    country: body?.country,
    description: body?.description,
    gateOpen: body?.gateOpen || body?.gate_open,
    ageRating: body?.ageRating || body?.age_rating,
    eventCode: body?.eventCode || body?.event_code,
    posterUrl: null,
  });

  const eventId = row.event_id;
  // update event_code default
  if (!row.event_code) {
    await db.query(
      `UPDATE events SET event_code = $2 WHERE event_id = $1`,
      [eventId, `EVT${String(eventId).padStart(3, "0")}`]
    );
  }

  let posterUrl = null;
  if (posterPending) {
    posterUrl = savePosterInput(posterPending, eventId);
    await db.setEventPoster(eventId, posterUrl);
  }

  const genSeats = body?.generateSeats !== false;
  let seatsCreated = 0;
  if (genSeats) {
    seatsCreated = await db.seedEventSeats(eventId, {
      priceIdr,
      quotaTotal,
      categories: body?.categories,
    });
  }

  await ensureQuotaInitialized(eventId, quotaTotal);
  await resetQuotaCounters(eventId, quotaTotal);
  await invalidateEventCache(eventId);

  await db.audit(null, eventId, "ADMIN_EVENT_CREATED", {
    title,
    quotaTotal,
    seatsCreated,
  });

  return {
    eventId,
    title: row.title,
    artist: row.artist,
    venue: row.venue,
    quotaTotal: row.quota_total,
    priceIdr: Number(row.price_idr),
    status: row.status,
    startsAt: row.starts_at,
    posterUrl,
    seatsCreated,
    sisa: quotaTotal,
  };
}

async function adminUpdateEvent(eventId, body) {
  const id = Number(eventId);
  if (!Number.isInteger(id) || id < 1) throw bad("event id tidak valid");

  const patch = { ...body };
  if (body?.startsAt || body?.starts_at) {
    patch.startsAt = parseDate(body.startsAt || body.starts_at, "startsAt");
  }
  if (body?.salesOpensAt || body?.sales_opens_at) {
    patch.salesOpensAt = parseDate(
      body.salesOpensAt || body.sales_opens_at,
      "salesOpensAt"
    );
  }
  if (body?.quotaTotal != null || body?.quota_total != null) {
    const q = Number(body.quotaTotal ?? body.quota_total);
    if (!Number.isInteger(q) || q < 1 || q > 5000) {
      throw bad("quotaTotal 1–5000");
    }
    patch.quotaTotal = q;
  }
  if (body?.priceIdr != null || body?.price_idr != null) {
    patch.priceIdr = Number(body.priceIdr ?? body.price_idr);
  }
  if (body?.status) {
    const st = String(body.status).toUpperCase();
    if (!["PUBLISHED", "DRAFT", "CLOSED"].includes(st)) {
      throw bad("status tidak valid");
    }
    patch.status = st;
  }
  if (body?.poster != null || body?.posterUrl != null || body?.poster_url != null) {
    const raw = body.poster ?? body.posterUrl ?? body.poster_url;
    patch.posterUrl = savePosterInput(raw, id);
  }

  const before = await db.getEvent(id);
  if (!before) throw bad("event tidak ditemukan", 404);
  const prevQuota = Number(before.quota_total);
  const prevPrice = Number(before.price_idr);

  const row = await db.updateEvent(id, patch);
  if (!row) throw bad("event tidak ditemukan", 404);

  // harga di kartu user = min kategori/kursi — harus ikut di-update
  if (patch.priceIdr != null && Number(patch.priceIdr) !== prevPrice) {
    await db.syncEventSeatPrices(id, patch.priceIdr, prevPrice);
  }

  // reset Redis hanya jika kuota total benar-benar berubah
  if (patch.quotaTotal != null && Number(patch.quotaTotal) !== prevQuota) {
    await resetQuotaCounters(id, patch.quotaTotal);
  }
  await invalidateEventCache(id);
  const auditPatch = { ...patch };
  if (auditPatch.poster || auditPatch.posterUrl) {
    auditPatch.poster = "[updated]";
    delete auditPatch.posterUrl;
  }
  await db.audit(null, id, "ADMIN_EVENT_UPDATED", auditPatch);

  return {
    eventId: row.event_id,
    title: row.title,
    artist: row.artist,
    venue: row.venue,
    quotaTotal: row.quota_total,
    priceIdr: Number(row.price_idr),
    status: row.status,
    startsAt: row.starts_at,
    posterUrl: row.poster_url || null,
  };
}

async function adminListEvents() {
  const rows = await db.listAllEvents();
  const items = [];
  for (const r of rows) {
    const snap = await redis
      .mget(keys.quota(r.event_id), keys.sold(r.event_id))
      .catch(() => [null, null]);
    const sisa = snap[0] == null ? null : Number(snap[0]);
    const sold = snap[1] == null ? 0 : Number(snap[1]);
    const ord = await db.countOrdersByEvent(r.event_id);
    items.push({
      eventId: r.event_id,
      eventCode: r.event_code,
      title: r.title,
      artist: r.artist,
      venue: r.venue,
      startsAt: r.starts_at,
      salesOpensAt: r.sales_opens_at,
      quotaTotal: r.quota_total,
      priceIdr: Number(r.price_idr),
      status: r.status,
      city: r.city,
      country: r.country,
      description: r.description,
      posterUrl: r.poster_url || null,
      sisa,
      sold,
      ordersConfirmed: ord.n,
      ticketsSold: ord.tickets,
      createdAt: r.created_at,
    });
  }
  return { items };
}

async function adminListOrders(limit) {
  const rows = await db.listRecentOrders(limit);
  return {
    items: rows.map((r) => ({
      orderId: r.order_id,
      eventId: r.event_id,
      title: r.title,
      qty: r.qty,
      amountIdr: Number(r.amount_idr),
      status: r.status,
      buyerEmail: r.buyer_email,
      buyerName: r.buyer_name,
      seatCodes: r.seat_codes
        ? String(r.seat_codes)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      paidAt: r.paid_at,
      createdAt: r.created_at,
    })),
  };
}

async function adminResetQuota(eventId) {
  const id = Number(eventId);
  const ev = await db.getEvent(id);
  if (!ev) throw bad("event tidak ditemukan", 404);
  const snap = await resetQuotaCounters(id, ev.quota_total);
  await invalidateEventCache(id);
  return {
    ok: true,
    eventId: id,
    quotaTotal: ev.quota_total,
    ...snap,
  };
}

/**
 * Regenerasi denah multi-zona (VIP/FLOOR/GOLD/SILVER/BRONZE) dari kuota+harga event.
 * Menghapus kursi & kategori lama event tersebut.
 */
async function adminRegenerateSeats(eventId) {
  const id = Number(eventId);
  if (!Number.isInteger(id) || id < 1) throw bad("event id tidak valid");
  const ev = await db.getEvent(id);
  if (!ev) throw bad("event tidak ditemukan", 404);

  const seatsCreated = await db.seedEventSeats(id, {
    priceIdr: Number(ev.price_idr),
    quotaTotal: Number(ev.quota_total),
    replace: true,
  });

  await resetQuotaCounters(id, ev.quota_total);
  await invalidateEventCache(id);
  await db.audit(null, id, "ADMIN_SEATS_REGENERATED", {
    seatsCreated,
    quotaTotal: ev.quota_total,
  });

  return {
    ok: true,
    eventId: id,
    seatsCreated,
    quotaTotal: ev.quota_total,
    sisa: ev.quota_total,
  };
}

async function adminDeleteEvent(eventId) {
  const id = Number(eventId);
  if (!Number.isInteger(id) || id < 1) throw bad("event id tidak valid");

  const removed = await db.deleteEvent(id);
  if (!removed) throw bad("event tidak ditemukan", 404);

  // bersihkan Redis kuota/cache
  try {
    await redis.del(
      keys.quota(id),
      keys.sold(id),
      keys.seatsSold(id),
      keys.eventCache(id)
    );
  } catch {
    /* */
  }
  await invalidateEventCache(id);

  // hapus file poster upload lokal (jika ada)
  if (removed.posterUrl && String(removed.posterUrl).startsWith("/posters/uploads/")) {
    try {
      const fs = require("fs");
      const path = require("path");
      const full = path.join(
        __dirname,
        "..",
        "..",
        "public",
        removed.posterUrl.replace(/^\//, "").replace(/\//g, path.sep)
      );
      if (fs.existsSync(full)) fs.unlinkSync(full);
    } catch {
      /* ignore */
    }
  }

  await db.audit(null, id, "ADMIN_EVENT_DELETED", { title: removed.title });

  return {
    ok: true,
    eventId: id,
    title: removed.title,
  };
}

module.exports = {
  adminCreateEvent,
  adminUpdateEvent,
  adminDeleteEvent,
  adminListEvents,
  adminListOrders,
  adminResetQuota,
  adminRegenerateSeats,
};
