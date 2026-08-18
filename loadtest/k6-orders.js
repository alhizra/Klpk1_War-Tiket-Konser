/**
 * k6 skenario War Tiket Konser — POST /orders
 * Jalankan: k6 run -e BASE=http://localhost:3000 loadtest/k6-orders.js
 *
 * Catatan QA: 409 = penolakan kuota SAH, jangan dihitung sebagai error sistem.
 * Hanya http_req_failed untuk status >= 500.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Counter } from "k6/metrics";

const BASE = __ENV.BASE || "http://localhost:8080";
const oversellSuspect = new Rate("oversell_suspect");
const orderOk = new Counter("order_ok");
const order409 = new Counter("order_409");
const order5xx = new Counter("order_5xx");

export const options = {
  scenarios: {
    war_tiket: {
      executor: "shared-iterations",
      vus: 200,
      iterations: 5000,
      maxDuration: "2m",
    },
  },
  thresholds: {
    order_5xx: ["count<50"], // <1% dari 5000
    http_req_duration: ["p(95)<500"],
  },
};

export default function () {
  const res = http.post(
    `${BASE}/orders`,
    JSON.stringify({ eventId: 1, qty: 1 }),
    { headers: { "Content-Type": "application/json" } }
  );

  if (res.status === 201) orderOk.add(1);
  else if (res.status === 409) order409.add(1);
  else if (res.status >= 500) order5xx.add(1);

  check(res, {
    "status 201 or 409": (r) => r.status === 201 || r.status === 409,
    "not 5xx": (r) => r.status < 500,
  });
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  const m = data.metrics || {};
  const lines = [
    "=== k6 War Tiket summary ===",
    `p95: ${m.http_req_duration?.values?.["p(95)"] ?? "n/a"} ms`,
    `order_ok: ${m.order_ok?.values?.count ?? 0}`,
    `order_409: ${m.order_409?.values?.count ?? 0}`,
    `order_5xx: ${m.order_5xx?.values?.count ?? 0}`,
    "Cek manual: curl $BASE/events/1 → terjual<=500 sisa>=0",
  ];
  return lines.join("\n") + "\n";
}
