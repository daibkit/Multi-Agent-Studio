// Vercel Serverless Function: cầu nối giữa trang Multi-Agent Studio và Telegram Bot API.
// Biến môi trường (đặt trong Vercel → Settings → Environment Variables):
//   TELEGRAM_BOT_TOKEN  (bắt buộc)  token từ @BotFather
//   TELEGRAM_CHAT_ID    (bắt buộc sau bước thiết lập)  chỉ chat này được đọc/gửi
//   STUDIO_KEY          (khuyên dùng)  nếu đặt, mọi request phải kèm header x-studio-key

const API = token => `https://api.telegram.org/bot${token}`;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(200).json({ configured: false });

  const studioKey = process.env.STUDIO_KEY;
  if (studioKey && req.headers["x-studio-key"] !== studioKey) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const chatId = process.env.TELEGRAM_CHAT_ID;

  try {
    if (req.method === "POST") {
      if (!chatId) return res.status(400).json({ error: "TELEGRAM_CHAT_ID chưa được đặt" });
      const text = String((req.body && req.body.text) || "").slice(0, 1000);
      if (!text) return res.status(400).json({ error: "Thiếu text" });
      const r = await fetch(`${API(token)}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      const j = await r.json();
      return res.status(j.ok ? 200 : 502).json({ ok: !!j.ok, error: j.description });
    }

    if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });

    const qs = new URLSearchParams({ timeout: "0", allowed_updates: JSON.stringify(["message"]) });
    const offset = Number(req.query && req.query.offset);
    if (Number.isFinite(offset) && offset > 0) qs.set("offset", String(offset));

    const r = await fetch(`${API(token)}/getUpdates?${qs}`);
    const j = await r.json();
    if (!j.ok) return res.status(502).json({ error: j.description || "Telegram error" });
    const all = j.result || [];

    if (!chatId) {
      // Bước thiết lập: liệt kê chat để người dùng lấy ID, không xác nhận (consume) update.
      const seen = {};
      all.forEach(u => {
        const c = u.message && u.message.chat;
        if (c) seen[c.id] = c.title || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.username || "";
      });
      return res.status(200).json({
        configured: true,
        needsChatId: true,
        chats: Object.entries(seen).map(([id, name]) => ({ id, name })),
      });
    }

    const next = all.length ? all[all.length - 1].update_id + 1 : null;
    const updates = all
      .filter(u => u.message && u.message.text && String(u.message.chat.id) === String(chatId))
      .map(u => ({
        id: u.update_id,
        text: u.message.text.slice(0, 500),
        from: (u.message.from && (u.message.from.first_name || u.message.from.username)) || "",
      }));
    return res.status(200).json({ configured: true, updates, next });
  } catch (e) {
    return res.status(502).json({ error: String((e && e.message) || e) });
  }
};
