const path = require("path");
try {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
} catch {
  /* dotenv opsional */
}

module.exports = {
  port: Number(process.env.PORT || 3000),
  instanceId: process.env.HOSTNAME || require("os").hostname(),
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgres://wtk:wtk@localhost:5432/wtk",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  // Kuota default event 1 (sinkron seed SQL)
  defaultEventId: 1,
  defaultQuota: Number(process.env.DEFAULT_QUOTA || 500),
  // Cache-aside TTL (detik) + jitter — JANGAN cache sisa kursi
  cacheTtlSec: Number(process.env.CACHE_TTL_SEC || 60),
  cacheJitterSec: Number(process.env.CACHE_JITTER_SEC || 15),
  // Rate limit: 60 req / 60s per IP (aturan baseurl P4)
  rateLimit: Number(process.env.RATE_LIMIT || 60),
  rateWindowSec: Number(process.env.RATE_WINDOW_SEC || 60),
  // Hold/order max qty
  maxQtyPerOrder: 4,
  // Panel admin lab (header x-admin-token)
  adminToken: process.env.ADMIN_TOKEN || "admin-wtk",
};
