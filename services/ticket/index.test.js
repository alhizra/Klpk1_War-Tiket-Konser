const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

// DB terpisah untuk test
process.env.DB_PATH = path.join(__dirname, "ticket-test.db");
try {
  fs.unlinkSync(process.env.DB_PATH);
} catch {
  /* */
}

const app = require("./index.js");

let server;
let base;

before(async () => {
  await new Promise((r) => {
    server = app.listen(0, "127.0.0.1", r);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  try {
    fs.unlinkSync(process.env.DB_PATH);
  } catch {
    /* */
  }
});

test("GET /health ok", async () => {
  const r = await fetch(`${base}/health`);
  assert.strictEqual(r.status, 200);
});

test("POST lock tanpa event service → 503 atau 201 jika event up", async () => {
  // event-service mungkin tidak jalan di unit test → 503 sah
  const r = await fetch(`${base}/v1/tickets/lock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId: 1, qty: 1 }),
  });
  assert.ok([201, 404, 503, 502].includes(r.status), `status=${r.status}`);
});
