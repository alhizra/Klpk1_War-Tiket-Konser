/**
 * E-ticket email
 *
 * Prioritas:
 * 1) SMTP_* di-set → kirim ke inbox sungguhan (Gmail/SendGrid/dll)
 * 2) MAIL_USE_ETHEREAL=1 → catcher uji (HANYA preview URL, BUKAN Gmail)
 * 3) default → simpan file outbox (bisa dibaca di web /api/mail/outbox)
 *
 * Selalu dual-write ke data/outbox-mail/ agar UI lab menampilkan e-ticket.
 */
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const OUTBOX_DIR = path.join(__dirname, "..", "..", "data", "outbox-mail");

let transporterPromise = null;

function ensureOutboxDir() {
  fs.mkdirSync(OUTBOX_DIR, { recursive: true });
}

async function getTransporter() {
  if (transporterPromise) return transporterPromise;
  transporterPromise = (async () => {
    const host = process.env.SMTP_HOST;
    if (host) {
      const t = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure:
          process.env.SMTP_SECURE === "1" ||
          Number(process.env.SMTP_PORT) === 465,
        auth:
          process.env.SMTP_USER
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS || "",
              }
            : undefined,
      });
      try {
        await t.verify();
        console.log(`[mail] SMTP ready host=${host} user=${process.env.SMTP_USER || "-"}`);
      } catch (e) {
        console.error(`[mail] SMTP verify gagal: ${e.message}`);
      }
      return { transport: t, mode: "smtp" };
    }
    if (process.env.MAIL_USE_ETHEREAL === "1") {
      try {
        const testAcc = await nodemailer.createTestAccount();
        const t = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: { user: testAcc.user, pass: testAcc.pass },
        });
        console.log(
          `[mail] Ethereal aktif (bukan inbox nyata). user=${testAcc.user}`
        );
        return { transport: t, mode: "ethereal", user: testAcc.user };
      } catch (e) {
        console.warn(`[mail] Ethereal gagal: ${e.message}`);
      }
    }
    console.log(
      "[mail] mode=file outbox — set SMTP_HOST untuk kirim ke Gmail/inbox nyata"
    );
    return { transport: null, mode: "file" };
  })();
  return transporterPromise;
}

function buildHtml(job) {
  const seats = (job.seatCodes || []).join(", ") || "—";
  return `<!DOCTYPE html>
<html><body style="font-family:sans-serif;background:#0f172a;color:#e2e8f0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#1e293b;border-radius:12px;padding:24px">
    <h1 style="color:#22c55e;margin:0 0 8px">E-Ticket WTK</h1>
    <p style="color:#94a3b8;margin:0 0 16px">War Tiket Konser — pembayaran terkonfirmasi</p>
    <table style="width:100%;font-size:14px;color:#e2e8f0">
      <tr><td style="color:#94a3b8">Order ID</td><td><strong>${job.orderId}</strong></td></tr>
      <tr><td style="color:#94a3b8">Event ID</td><td>${job.eventId}</td></tr>
      <tr><td style="color:#94a3b8">Judul</td><td>${job.title || "Konser"}</td></tr>
      <tr><td style="color:#94a3b8">Qty</td><td>${job.qty}</td></tr>
      <tr><td style="color:#94a3b8">Kursi</td><td>${seats}</td></tr>
      <tr><td style="color:#94a3b8">Total</td><td>Rp ${Number(job.amountIdr || 0).toLocaleString("id-ID")}</td></tr>
      <tr><td style="color:#94a3b8">Pembeli</td><td>${job.buyerName || "—"}</td></tr>
    </table>
    <p style="margin-top:20px;font-size:12px;color:#64748b">Tunjukkan Order ID di pintu masuk. Tiket non-refundable kecuali event dibatalkan.</p>
  </div>
</body></html>`;
}

function saveOutbox(record) {
  ensureOutboxDir();
  const safeId = String(record.orderId || record.paymentId || "x").replace(
    /[^\w-]/g,
    ""
  );
  const file = path.join(OUTBOX_DIR, `${safeId}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  return file;
}

async function sendETicket(job) {
  const to = job.email || `buyer-${String(job.orderId).slice(0, 8)}@example.com`;
  const from =
    process.env.MAIL_FROM ||
    (process.env.SMTP_USER
      ? `WTK Ticket <${process.env.SMTP_USER}>`
      : "WTK Ticket <noreply@wtk-ticket.local>");
  const subject = `[WTK] E-Ticket order ${job.orderId}`;
  const html = buildHtml(job);
  const text = `E-Ticket WTK\nOrder: ${job.orderId}\nEvent: ${job.eventId}\nQty: ${job.qty}\nSeats: ${(job.seatCodes || []).join(", ")}\nTotal: ${job.amountIdr}`;

  const base = {
    to,
    from,
    subject,
    text,
    html,
    job,
    orderId: job.orderId,
    eventId: job.eventId,
    at: new Date().toISOString(),
  };

  const { transport, mode } = await getTransporter();
  let result = { ok: true, mode: "file", to, previewUrl: null, path: null };

  if (transport && mode !== "file") {
    try {
      const info = await transport.sendMail({ from, to, subject, text, html });
      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) console.log(`[mail] ethereal preview: ${preview}`);
      console.log(`[mail] sent mode=${mode} to=${to} id=${info.messageId}`);
      result = {
        ok: true,
        mode,
        to,
        messageId: info.messageId,
        previewUrl: preview || null,
      };
      if (mode === "ethereal") {
        console.log(
          "[mail] PERINGATAN: Ethereal TIDAK mengirim ke Gmail. Buka previewUrl atau set SMTP_HOST."
        );
      }
    } catch (e) {
      console.error(`[mail] send gagal (${mode}): ${e.message} — fallback file`);
      result = { ok: false, mode: "file", to, error: e.message };
    }
  } else {
    console.log(`[mail] outbox file only → ${to}`);
  }

  const file = saveOutbox({
    ...base,
    mode: result.mode,
    messageId: result.messageId || null,
    previewUrl: result.previewUrl || null,
    error: result.error || null,
  });
  result.path = file;
  result.mode = result.mode || "file";
  result.ok = true;
  console.log(`[mail] outbox: ${file}`);
  return result;
}

function listOutbox(limit = 30) {
  ensureOutboxDir();
  const files = fs
    .readdirSync(OUTBOX_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const full = path.join(OUTBOX_DIR, f);
      const st = fs.statSync(full);
      return { f, full, mtime: st.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);

  return files.map(({ f, full }) => {
    try {
      const data = JSON.parse(fs.readFileSync(full, "utf8"));
      return {
        file: f,
        orderId: data.orderId || data.job?.orderId,
        to: data.to,
        subject: data.subject,
        mode: data.mode,
        previewUrl: data.previewUrl || null,
        at: data.at,
        eventId: data.eventId || data.job?.eventId,
        amountIdr: data.job?.amountIdr,
        seatCodes: data.job?.seatCodes,
        buyerName: data.job?.buyerName,
      };
    } catch {
      return { file: f, error: "parse gagal" };
    }
  });
}

function getOutboxByOrder(orderId) {
  ensureOutboxDir();
  const id = String(orderId);
  const files = fs
    .readdirSync(OUTBOX_DIR)
    .filter((f) => f.startsWith(id) || f.includes(id.slice(0, 8)))
    .map((f) => path.join(OUTBOX_DIR, f));
  const hits = [];
  for (const full of files) {
    try {
      const data = JSON.parse(fs.readFileSync(full, "utf8"));
      if (String(data.orderId || data.job?.orderId) === id) {
        hits.push({
          file: path.basename(full),
          to: data.to,
          subject: data.subject,
          html: data.html,
          text: data.text,
          mode: data.mode,
          previewUrl: data.previewUrl,
          at: data.at,
          job: data.job,
        });
      }
    } catch {
      /* skip */
    }
  }
  return hits.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

module.exports = {
  sendETicket,
  getTransporter,
  listOutbox,
  getOutboxByOrder,
  OUTBOX_DIR,
};
