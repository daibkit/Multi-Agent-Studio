# Multi-Agent Studio

Ứng dụng web tương tác để mô hình hóa và mô phỏng hệ thống Multi-Agent AI (Claude + Gemini + Shared Memory).

- `index.html`: ứng dụng single-file (kéo thả node, Inspector, 4 kịch bản mô phỏng, Export JSON / Mermaid).
- `api/telegram.js`: Vercel Serverless Function nối với bot Telegram thật (tùy chọn).

## Kết nối bot Telegram thật

1. Tạo bot qua [@BotFather](https://t.me/BotFather), lấy token.
2. Vercel → Settings → Environment Variables:
   - `TELEGRAM_BOT_TOKEN`: token của bot.
   - `STUDIO_KEY`: một chuỗi bí mật tự đặt (khuyên dùng, để người lạ không dùng được API).
3. Redeploy, mở trang, bấm **Telegram thật** → nhập Studio Key → **Bật kết nối**.
4. Nhắn một tin cho bot. Modal sẽ hiện Chat ID của bạn.
5. Đặt `TELEGRAM_CHAT_ID` bằng ID đó trên Vercel, redeploy, rồi bật kết nối lại.

Từ đó mỗi tin nhắn mới gửi cho bot sẽ chạy Kịch bản 4 trên sơ đồ và bot trả lời một tin xác nhận. Orchestrator/Claude vẫn là mô phỏng, chưa gọi model thật.

## Kết nối agent Claude và Gemini thật

Thêm các biến môi trường trên Vercel rồi redeploy:

- `STUDIO_KEY` (bắt buộc cho `/api/agent`): cùng giá trị bạn nhập trong nút **Telegram thật**.
- `ANTHROPIC_API_KEY`: key của Claude. Tùy chọn `CLAUDE_MODEL` (mặc định `claude-sonnet-5-5`).
- `GEMINI_API_KEY`: key của Gemini. Tùy chọn `GEMINI_MODEL` (mặc định `gemini-3.6-flash`).

Khi có tin nhắn Telegram, luồng chạy: Telegram → Orchestrator → **Gemini** (nghiên cứu) → **Claude** (soạn trả lời) → Telegram.
System Prompt của mỗi agent lấy từ ô System Prompt trong Inspector (sửa trên trang có hiệu lực ngay, nhưng mất khi tải lại).
Có thể thử không cần Telegram: **Telegram thật** → "Thử nhanh agent thật".
Mỗi lần chạy tốn API của bạn (tối đa 2048 token đầu ra mỗi agent).

Gemini dùng Google Search grounding để lấy dữ liệu mới và đính kèm nguồn; đặt `GEMINI_SEARCH=off` nếu muốn tắt.
