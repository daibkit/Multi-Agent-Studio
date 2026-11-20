// Đăng nhập một tài khoản quản trị. Biến môi trường: ADMIN_USER, ADMIN_PASSWORD, SESSION_SECRET.
const { COOKIE, MAX_AGE, eq, loginConfigured, makeToken, readSession } = require("./_auth");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const configured = loginConfigured();

  if (req.method === "GET") {
    const s = readSession(req);
    return res.status(200).json({ configured, authed: !!s, user: s ? s.u : "" });
  }
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method not allowed" });
  if (!configured) return res.status(503).json({ ok: false, error: "Chưa cấu hình đăng nhập (ADMIN_USER, ADMIN_PASSWORD, SESSION_SECRET)." });

  const body = req.body || {};
  if (body.logout) {
    res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
    return res.status(200).json({ ok: true });
  }

  const okUser = eq(body.username || "", process.env.ADMIN_USER);
  const okPass = eq(body.password || "", process.env.ADMIN_PASSWORD);
  if (!(okUser && okPass)) {
    await new Promise(r => setTimeout(r, 800)); // làm chậm dò mật khẩu
    return res.status(401).json({ ok: false, error: "Sai tên đăng nhập hoặc mật khẩu." });
  }
  res.setHeader("Set-Cookie", `${COOKIE}=${makeToken(process.env.ADMIN_USER)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`);
  return res.status(200).json({ ok: true, user: process.env.ADMIN_USER });
};
