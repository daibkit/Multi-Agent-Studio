// Vercel Serverless Function: gọi Claude (Anthropic) hoặc Gemini (Google) cho Multi-Agent Studio.
// Biến môi trường:
//   Xác thực: phiên đăng nhập (ADMIN_USER, ADMIN_PASSWORD, SESSION_SECRET) hoặc header x-studio-key = STUDIO_KEY
//   ANTHROPIC_API_KEY  (cho Claude)  CLAUDE_MODEL (mặc định claude-sonnet-5-5)
//   GEMINI_API_KEY     (cho Gemini)  GEMINI_MODEL (mặc định gemini-3.6-flash), GEMINI_SEARCH=off để tắt Google Search

const { authAvailable, isAuthed } = require("./_auth");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!authAvailable()) return res.status(503).json({ ok: false, error: "Cần cấu hình đăng nhập (ADMIN_USER, ADMIN_PASSWORD, SESSION_SECRET) hoặc STUDIO_KEY trước khi dùng agent thật." });
  if (!isAuthed(req)) return res.status(401).json({ ok: false, error: "Chưa đăng nhập hoặc sai Studio Key." });

  const claudeKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (req.method === "GET") return res.status(200).json({ claude: !!claudeKey, gemini: !!geminiKey });
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method not allowed" });

  const body = req.body || {};
  const agent = body.agent;
  const system = String(body.system || "").slice(0, 4000);
  const prompt = String(body.prompt || "").slice(0, 8000);
  if (!prompt) return res.status(400).json({ ok: false, error: "Thiếu prompt" });

  try {
    if (agent === "claude") {
      if (!claudeKey) return res.status(400).json({ ok: false, error: "Chưa đặt ANTHROPIC_API_KEY." });
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": claudeKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
          max_tokens: 2048,
          ...(system ? { system } : {}),
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const j = await r.json();
      if (!r.ok) return res.status(502).json({ ok: false, error: (j.error && j.error.message) || "Lỗi Anthropic API (" + r.status + ")" });
      const text = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("\n");
      return res.status(200).json({ ok: true, text });
    }

    if (agent === "gemini") {
      if (!geminiKey) return res.status(400).json({ ok: false, error: "Chưa đặt GEMINI_API_KEY." });
      const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": geminiKey, "content-type": "application/json" },
        body: JSON.stringify({
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          // Google Search grounding để có dữ liệu mới; đặt GEMINI_SEARCH=off để tắt
          ...(process.env.GEMINI_SEARCH === "off" ? {} : { tools: [{ google_search: {} }] }),
          generationConfig: { maxOutputTokens: 2048 },
        }),
      });
      const j = await r.json();
      if (!r.ok) return res.status(502).json({ ok: false, error: (j.error && j.error.message) || "Lỗi Gemini API (" + r.status + ")" });
      const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
      let text = parts.map(p => p.text || "").join("");
      if (!text) return res.status(502).json({ ok: false, error: "Gemini không trả về nội dung." });
      const chunks = (j.candidates[0].groundingMetadata && j.candidates[0].groundingMetadata.groundingChunks) || [];
      const sources = [...new Set(chunks.map(c => c.web && (c.web.title || c.web.uri)).filter(Boolean))].slice(0, 5);
      if (sources.length) text += "\n\nNguồn: " + sources.join("; ");
      return res.status(200).json({ ok: true, text });
    }

    return res.status(400).json({ ok: false, error: "agent phải là 'claude' hoặc 'gemini'." });
  } catch (e) {
    return res.status(502).json({ ok: false, error: String((e && e.message) || e) });
  }
};
