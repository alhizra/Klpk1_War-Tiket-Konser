(() => {
  const API = "/api";
  const TOKEN_KEY = "wtk_admin_token";

  const $ = (id) => document.getElementById(id);
  const tokenEl = $("adminToken");
  const msgEl = $("adminMsg");
  const apiStatus = $("apiStatus");
  let posterDataUrl = null;
  let editPosterDataUrl = null;
  let eventsCache = [];

  function getToken() {
    // token fixed di belakang layar (bukan UI)
    return (
      (tokenEl && tokenEl.value) ||
      localStorage.getItem(TOKEN_KEY) ||
      "admin-wtk"
    ).trim();
  }

  function setPosterPreview(dataUrl) {
    const box = $("posterPreview");
    if (!box) return;
    if (dataUrl) {
      box.style.backgroundImage = `url(${dataUrl})`;
      box.classList.remove("empty");
      box.textContent = "";
    } else {
      box.style.backgroundImage = "";
      box.classList.add("empty");
      box.textContent = "Belum ada gambar";
    }
  }

  function clearPoster() {
    posterDataUrl = null;
    const f = $("posterFile");
    if (f) f.value = "";
    setPosterPreview(null);
  }

  function readPosterFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      if (!/^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.type)) {
        reject(new Error("Pilih file JPG, PNG, WebP, atau GIF"));
        return;
      }
      if (file.size > 2.5 * 1024 * 1024) {
        reject(new Error("Ukuran gambar maks. 2.5 MB"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Gagal membaca file"));
      reader.readAsDataURL(file);
    });
  }

  let msgTimer = null;
  function showMsg(text, ok) {
    if (!msgEl) return;
    const textEl = msgEl.querySelector(".admin-toast-text") || msgEl;
    textEl.textContent = text;
    msgEl.classList.remove("hidden", "ok", "err");
    msgEl.classList.add(ok ? "ok" : "err");
    if (msgTimer) clearTimeout(msgTimer);
    // sukses hilang otomatis; error tetap sampai ditutup
    if (ok) {
      msgTimer = setTimeout(() => {
        msgEl.classList.add("hidden");
      }, 4200);
    }
  }
  $("adminMsgClose")?.addEventListener("click", () => {
    if (msgTimer) clearTimeout(msgTimer);
    msgEl?.classList.add("hidden");
  });

  async function api(path, opts = {}) {
    const headers = {
      "Content-Type": "application/json",
      "x-admin-token": getToken(),
      ...(opts.headers || {}),
    };
    const res = await fetch(`${API}${path}`, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || res.statusText || "request gagal");
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function fmtMoney(n) {
    return new Intl.NumberFormat("id-ID").format(Number(n) || 0);
  }

  function fmtTime(v) {
    if (!v) return "—";
    try {
      return new Date(v).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
    } catch {
      return String(v);
    }
  }

  function localToIso(v) {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  function badgeStatus(st) {
    const s = String(st || "").toUpperCase();
    const cls = s === "PUBLISHED" ? "pub" : s === "CLOSED" ? "closed" : "draft";
    return `<span class="badge ${cls}">${s || "—"}</span>`;
  }

  function isoToLocalInput(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  function setEditPosterPreview(url) {
    const box = $("editPosterPreview");
    if (!box) return;
    if (url) {
      box.style.backgroundImage = `url(${url})`;
      box.classList.remove("empty");
      box.textContent = "";
    } else {
      box.style.backgroundImage = "";
      box.classList.add("empty");
      box.textContent = "Tanpa ganti";
    }
  }

  function openEditModal(ev) {
    const modal = $("editModal");
    const form = $("formEdit");
    if (!modal || !form || !ev) {
      showMsg("Form edit tidak tersedia. Hard-refresh halaman (Ctrl+F5).", false);
      return;
    }
    form.reset();
    $("editEventId").value = String(ev.eventId);
    const heading = $("editModalHeading");
    if (heading) heading.textContent = `Edit #${ev.eventId}`;
    $("editTitleInput").value = ev.title || "";
    $("editArtist").value = ev.artist || "";
    $("editVenue").value = ev.venue || "";
    $("editCity").value = ev.city || "";
    $("editCountry").value = ev.country || "";
    $("editStartsAt").value = isoToLocalInput(ev.startsAt);
    $("editSalesOpensAt").value = isoToLocalInput(ev.salesOpensAt) || "";
    $("editQuotaTotal").value = String(ev.quotaTotal ?? 100);
    $("editPriceIdr").value = String(ev.priceIdr ?? 0);
    $("editStatus").value = ev.status || "PUBLISHED";
    $("editDescription").value = ev.description || "";
    editPosterDataUrl = null;
    const pf = $("editPosterFile");
    if (pf) pf.value = "";
    setEditPosterPreview(ev.posterUrl || null);
    modal.classList.remove("hidden");
    setTimeout(() => $("editTitleInput")?.focus(), 50);
  }

  function closeEditModal() {
    $("editModal")?.classList.add("hidden");
    editPosterDataUrl = null;
    const btn = $("btnSaveEdit");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Simpan perubahan";
    }
  }

  async function saveEditEvent() {
    const form = $("formEdit");
    if (!form) throw new Error("Form edit tidak ditemukan");
    if (!form.reportValidity()) return false;

    const id = Number($("editEventId").value || form.eventId?.value);
    if (!Number.isInteger(id) || id < 1) {
      throw new Error("ID event tidak valid — buka Edit lagi dari daftar");
    }

    const fd = new FormData(form);
    const title = String(fd.get("title") || "").trim();
    const artist = String(fd.get("artist") || "").trim();
    const venue = String(fd.get("venue") || "").trim();
    if (!title || !artist || !venue) {
      throw new Error("Judul, artist, dan venue wajib diisi");
    }

    const startsAt = localToIso(fd.get("startsAt"));
    if (!startsAt) throw new Error("Tanggal mulai konser tidak valid");

    const body = {
      title,
      artist,
      venue,
      city: String(fd.get("city") || "").trim(),
      country: String(fd.get("country") || "").trim(),
      startsAt,
      quotaTotal: Number(fd.get("quotaTotal")),
      priceIdr: Number(fd.get("priceIdr")),
      status: String(fd.get("status") || "PUBLISHED"),
      description: String(fd.get("description") || "").trim(),
    };
    const sales = localToIso(fd.get("salesOpensAt"));
    if (sales) body.salesOpensAt = sales;
    if (editPosterDataUrl) body.poster = editPosterDataUrl;

    if (!Number.isFinite(body.quotaTotal) || body.quotaTotal < 1) {
      throw new Error("Kuota total tidak valid");
    }
    if (!Number.isFinite(body.priceIdr) || body.priceIdr < 0) {
      throw new Error("Harga tidak valid");
    }

    const btn = $("btnSaveEdit");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Menyimpan…";
    }
    try {
      const updated = await api(`/admin/events/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      closeEditModal();
      await loadEvents();
      await loadOrders().catch(() => {});
      showMsg(`Perubahan pada “${updated.title}” berhasil disimpan`, true);
      return true;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Simpan perubahan";
      }
    }
  }

  async function loadEvents() {
    const { items } = await api("/admin/events");
    eventsCache = items || [];
    const body = $("eventsBody");
    const countEl = $("eventCountLabel");
    if (countEl) countEl.textContent = items.length ? `· ${items.length}` : "";
    if (!items.length) {
      body.innerHTML = `<div class="empty-state">Belum ada event</div>`;
      return;
    }
    body.innerHTML = items
      .map((e) => {
        const sisa = e.sisa == null ? "—" : e.sisa;
        const sisaZero = Number(e.sisa) === 0;
        return `<article class="event-row" data-id="${e.eventId}">
          <div class="eid">#${e.eventId}</div>
          <div class="einfo">
            <h3 class="etitle">${escapeHtml(e.title)}</h3>
            <p class="emeta">${escapeHtml(e.artist)} · Rp ${fmtMoney(e.priceIdr)}</p>
            <div class="estats">
              <span class="stat-chip">Kuota ${e.quotaTotal}</span>
              <span class="stat-chip sisa ${sisaZero ? "zero" : ""}">Sisa ${sisa}</span>
              <span class="stat-chip">Order ${e.ordersConfirmed || 0}</span>
            </div>
          </div>
          <div class="eright">
            ${badgeStatus(e.status)}
            <div class="acts">
              <button type="button" class="btn-sec btn-edit" data-id="${e.eventId}">Edit</button>
              <button type="button" class="btn-sec btn-toggle" data-id="${e.eventId}" data-st="${e.status}">
                ${e.status === "PUBLISHED" ? "Draft" : "Publish"}
              </button>
              <button type="button" class="btn-sec btn-reset" data-id="${e.eventId}">Reset</button>
              <button type="button" class="btn-sec btn-redehah" data-id="${e.eventId}" data-title="${escapeHtml(e.title)}">Denah</button>
              <button type="button" class="btn-danger btn-delete" data-id="${e.eventId}" data-title="${escapeHtml(e.title)}">Hapus</button>
            </div>
          </div>
        </article>`;
      })
      .join("");
  }

  async function loadOrders() {
    const { items } = await api("/admin/orders?limit=40");
    const body = $("ordersBody");
    if (!items.length) {
      body.innerHTML = `<tr><td colspan="6" class="muted">Belum ada order</td></tr>`;
      return;
    }
    body.innerHTML = items
      .map((o) => {
        const st = String(o.status || "");
        const b =
          st === "CONFIRMED"
            ? "ok"
            : st.includes("PENDING")
              ? "pend"
              : "draft";
        return `<tr>
          <td title="${escapeHtml(o.orderId)}">${escapeHtml(String(o.orderId).slice(0, 8).toUpperCase())}</td>
          <td>${escapeHtml(o.title || "Event " + o.eventId)}</td>
          <td>${escapeHtml(o.buyerName || "—")}<br/><span class="muted">${escapeHtml(o.buyerEmail || "")}</span></td>
          <td>${o.qty}</td>
          <td><span class="badge ${b}">${escapeHtml(st)}</span></td>
          <td>${fmtTime(o.createdAt)}</td>
        </tr>`;
      })
      .join("");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function refreshAll() {
    await Promise.all([loadEvents(), loadOrders()]);
    showMsg("Data admin dimuat.", true);
  }

  $("btnLoad").onclick = () => refreshAll().catch((e) => showMsg(e.message, false));
  $("btnRefreshEvents").onclick = () =>
    loadEvents()
      .then(() => showMsg("Event di-refresh.", true))
      .catch((e) => showMsg(e.message, false));
  $("btnRefreshOrders").onclick = () =>
    loadOrders()
      .then(() => showMsg("Order di-refresh.", true))
      .catch((e) => showMsg(e.message, false));

  $("posterFile")?.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    try {
      posterDataUrl = await readPosterFile(file);
      setPosterPreview(posterDataUrl);
    } catch (err) {
      clearPoster();
      showMsg(err.message, false);
    }
  });
  $("btnClearPoster")?.addEventListener("click", () => clearPoster());

  $("editPosterFile")?.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    try {
      editPosterDataUrl = await readPosterFile(file);
      setEditPosterPreview(editPosterDataUrl);
    } catch (err) {
      editPosterDataUrl = null;
      showMsg(err.message, false);
    }
  });
  $("btnClearEditPoster")?.addEventListener("click", () => {
    editPosterDataUrl = null;
    const f = $("editPosterFile");
    if (f) f.value = "";
    const id = Number($("editEventId")?.value);
    const cur = eventsCache.find((x) => x.eventId === id);
    setEditPosterPreview(cur?.posterUrl || null);
  });
  $("editCancel")?.addEventListener("click", closeEditModal);
  $("editModal")?.querySelector("[data-edit-close]")?.addEventListener("click", closeEditModal);

  $("formEdit")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    try {
      await saveEditEvent();
    } catch (e) {
      showMsg(e.message || "Gagal menyimpan", false);
    }
  });
  // cadangan jika submit form tidak terpicu
  $("btnSaveEdit")?.addEventListener("click", async (ev) => {
    if (ev.target.form) return; // biar submit handler yang jalan
    ev.preventDefault();
    try {
      await saveEditEvent();
    } catch (e) {
      showMsg(e.message || "Gagal menyimpan", false);
    }
  });

  $("formCreate").onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const body = {
      title: fd.get("title"),
      artist: fd.get("artist"),
      venue: fd.get("venue"),
      city: fd.get("city") || undefined,
      country: fd.get("country") || undefined,
      startsAt: localToIso(fd.get("startsAt")),
      salesOpensAt: localToIso(fd.get("salesOpensAt")) || undefined,
      quotaTotal: Number(fd.get("quotaTotal")),
      priceIdr: Number(fd.get("priceIdr")),
      status: fd.get("status"),
      description: fd.get("description") || undefined,
      generateSeats: fd.get("generateSeats") === "on",
    };
    if (posterDataUrl) body.poster = posterDataUrl;
    try {
      const created = await api("/admin/events", {
        method: "POST",
        body: JSON.stringify(body),
      });
      showMsg(
        `Event #${created.eventId} dibuat${created.posterUrl ? " · poster tersimpan" : ""}.`,
        true
      );
      ev.target.reset();
      ev.target.quotaTotal.value = 100;
      ev.target.priceIdr.value = 750000;
      ev.target.generateSeats.checked = true;
      clearPoster();
      await refreshAll();
    } catch (e) {
      showMsg(e.message, false);
    }
  };

  function askConfirm({ title, body, okLabel = "Ya", danger = false }) {
    const modal = $("confirmModal");
    const titleEl = $("confirmTitle");
    const bodyEl = $("confirmBody");
    const btnOk = $("confirmOk");
    const btnCancel = $("confirmCancel");
    if (!modal || !titleEl || !bodyEl || !btnOk || !btnCancel) {
      return Promise.resolve(window.confirm(title));
    }
    titleEl.textContent = title;
    bodyEl.innerHTML = body;
    btnOk.textContent = okLabel;
    btnOk.className = danger ? "btn-danger-solid" : "btn-pri";
    modal.classList.remove("hidden");
    btnOk.focus();

    return new Promise((resolve) => {
      const close = (val) => {
        modal.classList.add("hidden");
        btnOk.onclick = null;
        btnCancel.onclick = null;
        modal.querySelector("[data-modal-close]")?.removeEventListener("click", onBg);
        document.removeEventListener("keydown", onKey);
        resolve(val);
      };
      const onBg = () => close(false);
      const onKey = (e) => {
        if (e.key === "Escape") close(false);
        if (e.key === "Enter") close(true);
      };
      btnOk.onclick = () => close(true);
      btnCancel.onclick = () => close(false);
      modal.querySelector("[data-modal-close]")?.addEventListener("click", onBg);
      document.addEventListener("keydown", onKey);
    });
  }

  $("eventsBody").onclick = async (ev) => {
    const t = ev.target;
    if (!(t instanceof HTMLElement)) return;
    const id = t.getAttribute("data-id");
    if (!id) return;
    try {
      if (t.classList.contains("btn-edit")) {
        const evItem = eventsCache.find((x) => String(x.eventId) === String(id));
        if (!evItem) {
          showMsg("Data event tidak ditemukan. Refresh dulu.", false);
          return;
        }
        openEditModal(evItem);
        return;
      }
      if (t.classList.contains("btn-reset")) {
        const ok = await askConfirm({
          title: "Reset stok kursi?",
          body: `Stok event <strong>#${escapeHtml(id)}</strong> akan dikembalikan ke kuota penuh.`,
          okLabel: "Reset stok",
          danger: false,
        });
        if (!ok) return;
        const r = await api(`/admin/events/${id}/reset-quota`, { method: "POST", body: "{}" });
        showMsg(`Stok event #${id} direset · sisa ${r.sisa ?? "—"}`, true);
        await loadEvents();
      }
      if (t.classList.contains("btn-redehah")) {
        const title = t.getAttribute("data-title") || `#${id}`;
        const ok = await askConfirm({
          title: "Buat ulang denah multi-zona?",
          body: `Denah <strong>${escapeHtml(title)}</strong> diganti jadi VIP · Floor · Gold · Silver · Bronze (kursi lama diganti).`,
          okLabel: "Buat denah",
          danger: false,
        });
        if (!ok) return;
        const r = await api(`/admin/events/${id}/regenerate-seats`, {
          method: "POST",
          body: "{}",
        });
        showMsg(
          `Denah multi-zona siap · ${r.seatsCreated || 0} kursi`,
          true
        );
        await loadEvents();
      }
      if (t.classList.contains("btn-toggle")) {
        const cur = t.getAttribute("data-st");
        const next = cur === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
        await api(`/admin/events/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: next }),
        });
        showMsg(`Event #${id} → ${next}`, true);
        await loadEvents();
      }
      if (t.classList.contains("btn-delete")) {
        const title = t.getAttribute("data-title") || `Event #${id}`;
        const ok = await askConfirm({
          title: "Hapus konser?",
          body: `Konser <strong>${escapeHtml(title)}</strong> akan dihapus permanen beserta order dan kursi terkait.`,
          okLabel: "Hapus",
          danger: true,
        });
        if (!ok) return;
        const btn = t;
        btn.disabled = true;
        try {
          await api(`/admin/events/${id}`, { method: "DELETE" });
          showMsg(`Konser dihapus.`, true);
          await refreshAll();
        } finally {
          btn.disabled = false;
        }
      }
    } catch (e) {
      showMsg(e.message, false);
    }
  };

  async function ping() {
    try {
      const r = await fetch(`${API}/health`);
      const j = await r.json();
      apiStatus.textContent = j.ok ? "Online" : "Offline";
      apiStatus.classList.toggle("ok", !!j.ok);
    } catch {
      apiStatus.textContent = "Offline";
      apiStatus.classList.remove("ok");
    }
  }

  // default startsAt = +14 hari
  const starts = $("formCreate").startsAt;
  if (starts && !starts.value) {
    const d = new Date(Date.now() + 14 * 864e5);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    starts.value = d.toISOString().slice(0, 16);
  }

  ping();
  refreshAll().catch((e) => showMsg(e.message || "Gagal muat data admin", false));
})();
