// Drafts leadership findings from submitted interviews using the Claude API.
const AA = require("../public/questions.js");

function anonymized(r, i) {
  const a = r.answers || {}, lines = [`### Respondent ${i + 1}`];
  AA.SECTIONS.filter(s => s.fields).forEach(s => AA.flat(s).forEach(f => {
    if (f.id === "name" || f.id === "offRecord") return;
    const t = AA.fmt(f, a[f.id]);
    if (t) lines.push(`${f.label}: ${t}`);
  }));
  if (a.offRecord) lines.push(`[OFF THE RECORD — background only; never quote, paraphrase closely, or mention]: ${a.offRecord}`);
  return lines.join("\n");
}

function buildPrompt(settings, subs) {
  return `You are a senior technology consultant at ${settings.consultantName} running an "Assess & Advise" engagement for ${settings.clientName}, an architecture practice. Below are ${subs.length} self-guided interview responses from their staff about workflows, software (Revit, coordination, documentation, construction administration), frustrations and skills.

Analyse them as you would for a leadership readout:
- Find recurring themes and count how many respondents raised each. Weigh issues raised by several people, or with a time or cost attached, above single complaints.
- Draft practical recommendations (training, standards, templates, data management, integration, automation, process). Score each for impact (1–5; 5 = affects most people weekly or causes costly errors) and effort (1–5; 5 = new platform or months of change). Give a horizon: "Quick win" (0–3 months), "Project" (3–9 months) or "Strategic" (9–18 months).
- Suggest questions to probe in live follow-up interviews.
- Confidentiality: never name or identify individuals; never quote or reveal anything marked OFF THE RECORD. Paraphrase rather than quote.
- Be specific and plain-spoken.

Return ONLY a JSON object, no prose and no code fences, with this shape:
{"headline": "one sentence: the most important finding, with a number if the data supports one",
 "summary": "2-3 sentences",
 "themes": [{"name": "short name", "finding": "1-2 sentences", "heardFrom": "e.g. 4 of 7", "evidence": "short paraphrased evidence"}],
 "recommendations": [{"title": "action", "why": "one sentence tied to the evidence", "impact": 1, "effort": 1, "horizon": "Quick win"}],
 "probe": ["question"]}
Use 3-6 themes and 4-8 recommendations.

RESPONSES:
${subs.map(anonymized).join("\n\n")}`;
}

function parseJson(text) {
  const t = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  const start = t.indexOf("{"), end = t.lastIndexOf("}");
  return JSON.parse(t.slice(start, end + 1));
}

async function generate(store, settings) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw Object.assign(new Error("ANTHROPIC_API_KEY is not set"), { code: "no_key" });
  const subs = (await store.listResponses()).filter(r => r.status === "submitted");
  if (!subs.length) throw Object.assign(new Error("No submitted responses yet"), { code: "no_data" });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 4000,
      messages: [{ role: "user", content: buildPrompt(settings, subs) }]
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw Object.assign(new Error(`Claude API error ${res.status}: ${body.slice(0, 300)}`), { code: "api" });
  }
  const json = await res.json();
  const text = (json.content || []).filter(c => c.type === "text").map(c => c.text).join("");
  const data = parseJson(text);
  const out = { ...data, basedOn: subs.length };
  await store.saveInsights(out);
  return { ...out, generatedAt: new Date().toISOString() };
}

module.exports = { generate };
