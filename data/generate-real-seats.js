/**
 * Generate denah kursi dari events.manual.json → seats.manual.csv
 * Layout harus match quota kategori Excel (7 event, 2480 seats).
 *
 * node data/generate-real-seats.js
 */
const fs = require("fs");
const path = require("path");

const root = __dirname;
const events = JSON.parse(
  fs.readFileSync(path.join(root, "events.manual.json"), "utf8")
);

/** Layout scoped: event_id + category code (rows * perRow >= quota) */
const LAYOUT_BY_EVENT = {
  // 1 TREASURE — VIP 50, FLOOR 120, GOLD 140, SILVER 90
  1: {
    VIP: {
      rows: ["VIP1", "VIP2", "VIP3"],
      perRow: 20,
      section: "VIP Reserved",
    },
    FLOOR: {
      rows: ["FL1", "FL2"],
      perRow: 60,
      section: "Floor Standing",
      standing: true,
    },
    GOLD: {
      rows: ["GOL1", "GOL2", "GOL3", "GOL4", "GOL5", "GOL6", "GOL7"],
      perRow: 20,
      section: "GOLD Reserved",
    },
    SILVER: {
      rows: ["SIL1", "SIL2", "SIL3", "SIL4", "SIL5"],
      perRow: 20,
      section: "SILVER Reserved",
    },
  },
  // 2 LYKN — VVIP 40, A 80, B 100, C 60
  2: {
    VVIP: {
      rows: ["VVI1", "VVI2"],
      perRow: 20,
      section: "VVIP Reserved",
    },
    A: {
      rows: ["A1", "A2", "A3", "A4"],
      perRow: 20,
      section: "A Reserved",
    },
    B: {
      rows: ["B1", "B2", "B3", "B4", "B5"],
      perRow: 20,
      section: "B Reserved",
    },
    C: {
      rows: ["C1", "C2", "C3"],
      perRow: 20,
      section: "C Reserved",
    },
  },
  // 3 BLACKPINK — SCVIP 40, FLOOR 160, ORANGE 180, NAVY 120
  3: {
    SCVIP: {
      rows: ["SC1", "SC2", "SC3", "SC4"],
      perRow: 10,
      section: "Soundcheck VIP",
    },
    FLOOR: {
      rows: ["P1", "P2"],
      perRow: 80,
      section: "Pink Floor Standing",
      standing: true,
    },
    ORANGE: {
      rows: ["O1", "O2", "O3", "O4", "O5", "O6", "O7", "O8", "O9"],
      perRow: 20,
      section: "Orange Lower",
    },
    NAVY: {
      rows: ["N1", "N2", "N3", "N4", "N5", "N6"],
      perRow: 20,
      section: "Navy Upper",
    },
  },
  // 4 NCT DREAM — DIA 70, GOLD 90, SILVER 110, BRONZE 80
  4: {
    DIA: {
      rows: ["D1", "D2"],
      perRow: 40,
      section: "Diamond Standing",
      standing: true,
    },
    GOLD: {
      rows: ["G1", "G2", "G3", "G4", "G5"],
      perRow: 20,
      section: "Gold Side",
    },
    SILVER: {
      rows: ["S1", "S2", "S3", "S4", "S5", "S6"],
      perRow: 20,
      section: "Silver Rear",
    },
    BRONZE: {
      rows: ["B1", "B2", "B3", "B4"],
      perRow: 20,
      section: "Bronze Upper",
    },
  },
  // 5 EXO — R 60, S 120, A 140
  5: {
    R: {
      rows: ["R1", "R2", "R3"],
      perRow: 20,
      section: "R Premium",
    },
    S: {
      rows: ["S1", "S2", "S3", "S4", "S5", "S6"],
      perRow: 20,
      section: "S Center",
    },
    A: {
      rows: ["A1", "A2", "A3", "A4", "A5", "A6", "A7"],
      perRow: 20,
      section: "A Seat",
    },
  },
  // 6 ATEEZ — PIT 60, A 110, B 120, C 90
  6: {
    PIT: {
      rows: ["PT"],
      perRow: 60,
      section: "Front Pit Standing",
      standing: true,
    },
    A: {
      rows: ["A1", "A2", "A3", "A4", "A5", "A6"],
      perRow: 20,
      section: "Seat A",
    },
    B: {
      rows: ["B1", "B2", "B3", "B4", "B5", "B6"],
      perRow: 20,
      section: "Seat B",
    },
    C: {
      rows: ["C1", "C2", "C3", "C4", "C5"],
      perRow: 20,
      section: "Seat C",
    },
  },
  // 7 BUS — VVIP 30, A 70, B 90, C 60
  7: {
    VVIP: {
      rows: ["VVI1", "VVI2"],
      perRow: 20,
      section: "VVIP Reserved",
    },
    A: {
      rows: ["A1", "A2", "A3", "A4"],
      perRow: 20,
      section: "A Reserved",
    },
    B: {
      rows: ["B1", "B2", "B3", "B4", "B5"],
      perRow: 20,
      section: "B Reserved",
    },
    C: {
      rows: ["C1", "C2", "C3"],
      perRow: 20,
      section: "C Reserved",
    },
  },
};

function pad(n, width) {
  return String(n).padStart(width, "0");
}

function generateSeats(eventId, cat, layout) {
  const need = Number(cat.quota);
  const seats = [];
  let n = 0;
  const standing = !!layout.standing;
  const width = standing ? 3 : 2;

  outer: for (const row of layout.rows) {
    for (let i = 1; i <= layout.perRow; i++) {
      if (n >= need) break outer;
      n += 1;
      const seatNum = standing ? n : i;
      const code = standing
        ? `${row}-${pad(n, width)}`
        : `${row}-${pad(i, width)}`;
      const rowIdx = layout.rows.indexOf(row);
      seats.push({
        event_id: eventId,
        seat_code: code,
        category: cat.code,
        category_name: cat.name,
        row_label: row,
        seat_number: seatNum,
        section: layout.section,
        price_idr: cat.price_idr,
        color_hex: cat.color || "",
        pos_x: standing ? (n % 20) * 20 : i * 18,
        pos_y: standing ? Math.floor((n - 1) / 20) * 22 : rowIdx * 28,
      });
    }
  }

  if (seats.length !== need) {
    throw new Error(
      `event ${eventId} ${cat.code}: got ${seats.length} seats, need ${need}. Fix LAYOUT rows*perRow.`
    );
  }
  return seats;
}

const allSeats = [];
const allCategories = [];

for (const ev of events) {
  const map = LAYOUT_BY_EVENT[ev.event_id];
  if (!map) throw new Error(`No LAYOUT_BY_EVENT for event ${ev.event_id}`);

  let sum = 0;
  for (const c of ev.categories || []) {
    sum += Number(c.quota);
    const layout = map[c.code];
    if (!layout) {
      throw new Error(`No layout event=${ev.event_id} cat=${c.code}`);
    }
    allCategories.push({
      event_id: ev.event_id,
      event_code: ev.event_code,
      code: c.code,
      name: c.name,
      price_idr: c.price_idr,
      quota: c.quota,
      color_hex: c.color || "",
    });
    allSeats.push(...generateSeats(ev.event_id, c, layout));
  }

  if (sum !== Number(ev.quota_total)) {
    throw new Error(
      `Event ${ev.event_id}: category sum ${sum} != quota_total ${ev.quota_total}`
    );
  }

  const count = allSeats.filter((s) => s.event_id === ev.event_id).length;
  console.log(
    `✓ #${ev.event_id} ${ev.artist} — ${count} seats @ ${ev.city}`
  );
}

const headers = [
  "event_id",
  "seat_code",
  "category",
  "category_name",
  "row_label",
  "seat_number",
  "section",
  "price_idr",
  "color_hex",
  "pos_x",
  "pos_y",
];
const lines = [headers.join(",")];
for (const s of allSeats) {
  lines.push(
    [
      s.event_id,
      s.seat_code,
      s.category,
      `"${String(s.category_name).replace(/"/g, '""')}"`,
      s.row_label,
      s.seat_number,
      `"${String(s.section).replace(/"/g, '""')}"`,
      s.price_idr,
      s.color_hex,
      s.pos_x,
      s.pos_y,
    ].join(",")
  );
}

fs.writeFileSync(path.join(root, "seats.manual.csv"), lines.join("\n") + "\n");
fs.writeFileSync(
  path.join(root, "categories.manual.json"),
  JSON.stringify(allCategories, null, 2)
);

const summary = events.map((ev) => {
  const seats = allSeats.filter((s) => s.event_id === ev.event_id);
  const byCat = {};
  for (const s of seats) byCat[s.category] = (byCat[s.category] || 0) + 1;
  return {
    event_id: ev.event_id,
    event_code: ev.event_code,
    artist: ev.artist,
    venue: ev.venue,
    city: ev.city,
    quota_total: ev.quota_total,
    seats_generated: seats.length,
    by_category: byCat,
  };
});
fs.writeFileSync(
  path.join(root, "data-summary.json"),
  JSON.stringify(summary, null, 2)
);

console.log(`\nTotal seats: ${allSeats.length}`);
console.log(JSON.stringify(summary, null, 2));
