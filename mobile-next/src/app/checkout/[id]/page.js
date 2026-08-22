"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { apiPost, fmtRp } from "@/lib/api";

function CheckoutForm() {
  const { id } = useParams();
  const sp = useSearchParams();
  const router = useRouter();
  const seats = (sp.get("seats") || "").split(",").filter(Boolean);
  const title = sp.get("title") || "Konser";
  const qty = Number(sp.get("qty") || seats.length || 1);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  async function bayar() {
    const n = name.trim();
    const m = email.trim();
    if (!n || n.length < 2) {
      setErr("Isi nama pembeli (min. 2 huruf).");
      return;
    }
    if (!m || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)) {
      setErr("Isi email e-ticket yang valid.");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const pesanan = await apiPost("/api/orders", {
        eventId: Number(id),
        qty,
        seatCodes: seats,
        email: m,
        buyerName: n,
      });
      const q = new URLSearchParams({
        orderId: pesanan.orderId || "",
        status: pesanan.status || "CONFIRMED",
        seats: (pesanan.seatCodes || seats).join(","),
        title,
        amount: String(pesanan.amountIdr || ""),
        email: m,
      });
      router.replace(`/ticket?${q.toString()}`);
    } catch (e) {
      if (e.status === 409) setErr("Kursi/kuota habis. Pilih kursi lain.");
      else if (e.status === 400) setErr(e.message || "Data tidak valid.");
      else if (e.status === 429) setErr("Server sibuk (429). Coba lagi.");
      else setErr(e.message || "Gagal order");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Link href={`/event/${id}`} className="text-sm text-sky-400">
        ← Denah
      </Link>
      <div className="card space-y-1">
        <p className="text-xs font-bold uppercase text-green-400">Pembayaran</p>
        <h2 className="text-xl font-extrabold">{title}</h2>
        <p className="text-sm text-slate-400">
          {qty} tiket · {seats.join(", ") || "—"}
        </p>
      </div>

      <label className="block text-sm text-slate-400">
        Nama pembeli *
        <input
          className="input mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama di e-ticket"
          disabled={loading}
        />
      </label>
      <label className="block text-sm text-slate-400">
        Email e-ticket *
        <input
          className="input mt-1"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nama@email.com"
          disabled={loading}
        />
      </label>

      {err && <p className="text-center text-sm text-red-400">{err}</p>}

      <button
        type="button"
        className="btn-green w-full"
        disabled={loading || !seats.length}
        onClick={bayar}
      >
        {loading ? "Memproses…" : "Bayar sekarang (POST /orders)"}
      </button>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<p className="text-slate-400">Memuat…</p>}>
      <CheckoutForm />
    </Suspense>
  );
}
