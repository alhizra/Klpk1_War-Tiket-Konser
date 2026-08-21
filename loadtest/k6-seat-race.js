import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";

const BASE = __ENV.BASE || "http://localhost:3000";
const EVENT_ID = Number(__ENV.EVENT_ID || 2);
const SEAT_CODE = __ENV.SEAT_CODE || "FL1-002";

const success = new Counter("seat_success");
const conflict = new Counter("seat_conflict");
const serverError = new Counter("seat_5xx");

export const options = {
  scenarios: {
    seat_race: {
      executor: "shared-iterations",
      vus: Number(__ENV.VUS || 20),
      iterations: Number(__ENV.ITERS || 20),
      maxDuration: "1m",
    },
  },

  thresholds: {
    seat_success: ["count==1"],
    seat_conflict: ["count==19"],
    seat_5xx: ["count==0"],
  },
};

export default function () {
  const res = http.post(
    `${BASE}/orders`,
    JSON.stringify({
      eventId: EVENT_ID,
      qty: 1,
      seatCodes: [SEAT_CODE],
      email: `race-${__VU}-${__ITER}@wtk.local`,
      buyerName: `Seat Race ${__VU}-${__ITER}`,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (res.status === 201) {
    success.add(1);
  } else if (res.status === 409) {
    conflict.add(1);
  } else if (res.status >= 500) {
    serverError.add(1);
  }

  check(res, {
    "201 atau 409": (r) => r.status === 201 || r.status === 409,
    "bukan 5xx": (r) => r.status < 500,
  });
}

export function handleSummary(data) {
  const m = data.metrics || {};

  return {
    stdout:
      "=== k6 Seat Race ===\n" +
      `eventId: ${EVENT_ID}\n` +
      `seatCode: ${SEAT_CODE}\n` +
      `success_201: ${m.seat_success?.values?.count ?? 0}\n` +
      `conflict_409: ${m.seat_conflict?.values?.count ?? 0}\n` +
      `server_5xx: ${m.seat_5xx?.values?.count ?? 0}\n`,
  };
}