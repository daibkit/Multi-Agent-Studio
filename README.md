# Multi-Agent Studio

Ứng dụng web để mô hình hóa và mô phỏng hệ thống Multi-Agent AI (Claude + Gemini + Shared Memory), kèm một bot Telegram thật chạy trên Vercel.

- `index.html`: trang single-file (kéo thả node, Inspector, mô phỏng, Export JSON / Mermaid). Dùng để thiết kế và mô phỏng.
- `api/webhook.js`: webhook Telegram. Telegram gọi thẳng vào đây, function chạy Gemini (tra cứu) → Claude (trả lời) rồi gửi lại cho bạn. Chạy được kể cả khi không mở trang.
- `api/_agents.js`: gọi Gemini / Claude.

## Cài đặt bot Telegram

1. Tạo bot qua [@BotFather](https://t.me/BotFather), lấy token.
2. Vercel → Settings → Environment Variables:
   - `TELEGRAM_BOT_TOKEN`: token của bot.
   - `TELEGRAM_WEBHOOK_SECRET`: chuỗi bí mật tự đặt, chỉ gồm `A-Z a-z 0-9 _ -`.
   - `GEMINI_API_KEY`: key Gemini (dùng Google Search để lấy dữ liệu mới).
   - `ANTHROPIC_API_KEY` (tùy chọn): có thì Claude soạn câu trả lời cuối, không có thì Gemini trả lời thay.
   - `TELEGRAM_CHAT_ID`: đặt sau bước 4.
3. Redeploy, rồi mở link sau trong trình duyệt của bạn để đăng ký webhook (thay `<TOKEN>`, `<SECRET>`):
   `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<ten-mien>.vercel.app/api/webhook&secret_token=<SECRET>`
4. Nhắn `/start` cho bot. Bot báo Chat ID của bạn. Đặt `TELEGRAM_CHAT_ID` bằng ID đó, redeploy.
5. Nhắn câu hỏi bất kỳ cho bot. Nút **Telegram Webhook** trên trang hiển thị danh sách kiểm tra cấu hình.

Bảo mật: webhook chỉ nhận request có header `X-Telegram-Bot-Api-Secret-Token` đúng, và chỉ trả lời đúng `TELEGRAM_CHAT_ID`. Không có API nào gọi model từ trình duyệt.
Nếu bot cũng chạy ở nơi khác bằng polling (`getUpdates`), hãy tắt nơi đó, vì Telegram không cho dùng webhook và polling cùng lúc.

Tùy chọn: `CLAUDE_MODEL` (mặc định `claude-sonnet-5-5`), `GEMINI_MODEL` (mặc định `gemini-3.6-flash`), `GEMINI_SEARCH=off`, `GEMINI_SYSTEM_PROMPT`, `CLAUDE_SYSTEM_PROMPT`.
Mỗi tin nhắn gọi Gemini và (nếu có key) Claude, tối đa 2048 token đầu ra mỗi lần, tính vào API của bạn.
