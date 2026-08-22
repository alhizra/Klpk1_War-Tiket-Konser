"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { fmtRp } from "@/lib/api";

function TicketView() {
  const sp = useSearchParams();
  const orderId = sp.get("orderId") || "—";
  const status = sp.get("status") || "CONFIRMED";
  const seats = sp.get("seats") || "—";
  const title = sp.get("title") || "Konser";
  const amount = sp.get("amount");
  const email = sp.get("email") || "";

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold uppercase text-green-400">E-Ticket</p>
      <h2 className="text-xl font-extrabold">{title}</h2>

      <div className="card space-y-3 bg-white text-slate-900">
        <p className="text-center text-xs font-bold tracking-widest text-slate-500">
          WTK PASS
        </p>
        <p className="break-all text-center font-mono text-sm font-extrabold">
          {orderId}
        </p>
        <p className="text-center text-sm text-slate-600">Tunjukkan di pintu</p>
        <p className="text-center font-bold">{seats}</p>
        {amount ? (
          <p className="text-center text-sm">{fmtRp(amount)}</p>
        ) : null}
        {email ? (
          <p className="text-center text-xs text-slate-500">{email}</p>
        ) : null}
        <p className="text-center text-xs text-slate-400">Status: {status}</p>
      </div>

      <Link href="/" className="btn-primary block">
        Kembali ke daftar
      </Link>
    </div>
  );
}

export default function TicketPage() {
  return (
    <Suspense fallback={<p className="text-slate-400">Memuat tiket…</p>}>
      <TicketView />
    </Suspense>
  );
}
