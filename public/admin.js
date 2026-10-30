(() => {
  "use strict";
  const { SECTIONS, MODELS, RATINGS, HOURS, HOURS_MID, allFields, flat, fmt } = window.AA;
  const { esc, hexOk, applyBrand, brandMark, icon, api, download } = window.UI;
  const $ = s => document.querySelector(s);

  let me = { admin: false }, cfg = {}, responses = [], insights = null, tab = "dashboard", openId = null;
  let aiBusy = false, aiError = "", loading = true, logoBust = Date.now();
  const content = SECTIONS.filter(s => s.fields);
  const submitted = () => responses.filter(r => r.status === "submitted");
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;

  // ---------- charts ----------
  function bars(rows, max, fmtV, color, tip) {
    if (!rows.length || rows.every(r => !r[1])) return `<div class="empty">No answers yet.</div>`;
    return `<div class="bars" style="--cc:var(${color})">${rows.map(([l, v], i) => `<div class="brow" title="${esc(tip ? tip(l, v, i) : `${l}: ${fmtV(v)}`)}"><span class="lbl">${esc(l)}</span><span class="trk"><span class="fil" style="width:${max && v > 0 ? Math.max(1, v / max * 100) : 0}%"></span></span><span class="val">${fmtV(v)}</span></div>`).join("")}</div>`;
  }
  const panel = (title, sub, color, body, full) => `<div class="panel${full ? " full" : ""}" style="--cc:var(${color})"><div class="panel-head"><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div></div>${body}</div>`;
  function countBy(list, get) { const m = new Map(); list.forEach(r => { const v = get(r); (Array.isArray(v) ? v : [v]).filter(Boolean).forEach(x => m.set(x, (m.get(x) || 0) + 1)); }); return [...m.entries()].sort((a, b) => b[1] - a[1]); }
  const canon = n => { const s = String(n || "").trim(); if (!s) return ""; const k = s.toLowerCase().replace(/\s+/g, " "); const known = { revit: "Revit", autocad: "AutoCAD", acad: "AutoCAD", rhino: "Rhino", bluebeam: "Bluebeam", excel: "Excel", sketchup: "SketchUp", enscape: "Enscape", navisworks: "Navisworks", acc: "Autodesk Docs / ACC" }; return known[k] || s.charAt(0).toUpperCase() + s.slice(1); };

  function dashboard() {
    const sub = submitted(), n = sub.length, prog = responses.length - n;
    const hrs = sub.map(r => HOURS_MID[r.answers.hoursLost]).filter(x => x != null);
    const ratingAll = sub.flatMap(r => RATINGS.map(([k]) => Number(r.answers[k])).filter(Boolean));
    let html = `<div class="page-head"><div><h1>Dashboard</h1><p>${esc(cfg.clientName)} · refreshes every 30 seconds</p></div><div class="toolbar"><button class="btn small" id="reload">Refresh now</button></div></div>
      <div class="kpis">
        <div class="kpi" style="--kc:var(--c3)"><div class="v">${n}</div><div class="l">Interviews submitted</div></div>
        <div class="kpi" style="--kc:var(--c4)"><div class="v">${prog}</div><div class="l">In progress</div></div>
        <div class="kpi" style="--kc:var(--c2)"><div class="v">${hrs.length ? avg(hrs).toFixed(1) : "–"}<small> hrs</small></div><div class="l">Lost per person per week</div></div>
        <div class="kpi" style="--kc:var(--c1)"><div class="v">${ratingAll.length ? avg(ratingAll).toFixed(1) : "–"}<small> / 5</small></div><div class="l">Average satisfaction</div></div>
      </div>`;
    if (loading) return html + `<div class="panel"><div class="empty"><span class="spin"></span>Loading responses…</div></div>`;
    html += aiPanel();
    if (!n) return html + `<div class="panel" style="margin-top:16px"><div class="empty">No submitted interviews yet. Charts fill in as answers arrive${prog ? `; ${prog} ${prog === 1 ? "person is" : "people are"} working on theirs now` : ""}.</div></div>`;

    const ratingRows = RATINGS.map(([k, l]) => { const v = sub.map(r => Number(r.answers[k])).filter(Boolean); return [l, v.length ? avg(v) : 0, v.length]; }).sort((a, b) => a[1] - b[1]);
    const hoursRows = HOURS.map(h => [h + " hrs", sub.filter(r => r.answers.hoursLost === h).length]);
    const appMap = new Map(); sub.forEach(r => (r.answers.apps || []).forEach(a => { const nm = canon(a.name); if (!nm) return; const e = appMap.get(nm) || []; if (a.rating) e.push(Number(a.rating)); appMap.set(nm, e); }));
    const appRows = [...appMap.entries()].filter(([, e]) => e.length).map(([nm, e]) => [nm, avg(e), e.length]).sort((a, b) => a[1] - b[1]).slice(0, 10);
    const splitF = allFields().find(f => f.id === "split");
    const splitRows = splitF.parts.map(([k, l]) => { const v = sub.map(r => Number((r.answers.split || {})[k])).filter(x => !isNaN(x) && x > 0); return [l, v.length ? avg(v) : 0]; });
    const teams = countBy(sub, r => r.answers.dept);
    const quotes = sub.filter(r => r.answers.biggest && r.answers.quoteOk !== "No, please don't quote me").slice(0, 6);
    const who = r => cfg.model === "named" ? (r.answers.name || r.answers.title || "Respondent") : (r.answers.dept || "Respondent");

    html += `<div class="dash" style="margin-top:16px">
      ${panel("Ratings, lowest first", "Average of 1–5 answers", "--c1", bars(ratingRows.map(r => [r[0], r[1]]), 5, v => v.toFixed(1), "--c1", (l, v, i) => `${l}: ${v.toFixed(2)} / 5 from ${ratingRows[i][2]} answers`))}
      ${panel("Time lost to the biggest frustration", "People per answer, hours per week", "--c2", bars(hoursRows, Math.max(1, ...hoursRows.map(r => r[1])), v => String(v), "--c2"))}
      ${panel("Tools rated lowest", "Average 1–5 rating from people who rated each tool", "--c8", bars(appRows.map(r => [r[0], r[1]]), 5, v => v.toFixed(1), "--c8", (l, v, i) => `${l}: ${v.toFixed(2)} / 5 from ${appRows[i][2]} ratings`))}
      ${panel("Software in use", "People who use each tool", "--c7", bars(countBy(sub, r => r.answers.designTools).slice(0, 12), n, v => String(v), "--c7"))}
      ${panel("Where the week goes", "Average share of a typical week", "--c3", bars(splitRows, 100, v => Math.round(v) + "%", "--c3"))}
      ${panel("How files are shared", "People using each method", "--c1", bars(countBy(sub, r => r.answers.fileSharing), n, v => String(v), "--c1"))}
      ${panel("Last formal training", "People per answer", "--c4", bars(countBy(sub, r => r.answers.lastTraining), n, v => String(v), "--c4"))}
      ${panel("Who has answered", "Submitted interviews by team", "--c6", bars(teams, n, v => String(v), "--c6"))}
      ${panel("In their words", "Biggest frustrations, quotable answers only", "--c2", quotes.length ? `<ul class="quotes">${quotes.map(r => `<li>${esc(r.answers.biggest)}<small>${esc(who(r))}</small></li>`).join("")}</ul>` : `<div class="empty">No quotable answers yet.</div>`, true)}
    </div>`;
    return html;
  }

  function aiPanel() {
    const n = submitted().length, stale = insights && insights.basedOn !== n;
    let body;
    if (aiBusy) body = `<p class="muted" style="margin:14px 0 0"><span class="spin"></span>Claude is reading ${n} interview${n === 1 ? "" : "s"} and drafting findings. This takes up to a minute.</p>`;
    else if (!insights && !me.aiEnabled) body = `<p class="muted" style="margin:14px 0 0">Add an <span class="mono">ANTHROPIC_API_KEY</span> variable in Railway to turn on automatic findings.</p>`;
    else if (!insights) body = `<p class="muted" style="margin:14px 0 0">${n ? "Findings will be drafted automatically about 90 seconds after each submission, or draft them now." : "Findings are drafted automatically once interviews are submitted."}</p>`;
    else {
      const recs = (insights.recommendations || []).slice().sort((a, b) => (b.impact - b.effort) - (a.impact - a.effort));
      const hz = h => h === "Quick win" ? "qw" : h === "Project" ? "pr" : "st";
      body = `<p class="ai-headline">${esc(insights.headline)}</p><p class="muted" style="margin:0;max-width:80ch">${esc(insights.summary)}</p>
        <div class="ai-grid"><div><h3 style="margin:0 0 12px">Themes</h3>${(insights.themes || []).map(t => `<div class="theme"><b>${esc(t.name)}</b><span class="heard">${esc(t.heardFrom)}</span><p>${esc(t.finding)}</p>${t.evidence ? `<p class="ev">${esc(t.evidence)}</p>` : ""}</div>`).join("")}</div>
        <div style="min-width:0"><h3 style="margin:0 0 12px">Recommendations</h3><div class="tablewrap"><table class="recs"><thead><tr><th>Recommendation</th><th>Impact</th><th>Effort</th><th>Horizon</th></tr></thead><tbody>${recs.map(r => `<tr><td><b>${esc(r.title)}</b><div class="muted" style="font-size:13.5px">${esc(r.why)}</div></td><td class="n"><span class="score i">${esc(r.impact)}</span></td><td class="n"><span class="score e">${esc(r.effort)}</span></td><td><span class="pill ${hz(r.horizon)}">${esc(r.horizon)}</span></td></tr>`).join("")}</tbody></table></div>
        ${(insights.probe || []).length ? `<h3 style="margin:22px 0 8px">Ask in live follow-ups</h3><ul style="margin:0;padding-left:18px;font-size:15px">${insights.probe.map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}</div></div>`;
    }
    const meta = insights ? `Based on ${insights.basedOn} interview${insights.basedOn === 1 ? "" : "s"} · ${new Date(insights.generatedAt).toLocaleString()}` : "";
    return `<div class="panel ai"><div class="panel-head" style="margin:0"><div><span class="ai-badge">${icon("spark", 'style="width:16px;height:16px;stroke:currentColor"')} Automatic findings</span>${meta ? `<div class="muted" style="font-size:13.5px;margin-top:4px">${esc(meta)}${stale ? ` · <b style="color:var(--warn)">new responses since</b>` : ""}</div>` : ""}</div>
      ${me.aiEnabled && n ? `<button class="btn small ${stale || !insights ? "primary" : ""}" id="runAI" ${aiBusy ? "disabled" : ""}>${insights ? "Refresh findings" : "Draft findings now"}</button>` : ""}</div>${body}
      ${aiError ? `<p style="font-size:14px;color:var(--warn);margin:12px 0 0">${esc(aiError)}</p>` : ""}</div>`;
  }

  // ---------- responses ----------
  function reviewHTML(a) {
    return content.map(s => `<section><header><h2><span class="num">${String(SECTIONS.indexOf(s)).padStart(2, "0")}</span>${esc(s.title)}</h2></header><dl>${flat(s).map(f => { const t = fmt(f, a[f.id]); return `<dt>${esc(f.label)}</dt><dd class="${t ? "" : "empty"}">${t ? esc(t) : "—"}</dd>`; }).join("")}</dl></section>`).join("");
  }
  function responsesView() {
    const list = responses.length ? `<div class="tablewrap"><table class="lt"><thead><tr><th>Respondent</th><th>Team</th><th>Status</th><th>Updated</th></tr></thead><tbody>${responses.map(r => `<tr class="click ${openId === r.id ? "sel" : ""}" tabindex="0" data-open="${esc(r.id)}"><td><b>${esc(r.answers.name || "Anonymous")}</b><div class="muted" style="font-size:13.5px">${esc(r.answers.title || "")}</div></td><td>${esc(r.answers.dept || "")}</td><td><span class="pill ${r.status === "submitted" ? "sub" : "draft"}">${r.status === "submitted" ? "Submitted" : "In progress"}</span></td><td style="white-space:nowrap">${r.updatedAt ? esc(new Date(r.updatedAt).toLocaleDateString()) : ""}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No responses yet. Share the form link to get started.</div>`;
    const r = openId && responses.find(x => x.id === openId);
    const detail = r ? `<div class="panel review"><div class="panel-head"><div><h2 style="font-size:20px">${esc(r.answers.name || "Anonymous")}</h2><p style="margin-left:20px">${esc([r.answers.title, r.answers.dept].filter(Boolean).join(" · "))}</p></div><div class="toolbar"><button class="btn small" id="delResp">Delete</button><button class="btn small" id="closeResp">Close</button></div></div>${reviewHTML(r.answers)}</div>` : `<div class="panel"><div class="empty">Select a respondent to read their full answers.</div></div>`;
    return `<div class="page-head"><div><h1>Responses</h1><p>Each interviewee sees only their own answers.</p></div>
      <div class="toolbar"><button class="btn small" id="csvBtn" ${responses.length ? "" : "disabled"}>Export CSV</button><button class="btn small" id="jsonBtn" ${submitted().length ? "" : "disabled"} title="Submitted answers from people who agreed to research use, with names and off-the-record notes removed">Export research dataset</button></div></div>
      <div class="split-2"><div class="panel" style="padding:6px">${list}</div>${detail}</div>`;
  }

  // ---------- settings ----------
  let draft = {};
  function settingsView() {
    const s = { ...cfg, ...draft };
    return `<div class="page-head"><div><h1>Settings</h1><p>Shown to everyone who opens the form.</p></div></div>
    <div class="panel" style="max-width:820px"><div class="fields" style="gap:26px">
      <div class="row2"><div><label class="q" for="s-client">Client organization</label><input type="text" id="s-client" value="${esc(s.clientName)}"></div>
      <div><label class="q" for="s-consultant">Consulting team</label><input type="text" id="s-consultant" value="${esc(s.consultantName)}"></div></div>
      <div class="row2"><div><label class="q" for="s-contact">Contact email</label><input type="email" id="s-contact" value="${esc(s.contactEmail)}" placeholder="Shown in the form footer"></div>
      <div><label class="q" for="s-due">Please finish by</label><input type="text" id="s-due" value="${esc(s.dueDate)}" placeholder="e.g. Friday, November 20"></div></div>
      <div><label class="q" for="s-model">Confidentiality</label><select id="s-model">${Object.entries(MODELS).map(([k, m]) => `<option value="${k}" ${k === s.model ? "selected" : ""}>${m.label}: ${m.text}</option>`).join("")}</select></div>
      <div><span class="q">Client logo</span><span class="help">Use the logo file the client provides. PNG or SVG with a transparent background works best.</span>
        <div class="logo-edit"><div class="logo-box">${cfg.hasLogo ? `<img src="/api/logo?v=${logoBust}" alt="Current logo">` : "No logo yet"}</div>
        <div class="toolbar"><label class="btn small" for="s-logo">Upload logo<input type="file" id="s-logo" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden></label>${cfg.hasLogo ? `<button class="btn ghost small" id="rmLogo">Remove</button>` : ""}</div></div></div>
      <div class="colors">
        <div><label class="q" for="s-brand">Primary color</label><span class="help">Header, hero and selected answers. Kept dark enough for white text.</span><div class="color-row"><input type="color" id="s-brand" value="${esc(s.brandColor)}"><input type="text" id="s-brandHex" value="${esc(s.brandColor)}" aria-label="Primary color hex"></div></div>
        <div><label class="q" for="s-accent">Accent color</label><span class="help">Buttons, progress and highlights.</span><div class="color-row"><input type="color" id="s-accent" value="${esc(s.accentColor)}"><input type="text" id="s-accentHex" value="${esc(s.accentColor)}" aria-label="Accent color hex"></div></div>
      </div>
    </div><div class="nav"><span class="info" id="setMsg"></span><button class="btn primary" id="saveSettings">Save settings</button></div></div>
    <p class="info" style="margin-top:16px">Storage: ${esc(me.storage === "postgres" ? "PostgreSQL" : "local file (development only — add a Postgres database before going live)")} · Automatic findings: ${me.aiEnabled ? "on" : "off"}</p>`;
  }

  // ---------- login ----------
  function loginView(err) {
    return `<div class="login"><div class="card"><h1 style="margin:0 0 6px;font-size:26px">Consultant sign-in</h1><p class="muted" style="margin:0 0 24px">Enter the dashboard password set in Railway.</p>
      ${err ? `<div class="note err">${esc(err)}</div>` : ""}
      <form id="loginForm"><label class="q" for="pw">Password</label><input type="password" id="pw" autocomplete="current-password" required>
      <button class="btn primary" style="margin-top:20px;width:100%;justify-content:center" type="submit">Sign in</button></form></div></div>`;
  }

  // ---------- render ----------
  function header() {
    $("#brand").innerHTML = `${brandMark(cfg, logoBust)}<div class="brand-text"><span class="brand-name">${esc(cfg.clientName || "Assess & Advise")}</span><span class="brand-sub">Assess &amp; Advise · consultant dashboard</span></div>`;
    $("#tabs").hidden = !me.admin;
    document.querySelectorAll(".tab[data-tab]").forEach(t => t.setAttribute("aria-selected", String(t.dataset.tab === tab)));
  }
  function render(err) {
    header();
    const app = $("#app");
    if (!me.admin) { app.innerHTML = loginView(err); const pw = $("#pw"); if (pw) pw.focus(); return; }
    app.innerHTML = `<div class="wide">${tab === "responses" ? responsesView() : tab === "settings" ? settingsView() : dashboard()}</div>`;
  }

  // ---------- data ----------
  async function load() {
    try {
      const [r, i] = await Promise.all([api("/api/admin/responses"), api("/api/admin/insights")]);
      responses = r; if (!aiBusy) insights = i; loading = false;
      if (tab !== "settings") render();
    } catch (e) { if (e.status === 401) { me.admin = false; render("Your session ended. Please sign in again."); } }
  }
  setInterval(() => { if (me.admin && tab !== "settings" && document.visibilityState === "visible") load(); }, 30000);

  async function runAI() {
    aiBusy = true; aiError = ""; render();
    try { insights = await api("/api/admin/insights", { method: "POST" }); }
    catch (e) { aiError = e.message; }
    finally { aiBusy = false; render(); }
  }

  const csvCell = s => { s = String(s ?? ""); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  function exportCSV() {
    const fs = allFields(), head = ["status", "updated", "submitted", ...fs.map(f => f.label)];
    const rows = responses.map(r => [r.status, r.updatedAt || "", r.submittedAt || "", ...fs.map(f => fmt(f, r.answers[f.id]))]);
    download(`${(cfg.clientName || "client").replace(/[^\w-]+/g, "-").toLowerCase()}-responses-${new Date().toISOString().slice(0, 10)}.csv`, "﻿" + [head, ...rows].map(r => r.map(csvCell).join(",")).join("\r\n"), "text/csv");
  }
  function exportDataset() {
    const recs = submitted().filter(r => r.answers.researchOk === "Yes").map(r => { const a = { ...r.answers }; delete a.name; delete a.offRecord; return { engagement: { client: cfg.clientName, sector: "Architecture", collected: String(r.submittedAt || "").slice(0, 10), schema: "assess-advise-v2" }, answers: a }; });
    download(`assess-advise-dataset-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ exported: new Date().toISOString(), count: recs.length, fields: allFields().map(f => ({ id: f.id, label: f.label, type: f.type })), records: recs, findings: insights || null }, null, 2), "application/json");
  }

  // ---------- events ----------
  document.addEventListener("submit", async e => {
    if (e.target.id !== "loginForm") return;
    e.preventDefault();
    try { await api("/api/admin/login", { method: "POST", body: { password: $("#pw").value } }); me = await api("/api/admin/me"); render(); load(); }
    catch (err) { render(err.message); }
  });
  document.addEventListener("input", e => {
    const t = e.target, pairs = { "s-brand": ["brandColor", "s-brandHex"], "s-accent": ["accentColor", "s-accentHex"], "s-brandHex": ["brandColor", "s-brand"], "s-accentHex": ["accentColor", "s-accent"] };
    if (pairs[t.id]) { const [key, other] = pairs[t.id]; const v = t.value.trim(); if (!hexOk(v)) return; draft[key] = v; document.getElementById(other).value = v; applyBrand({ ...cfg, ...draft }); }
  });
  document.addEventListener("change", async e => {
    if (e.target.id !== "s-logo") return;
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 1.5e6) { $("#setMsg").textContent = "Please use a logo under 1.5 MB."; return; }
    const dataUrl = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
    try { await api("/api/admin/logo", { method: "PUT", body: { dataUrl } }); cfg.hasLogo = true; logoBust = Date.now(); keep(render); $("#setMsg").textContent = "Logo updated."; }
    catch (err) { $("#setMsg").textContent = err.message; }
  });
  function keep(fn) { const ids = ["s-client", "s-consultant", "s-contact", "s-due", "s-model"]; const v = ids.map(i => document.getElementById(i)?.value); fn(); ids.forEach((i, n) => { const el = document.getElementById(i); if (el && v[n] != null) el.value = v[n]; }); }
  document.addEventListener("click", async e => {
    const b = e.target.closest("button, tr[data-open]"); if (!b) return;
    if (b.dataset.tab) { tab = b.dataset.tab; draft = {}; applyBrand(cfg); render(); window.scrollTo({ top: 0 }); return; }
    if (b.dataset.open) { openId = b.dataset.open; render(); return; }
    switch (b.id) {
      case "reload": load(); break;
      case "runAI": runAI(); break;
      case "csvBtn": exportCSV(); break;
      case "jsonBtn": exportDataset(); break;
      case "closeResp": openId = null; render(); break;
      case "delResp":
        if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Click again to delete"; return; }
        try { await api(`/api/admin/responses/${encodeURIComponent(openId)}`, { method: "DELETE" }); openId = null; await load(); } catch (err) {} break;
      case "rmLogo": try { await api("/api/admin/logo", { method: "DELETE" }); cfg.hasLogo = false; keep(render); } catch (err) {} break;
      case "saveSettings": {
        const body = { clientName: $("#s-client").value, consultantName: $("#s-consultant").value, contactEmail: $("#s-contact").value, dueDate: $("#s-due").value, model: $("#s-model").value, brandColor: draft.brandColor || cfg.brandColor, accentColor: draft.accentColor || cfg.accentColor };
        try { cfg = await api("/api/admin/settings", { method: "PUT", body }); draft = {}; applyBrand(cfg); render(); $("#setMsg").textContent = "Saved. The form now uses these settings."; }
        catch (err) { $("#setMsg").textContent = err.message; }
        break; }
    }
  });
  document.addEventListener("keydown", e => { const r = e.target.closest && e.target.closest("tr[data-open]"); if (r && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openId = r.dataset.open; render(); } });

  // ---------- boot ----------
  (async () => {
    try { cfg = await api("/api/config"); applyBrand(cfg); } catch (e) {}
    try { me = await api("/api/admin/me"); } catch (e) {}
    render();
    if (me.admin) load();
  })();
})();
