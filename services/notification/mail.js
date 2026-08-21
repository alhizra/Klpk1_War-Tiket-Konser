/**
 * Email e-ticket notification-service.
 * Default: file outbox (+ optional SMTP). Ethereal hanya jika MAIL_USE_ETHEREAL=1.
 */
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const OUTBOX_DIR =
  process.env.MAIL_OUTBOX_DIR ||
  path.join(__dirname, "data", "outbox-mail");

let transporterPromise = null;

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
        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS || "",
            }
          : undefined,
      });
      return { transport: t, mode: "smtp" };
    }
    if (process.env.MAIL_USE_ETHEREAL === "1") {
      try {
        const testAcc = await nodemailer.createTestAccount();
        return {
          transport: nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: { user: testAcc.user, pass: testAcc.pass },
          }),
          mode: "ethereal",
        };
      } catch {
        /* fallthrough */
      }
    }
    return { transport: null, mode: "file" };
  })();
  return transporterPromise;
}

function buildHtml(data) {
  const seats = (data.seatCodes || []).join(", ") || "—";
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f172a;color:#e2e8f0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#1e293b;border-radius:12px;padding:24px">
    <h1 style="color:#22c55e">E-Ticket WTK (MS)</h1>
    <p>payment=${data.paymentId}</p>
    <p>event=${data.eventId} · ${data.title || ""}</p>
    <p>kursi: ${seats}</p>
    <p>total: Rp ${Number(data.amountIdr || 0).toLocaleString("id-ID")}</p>
    <p>pembeli: ${data.buyerName || data.user || "—"}</p>
  </div></body></html>`;
}

async function sendETicket(data) {
  const to =
    data.email ||
    (data.user ? `${data.user}@example.com` : null) ||
    `buyer-${String(data.paymentId || "x").slice(0, 8)}@example.com`;
  const from =
    process.env.MAIL_FROM ||
    (process.env.SMTP_USER
      ? `WTK Ticket <${process.env.SMTP_USER}>`
      : "WTK Ticket <noreply@wtk-ticket.local>");
  const subject = `[WTK] E-Ticket payment ${data.paymentId}`;
  const html = buildHtml(data);
  const text = `E-Ticket payment=${data.paymentId} event=${data.eventId} seats=${(data.seatCodes || []).join(",")}`;

  const { transport, mode } = await getTransporter();
  let result = { ok: true, mode: "file", to };

  if (transport && mode !== "file") {
    try {
      const info = await transport.sendMail({ from, to, subject, text, html });
      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) console.log(`[mail] ethereal preview: ${preview}`);
      result = {
        ok: true,
        mode,
        to,
        messageId: info.messageId,
        previewUrl: preview || null,
      };
    } catch (e) {
      console.error(`[mail] send gagal: ${e.message}`);
      result = { ok: false, mode: "file", to, error: e.message };
    }
  }

  fs.mkdirSync(OUTBOX_DIR, { recursive: true });
  const file = path.join(
    OUTBOX_DIR,
    `${data.paymentId || "x"}-${Date.now()}.json`
  );
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        to,
        from,
        subject,
        text,
        html,
        data,
        mode: result.mode,
        previewUrl: result.previewUrl || null,
        at: new Date().toISOString(),
      },
      null,
      2
    )
  );
  result.path = file;
  console.log(`[mail] outbox ${result.mode} → ${to} file=${file}`);
  return result;
}

module.exports = { sendETicket };
