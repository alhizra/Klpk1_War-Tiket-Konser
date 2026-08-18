const config = require("../config");
const { redis, keys } = require("../redis");

/**
 * Rate limit per IP (sliding window sederhana per bucket detik).
 * Header: X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After
 */
function rateLimit(options = {}) {
  const limit = options.limit ?? config.rateLimit;
  const windowSec = options.windowSec ?? config.rateWindowSec;

  return async function rateLimitMiddleware(req, res, next) {
    try {
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      const window = Math.floor(Date.now() / (windowSec * 1000));
      const key = keys.rateLimit(ip, window);
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSec);
      }
      const remaining = Math.max(0, limit - count);
      res.setHeader("X-RateLimit-Limit", String(limit));
      res.setHeader("X-RateLimit-Remaining", String(remaining));
      if (count > limit) {
        res.setHeader("Retry-After", String(windowSec));
        return res.status(429).json({
          error: "terlalu banyak permintaan, coba lagi nanti",
          limit,
          windowSec,
        });
      }
      return next();
    } catch (err) {
      // Jangan jatuhkan layanan jika Redis RL error — fail open + log
      console.error("[rateLimit]", err.message);
      return next();
    }
  };
}

module.exports = { rateLimit };
