/**
 * Unit test kuota Redis Lua — butuh REDIS_URL (default localhost:6379).
 * Skip otomatis jika Redis down.
 */
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

const EVENT = 99001;

let redis;
let quota;
let skip = false;

before(async () => {
  process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
  try {
    ({ redis } = require("../redis"));
    await redis.ping();
    quota = require("./quota");
  } catch (e) {
    skip = true;
    console.warn("[quota.test] skip — Redis tidak tersedia:", e.message);
  }
});

after(async () => {
  if (skip || !redis) return;
  try {
    await redis.del(
      `quota:event:${EVENT}`,
      `sold:event:${EVENT}`,
      `seats:sold:${EVENT}`
    );
    await redis.quit();
  } catch {
    /* ignore */
  }
});

describe("quota Lua", () => {
  it("reserve tidak melebihi kuota", async () => {
    if (skip) return;
    await quota.resetQuotaCounters(EVENT, 5);
    const r1 = await quota.reserveSeats(EVENT, 3);
    assert.equal(r1.ok, true);
    assert.equal(r1.sisa, 2);
    const r2 = await quota.reserveSeats(EVENT, 3);
    assert.equal(r2.ok, false);
    const r3 = await quota.reserveSeats(EVENT, 2);
    assert.equal(r3.ok, true);
    assert.equal(r3.sisa, 0);
    const snap = await quota.getQuotaSnapshot(EVENT);
    assert.equal(snap.sisa, 0);
    assert.equal(snap.sold, 5);
  });

  it("claim seat atomik — kursi sama → conflict", async () => {
    if (skip) return;
    await quota.resetQuotaCounters(EVENT, 10);
    await quota.reserveSeats(EVENT, 2);
    const a = await quota.claimSeatCodes(EVENT, ["Z9-01", "Z9-02"]);
    assert.equal(a.ok, true);
    const b = await quota.claimSeatCodes(EVENT, ["Z9-02", "Z9-03"]);
    assert.equal(b.ok, false);
    assert.equal(b.conflict, "Z9-02");
    const c = await quota.claimSeatCodes(EVENT, ["Z9-03"]);
    assert.equal(c.ok, true);
  });

  it("release mengembalikan kuota", async () => {
    if (skip) return;
    await quota.resetQuotaCounters(EVENT, 4);
    await quota.reserveSeats(EVENT, 2);
    await quota.releaseSeats(EVENT, 2);
    const snap = await quota.getQuotaSnapshot(EVENT);
    assert.equal(snap.sisa, 4);
    assert.equal(snap.sold, 0);
  });
});
