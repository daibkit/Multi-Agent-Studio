// Webhook Telegram: Telegram gọi thẳng vào đây, function chạy Gemini → Claude rồi trả lời.
// Biến môi trường:
//   TELEGRAM_BOT_TOKEN       token từ @BotFather
//   TELEGRAM_WEBHOOK_SECRET  chuỗi bí mật (A-Z a-z 0-9 _ -) trùng với secret_token khi setWebhook;
//                            nếu không đặt thì dùng STUDIO_KEY (cũng phải chỉ gồm A-Z a-z 0-9 _ -)
//   TELEGRAM_CHAT_ID         chỉ chat này được dùng bot (nhắn /start để bot báo ID của bạn)
//   GEMINI_API_KEY, ANTHROPIC_API_KEY (tùy chọn), CLAUDE_MODEL, GEMINI_MODEL, GEMINI_SEARCH=off
const crypto = require("crypto");
const { runPipeline, toPlain } = require("./_agents");

const eq = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const tg = async (token, method, payload) => {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    });
    return await r.json();
  } catch (e) { return { ok: false, description: String(e.message || e) }; }
};

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || process.env.STUDIO_KEY;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // Trạng thái cấu hình cho trang Studio (chỉ trả về true/false, không lộ giá trị)
  if (req.method === "GET") {
    const out = {
      token: !!token, secret: !!secret, chatId: !!chatId,
      gemini: !!process.env.GEMINI_API_KEY, claude: !!process.env.ANTHROPIC_API_KEY,
    };
    if (token) {
      const info = await tg(token, "getWebhookInfo", {});
      if (info.ok) {
        out.webhookUrl = info.result.url || "";
        out.pending = info.result.pending_update_count || 0;
        out.lastError = info.result.last_error_message || "";
      }
    }
    return res.status(200).json(out);
  }
  if (req.method !== "POST") return res.status(405).end();
  if (!token || !secret) return res.status(503).json({ error: "chưa cấu hình" });
  if (!eq(req.headers["x-telegram-bot-api-secret-token"] || "", secret)) return res.status(401).end();

  try {
    const msg = req.body && req.body.message;
    if (!msg || !msg.text || !msg.chat) return res.status(200).json({ ok: true });
    const from = msg.chat.id;

    if (!chatId) {
      await tg(token, "sendMessage", { chat_id: from, text: `Chat ID của bạn là ${from}.\nHãy đặt TELEGRAM_CHAT_ID = ${from} trên Vercel rồi redeploy.` });
      return res.status(200).json({ ok: true });
    }
    if (String(from) !== String(chatId)) return res.status(200).json({ ok: true }); // bỏ qua người lạ

    const text = msg.text.slice(0, 1000);
    if (text.startsWith("/start")) {
      await tg(token, "sendMessage", { chat_id: from, text: "Xin chào! Hãy gửi câu hỏi, mình sẽ nhờ Gemini tra cứu rồi trả lời bạn." });
      return res.status(200).json({ ok: true });
    }

    await tg(token, "sendChatAction", { chat_id: from, action: "typing" });
    let reply;
    try { reply = await runPipeline(text); }
    catch (e) { reply = "⚠ Không xử lý được yêu cầu: " + String((e && e.message) || e); }
    await tg(token, "sendMessage", { chat_id: from, text: toPlain(reply) });
  } catch (e) { /* luôn trả 200 để Telegram không gửi lại liên tục */ }
  return res.status(200).json({ ok: true });
};
