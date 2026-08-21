/**
 * Worker e-ticket — konsumsi antrean Redis (bisa di-scale terpisah).
 * Kirim email nyata via nodemailer (SMTP / Ethereal / file outbox).
 */
require("./config"); // load .env dulu
const { redis, keys } = require("./redis");
const db = require("./db");
const { sendETicket } = require("./services/mail");
const { expireStalePendingOrders } = require("./services/orders");

async function kirimETicket(job) {
  const result = await sendETicket(job);
  await db.audit(job.orderId, job.eventId, "ETICKET_SENT", {
    email: result.to || job.email,
    qty: job.qty,
    mode: result.mode,
    messageId: result.messageId || null,
    previewUrl: result.previewUrl || null,
    path: result.path || null,
  });
  console.log(
    `[worker] e-ticket sent order=${job.orderId} to=${result.to} mode=${result.mode}`
  );
  return result;
}

async function loop() {
  console.log("[worker] started, queue=", keys.queueEticket);
  for (let i = 0; i < 30; i++) {
    try {
      await db.query("SELECT 1");
      await db.ensureOrderColumns();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  let lastExpire = 0;
  while (true) {
    try {
      const now = Date.now();
      if (now - lastExpire > 30_000) {
        lastExpire = now;
        const n = await expireStalePendingOrders();
        if (n > 0) console.log(`[worker] expired ${n} pending order(s)`);
      }
      const result = await redis.brpop(keys.queueEticket, 5);
      if (!result) continue;
      const payload = result[1];
      const job = JSON.parse(payload);
      await kirimETicket(job);
    } catch (e) {
      console.error("[worker]", e.message);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

loop();
