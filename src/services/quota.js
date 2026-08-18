const { redis, keys } = require("../redis");

/**
 * Pengurangan kuota atomik anti-oversell.
 * DECRBY qty; jika sisa < 0 → rollback INCRBY dan tolak 409.
 * JANGAN baca-lalu-tulis (race condition multi-replika).
 */
async function reserveSeats(eventId, qty) {
  const qKey = keys.quota(eventId);
  const sKey = keys.sold(eventId);

  const sisa = await redis.decrby(qKey, qty);
  if (sisa < 0) {
    await redis.incrby(qKey, qty);
    const current = Number(await redis.get(qKey)) || 0;
    return { ok: false, sisa: current };
  }

  await redis.incrby(sKey, qty);
  return { ok: true, sisa };
}

async function getQuotaSnapshot(eventId) {
  const [sisaRaw, soldRaw] = await redis.mget(
    keys.quota(eventId),
    keys.sold(eventId)
  );
  const sisa = sisaRaw === null ? null : Number(sisaRaw);
  const sold = soldRaw === null ? 0 : Number(soldRaw);
  return { sisa, sold, terjual: sold };
}

async function ensureQuotaInitialized(eventId, fallbackQuota) {
  const exists = await redis.exists(keys.quota(eventId));
  if (!exists) {
    await redis.set(keys.quota(eventId), String(fallbackQuota));
    await redis.set(keys.sold(eventId), "0");
  }
}

module.exports = {
  reserveSeats,
  getQuotaSnapshot,
  ensureQuotaInitialized,
};
