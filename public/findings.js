// Findings: leadership-facing synthesis. Shared by the dashboard (editable) and /report (print view).
(function () {
  "use strict";
  const { esc } = window.UI;
  const AA = window.AA;

  // ---------- schema ----------
  const SEV = ["High", "Medium", "Low"], FIVE = ["1", "2", "3", "4", "5"];
  const SECTIONS = [
    { key: "summary", title: "Executive summary", fields: [["headline", "Headline finding", "text"], ["overview", "Overview", "textarea"], ["status", "Status note", "text"]] },
    { key: "themes", title: "What we heard", list: [["title", "Theme", "text"], ["severity", "Priority", SEV], ["heardFrom", "Heard from", "text"], ["detail", "Finding", "textarea"]] },
    { key: "voices", title: "In their words", list: [["quote", "Quote", "textarea"], ["who", "Attribution (role or team, never a name)", "text"]] },
    { key: "workflow", title: "How work flows today", fields: [["title", "Process name", "text"], ["intro", "One-line description", "text"]], list: [["name", "Step", "text"], ["owner", "Who", "text"], ["tools", "Tools (comma separated)", "text"], ["issue", "Friction", "text"], ["severity", "Friction level", ["None", "Minor", "Major"]]] },
    { key: "software", title: "Software landscape", list: [["name", "Software", "text"], ["category", "Category", "text"], ["use", "How it's used", "text"], ["status", "Recommendation", ["Keep", "Expand use", "Consolidate", "Replace", "Retire", "Evaluate"]], ["note", "Note", "text"]] },
    { key: "overlaps", title: "Where the tech stack overlaps", list: [["area", "Job to be done", "text"], ["tools", "Tools doing it today", "text"], ["move", "Recommendation", "textarea"]] },
    { key: "recommendations", title: "Recommendations", list: [["title", "Recommendation", "text"], ["horizon", "Horizon", ["Quick win", "Project", "Strategic"]], ["impact", "Impact (1–5)", FIVE], ["effort", "Effort (1–5)", FIVE], ["problem", "Addresses", "textarea"], ["solution", "What we recommend", "textarea"], ["offering", "How IMAGINiT can help", "textarea"]] },
    { key: "discussions", title: "Our conversations so far", list: [["date", "Date (YYYY-MM-DD)", "text"], ["type", "Type", "text"], ["who", "With", "text"], ["summary", "What was discussed", "textarea"]] },
    { key: "nextSteps", title: "Next steps", list: [["action", "Action", "text"], ["owner", "Owner", "text"], ["when", "When", "text"]] }
  ];
  const byKey = Object.fromEntries(SECTIONS.map(s => [s.key, s]));

  // ---------- derived numbers ----------
  const isTest = r => /^test\b/i.test(String(r.answers && r.answers.name || "").trim());
  function stats(responses) {
    const sub = responses.filter(r => r.status === "submitted");
    const real = sub.filter(r => !isTest(r));
    const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
    const hrs = real.map(r => AA.HOURS_MID[r.answers.hoursLost]).filter(x => x != null);
    const ratings = AA.RATINGS.map(([k, l]) => { const v = real.map(r => Number(r.answers[k])).filter(Boolean); return { label: l, avg: avg(v), n: v.length }; });
    const allR = real.flatMap(r => AA.RATINGS.map(([k]) => Number(r.answers[k])).filter(Boolean));
    const rework = real.map(r => Number((r.answers.split || {}).rework)).filter(x => !isNaN(x) && x > 0);
    const tools = new Set(); real.forEach(r => { (r.answers.designTools || []).forEach(t => tools.add(t)); (r.answers.apps || []).forEach(a => a.name && tools.add(a.name.trim())); });
    return { real, testCount: sub.length - real.length, inProgress: responses.length - sub.length, hours: avg(hrs), sat: avg(allR), ratings, rework: avg(rework), tools: tools.size };
  }

  // ---------- rendering ----------
  const sevClass = s => ({ High: "hi", Medium: "md", Low: "lo", Major: "hi", Minor: "md" }[s] || "");
  const para = t => esc(t || "").split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
  const items = (f, k) => ((f[k] || {}).items || []).filter(x => x && Object.values(x).some(v => String(v || "").trim()));

  function head(sec, n, editable, sub) {
    return `<header class="rep-h"><span class="rep-n">${String(n).padStart(2, "0")}</span><div><h2>${esc(sec.title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ""}</div>${editable ? `<button class="btn small rep-edit" data-edit="${sec.key}">Edit</button>` : ""}</header>`;
  }
  const emptyNote = (editable) => `<p class="rep-empty">${editable ? "Nothing here yet. Use Edit to add it." : "To be completed."}</p>`;

  function render(f, ctx, opts = {}) {
    const ed = !!opts.editable, st = stats(ctx.responses || []), cfg = ctx.cfg || {}, n = st.real.length;
    const fmt1 = v => v == null ? "–" : v.toFixed(1);
    let i = 0, out = [];

    // Cover
    out.push(`<section class="rep-cover"><div class="rep-cover-in"><span class="kicker">Assess &amp; Advise · Findings for leadership</span>
      <h1>${esc(cfg.clientName || "")}</h1>
      <p class="rep-meta">Prepared by ${esc(cfg.consultantName || "")} · ${esc(new Date(f.updatedAt || Date.now()).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }))}${f.summary && f.summary.status ? ` · ${esc(f.summary.status)}` : ""}</p>
      <div class="rep-kpis">
        <div><b>${n}</b><span>staff interview${n === 1 ? "" : "s"} completed${st.inProgress ? ` · ${st.inProgress} in progress` : ""}</span></div>
        <div><b>${fmt1(st.hours)}<small> hrs</small></b><span>lost per person each week to the biggest frustration</span></div>
        <div><b>${st.rework == null ? "–" : Math.round(st.rework) + "%"}</b><span>of a typical week spent on rework</span></div>
        <div><b>${fmt1(st.sat)}<small> / 5</small></b><span>average satisfaction with tools and handoffs</span></div>
      </div></div></section>`);

    // 1 Summary
    const s = f.summary || {};
    out.push(`<section class="rep-sec" data-sec="summary">${head(byKey.summary, ++i, ed)}${s.headline ? `<p class="rep-headline">${esc(s.headline)}</p>` : ""}${s.overview ? `<div class="rep-body">${para(s.overview)}</div>` : (s.headline ? "" : emptyNote(ed))}</section>`);

    // 2 Themes
    const th = items(f, "themes");
    out.push(`<section class="rep-sec" data-sec="themes">${head(byKey.themes, ++i, ed, "Recurring issues, most important first")}${th.length ? `<div class="rep-themes">${th.map(t => `<article class="rep-theme ${sevClass(t.severity)}"><div class="rep-theme-top"><span class="sev ${sevClass(t.severity)}">${esc(t.severity || "")}</span>${t.heardFrom ? `<span class="heard">${esc(t.heardFrom)}</span>` : ""}</div><h3>${esc(t.title)}</h3>${para(t.detail)}</article>`).join("")}</div>` : emptyNote(ed)}</section>`);

    // 3 Voices
    let vo = items(f, "voices");
    if (!vo.length) vo = st.real.filter(r => r.answers.biggest && r.answers.quoteOk === "Yes, anonymously").map(r => ({ quote: r.answers.biggest, who: r.answers.dept || "Staff member" }));
    out.push(`<section class="rep-sec" data-sec="voices">${head(byKey.voices, ++i, ed, "What staff told us, shared anonymously and with their permission")}${vo.length ? `<div class="rep-quotes">${vo.map(q => `<figure><blockquote>${esc(q.quote)}</blockquote><figcaption>${esc(q.who)}</figcaption></figure>`).join("")}</div>` : emptyNote(ed)}</section>`);

    // 4 Workflow
    const wf = f.workflow || {}, steps = items(f, "workflow");
    out.push(`<section class="rep-sec" data-sec="workflow">${head(byKey.workflow, ++i, ed, wf.intro || "")}${wf.title ? `<h3 class="rep-sub">${esc(wf.title)}</h3>` : ""}${steps.length ? `<ol class="flow">${steps.map((p, k) => `<li class="flow-step ${sevClass(p.severity)}"><span class="flow-n">${k + 1}</span><h4>${esc(p.name)}</h4>${p.owner ? `<p class="flow-who">${esc(p.owner)}</p>` : ""}${p.tools ? `<div class="flow-tools">${p.tools.split(",").map(t => t.trim()).filter(Boolean).map(t => `<span>${esc(t)}</span>`).join("")}</div>` : ""}${p.issue ? `<p class="flow-issue"><b>${esc(p.severity === "Major" ? "Major friction" : p.severity === "Minor" ? "Friction" : "Note")}:</b> ${esc(p.issue)}</p>` : ""}</li>`).join("")}</ol>
      <p class="flow-key"><span class="k hi"></span>Major friction <span class="k md"></span>Minor friction <span class="k"></span>Working well</p>` : emptyNote(ed)}</section>`);

    // 5 Software
    const sw = items(f, "software"), ov = items(f, "overlaps");
    const stCls = v => ({ Keep: "keep", "Expand use": "expand", Consolidate: "cons", Replace: "repl", Retire: "repl", Evaluate: "eval" }[v] || "");
    out.push(`<section class="rep-sec" data-sec="software">${head(byKey.software, ++i, ed, "Every tool staff named, and what we'd do with each")}${sw.length ? `<div class="tablewrap"><table class="rep-table"><thead><tr><th>Software</th><th>Category</th><th>How it's used</th><th>Recommendation</th></tr></thead><tbody>${sw.map(x => `<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.category)}</td><td>${esc(x.use)}${x.note ? `<div class="muted" style="font-size:13.5px">${esc(x.note)}</div>` : ""}</td><td><span class="stat ${stCls(x.status)}">${esc(x.status)}</span></td></tr>`).join("")}</tbody></table></div>` : emptyNote(ed)}</section>`);

    // 6 Overlaps
    out.push(`<section class="rep-sec" data-sec="overlaps">${head(byKey.overlaps, ++i, ed, "Several tools doing the same job: where to simplify")}${ov.length ? `<div class="rep-overlaps">${ov.map(o => `<article><h3>${esc(o.area)}</h3><div class="ov-tools">${String(o.tools || "").split(",").map(t => t.trim()).filter(Boolean).map(t => `<span>${esc(t)}</span>`).join("")}</div><div class="ov-arrow" aria-hidden="true">→</div><p>${esc(o.move)}</p></article>`).join("")}</div>` : emptyNote(ed)}</section>`);

    // 7 Recommendations roadmap
    const rec = items(f, "recommendations");
    const cols = ["Quick win", "Project", "Strategic"], colSub = { "Quick win": "0–3 months", Project: "3–9 months", Strategic: "9–18 months" };
    out.push(`<section class="rep-sec" data-sec="recommendations">${head(byKey.recommendations, ++i, ed, "A phased roadmap, highest impact for least effort first")}${rec.length ? `<div class="roadmap">${cols.map(c => { const list = rec.filter(r => (r.horizon || "Project") === c).sort((a, b) => (b.impact - b.effort) - (a.impact - a.effort)); return `<div class="rm-col"><div class="rm-head ${c === "Quick win" ? "qw" : c === "Project" ? "pr" : "st"}"><b>${c === "Quick win" ? "Quick wins" : c === "Project" ? "Projects" : "Strategic"}</b><span>${colSub[c]}</span></div>${list.map(r => `<article class="rm-card"><h3>${esc(r.title)}</h3>${r.problem ? `<p class="rm-prob"><b>Addresses:</b> ${esc(r.problem)}</p>` : ""}${r.solution ? `<p>${esc(r.solution)}</p>` : ""}${r.offering ? `<p class="rm-off"><b>How IMAGINiT can help:</b> ${esc(r.offering)}</p>` : ""}<div class="rm-scores"><span>Impact <b>${esc(r.impact)}</b></span><span>Effort <b>${esc(r.effort)}</b></span></div></article>`).join("") || `<p class="rep-empty">None</p>`}</div>`; }).join("")}</div>` : emptyNote(ed)}</section>`);

    // 8 Discussions
    const ds = items(f, "discussions").slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    out.push(`<section class="rep-sec" data-sec="discussions">${head(byKey.discussions, ++i, ed, "What leadership has already told us")}${ds.length ? `<ol class="timeline">${ds.map(d => `<li><time>${esc(fmtDate(d.date))}</time><div><b>${esc(d.type)}</b>${d.who ? ` · <span class="muted">${esc(d.who)}</span>` : ""}<p>${esc(d.summary)}</p></div></li>`).join("")}</ol>` : emptyNote(ed)}</section>`);

    // 9 Next steps
    const ns = items(f, "nextSteps");
    out.push(`<section class="rep-sec" data-sec="nextSteps">${head(byKey.nextSteps, ++i, ed)}${ns.length ? `<div class="tablewrap"><table class="rep-table"><thead><tr><th>Action</th><th>Owner</th><th>When</th></tr></thead><tbody>${ns.map(x => `<tr><td>${esc(x.action)}</td><td>${esc(x.owner)}</td><td style="white-space:nowrap">${esc(x.when)}</td></tr>`).join("")}</tbody></table></div>` : emptyNote(ed)}</section>`);

    // Appendix: ratings
    const rat = st.ratings.filter(r => r.avg != null);
    out.push(`<section class="rep-sec rep-appx"><header class="rep-h"><span class="rep-n">A</span><div><h2>Appendix: survey ratings</h2><p>Average of 1–5 answers across ${n} completed interview${n === 1 ? "" : "s"}${st.testCount ? ` (${st.testCount} test response${st.testCount === 1 ? "" : "s"} excluded)` : ""}</p></div></header>
      ${rat.length ? `<div class="bars" style="--cc:var(--brand-2)">${rat.map(r => `<div class="brow"><span class="lbl">${esc(r.label)}</span><span class="trk"><span class="fil" style="width:${r.avg / 5 * 100}%"></span></span><span class="val">${r.avg.toFixed(1)}</span></div>`).join("")}</div>` : `<p class="rep-empty">No ratings yet.</p>`}
      <p class="rep-foot">Confidential. Prepared for the leadership of ${esc(cfg.clientName || "")} by ${esc(cfg.consultantName || "")}. Staff answers are reported anonymously; off-the-record comments are never included.</p></section>`);
    return out.join("");
  }
  function fmtDate(d) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || "")); if (!m) return d || ""; return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }

  // ---------- editor ----------
  function input(name, label, type, val, idx) {
    const id = `fx-${name}-${idx ?? "x"}`, attr = `data-fx="${name}"${idx != null ? ` data-row="${idx}"` : ""}`;
    let ctl;
    if (Array.isArray(type)) ctl = `<select id="${id}" ${attr}><option value=""></option>${type.map(o => `<option ${String(o) === String(val) ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
    else if (type === "textarea") ctl = `<textarea id="${id}" ${attr} rows="3">${esc(val)}</textarea>`;
    else ctl = `<input type="text" id="${id}" ${attr} value="${esc(val)}">`;
    return `<div class="mini"><label for="${id}">${esc(label)}</label>${ctl}</div>`;
  }
  function editor(key, f) {
    const sec = byKey[key], data = f[key] || {}, rows = (data.items && data.items.length) ? data.items : (sec.list ? [{}] : []);
    return `<div class="fx-editor" data-editor="${key}"><header class="rep-h"><span class="rep-n">✎</span><div><h2>Edit: ${esc(sec.title)}</h2></div></header>
      ${sec.fields ? `<div class="fx-fields">${sec.fields.map(([k, l, t]) => input(k, l, t, data[k])).join("")}</div>` : ""}
      ${sec.list ? `<div class="fx-rows">${rows.map((r, n) => `<div class="item fx-row"><div class="item-head"><span class="tag">Item ${n + 1}</span><span class="toolbar">${n > 0 ? `<button class="btn ghost small" data-fxmove="${n}" title="Move up">↑ Up</button>` : ""}<button class="btn ghost small" data-fxdel="${n}">Remove</button></span></div><div class="fx-grid">${sec.list.map(([k, l, t]) => input(k, l, t, r[k], n)).join("")}</div></div>`).join("")}</div>
        <button class="btn small" data-fxadd="1" style="margin-top:12px">+ Add item</button>` : ""}
      <div class="nav"><button class="btn" data-fxcancel="1">Cancel</button><button class="btn primary" data-fxsave="${key}">Save section</button></div></div>`;
  }
  function collect(key, root, keepEmpty) {
    const sec = byKey[key], el = root.querySelector(`[data-editor="${key}"]`), out = {};
    (sec.fields || []).forEach(([k]) => { const i = el.querySelector(`[data-fx="${k}"]:not([data-row])`); out[k] = i ? i.value.trim() : ""; });
    if (sec.list) {
      const rows = [...el.querySelectorAll(".fx-row")].map((row, n) => { const o = {}; sec.list.forEach(([k]) => { const i = row.querySelector(`[data-fx="${k}"][data-row="${n}"]`); o[k] = i ? i.value.trim() : ""; }); return o; });
      out.items = keepEmpty ? rows : rows.filter(o => Object.values(o).some(v => v));
    }
    return out;
  }

  window.FX = { SECTIONS, stats, render, editor, collect, isTest };
})();
