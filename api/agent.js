// Vercel Serverless Function: gọi Claude (Anthropic) hoặc Gemini (Google) cho Multi-Agent Studio.
// Biến môi trường:
//   STUDIO_KEY         (bắt buộc)  mọi request phải có header x-studio-key, tránh bị người lạ đốt tiền API
//   ANTHROPIC_API_KEY  (cho Claude)  CLAUDE_MODEL (mặc định claude-sonnet-5-5)
//   GEMINI_API_KEY     (cho Gemini)  GEMINI_MODEL (mặc định gemini-3.6-flash)

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const studioKey = process.env.STUDIO_KEY;
  if (!studioKey) return res.status(503).json({ ok: false, error: "Cần đặt STUDIO_KEY trên Vercel trước khi dùng agent thật." });
  if (req.headers["x-studio-key"] !== studioKey) return res.status(401).json({ ok: false, error: "Sai hoặc thiếu Studio Key." });

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
          max_tokens: 1024,
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
          generationConfig: { maxOutputTokens: 1024 },
        }),
      });
      const j = await r.json();
      if (!r.ok) return res.status(502).json({ ok: false, error: (j.error && j.error.message) || "Lỗi Gemini API (" + r.status + ")" });
      const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
      const text = parts.map(p => p.text || "").join("");
      if (!text) return res.status(502).json({ ok: false, error: "Gemini không trả về nội dung." });
      return res.status(200).json({ ok: true, text });
    }

    return res.status(400).json({ ok: false, error: "agent phải là 'claude' hoặc 'gemini'." });
  } catch (e) {
    return res.status(502).json({ ok: false, error: String((e && e.message) || e) });
  }
};
