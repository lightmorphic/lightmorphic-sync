// Server-side auth. Note what this is NOT: it never sees the user's
// passphrase or their data-encryption key (see extension/sync/crypto.js
// in the lightmorphic-browser repo). `authKey` is a value independently
// derived from the passphrase that is useless for decrypting synced
// data even if this database leaks in full.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || "/data";
const SECRET_PATH = path.join(DATA_DIR, "session_secret");

function loadOrCreateSessionSecret() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(SECRET_PATH)) {
    return fs.readFileSync(SECRET_PATH, "utf8").trim();
  }
  const secret = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(SECRET_PATH, secret, { mode: 0o600 });
  return secret;
}

const SESSION_SECRET = loadOrCreateSessionSecret();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function hashAuthKey(authKey, salt) {
  return crypto.scryptSync(authKey, salt, 64).toString("hex");
}

function newSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function timingSafeEqualHex(a, b) {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function issueSessionToken(accountId) {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${accountId}.${expires}`;
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

function verifySessionToken(token) {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [accountId, expiresStr, sig] = decoded.split(".");
    const expected = crypto
      .createHmac("sha256", SESSION_SECRET)
      .update(`${accountId}.${expiresStr}`)
      .digest("hex");
    if (!timingSafeEqualHex(sig, expected)) return null;
    if (Date.now() > Number(expiresStr)) return null;
    return { accountId };
  } catch {
    return null;
  }
}

function requireSession(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const session = token && verifySessionToken(token);
  if (!session) return res.status(401).json({ error: "unauthenticated" });
  req.accountId = session.accountId;
  next();
}

module.exports = {
  hashAuthKey,
  newSalt,
  timingSafeEqualHex,
  issueSessionToken,
  verifySessionToken,
  requireSession,
};
