const express = require("express");
const db = require("./db");
const { hashAuthKey, newSalt, timingSafeEqualHex, issueSessionToken, requireSession } = require("./auth");

const PORT = process.env.PORT || 3000;
const ALLOWED_COLLECTIONS = new Set(["bookmarks", "snippets", "settings", "extensions"]);

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/healthz", (req, res) => res.json({ ok: true }));

// Registration only ever receives accountId (derived from the passphrase,
// not a human-chosen identifier) and authKey (derived, not the passphrase
// itself). See extension/sync/crypto.js for the client-side derivation.
app.post("/v1/register", (req, res) => {
  const { accountId, authKey } = req.body || {};
  if (typeof accountId !== "string" || typeof authKey !== "string" || !accountId || !authKey) {
    return res.status(400).json({ error: "accountId and authKey are required" });
  }

  const existing = db.prepare("SELECT 1 FROM accounts WHERE account_id = ?").get(accountId);
  if (existing) return res.status(409).json({ error: "account already exists" });

  const salt = newSalt();
  const hash = hashAuthKey(authKey, salt);
  db.prepare(
    "INSERT INTO accounts (account_id, auth_hash, auth_salt, created_at) VALUES (?, ?, ?, ?)"
  ).run(accountId, hash, salt, Date.now());

  res.status(201).json({ token: issueSessionToken(accountId) });
});

app.post("/v1/login", (req, res) => {
  const { accountId, authKey } = req.body || {};
  if (typeof accountId !== "string" || typeof authKey !== "string") {
    return res.status(400).json({ error: "accountId and authKey are required" });
  }

  const account = db.prepare("SELECT * FROM accounts WHERE account_id = ?").get(accountId);
  if (!account) return res.status(401).json({ error: "invalid credentials" });

  const candidateHash = hashAuthKey(authKey, account.auth_salt);
  if (!timingSafeEqualHex(candidateHash, account.auth_hash)) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  res.json({ token: issueSessionToken(accountId) });
});

app.delete("/v1/account", requireSession, (req, res) => {
  db.prepare("DELETE FROM accounts WHERE account_id = ?").run(req.accountId);
  res.status(204).end();
});

app.get("/v1/collections/:name", requireSession, (req, res) => {
  const { name } = req.params;
  if (!ALLOWED_COLLECTIONS.has(name)) return res.status(400).json({ error: "unknown collection" });

  const row = db
    .prepare("SELECT blob, version FROM collections WHERE account_id = ? AND name = ?")
    .get(req.accountId, name);
  if (!row) return res.status(404).json({ error: "not found" });

  res.json({ blob: row.blob, version: row.version });
});

// Optimistic concurrency: the client must supply the version it last saw
// (0 for "never synced before"). A mismatch means another device wrote
// in between, so the client re-fetches and re-merges instead of clobbering.
app.put("/v1/collections/:name", requireSession, (req, res) => {
  const { name } = req.params;
  if (!ALLOWED_COLLECTIONS.has(name)) return res.status(400).json({ error: "unknown collection" });

  const { blob, baseVersion } = req.body || {};
  if (typeof blob !== "string" || typeof baseVersion !== "number") {
    return res.status(400).json({ error: "blob and baseVersion are required" });
  }

  const current = db
    .prepare("SELECT version FROM collections WHERE account_id = ? AND name = ?")
    .get(req.accountId, name);

  const currentVersion = current ? current.version : 0;
  if (currentVersion !== baseVersion) {
    return res.status(409).json({ error: "version conflict", version: currentVersion });
  }

  const nextVersion = currentVersion + 1;
  db.prepare(
    `INSERT INTO collections (account_id, name, blob, version, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_id, name) DO UPDATE SET blob = excluded.blob, version = excluded.version, updated_at = excluded.updated_at`
  ).run(req.accountId, name, blob, nextVersion, Date.now());

  res.json({ version: nextVersion });
});

app.listen(PORT, () => console.log(`lightmorphic-sync-api listening on :${PORT}`));
