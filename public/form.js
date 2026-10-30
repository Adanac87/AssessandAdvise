(() => {
  "use strict";
  const { SECTIONS, MODELS, allFields, flat, fmt } = window.AA;
  const { esc, applyBrand, brandMark, icon, api, download } = window.UI;
  const $ = s => document.querySelector(s);
  const LS = "aa-interview";

  let cfg = { clientName: "", consultantName: "", model: "confidential" };
  let answers = {}, status = "draft", submittedAt = null, token = null;
  let step = 0, saveTimer = null, saving = false, pending = false, offline = false, errorMsg = "";

  // restore
  try { const d = JSON.parse(localStorage.getItem(LS) || "null"); if (d) { answers = d.answers || {}; token = d.token || null; } } catch (e) {}
  const urlToken = new URLSearchParams(location.search).get("r");
  if (urlToken) token = urlToken;
  const persistLocal = () => { try { localStorage.setItem(LS, JSON.stringify({ answers, token })); } catch (e) {} };
  const resumeLink = () => token ? `${location.origin}${location.pathname}?r=${encodeURIComponent(token)}` : "";

  // ---------- fields ----------
  function field(f) {
    if (f.pair) return `<div class="row2">${f.pair.map(field).join("")}</div>`;
    const v = answers[f.id], id = "f-" + f.id;
    const req = f.required ? ` <span class="req" aria-label="required">*</span>` : "";
    const help = f.help ? `<span class="help">${esc(f.help)}</span>` : "";
    const lab = `<label class="q" for="${id}">${esc(f.label)}${req}</label>${help}`;
    const grp = `<span class="q" id="${id}-l">${esc(f.label)}${req}</span>${help}`;
    switch (f.type) {
      case "text": case "number":
        return `<div>${lab}<input id="${id}" type="${f.type}" ${f.type === "number" ? 'min="0" inputmode="numeric"' : ""} data-k="${f.id}" value="${esc(v)}" autocomplete="off"></div>`;
      case "textarea": return `<div>${lab}<textarea id="${id}" data-k="${f.id}">${esc(v)}</textarea></div>`;
      case "select": return `<div>${lab}<select id="${id}" data-k="${f.id}"><option value="">Choose…</option>${f.options.map(o => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></div>`;
      case "radio": return `<div role="radiogroup" aria-labelledby="${id}-l">${grp}<div class="opts">${f.options.map((o, i) => `<label class="opt"><input type="radio" id="${id}-${i}" name="${id}" data-k="${f.id}" value="${esc(o)}" ${o === v ? "checked" : ""}><span>${esc(o)}</span></label>`).join("")}</div></div>`;
      case "checks": { const arr = Array.isArray(v) ? v : []; return `<div role="group" aria-labelledby="${id}-l">${grp}<div class="opts">${f.options.map((o, i) => `<label class="opt"><input type="checkbox" id="${id}-${i}" data-multi="${f.id}" value="${esc(o)}" ${arr.includes(o) ? "checked" : ""}><span>${esc(o)}</span></label>`).join("")}</div></div>`; }
      case "rating": return `<div role="radiogroup" aria-labelledby="${id}-l">${grp}<div class="scale">${[1, 2, 3, 4, 5].map(n => `<label class="opt"><input type="radio" id="${id}-${n}" name="${id}" data-k="${f.id}" value="${n}" ${String(v) === String(n) ? "checked" : ""}><span>${n}</span></label>`).join("")}</div><div class="scale-ends"><span>Poor</span><span>Excellent</span></div></div>`;
      case "split": { const s = v || {}; const tot = f.parts.reduce((t, [k]) => t + (Number(s[k]) || 0), 0);
        return `<div>${grp}<div class="split">${f.parts.map(([k, l]) => `<div class="mini"><label for="${id}-${k}">${esc(l)}</label><input type="number" min="0" max="100" inputmode="numeric" id="${id}-${k}" data-split="${f.id}" data-part="${k}" value="${esc(s[k])}"></div>`).join("")}</div><div class="total ${tot && tot !== 100 ? "off" : ""}" id="${id}-total">Total ${tot}%</div></div>`; }
      case "steps": { const arr = Array.isArray(v) && v.length ? v : [{}];
        return `<div>${grp}<div class="list">${arr.map((r, i) => `<div class="item"><div class="item-head"><span class="tag">Step ${i + 1}</span>${arr.length > 1 ? `<button type="button" class="btn ghost small" data-del="${f.id}" data-i="${i}">Remove</button>` : ""}</div>
          <div class="mini"><label for="${id}-${i}-what">What happens</label><input type="text" id="${id}-${i}-what" data-list="${f.id}" data-i="${i}" data-f="what" value="${esc(r.what)}"></div>
          <div class="row2"><div class="mini"><label for="${id}-${i}-tool">Software used</label><input type="text" id="${id}-${i}-tool" data-list="${f.id}" data-i="${i}" data-f="tool" value="${esc(r.tool)}"></div>
          <div class="mini"><label for="${id}-${i}-pain">Waiting, rework or problems</label><input type="text" id="${id}-${i}-pain" data-list="${f.id}" data-i="${i}" data-f="pain" value="${esc(r.pain)}"></div></div></div>`).join("")}</div>
          <button type="button" class="btn small" style="margin-top:12px" data-add="${f.id}">+ Add a step</button></div>`; }
      case "apps": { const arr = Array.isArray(v) && v.length ? v : [{}];
        const sel = (i, k, opts, cur) => `<select id="${id}-${i}-${k}" data-list="${f.id}" data-i="${i}" data-f="${k}"><option value="">Choose…</option>${opts.map(o => `<option ${String(o) === String(cur) ? "selected" : ""}>${o}</option>`).join("")}</select>`;
        return `<div>${grp}<div class="list">${arr.map((r, i) => `<div class="item"><div class="item-head"><span class="tag">Tool ${i + 1}</span>${arr.length > 1 ? `<button type="button" class="btn ghost small" data-del="${f.id}" data-i="${i}">Remove</button>` : ""}</div>
          <div class="grid3"><div class="mini"><label for="${id}-${i}-name">Application</label><input type="text" id="${id}-${i}-name" data-list="${f.id}" data-i="${i}" data-f="name" value="${esc(r.name)}" placeholder="e.g. Revit"></div>
          <div class="mini"><label for="${id}-${i}-freq">How often</label>${sel(i, "freq", ["Daily", "Weekly", "Occasionally"], r.freq)}</div>
          <div class="mini"><label for="${id}-${i}-rating">How well it works (1–5)</label>${sel(i, "rating", [1, 2, 3, 4, 5], r.rating)}</div></div>
          <div class="mini"><label for="${id}-${i}-note">One-line comment (optional)</label><input type="text" id="${id}-${i}-note" data-list="${f.id}" data-i="${i}" data-f="note" value="${esc(r.note)}"></div></div>`).join("")}</div>
          <button type="button" class="btn small" style="margin-top:12px" data-add="${f.id}">+ Add a tool</button></div>`; }
    }
    return "";
  }

  const answered = s => flat(s).filter(f => fmt(f, answers[f.id])).length;
  const content = SECTIONS.filter(s => s.fields);

  function sideNav() {
    return `<aside class="side"><nav aria-label="Sections">${content.map(s => { const i = SECTIONS.indexOf(s), n = answered(s) > 0;
      return `<button type="button" data-go="${i}" ${i === step ? 'aria-current="step"' : ""}><span class="num ${n && i !== step ? "done" : ""}">${n && i !== step ? "✓" : String(i).padStart(2, "0")}</span><span class="lbl">${esc(s.title)}</span></button>`; }).join("")}
      <button type="button" data-go="${SECTIONS.length - 1}" ${step === SECTIONS.length - 1 ? 'aria-current="step"' : ""}><span class="num">${icon("check", 'style="width:14px;height:14px;stroke:#fff"')}</span><span class="lbl">Review and submit</span></button></nav>
      <div class="side-note">${offline ? "You're offline from our server right now. Your answers are kept in this browser and will save when the connection returns." : "Your progress saves automatically. You can close this page and come back on this device."}</div></aside>`;
  }

  function welcome() {
    const m = MODELS[cfg.model] || MODELS.confidential;
    return `<section class="hero"><div class="hero-in gut"><span class="kicker">Assess &amp; Advise</span>
      <h1>How does work really get done at ${esc(cfg.clientName)}?</h1>
      <p>${esc(cfg.clientName)} has asked ${esc(cfg.consultantName)} to understand how projects move through the studio: which tools help, and where time is lost. Your answers shape the recommendations.</p></div></section>
      <div class="gut"><div class="welcome-card">
        <div class="stats"><div><b>About 25 minutes</b><span>Skip anything that doesn't apply</span></div><div><b>${content.length} short sections</b><span>Most questions are optional</span></div><div><b>${esc(m.label)}</b><span>How findings are reported</span></div></div>
        <div class="promise">
          <div>${icon("shield")}<span><b>Your answers are protected</b>${esc(m.text)}</span></div>
          <div>${icon("eye")}<span><b>Only the consulting team reads them</b>Raw answers go to ${esc(cfg.consultantName)}, not to your managers.</span></div>
          <div>${icon("save")}<span><b>Saves as you go</b>Close the page and pick up where you left off.</span></div>
          <div>${icon("clock")}<span><b>${cfg.dueDate ? "Please finish by " + esc(cfg.dueDate) : "Not a performance review"}</b>${cfg.dueDate ? "Partial answers still help." : "We're looking at systems and tools, not people."}</span></div>
        </div>
        <div class="section-map"><span class="eyebrow">What we'll cover</span><ol>${content.map(s => `<li><span class="num">${String(SECTIONS.indexOf(s)).padStart(2, "0")}</span>${esc(s.title)}</li>`).join("")}</ol></div>
        <div class="nav" style="border:0"><span class="muted" style="font-size:14px">${token && Object.keys(answers).length ? "Welcome back. Your earlier answers are saved." : ""}</span><button type="button" class="btn primary lg" data-go="${token && Object.keys(answers).length ? firstOpen() : 1}">${token && Object.keys(answers).length ? "Continue" : "Begin the interview"} →</button></div>
      </div></div>`;
  }
  function firstOpen() { const s = content.find(s => answered(s) === 0); return s ? SECTIONS.indexOf(s) : SECTIONS.length - 1; }

  function sectionView(s) {
    const last = SECTIONS.length - 1;
    return `<div class="shell gut">${sideNav()}<main class="main"><div class="card">
      ${errorMsg ? `<div class="note err">${esc(errorMsg)}</div>` : ""}
      <div class="sec-head"><div class="sec-icon">${icon(s.icon)}</div><div><span class="eyebrow">Section ${step} of ${content.length}</span><h1>${esc(s.title)}</h1><p>${esc(s.intro || "")}</p></div></div>
      <div class="fields">${s.fields.map(field).join("")}</div>
      <div class="nav"><button type="button" class="btn" data-go="${step - 1}">← Back</button><button type="button" class="btn primary" data-go="${step + 1}">${step + 1 === last ? "Review answers" : "Continue"} →</button></div>
    </div></main></div>`;
  }

  function reviewView() {
    if (status === "submitted") {
      const link = resumeLink();
      return `<div class="shell gut" style="grid-template-columns:minmax(0,1fr)"><main class="main" style="margin:0 auto"><div class="card done">
        <div class="done-mark">${icon("check")}</div><h1>Thank you. Your answers are in.</h1>
        <p class="muted" style="max-width:52ch;margin:0 auto">Submitted ${submittedAt ? esc(new Date(submittedAt).toLocaleString()) : ""}. ${esc(cfg.consultantName)} will combine them with your colleagues' answers to prepare recommendations for ${esc(cfg.clientName)}.</p>
        ${link ? `<div class="resume"><label class="q" for="resumeLink" style="font-size:14px">Want to add something later? Keep this private link:</label><div class="toolbar" style="flex-wrap:nowrap"><input type="text" id="resumeLink" readonly value="${esc(link)}"><button type="button" class="btn small" id="copyLink">Copy</button></div></div>` : ""}
        <div class="toolbar" style="justify-content:center;margin-top:24px"><button type="button" class="btn" id="editAgain">Edit my answers</button><button type="button" class="btn" id="dlBtn">Download a copy</button></div>
      </div></main></div>`;
    }
    const missing = allFields().filter(f => f.required && !fmt(f, answers[f.id]));
    return `<div class="shell gut">${sideNav()}<main class="main"><div class="card review">
      ${errorMsg ? `<div class="note err">${esc(errorMsg)}</div>` : ""}
      <div class="sec-head"><div class="sec-icon">${icon("check")}</div><div><span class="eyebrow">Final step</span><h1>Review and submit</h1><p>Check your answers, then submit. Use Edit to jump back to any section.</p></div></div>
      ${missing.length ? `<div class="note warn">Still needed before you can submit: ${missing.map(f => `<b>${esc(f.label)}</b>`).join(" · ")}</div>` : ""}
      ${content.map(s => `<section><header><h2><span class="num">${String(SECTIONS.indexOf(s)).padStart(2, "0")}</span>${esc(s.title)}</h2><button type="button" class="btn ghost small" data-go="${SECTIONS.indexOf(s)}">Edit</button></header><dl>${flat(s).map(f => { const t = fmt(f, answers[f.id]); return `<dt>${esc(f.label)}</dt><dd class="${t ? "" : "empty"}">${t ? esc(t) : "—"}</dd>`; }).join("")}</dl></section>`).join("")}
      <div class="nav"><button type="button" class="btn" data-go="${step - 1}">← Back</button><div class="toolbar"><button type="button" class="btn" id="dlBtn">Download my answers</button><button type="button" class="btn primary lg" id="submitBtn" ${missing.length ? "disabled" : ""}>Submit answers</button></div></div>
    </div></main></div>`;
  }

  function render() {
    const s = SECTIONS[step];
    $("#progress").hidden = !!s.welcome;
    $("#progress i").style.width = Math.round(step / (SECTIONS.length - 1) * 100) + "%";
    $("#app").innerHTML = s.welcome ? welcome() : s.review ? reviewView() : sectionView(s);
    showSave();
  }
  function showSave(msg) {
    const el = $("#saveState");
    if (msg !== undefined) el.dataset.msg = msg;
    el.textContent = offline ? "Saved in this browser" : (el.dataset.msg || "");
    el.hidden = !el.textContent || SECTIONS[step].welcome;
  }

  // ---------- saving ----------
  function queueSave() { persistLocal(); showSave("Saving…"); clearTimeout(saveTimer); saveTimer = setTimeout(doSave, 900); }
  async function doSave(final) {
    if (saving) { pending = true; return; }
    saving = true;
    try {
      if (!token) { const r = await api("/api/responses", { method: "POST", body: { answers } }); token = r.token; persistLocal(); if (!urlToken) history.replaceState(null, "", `?r=${encodeURIComponent(token)}`); }
      const r = await api(`/api/responses/${encodeURIComponent(token)}`, { method: "PUT", body: { answers, status } });
      submittedAt = r.submittedAt; offline = false; errorMsg = ""; showSave("All changes saved");
      return true;
    } catch (e) {
      if (e.status === 400 && final) { errorMsg = e.message; }
      else if (e.status === 404) { token = null; persistLocal(); }
      else { offline = true; showSave(); }
      if (final) throw e;
      return false;
    } finally { saving = false; if (pending) { pending = false; doSave(); } }
  }
  setInterval(() => { if (offline) doSave(); }, 20000);

  // ---------- events ----------
  const listOf = k => (Array.isArray(answers[k]) && answers[k].length ? answers[k] : [{}]).map(x => ({ ...x }));
  document.addEventListener("input", e => {
    const t = e.target;
    if (t.dataset.k && t.type !== "radio" && t.tagName !== "SELECT") { answers[t.dataset.k] = t.value; queueSave(); }
    else if (t.dataset.split) {
      const o = answers[t.dataset.split] = { ...(answers[t.dataset.split] || {}) }; o[t.dataset.part] = t.value;
      const f = allFields().find(x => x.id === t.dataset.split), tot = f.parts.reduce((s, [k]) => s + (Number(o[k]) || 0), 0);
      const el = document.getElementById("f-" + f.id + "-total"); if (el) { el.textContent = `Total ${tot}%`; el.classList.toggle("off", !!tot && tot !== 100); }
      queueSave();
    } else if (t.dataset.list && t.tagName !== "SELECT") { const arr = answers[t.dataset.list] = listOf(t.dataset.list); arr[+t.dataset.i][t.dataset.f] = t.value; queueSave(); }
  });
  document.addEventListener("change", e => {
    const t = e.target;
    if (t.dataset.k && (t.type === "radio" || t.tagName === "SELECT")) { answers[t.dataset.k] = t.value; queueSave(); }
    else if (t.dataset.multi) { const cur = new Set(Array.isArray(answers[t.dataset.multi]) ? answers[t.dataset.multi] : []); t.checked ? cur.add(t.value) : cur.delete(t.value); answers[t.dataset.multi] = [...cur]; queueSave(); }
    else if (t.dataset.list && t.tagName === "SELECT") { const arr = answers[t.dataset.list] = listOf(t.dataset.list); arr[+t.dataset.i][t.dataset.f] = t.value; queueSave(); }
  });
  document.addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.go != null) { step = Math.max(0, Math.min(SECTIONS.length - 1, +b.dataset.go)); errorMsg = ""; render(); window.scrollTo({ top: 0 }); return; }
    if (b.dataset.add) { const k = b.dataset.add, arr = listOf(k); arr.push({}); answers[k] = arr; render(); queueSave(); return; }
    if (b.dataset.del) { const k = b.dataset.del, arr = listOf(k); arr.splice(+b.dataset.i, 1); answers[k] = arr; render(); queueSave(); return; }
    switch (b.id) {
      case "submitBtn":
        b.disabled = true; b.innerHTML = '<span class="spin"></span>Submitting…';
        clearTimeout(saveTimer); status = "submitted";
        try { await doSave(true); } catch (err) { status = "draft"; if (!errorMsg) errorMsg = "We couldn't reach the server to submit. Check your connection and try again; your answers are safe in this browser."; }
        render(); window.scrollTo({ top: 0 }); break;
      case "editAgain": status = "draft"; step = 1; render(); queueSave(); break;
      case "dlBtn": download(`interview-${(answers.title || "answers").replace(/[^\w-]+/g, "-").slice(0, 40)}.txt`, textCopy(), "text/plain"); break;
      case "copyLink": { const i = document.getElementById("resumeLink"); try { await navigator.clipboard.writeText(i.value); b.textContent = "Copied"; } catch (err) { i.select(); } break; }
    }
  });
  function textCopy() {
    const out = [`Assess & Advise interview — ${cfg.clientName}`, `Saved ${new Date().toLocaleString()}`, ""];
    content.forEach(s => { out.push("== " + s.title.toUpperCase() + " =="); flat(s).forEach(f => { out.push(f.label); out.push((fmt(f, answers[f.id]) || "(not answered)").split("\n").map(l => "  " + l).join("\n")); out.push(""); }); });
    return out.join("\n");
  }

  // ---------- boot ----------
  (async () => {
    try { cfg = await api("/api/config"); } catch (e) { cfg = { clientName: "your organization", consultantName: "our consulting team", model: "confidential" }; }
    applyBrand(cfg);
    document.title = `${cfg.clientName} · Assess & Advise`;
    $("#brand").innerHTML = `${brandMark(cfg)}<div class="brand-text"><span class="brand-name">${esc(cfg.clientName)}</span><span class="brand-sub">Assess &amp; Advise · ${esc(cfg.consultantName)}</span></div>`;
    $("#foot").innerHTML = `<span>Confidential interview prepared by ${esc(cfg.consultantName)} for ${esc(cfg.clientName)}.</span>${cfg.contactEmail ? `<span>Questions? <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a></span>` : ""}`;
    if (token) {
      try { const r = await api(`/api/responses/${encodeURIComponent(token)}`); answers = { ...r.answers, ...(urlToken ? {} : answers) }; if (urlToken) answers = r.answers; status = r.status; submittedAt = r.submittedAt; persistLocal(); if (status === "submitted") step = SECTIONS.length - 1; }
      catch (e) { if (e.status === 404) { token = null; persistLocal(); } else offline = true; }
    }
    render();
  })();
})();
