// Storage: PostgreSQL when DATABASE_URL is set (Railway), otherwise a local JSON file for development.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const hashToken = t => crypto.createHash("sha256").update(String(t)).digest("hex");

function pgStore(url) {
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1|\.railway\.internal/.test(url) ? false : { rejectUnauthorized: false }
  });
  return {
    kind: "postgres",
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS responses (
          id UUID PRIMARY KEY,
          token_hash TEXT UNIQUE NOT NULL,
          answers JSONB NOT NULL DEFAULT '{}'::jsonb,
          status TEXT NOT NULL DEFAULT 'draft',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          submitted_at TIMESTAMPTZ
        );
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB NOT NULL);
        CREATE TABLE IF NOT EXISTS insights (id SERIAL PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
      `);
    },
    async createResponse(token) {
      const id = crypto.randomUUID();
      await pool.query("INSERT INTO responses (id, token_hash) VALUES ($1, $2)", [id, hashToken(token)]);
      return id;
    },
    async getByToken(token) {
      const r = await pool.query("SELECT * FROM responses WHERE token_hash = $1", [hashToken(token)]);
      return r.rows[0] ? row(r.rows[0]) : null;
    },
    async updateByToken(token, answers, status) {
      const r = await pool.query(
        `UPDATE responses SET answers = $2, status = $3, updated_at = now(),
           submitted_at = CASE WHEN $3 = 'submitted' THEN COALESCE(submitted_at, now()) ELSE submitted_at END
         WHERE token_hash = $1 RETURNING *`, [hashToken(token), answers, status]);
      return r.rows[0] ? row(r.rows[0]) : null;
    },
    async listResponses() {
      const r = await pool.query("SELECT * FROM responses ORDER BY updated_at DESC");
      return r.rows.map(row);
    },
    async deleteResponse(id) { await pool.query("DELETE FROM responses WHERE id = $1", [id]); },
    async getSettings() {
      const r = await pool.query("SELECT key, value FROM settings");
      return Object.fromEntries(r.rows.map(x => [x.key, x.value]));
    },
    async setSetting(key, value) {
      await pool.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [key, JSON.stringify(value)]);
    },
    async latestInsights() {
      const r = await pool.query("SELECT data, created_at FROM insights ORDER BY id DESC LIMIT 1");
      return r.rows[0] ? { ...r.rows[0].data, generatedAt: r.rows[0].created_at } : null;
    },
    async saveInsights(data) { await pool.query("INSERT INTO insights (data) VALUES ($1)", [data]); }
  };
  function row(x) {
    return { id: x.id, answers: x.answers || {}, status: x.status, createdAt: x.created_at, updatedAt: x.updated_at, submittedAt: x.submitted_at };
  }
}

function fileStore(file) {
  let data = { responses: [], settings: {}, insights: [] };
  const save = () => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + ".tmp", JSON.stringify(data, null, 2)); fs.renameSync(file + ".tmp", file); };
  const pub = r => ({ id: r.id, answers: r.answers, status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt, submittedAt: r.submittedAt });
  return {
    kind: "file",
    async init() { try { data = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { save(); } },
    async createResponse(token) {
      const now = new Date().toISOString(), id = crypto.randomUUID();
      data.responses.push({ id, tokenHash: hashToken(token), answers: {}, status: "draft", createdAt: now, updatedAt: now, submittedAt: null });
      save(); return id;
    },
    async getByToken(token) { const r = data.responses.find(x => x.tokenHash === hashToken(token)); return r ? pub(r) : null; },
    async updateByToken(token, answers, status) {
      const r = data.responses.find(x => x.tokenHash === hashToken(token)); if (!r) return null;
      r.answers = answers; r.status = status; r.updatedAt = new Date().toISOString();
      if (status === "submitted" && !r.submittedAt) r.submittedAt = r.updatedAt;
      save(); return pub(r);
    },
    async listResponses() { return data.responses.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(pub); },
    async deleteResponse(id) { data.responses = data.responses.filter(x => x.id !== id); save(); },
    async getSettings() { return { ...data.settings }; },
    async setSetting(key, value) { data.settings[key] = value; save(); },
    async latestInsights() { const i = data.insights[data.insights.length - 1]; return i || null; },
    async saveInsights(d) { data.insights.push({ ...d, generatedAt: new Date().toISOString() }); data.insights = data.insights.slice(-20); save(); }
  };
}

module.exports = function createStore() {
  if (process.env.DATABASE_URL) return pgStore(process.env.DATABASE_URL);
  return fileStore(process.env.DATA_FILE || path.join(__dirname, "..", "data", "local.json"));
};
