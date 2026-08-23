(() => {
  const MAX_SELECT = 4;
  const params = new URLSearchParams(location.search);
  let currentEventId = Number(params.get("event") || 0);

  const el = (id) => document.getElementById(id);
  const selected = new Set();
  let eventData = null;
  let soldCodes = new Set();
  let seatLayout = [];
  let allEvents = [];

  function metaOf(id) {
    return (window.EVENT_META && window.EVENT_META[id]) || {};
  }

  function benefitsOf(eventId, catCode) {
    const m = metaOf(eventId);
    const map = m.benefits || {};
    return map[catCode] || map[String(catCode).toUpperCase()] || window.defaultBenefits(catCode);
  }

  const POSTER_BY_ID = {
    1: "/posters/01-treasure.jpg",
    2: "/posters/02-lykn.png",
    3: "/posters/03-blackpink.jpg",
    4: "/posters/04-nctdream.jpg",
    5: "/posters/05-exo.jpg",
    6: "/posters/06-ateez.jpg",
    7: "/posters/07-bus.jpg",
    8: "/posters/08-straykids.jpg",
    9: "/posters/09-aespa.jpg",
    10: "/posters/10-seventeen.jpg",
    11: "/posters/11-4eve.jpg",
    12: "/posters/12-iu.jpg",
    13: "/posters/13-newjeans.jpg",
    14: "/posters/14-seventeen-encore.jpg",
    15: "/posters/15-twice.jpg",
    16: "/posters/16-lesserafim.jpg",
    17: "/posters/17-itzy.jpg",
    18: "/posters/18-gidle.jpg",
    19: "/posters/19-enhypen.jpg",
    20: "/posters/20-ive.jpg",
    21: "/posters/21-bts.jpg",
    22: "/posters/22-txt.jpg",
    23: "/posters/23-riize.jpg",
    24: "/posters/24-boynextdoor.jpg",
    25: "/posters/25-zerobaseone.jpg",
    26: "/posters/26-kissoflife.jpg",
    27: "/posters/27-nmixx.jpg",
    28: "/posters/28-babymonster.jpg",
    29: "/posters/29-illit.jpg",
    30: "/posters/30-katseye.jpg",
  };

  function posterOf(ev) {
    if (ev && ev.posterUrl) return ev.posterUrl;
    const id = Number(ev && (ev.eventId || ev.id));
    return (
      metaOf(id).poster ||
      POSTER_BY_ID[id] ||
      `https://picsum.photos/seed/wtk${id || 0}/600/800`
    );
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
        weekday: "short",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(iso);
    }
  }

  function fmtDateShort(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("id-ID", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return String(iso);
    }
  }

  function toast(msg, type = "") {
    const t = el("toast");
    if (!t) return;
    t.textContent = msg;
    t.className = `toast ${type}`;
    if (!msg) t.classList.add("hidden");
    else t.classList.remove("hidden");
  }

  function setNavActive(name) {
    document.querySelectorAll("#mainNav a").forEach((a) => {
      a.classList.toggle("active", a.dataset.nav === name);
    });
  }

  function showList(opts = {}) {
    el("view-list").classList.remove("hidden");
    el("view-detail").classList.add("hidden");
    currentEventId = 0;
    setNavActive(opts.nav || "concert");
    const hash = opts.hash ? `#${opts.hash}` : "";
    history.replaceState({}, "", `/${hash}`);
    if (opts.scrollList) {
      requestAnimationFrame(() => {
        el("list")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function showDetail(id, opts = {}) {
    currentEventId = Number(id);
    el("view-list").classList.add("hidden");
    el("view-detail").classList.remove("hidden");
    setNavActive(opts.nav || "booking");
    history.replaceState({}, "", `/?event=${currentEventId}`);
    selected.clear();
    loadEventDetail(currentEventId).then(() => {
      if (opts.openSeat) {
        const tab = document.querySelector('.tab[data-tab="tab-seat"]');
        if (tab) tab.click();
        setTimeout(() => {
          el("seatMap")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      }
    });
  }

  /** Open Sale = daftar event open; Booking = denah kursi event aktif / pilih dulu */
  function goOpenSale() {
    showList({ nav: "opensale", hash: "list", scrollList: true });
    loadEventList().catch(() => {});
  }

  function goBooking() {
    if (currentEventId > 0) {
      showDetail(currentEventId, { nav: "booking", openSeat: true });
      return;
    }
    // belum pilih event → ke open sale + petunjuk
    showList({ nav: "opensale", hash: "list", scrollList: true });
    loadEventList()
      .then(() => {
        toast("Pilih konser dulu, lalu Booking / Pilih kursi", "");
      })
      .catch(() => {});
  }

  async function loadHealth() {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      const chip = el("apiStatus");
      chip.textContent = data.ok ? "Online" : "Offline";
      chip.classList.toggle("ok", !!data.ok);
    } catch {
      el("apiStatus").textContent = "Offline";
      el("apiStatus").classList.remove("ok");
    }
  }

  async function loadEventList() {
    const res = await fetch("/api/events?size=50");
    if (!res.ok) throw new Error("Gagal memuat daftar event");
    const data = await res.json();
    allEvents = data.items || [];
    el("listCount").textContent = `${allEvents.length} event`;
    const grid = el("eventGrid");
    grid.innerHTML = "";

    for (const ev of allEvents) {
      const m = metaOf(ev.eventId);
      const minP =
        ev.categories?.length
          ? Math.min(...ev.categories.map((c) => c.priceIdr || ev.priceIdr))
          : ev.priceIdr;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "event-card";
      const sisa = ev.sisa ?? "—";
      const low = Number(ev.sisa) >= 0 && Number(ev.sisa) <= 20;
      btn.innerHTML = `
        <div class="thumb-wrap">
          <img class="thumb" src="${posterOf(ev)}" alt="" loading="lazy" />
          ${m.tag ? `<span class="tag">${m.tag}</span>` : `<span class="tag tag-open">OPEN</span>`}
        </div>
        <div class="body">
          <h3>${ev.title || ev.artist || "Event"}</h3>
          <p class="meta meta-date">${fmtDateShort(ev.startsAt)}</p>
          <p class="meta">${ev.venue || "—"}</p>
          <p class="meta meta-city">${[ev.city, ev.quotaTotal != null ? ev.quotaTotal + " seats" : ""].filter(Boolean).join(" · ")}</p>
          <div class="card-foot">
            <div class="price">${fmtRp(minP)} <span class="price-tilde">~</span></div>
            <div class="stock ${low ? "low" : ""}">Sisa ${sisa}/${ev.quotaTotal ?? "—"}</div>
          </div>
        </div>
      `;
      btn.addEventListener("click", () => showDetail(ev.eventId));
      grid.appendChild(btn);
    }
  }

  function buildLayoutFromEvent(data) {
    if (data?.seats?.length) {
      seatLayout = data.seats.map((s) => ({
        code: String(s.code).toUpperCase(),
        category: s.category || "REG",
        categoryName: s.categoryName || s.category,
        row: s.row || String(s.code)[0],
        number: s.number || 0,
        priceIdr: s.priceIdr || data.priceIdr,
        color: s.color || catColor(data, s.category),
      }));
      return;
    }
    seatLayout = [];
  }

  function catColor(data, code) {
    const c = (data.categories || []).find((x) => x.code === code);
    return c?.color || "#94a3b8";
  }

  function markSold() {
    const codes = seatLayout.map((s) => s.code);
    const fromApi = new Set(
      (eventData?.soldSeats || []).map((c) => String(c).toUpperCase())
    );
    const sisa = Number(eventData?.sisa);
    const quota = Number(eventData?.quotaTotal) || codes.length;
    // Kuota habis → semua kursi di denah dianggap sold (tidak bisa diklik)
    if (Number.isFinite(sisa) && sisa <= 0) {
      soldCodes = new Set(codes);
      return;
    }
    if (fromApi.size) {
      soldCodes = fromApi;
      return;
    }
    const soldCount = Math.max(
      0,
      Math.min(codes.length, quota - (Number.isFinite(sisa) ? sisa : quota))
    );
    soldCodes = new Set(codes.slice(Math.max(0, codes.length - soldCount)));
  }

  function priceOf(code) {
    const s = seatLayout.find((x) => x.code === code);
    return s?.priceIdr || eventData?.priceIdr || 0;
  }

  function catOf(code) {
    return seatLayout.find((x) => x.code === code)?.category || "";
  }

  function updateCheckout() {
    const list = [...selected];
    const sisa = Number(eventData?.sisa);
    const habis = Number.isFinite(sisa) && sisa <= 0;
    el("selectedList").textContent = list.length
      ? list.join(", ")
      : habis
        ? "Kuota habis — tidak bisa booking"
        : "Belum ada";
    el("selectedCount").textContent = String(list.length);
    const total = list.reduce((sum, c) => sum + priceOf(c), 0);
    el("totalPrice").textContent = fmtRp(total);
    el("btnOrder").disabled = list.length === 0 || habis;
    const go = el("btnGoSeat");
    if (go) {
      go.disabled = habis;
      go.textContent = habis
        ? "매진 · Sold out"
        : "좌석 선택 · Pilih kursi";
    }

    const bp = el("benefitPreview");
    if (habis) {
      bp.innerHTML =
        "<strong style='color:#b91c1c'>Sold out</strong> — kursi untuk event ini sudah habis.";
      bp.classList.add("show");
    } else if (list.length) {
      const cats = [...new Set(list.map(catOf))];
      const lines = cats.flatMap((c) => {
        const bens = benefitsOf(currentEventId, c).slice(0, 2);
        return bens.map((b) => `· [${c}] ${b}`);
      });
      bp.innerHTML = `<strong>Benefit zona:</strong><br>${lines.join("<br>")}`;
      bp.classList.add("show");
    } else {
      bp.classList.remove("show");
      bp.innerHTML = "";
    }
  }

  function renderVenueSketch() {
    const box = el("venueSketch");
    const cats = eventData.categories || [];
    box.innerHTML = cats
      .map(
        (c) =>
          `<div class="zone-block" style="background:${c.color || "#64748b"}">${c.code}<br><small style="font-weight:600;opacity:.9">${c.quota}</small></div>`
      )
      .join("");
  }

  function renderLegend() {
    const box = el("legendColors");
    const cats = eventData.categories || [];
    box.innerHTML =
      cats
        .map(
          (c) =>
            `<span><i class="swatch" style="background:${c.color || "#94a3b8"}"></i>${c.code} · ${fmtRp(c.priceIdr)}</span>`
        )
        .join("") +
      `<span><i class="swatch" style="background:#334155"></i>SOLD</span>
       <span><i class="swatch" style="background:#00cd3c;outline:2px solid #111"></i>SELECTED</span>`;
  }

  function renderMap() {
    const root = el("seatMap");
    root.innerHTML = "";
    const byCat = new Map();
    for (const s of seatLayout) {
      if (!byCat.has(s.category)) byCat.set(s.category, new Map());
      const byRow = byCat.get(s.category);
      if (!byRow.has(s.row)) byRow.set(s.row, []);
      byRow.get(s.row).push(s);
    }
    for (const [cat, byRow] of byCat) {
      const catInfo = (eventData.categories || []).find((c) => c.code === cat);
      const tag = document.createElement("div");
      tag.className = "cat-tag";
      tag.innerHTML = `<i class="swatch" style="background:${catInfo?.color || "#94a3b8"}"></i> ${catInfo?.name || cat} · ${fmtRp(catInfo?.priceIdr || 0)} · quota ${catInfo?.quota ?? "—"}`;
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
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "seat";
          btn.dataset.code = s.code;
          btn.textContent = String(s.number || "").slice(-2) || "·";
          btn.title = `${s.code} · ${fmtRp(s.priceIdr)}`;
          const color = s.color || catInfo?.color || "#94a3b8";
          if (soldCodes.has(s.code)) {
            btn.classList.add("sold");
            btn.disabled = true;
          } else {
            btn.style.background = color;
            if (selected.has(s.code)) btn.classList.add("selected");
          }
          btn.addEventListener("click", () => toggleSeat(s.code));
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
    if (soldCodes.has(code)) {
      toast("Kursi sudah terjual", "err");
      return;
    }
    const sisa = Number(eventData?.sisa);
    if (Number.isFinite(sisa) && sisa <= 0) {
      toast("Kursi untuk event ini sudah habis.", "err");
      return;
    }
    if (selected.has(code)) selected.delete(code);
    else {
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
    renderMap();
  }

  function renderBenefitsAll() {
    const box = el("benefitAll");
    const cats = eventData.categories || [];
    box.innerHTML = cats
      .map((c) => {
        const bens = benefitsOf(currentEventId, c.code);
        return `<div class="benefit-card">
          <h4><i class="swatch" style="background:${c.color || "#94a3b8"}"></i> ${c.name || c.code}</h4>
          <p class="muted" style="margin:0 0 .4rem;font-size:.8rem">${fmtRp(c.priceIdr)} · ${c.quota} seats</p>
          <ul>${bens.map((b) => `<li>${b}</li>`).join("")}</ul>
        </div>`;
      })
      .join("");
  }

  function renderDetail() {
    const m = metaOf(currentEventId);
    const poster = posterOf(eventData);
    el("dPoster").src = poster;
    el("dPosterSm").src = poster;
    el("dTag").textContent = m.tag || "OPEN SALE";
    el("dGenre").textContent = m.genre || "Concert";
    el("dTitle").textContent = eventData.title || eventData.artist;
    el("dTitleSm").textContent = eventData.title || eventData.artist;
    el("dArtist").textContent = eventData.artist || "—";
    el("dPeriod").textContent = fmtDate(eventData.startsAt);
    el("dDateSm").textContent = fmtDate(eventData.startsAt);
    el("dVenue").textContent = `${eventData.venue || "—"}${eventData.city ? " · " + eventData.city : ""}`;
    el("dRating").textContent = eventData.ageRating || "All ages";
    el("dGate").textContent = eventData.gateOpen || "—";
    el("dSisa").textContent = `${eventData.sisa ?? "—"} seats`;
    el("dSisaSm").textContent = String(eventData.sisa ?? "—");
    el("dQuota").textContent = String(eventData.quotaTotal ?? "—");
    el("dQuotaSm").textContent = String(eventData.quotaTotal ?? "—");
    el("dDesc").textContent = eventData.description || "—";

    const minP =
      eventData.categories?.length
        ? Math.min(...eventData.categories.map((c) => c.priceIdr || eventData.priceIdr))
        : eventData.priceIdr;
    el("dPriceMin").textContent = `${fmtRp(minP)} ~`;

    el("dPriceList").innerHTML = (eventData.categories || [])
      .map(
        (c) =>
          `<div class="price-row">
            <span><i class="swatch" style="background:${c.color || "#94a3b8"}"></i>${c.name || c.code}</span>
            <strong>${fmtRp(c.priceIdr)}</strong>
          </div>`
      )
      .join("");

    el("dSchedule").innerHTML = `
      <li>Show: <strong>${fmtDate(eventData.startsAt)}</strong></li>
      <li>Sale open: ${fmtDate(eventData.salesOpensAt)}</li>
      <li>Gate open: ${eventData.gateOpen || "—"}</li>
      <li>Venue: ${eventData.venue || "—"}</li>
    `;

    const defaultTerms = [
      "Maksimal 4 tiket per transaksi / pesanan",
      "Satu kursi hanya boleh terjual satu kali",
      "Wajib membawa identitas sesuai nama di e-ticket saat masuk venue",
      "E-ticket dikirim ke email pembeli setelah pembayaran berhasil",
      "Tiket non-refundable kecuali event dibatalkan oleh promoter",
      "Dilarang memindahkan / menjual tiket di atas harga resmi",
      "Penonton wajib mematuhi aturan keamanan dan dress code venue",
      "Gate open mengikuti jadwal di detail event; datang lebih awal disarankan",
    ];
    const terms =
      Array.isArray(eventData.terms) && eventData.terms.length
        ? eventData.terms
        : defaultTerms;
    el("dTerms").innerHTML = terms.map((t) => `<li>${t}</li>`).join("");

    renderVenueSketch();
    renderLegend();
    renderBenefitsAll();
    renderMap();
  }

  async function loadEventDetail(id, opts = {}) {
    const keepResult = opts.keepResult === true;
    if (!keepResult) {
      toast("");
      el("orderResult").classList.add("hidden");
    }
    const res = await fetch(`/api/events/${id}`);
    if (!res.ok) {
      toast("Event tidak ditemukan", "err");
      return;
    }
    eventData = await res.json();
    buildLayoutFromEvent(eventData);
    markSold();
    // Jangan hapus pilihan kursi user saat refresh sisa (keepSelection)
    if (!opts.keepSelection) {
      /* selected tetap jika keepSelection — renderMap pakai selected */
    }
    renderDetail();
    if (!keepResult && Number(eventData.sisa) <= 0) {
      toast("Sold out — kursi sudah habis.", "err");
    }
  }

  /** Refresh sisa/sold tanpa menghapus checkout / hasil booking */
  async function refreshLiveQuiet(id) {
    try {
      const res = await fetch(`/api/events/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      eventData = data;
      buildLayoutFromEvent(data);
      markSold();
      // buang dari selected yang sudah sold
      for (const c of [...selected]) {
        if (soldCodes.has(c)) selected.delete(c);
      }
      if (el("dSisa")) el("dSisa").textContent = `${data.sisa ?? "—"} seats`;
      if (el("dSisaSm")) el("dSisaSm").textContent = String(data.sisa ?? "—");
      renderMap();
    } catch {
      /* ignore */
    }
  }

  /** Materi P3: 429 mundur teratur (1s → 2s → 4s), hormati Retry-After, max 3x */
  function tidur(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function fetchOrderDenganBatasLaju(body, percobaan = 0) {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 429 && percobaan < 3) {
      const saran = Number(res.headers.get("Retry-After"));
      const jeda =
        Number.isFinite(saran) && saran > 0
          ? saran * 1000
          : 1000 * 2 ** percobaan;
      toast(
        `Batas laju (429). Menunggu ${Math.ceil(jeda / 1000)}s lalu coba lagi…`,
        ""
      );
      await tidur(jeda);
      return fetchOrderDenganBatasLaju(body, percobaan + 1);
    }
    return res;
  }

  let memesan = false;

  function shortId(id) {
    const s = String(id || "");
    return s.length > 10 ? s.slice(0, 8).toUpperCase() : s.toUpperCase();
  }

  function parseTicketFields(text) {
    const t = String(text || "");
    const grab = (label) => {
      const m = t.match(new RegExp(label + "\\s*:\\s*(.+)", "i"));
      return m ? m[1].trim() : "";
    };
    return {
      seats: grab("Seats") || grab("Kursi"),
      qty: grab("Qty") || grab("Jumlah"),
      total: grab("Total"),
      event: grab("Event"),
    };
  }

  function renderReceipt({
    paid,
    orderId,
    seats,
    amountIdr,
    email,
    benefits,
    pendingPay,
  }) {
    const seatStr = Array.isArray(seats) ? seats.join(", ") : seats || "—";
    const benHtml = (benefits || [])
      .map((b) => `<li>${String(b).replace(/^•\s*/, "").replace(/^\[[^\]]+\]\s*/, "")}</li>`)
      .join("");
    const payHtml = pendingPay
      ? `<button type="button" class="btn primary" id="btnPayNow" style="margin-top:.75rem;width:100%">Bayar sekarang</button>`
      : "";
    return `
      <div class="receipt">
        <div class="receipt-badge ${paid ? "ok" : "wait"}">${paid ? "Pembayaran berhasil" : "Menunggu pembayaran"}</div>
        <h3 class="receipt-title">${paid ? "Tiket kamu siap" : "Selesaikan pembayaran"}</h3>
        <dl class="receipt-dl">
          <div><dt>Kode booking</dt><dd>${shortId(orderId)}</dd></div>
          <div><dt>Kursi</dt><dd>${seatStr}</dd></div>
          <div><dt>Total</dt><dd>${fmtRp(amountIdr)}</dd></div>
          ${email ? `<div><dt>E-ticket</dt><dd>${email}</dd></div>` : ""}
        </dl>
        ${payHtml}
        <div id="eticketBox" class="receipt-ticket ${paid ? "" : "hidden"}">
          ${paid ? "<em>Menyiapkan e-ticket…</em>" : ""}
        </div>
        ${
          benHtml
            ? `<div class="receipt-ben"><strong>Benefit</strong><ul>${benHtml}</ul></div>`
            : ""
        }
      </div>`;
  }

  /** Ambil e-ticket di belakang layar; tampilkan ringkas ke user */
  async function pollETicket(orderId, email, attempt = 0) {
    const box = el("eticketBox");
    if (!box) return;
    try {
      const res = await fetch(`/api/mail/outbox/${encodeURIComponent(orderId)}`);
      if (res.ok) {
        const data = await res.json();
        const item = (data.items || [])[0];
        if (item) {
          const f = parseTicketFields(item.text);
          const to = item.to || email || "email kamu";
          box.classList.remove("hidden");
          box.innerHTML = `
            <div class="ticket-ready">
              <strong>E-ticket terkirim</strong>
              <p>Dikirim ke <b>${to}</b></p>
              ${f.seats ? `<p class="ticket-meta">Kursi ${f.seats}${f.qty ? ` · ${f.qty} tiket` : ""}</p>` : ""}
              <p class="ticket-hint">Cek inbox / spam. Simpan kode booking di atas.</p>
            </div>`;
          toast(`E-ticket dikirim ke ${to}`, "ok");
          return;
        }
      }
    } catch {
      /* retry */
    }
    if (attempt < 12) {
      box.innerHTML = `<em>Menyiapkan e-ticket…</em>`;
      setTimeout(() => pollETicket(orderId, email, attempt + 1), 800);
    } else {
      box.innerHTML = `<p class="ticket-hint">E-ticket sedang diproses. Cek email kamu beberapa saat lagi.</p>`;
    }
  }

  async function placeOrder() {
    const qty = selected.size;
    if (!qty) {
      toast("Pilih minimal 1 kursi dulu.", "err");
      return;
    }
    const emailRaw = (el("buyerEmail") && el("buyerEmail").value || "").trim();
    const nameRaw = (el("buyerName") && el("buyerName").value || "").trim();
    if (!nameRaw || nameRaw.length < 2) {
      toast("Isi nama pembeli dulu (min. 2 huruf).", "err");
      if (el("buyerName")) el("buyerName").focus();
      return;
    }
    if (!emailRaw) {
      toast("Isi email e-ticket dulu.", "err");
      if (el("buyerEmail")) el("buyerEmail").focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      toast("Format email tidak valid.", "err");
      if (el("buyerEmail")) el("buyerEmail").focus();
      return;
    }
    // Cegah kirim ganda (materi P3)
    if (memesan) return;
    memesan = true;

    const btn = el("btnOrder");
    btn.disabled = true;
    btn.classList.add("loading");
    btn.innerHTML =
      '<span class="btn-spinner" aria-hidden="true"></span> Memesan…';
    toast("");

    const body = {
      eventId: currentEventId,
      qty,
      seatCodes: [...selected],
      email: emailRaw,
      buyerName: nameRaw,
    };

    try {
      const res = await fetchOrderDenganBatasLaju(body);
      const data = await res.json().catch(() => ({}));

      if (res.status === 201) {
        const seatsDone = data.seatCodes || [...selected];
        const cats = [...new Set(seatsDone.map(catOf))];
        const benLines = cats.flatMap((c) =>
          benefitsOf(currentEventId, c).map((b) => b)
        );
        const paid = data.status === "CONFIRMED";
        toast(
          paid ? "Pembayaran berhasil" : "Pesanan dibuat — selesaikan pembayaran",
          paid ? "ok" : ""
        );
        el("orderResult").classList.remove("hidden");
        el("orderResult").innerHTML = renderReceipt({
          paid,
          orderId: data.orderId,
          seats: seatsDone,
          amountIdr: data.amountIdr,
          email: data.buyerEmail,
          benefits: benLines,
          pendingPay: !paid,
        });
        if (paid) pollETicket(data.orderId, data.buyerEmail);
        const btnPay = el("btnPayNow");
        if (btnPay) {
          btnPay.onclick = async () => {
            btnPay.disabled = true;
            btnPay.textContent = "Memproses…";
            const pr = await fetch("/api/payments/simulate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: data.orderId }),
            });
            const pd = await pr.json().catch(() => ({}));
            if (pr.ok && pd.ok) {
              toast("Pembayaran berhasil", "ok");
              el("orderResult").innerHTML = renderReceipt({
                paid: true,
                orderId: data.orderId,
                seats: seatsDone,
                amountIdr: data.amountIdr,
                email: data.buyerEmail,
                benefits: benLines,
              });
              pollETicket(data.orderId, data.buyerEmail);
            } else {
              toast(pd.error || "Gagal bayar", "err");
              btnPay.disabled = false;
              btnPay.textContent = "Bayar sekarang";
            }
          };
        }
        selected.clear();
        await loadEventDetail(currentEventId, { keepResult: true });
      } else if (res.status === 409) {
        toast(
          data.error ||
            "Kursi ini baru saja diambil orang lain / kuota habis. Pilih kursi lain.",
          "err"
        );
        selected.clear();
        await loadEventDetail(currentEventId, { keepResult: true });
      } else if (res.status === 429) {
        toast(
          "Server sedang sibuk (batas laju). Coba lagi beberapa detik.",
          "err"
        );
      } else if (res.status === 400) {
        toast(data.error || "Data pesanan tidak valid.", "err");
      } else {
        toast(data.error || `Gagal memesan (${res.status}). Coba lagi.`, "err");
      }
    } catch (e) {
      toast(
        e.message ||
          "Jaringan bermasalah. Periksa koneksi lalu ulangi.",
        "err"
      );
    } finally {
      memesan = false;
      btn.classList.remove("loading");
      btn.innerHTML = "예매하기 · Bayar";
      updateCheckout();
    }
  }

  // tabs
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      el(tab.dataset.tab).classList.add("active");
    });
  });

  el("btnBack").addEventListener("click", () => {
    showList({ nav: "concert" });
    loadEventList().catch(() => {});
  });
  el("btnGoSeat").addEventListener("click", () => {
    setNavActive("booking");
    document.querySelector('.tab[data-tab="tab-seat"]').click();
    el("seatMap").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  el("btnClear").addEventListener("click", () => {
    selected.clear();
    renderMap();
    toast("Pilihan dikosongkan");
  });
  el("btnOrder").addEventListener("click", placeOrder);

  // Nav: Concert / Open Sale / Booking
  document.querySelectorAll("#mainNav a").forEach((a) => {
    a.addEventListener("click", (ev) => {
      ev.preventDefault();
      const nav = a.dataset.nav;
      if (nav === "concert") {
        showList({ nav: "concert" });
        loadEventList().catch(() => {});
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (nav === "opensale") {
        goOpenSale();
      } else if (nav === "booking") {
        goBooking();
      }
    });
  });

  async function boot() {
    await loadHealth();
    try {
      await loadEventList();
      const hash = (location.hash || "").replace(/^#/, "");
      if (currentEventId > 0) {
        showDetail(currentEventId, {
          openSeat: hash === "booking" || hash === "detail",
        });
      } else if (hash === "list" || hash === "opensale") {
        goOpenSale();
      } else if (hash === "booking" || hash === "detail") {
        goBooking();
      } else {
        showList({ nav: "concert" });
      }
    } catch (e) {
      el("eventGrid").innerHTML = `<p class="muted">${e.message || "Gagal memuat konser. Coba refresh halaman."}</p>`;
    }
    setInterval(() => {
      loadHealth().catch(() => {});
      if (currentEventId > 0) {
        // Jangan full reload (itu mengosongkan checkout & hasil booking)
        refreshLiveQuiet(currentEventId).catch(() => {});
      } else {
        loadEventList().catch(() => {});
      }
    }, 12000);
  }

  boot();
})();
