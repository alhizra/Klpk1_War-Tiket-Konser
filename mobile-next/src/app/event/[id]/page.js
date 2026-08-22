"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiGet, fmtRp, posterUrl } from "@/lib/api";

const MAX = 4;

export default function EventPage() {
  const { id } = useParams();
  const router = useRouter();
  const [ev, setEv] = useState(null);
  const [err, setErr] = useState(null);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    let ok = true;
    apiGet(`/api/events/${id}`)
      .then((d) => {
        if (ok) setEv(d);
      })
      .catch((e) => {
        if (ok) setErr(e.message);
      });
    return () => {
      ok = false;
    };
  }, [id]);

  const sold = useMemo(
    () => new Set((ev?.soldSeats || []).map((s) => String(s).toUpperCase())),
    [ev]
  );

  const seats = useMemo(() => {
    const list = ev?.seats || [];
    return list.map((s) => ({
      code: String(s.code || s.seat_code || "").toUpperCase(),
      cat: s.category || "",
      price: s.priceIdr || s.price_idr || ev?.priceIdr,
      color: s.color || s.color_hex || "#94a3b8",
      num: s.number || s.seat_number || "",
      row: s.row || s.row_label || "",
    }));
  }, [ev]);

  const byCat = useMemo(() => {
    const m = new Map();
    for (const s of seats) {
      if (!m.has(s.cat)) m.set(s.cat, []);
      m.get(s.cat).push(s);
    }
    return m;
  }, [seats]);

  function toggle(code) {
    if (sold.has(code)) return;
    setSelected((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= MAX) return prev;
      if (Number(ev?.sisa) <= 0) return prev;
      return [...prev, code];
    });
  }

  const total = selected.reduce((sum, c) => {
    const s = seats.find((x) => x.code === c);
    return sum + (Number(s?.price) || 0);
  }, 0);

  function lanjut() {
    if (!selected.length) return;
    const q = new URLSearchParams({
      seats: selected.join(","),
      title: ev?.title || "",
      qty: String(selected.length),
    });
    router.push(`/checkout/${id}?${q.toString()}`);
  }

  if (err) {
    return (
      <div className="card">
        <p className="text-red-400">{err}</p>
        <Link href="/" className="btn-primary mt-4 block">
          Kembali
        </Link>
      </div>
    );
  }

  if (!ev) {
    return <p className="py-16 text-center text-slate-400">Memuat denah…</p>;
  }

  const src = posterUrl(ev.eventId);
  const habis = Number(ev.sisa) <= 0;

  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-sky-400">
        ← Daftar
      </Link>

      <div className="card flex gap-3">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-28 w-20 rounded-xl object-cover" />
        ) : null}
        <div>
          <h2 className="font-extrabold">{ev.title}</h2>
          <p className="text-sm text-slate-400">{ev.artist}</p>
          <p className="mt-2 text-sm">
            Sisa <strong className="text-green-400">{ev.sisa}</strong> /{" "}
            {ev.quotaTotal}
          </p>
          {habis && (
            <p className="mt-1 text-xs text-red-400">
              Sold out — reset kuota di API lab
            </p>
          )}
        </div>
      </div>

      <p className="text-center text-xs font-bold tracking-widest text-slate-500">
        STAGE
      </p>

      <div className="max-h-[50vh] space-y-4 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950/50 p-3">
        {[...byCat.entries()].map(([cat, list]) => (
          <div key={cat}>
            <p className="mb-2 text-xs font-bold text-slate-400">
              {cat} · {list.length} seats
            </p>
            <div className="flex flex-wrap gap-1.5">
              {list.slice(0, 80).map((s) => {
                const isSold = sold.has(s.code);
                const isSel = selected.includes(s.code);
                return (
                  <button
                    key={s.code}
                    type="button"
                    disabled={isSold || habis}
                    title={s.code}
                    onClick={() => toggle(s.code)}
                    className={[
                      "seat",
                      isSold ? "seat-sold" : "seat-free",
                      isSel ? "seat-sel" : "",
                    ].join(" ")}
                    style={
                      isSold
                        ? undefined
                        : { backgroundColor: s.color || "#94a3b8" }
                    }
                  >
                    {String(s.num).slice(-2) || "·"}
                  </button>
                );
              })}
              {list.length > 80 && (
                <span className="self-center text-xs text-slate-500">
                  +{list.length - 80} lagi (scroll / pilih dari yang tampil)
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="card sticky bottom-2 space-y-2">
        <p className="text-sm text-slate-400">
          Dipilih:{" "}
          <span className="text-slate-100">
            {selected.length ? selected.join(", ") : "—"}
          </span>
        </p>
        <p className="font-bold">{fmtRp(total)}</p>
        <button
          type="button"
          className="btn-green w-full"
          disabled={!selected.length || habis}
          onClick={lanjut}
        >
          Lanjut bayar ({selected.length})
        </button>
      </div>
    </div>
  );
}
