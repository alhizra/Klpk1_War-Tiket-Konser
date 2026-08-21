const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("paymentGateway mock", () => {
  it("createPaymentSession mock mengembalikan VA + paymentId", async () => {
    process.env.PAYMENT_PROVIDER = "mock";
    delete require.cache[require.resolve("./paymentGateway")];
    const { createPaymentSession, parseWebhook } = require("./paymentGateway");
    const s = await createPaymentSession({
      orderId: "ord-test-1",
      eventId: 1,
      qty: 1,
      amountIdr: 100000,
      email: "a@b.c",
      buyerName: "T",
      title: "Test",
    });
    assert.equal(s.provider, "mock");
    assert.ok(s.paymentId);
    assert.ok(s.vaNumber);
    assert.equal(s.status, "pending");
    const w = parseWebhook({
      orderId: "ord-test-1",
      status: "settlement",
      paymentId: s.paymentId,
    });
    assert.equal(w.status, "paid");
    assert.equal(w.orderId, "ord-test-1");
  });
});
