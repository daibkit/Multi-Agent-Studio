// Gọi Gemini / Claude và pipeline Telegram → Gemini (nghiên cứu) → Claude (trả lời).
const GEMINI_SYSTEM = process.env.GEMINI_SYSTEM_PROMPT ||
  "Bạn là chuyên gia nghiên cứu. Tìm và tổng hợp thông tin mới nhất, xử lý ngữ cảnh dài, trả về bản tóm tắt có nguồn dẫn và ngày của dữ liệu. Không bịa số liệu.";
const CLAUDE_SYSTEM = process.env.CLAUDE_SYSTEM_PROMPT ||
  "Bạn là trợ lý trả lời người dùng qua Telegram. Dựa trên ghi chú nghiên cứu, trả lời chính xác, cụ thể, giữ lại số liệu và nguồn. Nếu thiếu dữ liệu thì nói rõ.";

async function post(url, headers, body, ms = 25000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: ctl.signal });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, j };
  } finally { clearTimeout(timer); }
}

async function callClaude(system, prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Chưa đặt ANTHROPIC_API_KEY");
  const { ok, status, j } = await post("https://api.anthropic.com/v1/messages",
    { "x-api-key": key, "anthropic-version": "2023-06-01" },
    { model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5", max_tokens: 2048, system, messages: [{ role: "user", content: prompt }] });
  if (!ok) throw new Error((j.error && j.error.message) || "Anthropic API " + status);
  return (j.content || []).filter(c => c.type === "text").map(c => c.text).join("\n");
}

async function callGemini(system, prompt, search) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Chưa đặt GEMINI_API_KEY");
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const useSearch = search && process.env.GEMINI_SEARCH !== "off";
  const { ok, status, j } = await post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { "x-goog-api-key": key },
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      ...(useSearch ? { tools: [{ google_search: {} }] } : {}),
      generationConfig: { maxOutputTokens: 2048 },
    });
  if (!ok) throw new Error((j.error && j.error.message) || "Gemini API " + status);
  const cand = j.candidates && j.candidates[0];
  let text = ((cand && cand.content && cand.content.parts) || []).map(p => p.text || "").join("");
  if (!text) throw new Error("Gemini không trả về nội dung");
  const chunks = (cand.groundingMetadata && cand.groundingMetadata.groundingChunks) || [];
  const sources = [...new Set(chunks.map(c => c.web && (c.web.title || c.web.uri)).filter(Boolean))].slice(0, 5);
  if (sources.length) text += "\n\nNguồn: " + sources.join("; ");
  return text;
}

// Trả về văn bản gửi người dùng.
async function runPipeline(userText) {
  const today = new Date().toLocaleDateString("vi-VN", { dateStyle: "full", timeZone: "Asia/Ho_Chi_Minh" });
  const notes = await callGemini(GEMINI_SYSTEM,
    `Hôm nay là ${today}. Yêu cầu của người dùng: ${userText}\n\nHãy dùng Google Search để lấy dữ liệu mới nhất và cụ thể (số liệu, thứ hạng, kết quả gần đây, thành tích, mốc thời gian), kèm nguồn và ngày của dữ liệu. Không bịa số liệu; nếu không tìm thấy thì nói rõ. Trả lời dạng gạch đầu dòng.`, true);
  const finalPrompt = `Yêu cầu của người dùng: ${userText}\n\nGhi chú nghiên cứu từ Gemini:\n${notes}\n\nHãy trả lời người dùng bằng tiếng Việt. Giữ lại các số liệu cụ thể và nguồn từ ghi chú, nếu thiếu số liệu thì nói rõ là thiếu. Viết văn bản thuần, không dùng Markdown (không **, không #), có thể dùng emoji và dấu • cho danh sách, tối đa khoảng 1500 ký tự.`;
  try {
    return await callClaude(CLAUDE_SYSTEM, finalPrompt);
  } catch (e) {
    // Chưa có key Claude hoặc Claude lỗi: để Gemini soạn câu trả lời cuối
    return await callGemini(GEMINI_SYSTEM, finalPrompt, false);
  }
}

// Telegram không render Markdown thô
function toPlain(t) {
  return String(t)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[*-]\s+/gm, "• ")
    .replace(/`/g, "")
    .slice(0, 3900);
}

module.exports = { runPipeline, toPlain };
