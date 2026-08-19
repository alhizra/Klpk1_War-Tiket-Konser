(() => {
  const EVENT_ID = 1;
  const MAX_SELECT = 4;
  const ROWS = [
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
    const codes = [];
    for (const row of ROWS) {
      for (let i = 1; i <= row.count; i++) {
        codes.push(`${row.label}${String(i).padStart(2, "0")}`);
      }
    }
    return codes;
  }

  function markSoldFromQuota(sisa, quotaTotal) {
    // Denah visual: kursi "terjual" diisi dari belakang berdasarkan terjual live
    const codes = allSeatCodes();
    const soldCount = Math.max(0, Math.min(codes.length, (quotaTotal || codes.length) - (sisa ?? 0)));
    // Prefer API sold list if provided
    if (eventData?.soldSeats?.length) {
      soldCodes = new Set(eventData.soldSeats);
      return;
    }
    soldCodes = new Set(codes.slice(codes.length - soldCount));
  }

  function renderEvent() {
    if (!eventData) return;
    el("eventTitle").textContent = eventData.title || "Event";
    el("eventArtist").textContent = eventData.artist || "—";
    el("eventVenue").textContent = eventData.venue || "—";
    el("eventDate").textContent = fmtDate(eventData.startsAt);
    el("eventPrice").textContent = fmtRp(eventData.priceIdr);
    el("eventQuota").textContent = String(eventData.quotaTotal ?? "—");
    el("eventSold").textContent = String(eventData.terjual ?? 0);
    el("eventSisa").textContent = String(eventData.sisa ?? "—");
    el("quotaPill").textContent = `Sisa kursi: ${eventData.sisa ?? "—"} / ${eventData.quotaTotal ?? "—"}`;
    el("eventDesc").textContent =
      eventData.description ||
      "Pilih kursi di denah, lalu pesan. Satu unit kuota hanya bisa terjual sekali (anti-oversell).";
  }

  function updateCheckout() {
    const list = [...selected];
    el("selectedList").textContent = list.length ? list.join(", ") : "Belum ada";
    el("selectedCount").textContent = String(list.length);
    const total = list.length * (eventData?.priceIdr || 0);
    el("totalPrice").textContent = fmtRp(total);
    el("btnOrder").disabled = list.length === 0;
  }

  function renderMap() {
    const root = el("seatMap");
    root.innerHTML = "";
    let lastCat = "";
    for (const row of ROWS) {
      if (row.cat !== lastCat) {
        const tag = document.createElement("div");
        tag.className = "cat-tag";
        tag.textContent = row.cat;
        root.appendChild(tag);
        lastCat = row.cat;
      }
      const rowEl = document.createElement("div");
      rowEl.className = "row";
      const lab = document.createElement("div");
      lab.className = "row-label";
      lab.textContent = row.label;
      const seats = document.createElement("div");
      seats.className = "seats";
      for (let i = 1; i <= row.count; i++) {
        const code = `${row.label}${String(i).padStart(2, "0")}`;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "seat";
        btn.dataset.code = code;
        btn.textContent = String(i);
        btn.title = code;
        const isSold = soldCodes.has(code);
        if (isSold) {
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
    markSoldFromQuota(eventData.sisa, eventData.quotaTotal);
    // buang pilihan yang sudah sold
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
    try {
      await loadEvent();
      toast("Siap war · pilih kursi lalu pesan", "ok");
    } catch (e) {
      toast(e.message || "Gagal load data event", "err");
    }
    // refresh sisa kursi berkala
    setInterval(() => {
      loadEvent().catch(() => {});
      loadHealth().catch(() => {});
    }, 8000);
  }

  boot();
})();
