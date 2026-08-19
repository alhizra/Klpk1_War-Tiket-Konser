const { redis, keys } = require("../redis");

/**
 * Reserve atomik dalam 1 round-trip Redis (Lua).
 * Mencegah sisa negatif bila client disconnect antara DECRBY dan INCRBY rollback.
 */
const RESERVE_LUA = `
local q = KEYS[1]
local s = KEYS[2]
local qty = tonumber(ARGV[1])
local sisa = redis.call('DECRBY', q, qty)
if sisa < 0 then
  redis.call('INCRBY', q, qty)
  local cur = redis.call('GET', q)
  return {0, tonumber(cur) or 0}
end
redis.call('INCRBY', s, qty)
return {1, sisa}
`;

async function reserveSeats(eventId, qty) {
  const qKey = keys.quota(eventId);
  const sKey = keys.sold(eventId);
  const result = await redis.eval(RESERVE_LUA, 2, qKey, sKey, String(qty));
  const ok = Number(result[0]) === 1;
  const sisa = Number(result[1]);
  return { ok, sisa };
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

/** Reset counter Redis ke quota penuh (uji beban antar run). */
async function resetQuotaCounters(eventId, quotaTotal) {
  await redis.set(keys.quota(eventId), String(quotaTotal));
  await redis.set(keys.sold(eventId), "0");
  await redis.del(keys.eventCache(eventId));
  await redis.del(`seats:sold:${eventId}`);
  return getQuotaSnapshot(eventId);
}

module.exports = {
  reserveSeats,
  getQuotaSnapshot,
  ensureQuotaInitialized,
  resetQuotaCounters,
};
