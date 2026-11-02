(async () => {
  const { api, applyBrand, brandMark, esc } = window.UI;
  const el = document.getElementById("report");
  document.getElementById("printBtn").addEventListener("click", () => window.print());
  try {
    const cfg = await api("/api/config"); applyBrand(cfg);
    document.title = `${cfg.clientName} · Leadership findings`;
    document.getElementById("brand").innerHTML = `${brandMark(cfg)}<div class="brand-text"><span class="brand-name">${esc(cfg.clientName)}</span><span class="brand-sub">Leadership findings · ${esc(cfg.consultantName)}</span></div>`;
    const [responses, findings] = await Promise.all([api("/api/admin/responses"), api("/api/admin/findings")]);
    el.innerHTML = FX.render(findings || {}, { responses, cfg }, { editable: false });
  } catch (e) {
    el.innerHTML = e.status === 401 ? `<div class="login"><div class="card"><h1 style="margin:0 0 8px;font-size:24px">Sign in to view this report</h1><p class="muted">This report is private to the consulting team.</p><a class="btn primary" href="/admin">Go to sign-in</a></div></div>` : `<p class="empty">${esc(e.message)}</p>`;
  }
})();
