// Shared helpers: config loading, brand colours, icons, escaping.
(function () {
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hexOk = h => /^#[0-9a-f]{6}$/i.test(h || "");
  const toRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const toHex = a => "#" + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const lum = rgb => { const c = rgb.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };

  function applyBrand(cfg) {
    let el = document.getElementById("brandVars");
    if (!el) { el = document.createElement("style"); el.id = "brandVars"; document.head.appendChild(el); }
    let css = ":root{";
    if (hexOk(cfg.brandColor)) {
      let b = toRgb(cfg.brandColor);
      if (lum(b) > .22) b = mix(b, [0, 0, 0], .45); // header must carry white text
      css += `--brand:${toHex(b)};--brand-2:${toHex(mix(b, [255, 255, 255], .18))};--brand-ink:#ffffff;--brand-soft:${toHex(mix(b, [255, 255, 255], .9))};`;
    }
    if (hexOk(cfg.accentColor)) {
      const a = toRgb(cfg.accentColor);
      css += `--accent:${cfg.accentColor};--accent-ink:${lum(a) > .45 ? "#151515" : "#ffffff"};--accent-soft:${toHex(mix(a, [255, 255, 255], .88))};`;
    }
    css += "}";
    if (hexOk(cfg.brandColor)) {
      const b = toRgb(cfg.brandColor);
      css += `@media (prefers-color-scheme: dark){:root{--brand-soft:${toHex(mix(b, [23, 30, 36], .75))};--brand-2:${toHex(mix(b, [255, 255, 255], .3))}}}`;
    }
    if (hexOk(cfg.accentColor)) css += `@media (prefers-color-scheme: dark){:root{--accent-soft:${toHex(mix(toRgb(cfg.accentColor), [23, 30, 36], .78))}}}`;
    el.textContent = css;
  }

  function brandMark(cfg, bust) {
    if (cfg.hasLogo) return `<span class="logo-chip"><img src="/api/logo${bust ? "?v=" + bust : ""}" alt="${esc(cfg.clientName)} logo"></span>`;
    const initials = String(cfg.clientName || "").split(/\s+/).filter(w => /^[A-Za-z]/.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join("");
    return `<span class="monogram" aria-hidden="true">${esc(initials || "AA")}</span>`;
  }

  const P = {
    person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h8"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
    grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18h.01"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7M8 21v-7h8v7"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
  };
  const icon = (name, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${P[name] || ""}</svg>`;

  async function api(path, opts = {}) {
    const res = await fetch(path, { credentials: "same-origin", ...opts, headers: { "content-type": "application/json", ...(opts.headers || {}) }, body: opts.body && typeof opts.body !== "string" ? JSON.stringify(opts.body) : opts.body });
    let data = null; try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw Object.assign(new Error((data && data.error) || `Request failed (${res.status})`), { status: res.status });
    return data;
  }

  function download(filename, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  window.UI = { esc, hexOk, applyBrand, brandMark, icon, api, download };
})();
