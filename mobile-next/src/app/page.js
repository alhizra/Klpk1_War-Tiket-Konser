"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiGet, fmtRp, getApiBase, posterUrl } from "@/lib/api";

export default function HomePage() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const json = await apiGet("/api/events?page=1&size=20");
      const list = Array.isArray(json) ? json : json.items || [];
      setItems(list);
    } catch (e) {
      setErr(e.message || "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <p className="py-16 text-center text-slate-400">Memuat konser dari API…</p>
    );
  }

  if (err) {
    return (
      <div className="card space-y-3 text-center">
        <p className="font-bold text-red-400">Gagal memuat: {err}</p>
        <p className="break-all text-xs text-sky-400">API: {getApiBase()}</p>
        <p className="text-left text-sm text-slate-400">
          1) Root repo: <code className="text-slate-200">npm start</code>
          <br />
          2) Cek {getApiBase()}/api/health
          <br />
          3) HP: set NEXT_PUBLIC_API_URL ke IP Wi‑Fi laptop di .env.local
        </p>
        <button type="button" className="btn-primary w-full" onClick={load}>
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">API · {getApiBase()}</p>
      {items.map((ev) => {
        const id = ev.eventId ?? ev.id;
        const src = posterUrl(id);
        return (
          <Link
            key={id}
            href={`/event/${id}`}
            className="card flex gap-3 transition hover:border-sky-500/50"
          >
            <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-900">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-extrabold leading-tight">
                {ev.title || ev.artist}
              </h2>
              <p className="truncate text-sm text-slate-400">{ev.artist}</p>
              <p className="mt-1 text-xs text-slate-500">
                Sisa {ev.sisa ?? "—"} · dari {fmtRp(ev.priceIdr)}
              </p>
            </div>
          </Link>
        );
      })}
      {!items.length && (
        <p className="text-center text-slate-500">Tidak ada event.</p>
      )}
    </div>
  );
}
