(() => {
  const KEY = "wtk_role";
  const gate = document.getElementById("view-gate");
  const shell = document.getElementById("appShell");
  if (!gate || !shell) return;

  const params = new URLSearchParams(location.search);
  const qRole = (params.get("role") || "").toLowerCase();

  function goAdmin() {
    sessionStorage.setItem(KEY, "admin");
    location.href = "/admin.html";
  }

  function goUser(persist) {
    if (persist !== false) sessionStorage.setItem(KEY, "user");
    gate.classList.add("hidden");
    shell.classList.remove("hidden");
    document.body.classList.add("role-user");
    document.body.classList.remove("role-admin");
    // Nav admin tidak ditampilkan di dashboard user
    document.querySelectorAll('[data-nav="admin"]').forEach((a) => a.remove());
    window.dispatchEvent(new CustomEvent("wtk-role-ready", { detail: { role: "user" } }));
  }

  function showGate() {
    sessionStorage.removeItem(KEY);
    gate.classList.remove("hidden");
    shell.classList.add("hidden");
    document.body.classList.remove("role-user");
    // bersihkan query role agar refresh tetap di gate
    if (params.has("role")) {
      params.delete("role");
      const q = params.toString();
      history.replaceState(null, "", q ? `/?${q}` : "/");
    }
  }

  document.getElementById("btnRoleUser")?.addEventListener("click", () => goUser(true));
  document.getElementById("btnRoleAdmin")?.addEventListener("click", goAdmin);
  document.getElementById("btnSwitchRole")?.addEventListener("click", showGate);

  // Deep-link: /?role=user | /?role=admin | /?event=1 (langsung user)
  if (qRole === "admin") {
    goAdmin();
    return;
  }
  if (qRole === "user" || params.get("event")) {
    goUser(true);
    return;
  }

  const saved = sessionStorage.getItem(KEY);
  if (saved === "user") {
    goUser(false);
    return;
  }
  if (saved === "admin") {
    // admin punya halaman sendiri; kalau balik ke / tampilkan gate
    sessionStorage.removeItem(KEY);
  }

  // default: tampilkan pilih peran
  showGate();
})();
