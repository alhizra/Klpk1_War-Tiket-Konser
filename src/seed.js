/**
 * Seed runtime kuota ke Redis dari Postgres (atau DEFAULT_QUOTA).
 * Dipanggil saat server start dan lewat: npm run seed
 */
const config = require("./config");
const db = require("./db");
const { redis, keys } = require("./redis");

/**
 * Seed kuota runtime.
 * - Default (API start): sisa = quota_total - sold_db (aman production-ish)
 * - FORCE_FULL_QUOTA=1 atau argv --full: sisa = quota_total, sold redis = 0 (untuk ulang load test)
 */
async function seedQuota(eventId = config.defaultEventId, opts = {}) {
  const forceFull =
    opts.full === true ||
    process.env.FORCE_FULL_QUOTA === "1" ||
    process.argv.includes("--full");

  const event = await db.getEvent(eventId);
  const quota = event ? event.quota_total : config.defaultQuota;
  const soldDb = event ? await db.countSold(eventId) : 0;

  let sisa;
  let soldRedis;
  if (forceFull) {
    sisa = quota;
    soldRedis = 0;
  } else {
    sisa = Math.max(0, quota - soldDb);
    soldRedis = soldDb;
  }

  await redis.set(keys.quota(eventId), String(sisa));
  await redis.set(keys.sold(eventId), String(soldRedis));
  await redis.del(keys.eventCache(eventId));

  console.log(
    `[seed] event=${eventId} quota_total=${quota} sold_db=${soldDb} sisa_redis=${sisa} full=${forceFull}`
  );
  return { eventId, quota, sold: soldRedis, sisa, soldDb };
}

async function main() {
  try {
    await seedQuota(1);
    process.exit(0);
  } catch (e) {
    console.error("[seed] gagal:", e.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { seedQuota };
