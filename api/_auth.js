// Xác thực dùng chung: phiên đăng nhập (cookie ký HMAC) hoặc STUDIO_KEY (header x-studio-key).
// Tệp bắt đầu bằng "_" không phải là endpoint trên Vercel.
const crypto = require("crypto");

const COOKIE = "studio_session";
const MAX_AGE = 30 * 24 * 3600; // 30 ngày

const eq = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const sign = payload => crypto.createHmac("sha256", process.env.SESSION_SECRET).update(payload).digest("base64url");

const loginConfigured = () => !!(process.env.ADMIN_USER && process.env.ADMIN_PASSWORD && process.env.SESSION_SECRET);
const authAvailable = () => loginConfigured() || !!process.env.STUDIO_KEY;

function makeToken(user) {
  const payload = Buffer.from(JSON.stringify({ u: user, e: Math.floor(Date.now() / 1000) + MAX_AGE })).toString("base64url");
  return payload + "." + sign(payload);
}

function readSession(req) {
  if (!loginConfigured()) return null;
  const part = (req.headers.cookie || "").split(/;\s*/).find(c => c.startsWith(COOKIE + "="));
  if (!part) return null;
  const [payload, s] = part.slice(COOKIE.length + 1).split(".");
  if (!payload || !s || !eq(s, sign(payload))) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString());
    return d.e > Date.now() / 1000 ? d : null;
  } catch (e) { return null; }
}

function isAuthed(req) {
  if (readSession(req)) return true;
  const k = process.env.STUDIO_KEY;
  return !!(k && eq(req.headers["x-studio-key"] || "", k));
}

module.exports = { COOKIE, MAX_AGE, eq, loginConfigured, authAvailable, makeToken, readSession, isAuthed };
