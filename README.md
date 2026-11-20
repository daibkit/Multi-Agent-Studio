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
