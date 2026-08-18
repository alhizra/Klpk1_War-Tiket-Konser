/**
 * Seed runtime kuota ke Redis dari Postgres (atau DEFAULT_QUOTA).
 * Dipanggil saat server start dan lewat: npm run seed
 */
const config = require("./config");
const db = require("./db");
const { redis, keys } = require("./redis");

async function seedQuota(eventId = config.defaultEventId) {
  const event = await db.getEvent(eventId);
  const quota = event ? event.quota_total : config.defaultQuota;
  const sold = event ? await db.countSold(eventId) : 0;
  const sisa = Math.max(0, quota - sold);

  await redis.set(keys.quota(eventId), String(sisa));
  await redis.set(keys.sold(eventId), String(sold));
  await redis.del(keys.eventCache(eventId));

  console.log(
    `[seed] event=${eventId} quota_total=${quota} sold_db=${sold} sisa_redis=${sisa}`
  );
  return { eventId, quota, sold, sisa };
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
