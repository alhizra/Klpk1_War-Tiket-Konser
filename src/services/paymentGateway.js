/**
 * Payment gateway utuh (lab production-like).
 *
 * PROVIDER:
 * - mock     → virtual account / redirect simulasi (default, tanpa akun eksternal)
 * - midtrans → Snap sandbox (butuh MIDTRANS_SERVER_KEY + MIDTRANS_CLIENT_KEY)
 *
 * Alur:
 * 1) createPaymentSession(order) → token/VA/redirect
 * 2) handleWebhook / simulatePay → status settlement
 */
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

const PROVIDER = (process.env.PAYMENT_PROVIDER || "mock").toLowerCase();
const AUTO_CAPTURE = process.env.PAYMENT_AUTO_CAPTURE !== "0"; // default ON agar loadtest tetap jalan

function mockCreateSession(order) {
  const paymentId = `pay_${uuidv4().replace(/-/g, "").slice(0, 16)}`;
  const va = `8808${String(Date.now()).slice(-10)}`;
  return {
    provider: "mock",
    paymentId,
    orderId: order.orderId,
    amountIdr: order.amountIdr,
    status: "pending",
    method: "bank_transfer_va",
    vaNumber: va,
    bank: "Mock Bank WTK",
    redirectUrl: `/pay/mock.html?orderId=${encodeURIComponent(order.orderId)}&paymentId=${paymentId}`,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    instructions: [
      "Transfer ke VA di atas (simulasi gateway).",
      "Atau buka redirectUrl / klik Bayar di web untuk settle instan.",
      "Webhook: POST /api/payments/webhook dengan body settlement.",
    ],
  };
}

async function midtransCreateSession(order) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    throw Object.assign(new Error("MIDTRANS_SERVER_KEY belum di-set"), {
      status: 500,
    });
  }
  const isProd = process.env.MIDTRANS_IS_PRODUCTION === "1";
  const host = isProd
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";
  const auth = Buffer.from(`${serverKey}:`).toString("base64");
  const payload = {
    transaction_details: {
      order_id: order.orderId,
      gross_amount: order.amountIdr,
    },
    customer_details: {
      email: order.email,
      first_name: order.buyerName || "WTK Buyer",
    },
    item_details: [
      {
        id: `evt-${order.eventId}`,
        price: order.amountIdr,
        quantity: 1,
        name: (order.title || "Tiket Konser").slice(0, 50),
      },
    ],
  };
  const res = await fetch(`${host}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(
      new Error(data.error_messages?.join(", ") || data.message || "Midtrans error"),
      { status: 502, detail: data }
    );
  }
  return {
    provider: "midtrans",
    paymentId: data.token,
    orderId: order.orderId,
    amountIdr: order.amountIdr,
    status: "pending",
    token: data.token,
    redirectUrl: data.redirect_url,
    clientKey: process.env.MIDTRANS_CLIENT_KEY || "",
  };
}

async function createPaymentSession(order) {
  if (PROVIDER === "midtrans") return midtransCreateSession(order);
  return mockCreateSession(order);
}

/** Verifikasi webhook Midtrans (signature) — mock selalu terima */
function verifyMidtransSignature(body) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
  if (!serverKey) return false;
  const status = body.status_code || "";
  const orderId = body.order_id || "";
  const gross = body.gross_amount || "";
  const sig = body.signature_key || "";
  const raw = status + orderId + gross + serverKey;
  const expect = crypto.createHash("sha512").update(raw).digest("hex");
  return sig === expect;
}

/**
 * Normalisasi notifikasi gateway → { orderId, paymentId, status: paid|pending|deny }
 */
function parseWebhook(body, provider = PROVIDER) {
  if (provider === "midtrans") {
    const st = String(body.transaction_status || "").toLowerCase();
    const fraud = String(body.fraud_status || "").toLowerCase();
    let status = "pending";
    if (st === "capture" && fraud === "accept") status = "paid";
    if (st === "settlement") status = "paid";
    if (st === "deny" || st === "cancel" || st === "expire") status = "deny";
    return {
      orderId: body.order_id,
      paymentId: body.transaction_id || body.order_id,
      status,
      raw: body,
    };
  }
  // mock
  const st = String(body.status || body.transaction_status || "settlement").toLowerCase();
  return {
    orderId: body.orderId || body.order_id,
    paymentId: body.paymentId || body.payment_id || `pay_${Date.now()}`,
    status:
      st === "settlement" || st === "paid" || st === "success"
        ? "paid"
        : st === "deny" || st === "expire"
          ? "deny"
          : "pending",
    raw: body,
  };
}

module.exports = {
  PROVIDER,
  AUTO_CAPTURE,
  createPaymentSession,
  verifyMidtransSignature,
  parseWebhook,
};
