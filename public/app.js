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

  function posterOf(ev) {
    return metaOf(ev.eventId).poster ||
      `https://picsum.photos/seed/wtk${ev.eventId}/600/800`;
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
      chip.textContent = data.ok ? "API OK" : "API down";
      chip.className = data.ok ? "chip ok" : "chip";
    } catch {
      el("apiStatus").textContent = "API offline";
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
      btn.innerHTML = `
        <img class="thumb" src="${posterOf(ev)}" alt="" loading="lazy" />
        <div class="body">
          ${m.tag ? `<span class="tag">${m.tag}</span>` : ""}
          <h3>${ev.title || ev.artist || "Event"}</h3>
          <p class="meta">${fmtDateShort(ev.startsAt)}</p>
          <p class="meta">${ev.venue || "—"}</p>
          <p class="meta">${ev.city || ""} · ${ev.quotaTotal ?? "—"} seats</p>
          <div class="price">${fmtRp(minP)} ~</div>
          <div class="stock">Sisa ${ev.sisa ?? "—"} / ${ev.quotaTotal ?? "—"}</div>
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
        "<strong style='color:#fca5a5'>Sold out.</strong> Reset kuota lab: " +
        "<code style='font-size:.75rem'>POST /internal/reset-quota/" +
        currentEventId +
        "</code> lalu refresh.";
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
      toast("Kuota event habis (sold out). Reset kuota lab lalu refresh.", "err");
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

    el("dTerms").innerHTML = (eventData.terms || [])
      .map((t) => `<li>${t}</li>`)
      .join("") || "<li>—</li>";

    renderVenueSketch();
    renderLegend();
    renderBenefitsAll();
    renderMap();
  }

  async function loadEventDetail(id) {
    toast("");
    el("orderResult").classList.add("hidden");
    const res = await fetch(`/api/events/${id}`);
    if (!res.ok) {
      toast("Event tidak ditemukan", "err");
      return;
    }
    eventData = await res.json();
    buildLayoutFromEvent(eventData);
    markSold();
    renderDetail();
    if (Number(eventData.sisa) <= 0) {
      toast("Sold out — sisa 0. Kuota lab bisa di-reset, lalu refresh halaman.", "err");
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

  async function placeOrder() {
    const qty = selected.size;
    if (!qty) return;
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
    };

    try {
      const res = await fetchOrderDenganBatasLaju(body);
      const data = await res.json().catch(() => ({}));

      if (res.status === 201) {
        const seatsDone = data.seatCodes || [...selected];
        const cats = [...new Set(seatsDone.map(catOf))];
        const benLines = cats.flatMap((c) =>
          benefitsOf(currentEventId, c).map((b) => `• [${c}] ${b}`)
        );
        toast(`Berhasil · sisa ${data.sisa}`, "ok");
        el("orderResult").classList.remove("hidden");
        el("orderResult").innerHTML = `
          <strong>예매 완료 · Pembayaran / pesanan berhasil</strong>
          <code>orderId: ${data.orderId}</code>
          <code>kursi: ${seatsDone.join(", ")}</code>
          <code>total: ${fmtRp(data.amountIdr)}</code>
          <code>status: ${data.status || "CONFIRMED"}</code>
          <code style="margin-top:.5rem;color:#fde68a">Benefit yang didapat:</code>
          <code style="white-space:pre-wrap;color:#e2e8f0">${benLines.join("\n") || "• E-ticket QR"}</code>
        `;
        selected.clear();
        await loadEventDetail(currentEventId);
      } else if (res.status === 409) {
        // Kursi/kuota habis — penolakan sah, pesan ramah
        toast(
          data.error ||
            "Kursi ini baru saja diambil orang lain / kuota habis. Pilih kursi lain.",
          "err"
        );
        selected.clear();
        await loadEventDetail(currentEventId);
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
      // Jaringan putus — app tetap hidup, pesan jelas
      toast(
        e.message ||
          "Jaringan bermasalah. Periksa koneksi lalu ulangi.",
        "err"
      );
    } finally {
      memesan = false;
      btn.classList.remove("loading");
      btn.innerHTML = "예매하기 · Pesan";
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
      el("eventGrid").innerHTML = `<p class="muted">${e.message || "Gagal load. Pastikan API & dataset jalan."}</p>`;
    }
    setInterval(() => {
      loadHealth().catch(() => {});
      if (currentEventId > 0) loadEventDetail(currentEventId).catch(() => {});
      else loadEventList().catch(() => {});
    }, 12000);
  }

  boot();
})();
