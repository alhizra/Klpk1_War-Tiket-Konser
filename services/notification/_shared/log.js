function createLogger(service) {
  return function log(level, msg, extra = {}) {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        service,
        level,
        msg,
        ...extra,
      })
    );
  };
}

function requestIdMiddleware(req, res, next) {
  const crypto = require("node:crypto");
  req.rid = req.headers["x-request-id"] || crypto.randomUUID();
  res.setHeader("x-request-id", req.rid);
  next();
}

async function panggilTahan(url, opts = {}) {
  const retries = opts.retries ?? 2;
  const timeoutMs = opts.timeoutMs ?? 2000;
  const method = opts.method || "GET";
  const headers = opts.headers || {};
  const body = opts.body;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch(url, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (r.ok) {
        const text = await r.text();
        return { ok: true, status: r.status, data: text ? JSON.parse(text) : null };
      }
      if (r.status >= 400 && r.status < 500) {
        const text = await r.text();
        let data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = { error: text };
        }
        return { ok: false, status: r.status, data };
      }
    } catch {
      /* retry */
    }
    if (attempt < retries) {
      await new Promise((s) => setTimeout(s, 300 * (attempt + 1)));
    }
  }
  return { ok: false, status: 502, data: { error: "upstream tidak tersedia" } };
}

module.exports = { createLogger, requestIdMiddleware, panggilTahan };
