const Redis = require("ioredis");
const config = require("./config");

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on("error", (err) => {
  console.error("[redis]", err.message);
});

/** Key conventions — lihat docs/DATA.md */
const keys = {
  quota: (eventId) => `quota:event:${eventId}`,
  sold: (eventId) => `sold:event:${eventId}`,
  seatsSold: (eventId) => `seats:sold:${eventId}`,
  eventCache: (eventId) => `cache:event:${eventId}`,
  lockCache: (eventId) => `lock:cache:event:${eventId}`,
  queueEticket: "queue:eticket",
  rateLimit: (ip, window) => `rl:${ip}:${window}`,
};

module.exports = { redis, keys };
