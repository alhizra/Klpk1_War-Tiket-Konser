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

/**
 * Claim seat codes atomik (SADD return 1 = baru).
 * KEYS[1]=seats:sold set  ARGV = seat codes
 * Return: 1 ok | 0 conflict (sudah di-rollback partial adds)
 */
const CLAIM_SEATS_LUA = `
local setkey = KEYS[1]
local added = {}
for i = 1, #ARGV do
  local r = redis.call('SADD', setkey, ARGV[i])
  if r == 0 then
    for j = 1, #added do
      redis.call('SREM', setkey, added[j])
    end
    return {0, ARGV[i]}
  end
  table.insert(added, ARGV[i])
end
return {1, ''}
`;

async function reserveSeats(eventId, qty) {
  const qKey = keys.quota(eventId);
  const sKey = keys.sold(eventId);
  const result = await redis.eval(RESERVE_LUA, 2, qKey, sKey, String(qty));
  const ok = Number(result[0]) === 1;
  const sisa = Number(result[1]);
  return { ok, sisa };
}

/** Lepas kuota (batal order / expire unpaid) */
async function releaseSeats(eventId, qty) {
  const q = Number(qty) || 0;
  if (q < 1) return;
  await redis.incrby(keys.quota(eventId), q);
  await redis.decrby(keys.sold(eventId), q);
}

/**
 * Claim label kursi spesifik. Gagal → { ok:false, conflict }.
 * Harus dipanggil SETELAH reserveSeats qty berhasil.
 */
async function claimSeatCodes(eventId, seatCodes) {
  const seats = (seatCodes || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
  if (!seats.length) return { ok: true };
  const setKey = keys.seatsSold(eventId);
  const result = await redis.eval(CLAIM_SEATS_LUA, 1, setKey, ...seats);
  const ok = Number(result[0]) === 1;
  return { ok, conflict: ok ? null : String(result[1] || "") };
}

async function releaseSeatCodes(eventId, seatCodes) {
  const seats = (seatCodes || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
  if (!seats.length) return;
  await redis.srem(keys.seatsSold(eventId), ...seats);
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
  await redis.del(keys.seatsSold(eventId));
  return getQuotaSnapshot(eventId);
}

module.exports = {
  reserveSeats,
  releaseSeats,
  claimSeatCodes,
  releaseSeatCodes,
  getQuotaSnapshot,
  ensureQuotaInitialized,
  resetQuotaCounters,
};
