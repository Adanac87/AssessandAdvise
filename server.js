// Assess & Advise web app: public interview form + password-protected dashboard.
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const createStore = require("./lib/store");
const insights = require("./lib/insights");
const AA = require("./public/questions.js");

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const PROD = process.env.NODE_ENV === "production" || !!process.env.RAILWAY_ENVIRONMENT;
if (!ADMIN_PASSWORD) console.warn("WARNING: ADMIN_PASSWORD is not set. The dashboard is locked until you set it.");

const DEFAULTS = {
  clientName: process.env.CLIENT_NAME || "Acton Ostry Architects",
  consultantName: process.env.CONSULTANT_NAME || "Rand Worldwide",
  contactEmail: process.env.CONTACT_EMAIL || "",
  dueDate: "",
  model: "confidential",
  brandColor: process.env.BRAND_COLOR || "#14384f",
  accentColor: process.env.ACCENT_COLOR || "#c8692f",
  hasLogo: false
};

const store = createStore();
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "3mb" }));

// Security headers
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
  });
  next();
});

// ---------- helpers ----------
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const k = req.ip + req.path.split("/").slice(0, 3).join("/"), now = Date.now();
    const arr = (hits.get(k) || []).filter(t => now - t < windowMs);
    if (arr.length >= max) return res.status(429).json({ error: "Too many requests. Please wait a minute and try again." });
    arr.push(now); hits.set(k, arr); next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < 3600e3)) hits.delete(k); }, 600e3).unref();

const FIELD_IDS = new Set(AA.allFields().map(f => f.id));
function cleanAnswers(input) {
  const out = {};
  if (!input || typeof input !== "object") return out;
  for (const [k, v] of Object.entries(input)) {
    if (!FIELD_IDS.has(k)) continue;
    if (typeof v === "string") out[k] = v.slice(0, 8000);
    else if (Array.isArray(v)) out[k] = v.slice(0, 40).map(x => typeof x === "string" ? x.slice(0, 300) : (x && typeof x === "object" ? Object.fromEntries(Object.entries(x).slice(0, 8).map(([a, b]) => [String(a).slice(0, 40), String(b ?? "").slice(0, 1000)])) : "")).filter(x => x !== "");
    else if (v && typeof v === "object") out[k] = Object.fromEntries(Object.entries(v).slice(0, 10).map(([a, b]) => [String(a).slice(0, 40), String(b ?? "").slice(0, 20)]));
    else if (typeof v === "number") out[k] = v;
  }
  return out;
}
async function publicSettings() {
  const s = { ...DEFAULTS, ...((await store.getSettings()).engagement || {}) };
  const logo = (await store.getSettings()).logo;
  return { ...s, hasLogo: !!(logo && logo.data) };
}

// Admin session: HMAC-signed cookie
function sign(v) { return crypto.createHmac("sha256", SESSION_SECRET).update(v).digest("hex"); }
function makeSession() { const exp = Date.now() + 12 * 3600e3; const v = `admin.${exp}`; return `${v}.${sign(v)}`; }
function readCookie(req, name) { const m = (req.headers.cookie || "").split(/;\s*/).find(c => c.startsWith(name + "=")); return m ? decodeURIComponent(m.slice(name.length + 1)) : ""; }
function isAdmin(req) {
  const c = readCookie(req, "aa_admin"); const parts = c.split(".");
  if (parts.length !== 3) return false;
  const v = `${parts[0]}.${parts[1]}`, sig = parts[2];
  const good = sign(v);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  return Number(parts[1]) > Date.now();
}
const requireAdmin = (req, res, next) => isAdmin(req) ? next() : res.status(401).json({ error: "Please sign in." });
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- public API ----------
app.get("/api/config", wrap(async (req, res) => res.json(await publicSettings())));

app.get("/api/logo", wrap(async (req, res) => {
  const logo = (await store.getSettings()).logo;
  if (!logo || !logo.data) return res.status(404).end();
  res.set({ "Content-Type": logo.type, "Cache-Control": "public, max-age=300", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" });
  res.send(Buffer.from(logo.data, "base64"));
}));

app.post("/api/responses", rateLimit(20, 3600e3), wrap(async (req, res) => {
  const token = crypto.randomBytes(24).toString("base64url");
  await store.createResponse(token);
  const r = await store.updateByToken(token, cleanAnswers(req.body && req.body.answers), "draft");
  res.status(201).json({ token, status: r.status });
}));

app.get("/api/responses/:token", rateLimit(120, 600e3), wrap(async (req, res) => {
  const r = await store.getByToken(req.params.token);
  if (!r) return res.status(404).json({ error: "We couldn't find those answers." });
  res.json({ answers: r.answers, status: r.status, submittedAt: r.submittedAt });
}));

let insightTimer = null;
function scheduleInsights() {
  if (!process.env.ANTHROPIC_API_KEY) return;
  clearTimeout(insightTimer);
  insightTimer = setTimeout(async () => {
    try { await insights.generate(store, await publicSettings()); console.log("Findings refreshed"); }
    catch (e) { console.error("Findings failed:", e.message); }
  }, 90e3);
}

app.put("/api/responses/:token", rateLimit(600, 600e3), wrap(async (req, res) => {
  const status = req.body && req.body.status === "submitted" ? "submitted" : "draft";
  const answers = cleanAnswers(req.body && req.body.answers);
  if (status === "submitted") {
    const missing = AA.allFields().filter(f => f.required && !AA.fmt(f, answers[f.id]));
    if (missing.length) return res.status(400).json({ error: "Please answer: " + missing.map(f => f.label).join("; ") });
  }
  const r = await store.updateByToken(req.params.token, answers, status);
  if (!r) return res.status(404).json({ error: "We couldn't find those answers." });
  if (status === "submitted") scheduleInsights();
  res.json({ status: r.status, submittedAt: r.submittedAt, updatedAt: r.updatedAt });
}));

// ---------- admin API ----------
app.post("/api/admin/login", rateLimit(10, 600e3), (req, res) => {
  const pw = String((req.body && req.body.password) || "");
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: "Set ADMIN_PASSWORD on the server first." });
  const a = crypto.createHash("sha256").update(pw).digest(), b = crypto.createHash("sha256").update(ADMIN_PASSWORD).digest();
  if (!crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: "That password isn't right." });
  res.set("Set-Cookie", `aa_admin=${encodeURIComponent(makeSession())}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${PROD ? "; Secure" : ""}`);
  res.json({ ok: true });
});
app.post("/api/admin/logout", (req, res) => { res.set("Set-Cookie", "aa_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"); res.json({ ok: true }); });
app.get("/api/admin/me", (req, res) => res.json({ admin: isAdmin(req), aiEnabled: !!process.env.ANTHROPIC_API_KEY, storage: store.kind }));

app.get("/api/admin/responses", requireAdmin, wrap(async (req, res) => res.json(await store.listResponses())));
app.delete("/api/admin/responses/:id", requireAdmin, wrap(async (req, res) => { await store.deleteResponse(req.params.id); res.json({ ok: true }); }));

app.put("/api/admin/settings", requireAdmin, wrap(async (req, res) => {
  const b = req.body || {}, hex = v => /^#[0-9a-f]{6}$/i.test(v || "") ? v : "";
  const next = {
    clientName: String(b.clientName || DEFAULTS.clientName).slice(0, 120),
    consultantName: String(b.consultantName || DEFAULTS.consultantName).slice(0, 120),
    contactEmail: String(b.contactEmail || "").slice(0, 200),
    dueDate: String(b.dueDate || "").slice(0, 80),
    model: ["confidential", "role", "named"].includes(b.model) ? b.model : "confidential",
    brandColor: hex(b.brandColor) || DEFAULTS.brandColor,
    accentColor: hex(b.accentColor) || DEFAULTS.accentColor
  };
  await store.setSetting("engagement", next);
  res.json(await publicSettings());
}));

app.put("/api/admin/logo", requireAdmin, wrap(async (req, res) => {
  const m = /^data:(image\/(png|jpeg|webp|svg\+xml));base64,([A-Za-z0-9+/=]+)$/.exec(String((req.body && req.body.dataUrl) || ""));
  if (!m) return res.status(400).json({ error: "Upload a PNG, JPEG, WebP or SVG image." });
  if (m[3].length > 2.2e6) return res.status(400).json({ error: "Keep the logo under about 1.5 MB." });
  await store.setSetting("logo", { type: m[1], data: m[3] });
  res.json({ ok: true });
}));
app.delete("/api/admin/logo", requireAdmin, wrap(async (req, res) => { await store.setSetting("logo", {}); res.json({ ok: true }); }));

app.get("/api/admin/insights", requireAdmin, wrap(async (req, res) => res.json((await store.latestInsights()) || null)));
let aiRunning = false;
app.post("/api/admin/insights", requireAdmin, wrap(async (req, res) => {
  if (aiRunning) return res.status(409).json({ error: "Findings are already being drafted." });
  aiRunning = true;
  try { res.json(await insights.generate(store, await publicSettings())); }
  catch (e) { res.status(e.code === "no_key" ? 503 : e.code === "no_data" ? 400 : 502).json({ error: e.message }); }
  finally { aiRunning = false; }
}));

// ---------- pages ----------
app.get("/healthz", (req, res) => res.json({ ok: true }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"], maxAge: PROD ? "10m" : 0 }));
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: "Something went wrong on our side. Please try again." }); });

store.init().then(() => {
  app.listen(PORT, () => console.log(`Assess & Advise running on :${PORT} (storage: ${store.kind})`));
}).catch(e => { console.error("Storage failed to start:", e); process.exit(1); });
