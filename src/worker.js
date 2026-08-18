/**
 * Worker e-ticket — konsumsi antrean Redis (bisa di-scale terpisah).
 * Jalur request POST /orders tidak menunggu pengiriman email.
 */
const { redis, keys } = require("./redis");
const db = require("./db");

async function kirimETicket(job) {
  // Simulasi kerja berat (email/SMS provider)
  await new Promise((r) => setTimeout(r, 50));
  await db.audit(job.orderId, job.eventId, "ETICKET_SENT", {
    email: job.email,
    qty: job.qty,
  });
  console.log(`[worker] e-ticket sent order=${job.orderId} to ${job.email}`);
}

async function loop() {
  console.log("[worker] started, queue=", keys.queueEticket);
  // pastikan DB hidup
  for (let i = 0; i < 30; i++) {
    try {
      await db.query("SELECT 1");
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  while (true) {
    try {
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
