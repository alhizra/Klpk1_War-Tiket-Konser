# -*- coding: utf-8 -*-
"""
Import DATA_WAR_TIKET_KONSER.xlsx → events.manual.json + seats.manual.csv
lalu load ke Postgres + Redis (opsional --load).

Usage:
  python data/import_excel_dataset.py
  python data/import_excel_dataset.py --load
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
DEFAULT_XLSX = Path(r"C:\Users\User\Downloads\DATA_WAR_TIKET_KONSER.xlsx")
XLSX_IN_REPO = ROOT / "DATA_WAR_TIKET_KONSER.xlsx"

# warna default per kode kategori
COLORS = {
    "VIP": "#A855F7",
    "VVIP": "#EF4444",
    "SCVIP": "#C026D3",
    "FLOOR": "#7C3AED",
    "GOLD": "#EAB308",
    "SILVER": "#94A3B8",
    "BRONZE": "#B45309",
    "ORANGE": "#F97316",
    "NAVY": "#1E3A8A",
    "DIA": "#22D3EE",
    "PIT": "#F472B6",
    "R": "#F43F5E",
    "S": "#FBBF24",
    "A": "#38BDF8",
    "B": "#34D399",
    "C": "#A78BFA",
}


def sheet_table(ws):
    """Baca baris header pertama yang berisi teks, return list[dict]."""
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    # cari header: baris pertama non-kosong
    header_idx = 0
    for i, row in enumerate(rows):
        if row and any(c is not None and str(c).strip() for c in row):
            header_idx = i
            break
    headers = [str(c).strip() if c is not None else f"col{i}" for i, c in enumerate(rows[header_idx])]
    out = []
    for row in rows[header_idx + 1 :]:
        if not row or all(c is None or str(c).strip() == "" for c in row):
            continue
        # skip INFO rows
        if row[0] is not None and str(row[0]).upper() in ("INFO",):
            continue
        item = {}
        for i, h in enumerate(headers):
            item[h] = row[i] if i < len(row) else None
        out.append(item)
    return out


def to_iso(val, default_tz="+09:00"):
    if val is None:
        return None
    if isinstance(val, datetime):
        # Excel naive → assume KST-ish / local; store as +07 for ID lab or +09
        return val.strftime("%Y-%m-%dT%H:%M:%S") + default_tz
    # Excel serial date (float/int) — openpyxl data_only kadang mengembalikan angka
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        try:
            from openpyxl.utils.datetime import from_excel

            dt = from_excel(val)
            if isinstance(dt, datetime):
                return dt.strftime("%Y-%m-%dT%H:%M:%S") + default_tz
        except Exception:
            pass
    s = str(val).strip()
    if not s:
        return None
    # already iso-ish
    if "T" in s:
        return s
    # numeric string serial
    try:
        num = float(s)
        if 20000 < num < 80000:
            from openpyxl.utils.datetime import from_excel

            dt = from_excel(num)
            if isinstance(dt, datetime):
                return dt.strftime("%Y-%m-%dT%H:%M:%S") + default_tz
    except Exception:
        pass
    try:
        dt = datetime.fromisoformat(s.replace(" ", "T"))
        return dt.strftime("%Y-%m-%dT%H:%M:%S") + default_tz
    except Exception:
        return s


def parse_artist(event_name: str):
    """'TREASURE (트레저)' → artist, title same."""
    name = (event_name or "").strip()
    return name, name


def layout_for(code: str, quota: int):
    """Generate seat rows covering exact quota."""
    code = code.upper()
    standing_codes = {"FLOOR", "PIT", "DIA", "FS", "STAND"}
    standing = code in standing_codes or "FLOOR" in code or "STAND" in code

    if standing:
        # one or two blocks
        if quota <= 100:
            rows = [f"{code[:2]}1"]
            per = quota
        else:
            half = (quota + 1) // 2
            rows = [f"{code[:2]}1", f"{code[:2]}2"]
            per = half
        return {"rows": rows, "perRow": per, "standing": True, "section": f"{code} Standing"}

    # reserved: spread across rows of ~20
    per = 20
    n_rows = max(1, (quota + per - 1) // per)
    # last row may be shorter — handled in generator by total count
    prefix = re.sub(r"[^A-Z0-9]", "", code)[:3] or "R"
    rows = [f"{prefix}{i}" for i in range(1, n_rows + 1)]
    return {
        "rows": rows,
        "perRow": per,
        "standing": False,
        "section": f"{code} Reserved",
    }


def generate_seats(event_num: int, cat_code: str, cat_name: str, price: int, quota: int, color: str):
    layout = layout_for(cat_code, quota)
    seats = []
    n = 0
    standing = layout["standing"]
    width = 3 if standing else 3
    for row in layout["rows"]:
        for i in range(1, layout["perRow"] + 1):
            if n >= quota:
                break
            n += 1
            seat_num = n if standing else i
            code = f"{row}-{str(seat_num if standing else i).zfill(width)}"
            row_idx = layout["rows"].index(row)
            seats.append(
                {
                    "event_id": event_num,
                    "seat_code": code,
                    "category": cat_code,
                    "category_name": cat_name,
                    "row_label": row,
                    "seat_number": seat_num,
                    "section": layout["section"],
                    "price_idr": price,
                    "color_hex": color,
                    "pos_x": (n % 20) * 20 if standing else i * 18,
                    "pos_y": (n // 20) * 22 if standing else row_idx * 28,
                }
            )
        if n >= quota:
            break
    if len(seats) != quota:
        # pad or trim
        while len(seats) < quota:
            n = len(seats) + 1
            seats.append(
                {
                    "event_id": event_num,
                    "seat_code": f"{cat_code}-X{str(n).zfill(3)}",
                    "category": cat_code,
                    "category_name": cat_name,
                    "row_label": cat_code,
                    "seat_number": n,
                    "section": layout["section"],
                    "price_idr": price,
                    "color_hex": color,
                    "pos_x": n * 10,
                    "pos_y": 0,
                }
            )
        seats = seats[:quota]
    return seats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--xlsx", default=str(DEFAULT_XLSX if DEFAULT_XLSX.exists() else XLSX_IN_REPO))
    ap.add_argument("--load", action="store_true", help="Load ke Postgres+Redis via npm run data:manual")
    args = ap.parse_args()

    xlsx = Path(args.xlsx)
    if not xlsx.exists():
        print("Excel tidak ditemukan:", xlsx)
        sys.exit(1)

    # copy ke repo (skip jika path sama / file terkunci)
    import shutil

    try:
        if xlsx.resolve() != XLSX_IN_REPO.resolve():
            shutil.copy2(xlsx, XLSX_IN_REPO)
            print("Copied Excel ->", XLSX_IN_REPO)
        else:
            print("Using Excel in-repo:", XLSX_IN_REPO)
    except PermissionError:
        print("WARN: tidak bisa copy Excel (file terkunci), pakai path sumber:", xlsx)

    wb = openpyxl.load_workbook(xlsx, data_only=True)
    venues = sheet_table(wb["03_venues"])
    events_raw = sheet_table(wb["04_events"])
    cats_raw = sheet_table(wb["05_seat_categories"])

    venue_by_id = {str(v.get("venue_id")): v for v in venues}

    # map EVT001 → 1
    event_id_map = {}
    events_out = []
    all_seats = []
    all_cats_flat = []

    for idx, er in enumerate(events_raw, start=1):
        eid_str = str(er.get("event_id") or "").strip()
        if not eid_str or eid_str.upper() == "INFO":
            continue
        event_id_map[eid_str] = idx
        vid = str(er.get("venue_id") or "")
        ven = venue_by_id.get(vid, {})
        ename = str(er.get("event_name") or f"Event {idx}")
        artist, title = parse_artist(ename)
        # title lebih deskriptif
        title = f"{ename} Live"

        # categories for this event
        ecats = [c for c in cats_raw if str(c.get("event_id")) == eid_str]
        categories = []
        quota_total = 0
        min_price = None
        for c in ecats:
            code = str(c.get("category_code") or "REG").upper()
            name = str(c.get("category_name") or code)
            price = int(c.get("price") or 0)
            quota = int(c.get("quota") or 0)
            color = COLORS.get(code, "#64748B")
            categories.append(
                {
                    "code": code,
                    "name": name,
                    "price_idr": price,
                    "quota": quota,
                    "color": color,
                }
            )
            quota_total += quota
            min_price = price if min_price is None else min(min_price, price)
            all_seats.extend(
                generate_seats(idx, code, name, price, quota, color)
            )
            all_cats_flat.append(
                {
                    "event_id": idx,
                    "event_code": eid_str,
                    "code": code,
                    "name": name,
                    "price_idr": price,
                    "quota": quota,
                    "color_hex": color,
                }
            )

        status_src = str(er.get("status") or "ACTIVE").upper()
        status = "PUBLISHED" if status_src in ("ACTIVE", "PUBLISHED", "OPEN") else status_src

        city = ven.get("city") or "Seoul"
        country = "Thailand" if "Thai" in str(ven.get("address") or "") or "Bangkok" in str(city) else "South Korea"
        tz = "+07:00" if country == "Thailand" else "+09:00"

        events_out.append(
            {
                "event_id": idx,
                "event_code": eid_str,
                "title": title,
                "artist": artist,
                "venue": ven.get("venue_name") or vid,
                "venue_id": vid,
                "venue_code": ven.get("venue_code"),
                "starts_at": to_iso(er.get("event_date"), tz),
                "sales_opens_at": to_iso(er.get("sale_start_time"), tz),
                "sales_closes_at": to_iso(er.get("sale_end_time"), tz),
                "ends_at": to_iso(er.get("event_date"), tz),
                "quota_total": quota_total,
                "price_idr": min_price or 0,
                "status": status,
                "city": city,
                "country": country,
                "currency_note": "Harga IDR demo praktikum",
                "age_rating": "All ages",
                "gate_open": "16:00",
                "timezone": "Asia/Bangkok" if country == "Thailand" else "Asia/Seoul",
                "description": (
                    f"War tiket {artist} di {ven.get('venue_name') or vid}, {city}. "
                    f"Kuota total {quota_total} kursi. Satu seat code hanya terjual sekali (anti-oversell)."
                ),
                "terms": [
                    "Maksimal 4 tiket per transaksi",
                    "Satu kursi hanya boleh terjual satu kali",
                    "Wajib identitas sesuai pemesan saat masuk venue",
                    "Tiket non-refundable kecuali event dibatalkan promoter",
                ],
                "categories": categories,
            }
        )
        print(f"OK event {idx} {eid_str} {artist}: quota={quota_total} cats={len(categories)}")

    # write events.manual.json
    events_path = ROOT / "events.manual.json"
    events_path.write_text(json.dumps(events_out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("WROTE", events_path)

    # seats csv
    seats_path = ROOT / "seats.manual.csv"
    headers = [
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
    ]
    with seats_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=headers)
        w.writeheader()
        for s in all_seats:
            w.writerow(s)
    print("WROTE", seats_path, "seats=", len(all_seats))

    (ROOT / "categories.manual.json").write_text(
        json.dumps(all_cats_flat, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    summary = [
        {
            "event_id": e["event_id"],
            "event_code": e.get("event_code"),
            "artist": e["artist"],
            "venue": e["venue"],
            "city": e["city"],
            "quota_total": e["quota_total"],
            "seats_generated": sum(1 for s in all_seats if s["event_id"] == e["event_id"]),
            "by_category": {
                c["code"]: c["quota"] for c in e["categories"]
            },
        }
        for e in events_out
    ]
    (ROOT / "data-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("SUMMARY", json.dumps(summary, ensure_ascii=False, indent=2))

    # selalu regenerate db/init.sql agar Codespace/Docker fresh = dataset Excel
    print("==> Generating db/init.sql ...")
    subprocess.run(
        [sys.executable, str(ROOT / "generate_init_sql.py")],
        cwd=str(REPO),
        check=False,
    )

    if args.load:
        print("==> Loading to database...")
        env = {
            **dict(**{k: v for k, v in __import__("os").environ.items()}),
            "DATABASE_URL": __import__("os").environ.get(
                "DATABASE_URL", "postgres://wtk:wtk@localhost:5432/wtk"
            ),
            "REDIS_URL": __import__("os").environ.get("REDIS_URL", "redis://localhost:6379"),
        }
        r = subprocess.run(
            [sys.executable, str(ROOT / "load_to_db.py")],
            cwd=str(REPO),
            env=env,
        )
        if r.returncode != 0:
            gen = ROOT / "generate-real-seats.js"
            bak = ROOT / "generate-real-seats.js.bak_tmp"
            if gen.exists():
                gen.rename(bak)
            try:
                r2 = subprocess.run(
                    ["node", "src/load-manual-data.js"],
                    cwd=str(REPO),
                    env=env,
                )
                sys.exit(r2.returncode)
            finally:
                if bak.exists():
                    bak.rename(gen)
        print("LOAD done")


if __name__ == "__main__":
    main()
