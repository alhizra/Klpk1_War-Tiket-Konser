const { test, before, after } = require("node:test");
const assert = require("node:assert");
const app = require("./index.js");

let server;
let base;

before(async () => {
  await new Promise((r) => {
    server = app.listen(0, "127.0.0.1", r);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test("GET /health ok", async () => {
  const r = await fetch(`${base}/health`);
  assert.strictEqual(r.status, 200);
  const j = await r.json();
  assert.strictEqual(j.service, "payment");
});

test("POST /v1/payments tanpa token → 401", async () => {
  const r = await fetch(`${base}/v1/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId: 1, qty: 1 }),
  });
  assert.strictEqual(r.status, 401);
});

test("POST /v1/login mengeluarkan token", async () => {
  const r = await fetch(`${base}/v1/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "tester" }),
  });
  assert.strictEqual(r.status, 200);
  const j = await r.json();
  assert.ok(j.token && j.token.length > 10);
});
