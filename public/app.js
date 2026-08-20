(() => {
  const EVENT_ID = Number(new URLSearchParams(location.search).get("event") || 1);
  const MAX_SELECT = 4;
  /** Denah bawaan jika API belum kirim seats (data manual kosong) */
  const DEFAULT_ROWS = [
    { label: "A", count: 12, cat: "VIP" },
    { label: "B", count: 14, cat: "CAT1" },
    { label: "C", count: 14, cat: "CAT1" },
    { label: "D", count: 16, cat: "CAT2" },
    { label: "E", count: 16, cat: "CAT2" },
    { label: "F", count: 12, cat: "FEST" },
  ];

  const el = (id) => document.getElementById(id);
  const selected = new Set();
  let eventData = null;
  let soldCodes = new Set();
  let seatLayout = []; // [{code, category, row, number, priceIdr}]

  function buildLayoutFromEvent(data) {
    if (data?.seats?.length) {
      seatLayout = data.seats.map((s) => ({
        code: String(s.code).toUpperCase(),
        category: s.category || "REG",
        row: s.row || String(s.code)[0],
        number: s.number || 0,
        priceIdr: s.priceIdr || data.priceIdr,
      }));
      return;
    }
    // fallback denah bawaan
    seatLayout = [];
    for (const row of DEFAULT_ROWS) {
      for (let i = 1; i <= row.count; i++) {
        seatLayout.push({
          code: `${row.label}${String(i).padStart(2, "0")}`,
          category: row.cat,
          row: row.label,
          number: i,
          priceIdr: data?.priceIdr || 0,
        });
      }
    }
  }

  function fmtRp(n) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number(n) || 0);
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("id-ID", {
        dateStyle: "full",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  }

  function toast(msg, type = "") {
    const t = el("toast");
    t.textContent = msg;
    t.className = `toast ${type}`;
  }

  function allSeatCodes() {
    return seatLayout.map((s) => s.code);
  }

  function markSoldFromQuota(sisa, quotaTotal) {
    const codes = allSeatCodes();
    if (eventData?.soldSeats?.length) {
      soldCodes = new Set(eventData.soldSeats.map((c) => String(c).toUpperCase()));
      return;
    }
    const soldCount = Math.max(
      0,
      Math.min(codes.length, (quotaTotal || codes.length) - (sisa ?? 0))
    );
    soldCodes = new Set(codes.slice(codes.length - soldCount));
  }

  function renderEvent() {
    if (!eventData) return;
    el("eventTitle").textContent = eventData.title || "Event";
    el("eventArtist").textContent = eventData.artist || "—";
    if (el("eventCity")) {
      el("eventCity").textContent = eventData.city
        ? `${eventData.city}${eventData.country ? ", " + eventData.country : ""}`
        : "South Korea";
    }
    el("eventVenue").textContent = eventData.venue || "—";
    el("eventDate").textContent = fmtDate(eventData.startsAt);
    const minPrice =
      eventData.categories?.length
        ? Math.min(...eventData.categories.map((c) => c.priceIdr || eventData.priceIdr))
        : eventData.priceIdr;
    el("eventPrice").textContent = fmtRp(minPrice);
    el("eventQuota").textContent = String(eventData.quotaTotal ?? "—");
    el("eventSold").textContent = String(eventData.terjual ?? 0);
    el("eventSisa").textContent = String(eventData.sisa ?? "—");
    el("quotaPill").textContent = `Sisa: ${eventData.sisa ?? "—"} / ${eventData.quotaTotal ?? "—"}`;
    el("eventDesc").textContent =
      eventData.description ||
      "Pilih kursi di denah. Satu seat code hanya terjual sekali (anti-oversell).";
    if (el("eventGate")) {
      const bits = [];
      if (eventData.gateOpen) bits.push(`Gate open ${eventData.gateOpen}`);
      if (eventData.ageRating) bits.push(eventData.ageRating);
      el("eventGate").textContent = bits.join(" · ");
    }
    if (el("catList") && eventData.categories?.length) {
      el("catList").innerHTML = eventData.categories
        .map(
          (c) =>
            `<div style="display:flex;justify-content:space-between;gap:.5rem;border-bottom:1px solid #1e293b;padding:.25rem 0">
              <span><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${c.color || "#64748b"};margin-right:.35rem"></i>${c.name || c.code}</span>
              <span>${fmtRp(c.priceIdr)} · ${c.quota} seats</span>
            </div>`
        )
        .join("");
    }
  }

  async function renderEventSwitch() {
    const box = el("eventSwitch");
    if (!box) return;
    try {
      const res = await fetch("/api/events?size=20");
      const data = await res.json();
      const items = data.items || [];
      box.innerHTML = items
        .map((ev) => {
          const active = Number(ev.eventId) === EVENT_ID;
          return `<a href="/?event=${ev.eventId}" style="
            text-decoration:none;font-size:.75rem;font-weight:700;
            padding:.35rem .65rem;border-radius:999px;
            border:1px solid ${active ? "#38bdf8" : "#334155"};
            background:${active ? "rgba(56,189,248,.15)" : "#0f172a"};
            color:${active ? "#7dd3fc" : "#94a3b8"}">${ev.artist || "Event " + ev.eventId}</a>`;
        })
        .join("");
    } catch {
      box.innerHTML = "";
    }
  }

  function priceOf(code) {
    const s = seatLayout.find((x) => x.code === code);
    return s?.priceIdr || eventData?.priceIdr || 0;
  }

  function updateCheckout() {
    const list = [...selected];
    el("selectedList").textContent = list.length ? list.join(", ") : "Belum ada";
    el("selectedCount").textContent = String(list.length);
    const total = list.reduce((sum, c) => sum + priceOf(c), 0);
    el("totalPrice").textContent = fmtRp(total);
    el("btnOrder").disabled = list.length === 0;
  }

  function renderMap() {
    const root = el("seatMap");
    root.innerHTML = "";
    // group by category then row
    const byCat = new Map();
    for (const s of seatLayout) {
      if (!byCat.has(s.category)) byCat.set(s.category, new Map());
      const byRow = byCat.get(s.category);
      if (!byRow.has(s.row)) byRow.set(s.row, []);
      byRow.get(s.row).push(s);
    }
    for (const [cat, byRow] of byCat) {
      const tag = document.createElement("div");
      tag.className = "cat-tag";
      tag.textContent = cat;
      root.appendChild(tag);
      for (const [rowLabel, seatsInRow] of byRow) {
        seatsInRow.sort((a, b) => a.number - b.number);
        const rowEl = document.createElement("div");
        rowEl.className = "row";
        const lab = document.createElement("div");
        lab.className = "row-label";
        lab.textContent = rowLabel;
        const seats = document.createElement("div");
        seats.className = "seats";
        for (const s of seatsInRow) {
          const code = s.code;
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "seat";
          btn.dataset.code = code;
          btn.textContent = String(s.number || code.replace(/\D/g, "") || "·");
          btn.title = `${code} · ${fmtRp(s.priceIdr)}`;
          if (soldCodes.has(code)) {
            btn.classList.add("sold");
            btn.disabled = true;
          } else if (selected.has(code)) {
            btn.classList.add("selected");
          }
          btn.addEventListener("click", () => toggleSeat(code));
          seats.appendChild(btn);
        }
        rowEl.appendChild(lab);
        rowEl.appendChild(seats);
        root.appendChild(rowEl);
      }
    }
    updateCheckout();
  }

  function toggleSeat(code) {
    if (soldCodes.has(code)) return;
    if (selected.has(code)) {
      selected.delete(code);
    } else {
      if (selected.size >= MAX_SELECT) {
        toast(`Maksimal ${MAX_SELECT} kursi per pesanan`, "err");
        return;
      }
      if (eventData && selected.size >= (eventData.sisa || 0)) {
        toast("Sisa kursi tidak cukup", "err");
        return;
      }
      selected.add(code);
    }
    toast("");
    el("toast").classList.add("hidden");
    renderMap();
  }

  async function loadEvent() {
    const res = await fetch(`/api/events/${EVENT_ID}`);
    if (!res.ok) throw new Error("Gagal memuat event");
    eventData = await res.json();
    buildLayoutFromEvent(eventData);
    markSoldFromQuota(eventData.sisa, eventData.quotaTotal);
    for (const c of [...selected]) {
      if (soldCodes.has(c)) selected.delete(c);
    }
    renderEvent();
    renderMap();
  }

  async function loadHealth() {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      const pill = el("apiStatus");
      pill.textContent = data.ok ? `API OK · ${data.instance || "backend"}` : "API down";
      pill.className = data.ok ? "pill ok" : "pill bad";
    } catch {
      el("apiStatus").textContent = "API offline";
      el("apiStatus").className = "pill bad";
    }
  }

  async function placeOrder() {
    const qty = selected.size;
    if (!qty) return;
    el("btnOrder").disabled = true;
    el("btnOrder").textContent = "Memesan…";
    el("orderResult").classList.add("hidden");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: EVENT_ID,
          qty,
          seatCodes: [...selected],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201) {
        toast(`Berhasil pesan ${qty} tiket · sisa ${data.sisa}`, "ok");
        el("orderResult").classList.remove("hidden");
        el("orderResult").innerHTML = `
          <strong>Pesanan berhasil</strong>
          <code>orderId: ${data.orderId}</code>
          <code>kursi: ${(data.seatCodes || [...selected]).join(", ")}</code>
          <code>total: ${fmtRp(data.amountIdr)}</code>
          <code>status: ${data.status}</code>
        `;
        selected.clear();
        await loadEvent();
      } else if (res.status === 409) {
        toast(data.error || "Kuota habis / kursi tidak tersedia", "err");
        await loadEvent();
      } else {
        toast(data.error || `Gagal (${res.status})`, "err");
      }
    } catch (e) {
      toast(e.message || "Jaringan error", "err");
    } finally {
      el("btnOrder").textContent = "Pesan tiket";
      updateCheckout();
    }
  }

  el("btnClear").addEventListener("click", () => {
    selected.clear();
    renderMap();
    toast("Pilihan dikosongkan");
  });
  el("btnOrder").addEventListener("click", placeOrder);

  async function boot() {
    await loadHealth();
    await renderEventSwitch();
    try {
      await loadEvent();
      toast("Siap war K-pop · pilih zona/kursi lalu pesan", "ok");
    } catch (e) {
      toast(e.message || "Gagal load data event — jalankan npm run data:manual", "err");
    }
    setInterval(() => {
      loadEvent().catch(() => {});
      loadHealth().catch(() => {});
    }, 8000);
  }

  boot();
})();
