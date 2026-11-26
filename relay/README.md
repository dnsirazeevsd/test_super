# SUPER STORE — Safe Telegram Lead Relay (`/relay`)

Minimal Cloudflare Worker (`worker.js`, ~80 lines) that receives form submissions from the static Astro site (`Забронировать`, `Trade-In`, `Выкуп`) and forwards them to a private Telegram chat without ever exposing bot credentials to the browser.

## Security guarantees

1. **Secrets stay server-side:** `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` live only in Cloudflare Worker Secrets — never in client JS, `PUBLIC_*` variables, or Git.
2. **Strict Origin check (CORS):** Rejects any request whose `Origin` header does not match `ALLOWED_ORIGIN` (`403 Forbidden`).
3. **Anti-spam & validation:**
   - Payload size cap (`4 KB`).
   - Hidden honeypot check (`website` must be empty).
   - Minimum fill time (`elapsedMs >= 1200 ms`).
   - Per-IP sliding-window rate limit (`5` requests / `10` minutes via `CF-Connecting-IP`).
   - Strict field validation (`type`, `name`, `+7XXXXXXXXXX` 10-digit phone, `consent === true`).
4. **HTML-escaping:** Every field is escaped before sending with `parse_mode: "HTML"` to `https://api.telegram.org/bot<TOKEN>/sendMessage`.

## Deploy steps

1. **Create a Telegram Bot & get Chat ID:**
   - Message `@BotFather` -> `/newbot` -> copy the token.
   - Add the bot to your managers' group (or open a direct chat with it and send `/start`), then call `https://api.telegram.org/bot<TOKEN>/getUpdates` once from your terminal to read `chat.id`.

2. **Configure `wrangler.toml`:**
   Update `ALLOWED_ORIGIN` in `relay/wrangler.toml` to your production domain (e.g. `https://superstore-rio.ru`).

3. **Store secrets in Cloudflare (never in files):**
   ```bash
   cd relay
   npx wrangler login
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put TELEGRAM_CHAT_ID
   ```

4. **Deploy the Worker:**
   ```bash
   npx wrangler deploy
   ```
   Copy the deployed URL (e.g. `https://superstore-lead-relay.<account>.workers.dev`).

5. **Connect the Astro build:**
   Set `PUBLIC_LEAD_ENDPOINT` in your hosting environment variables before running `npm run build`:
   ```bash
   PUBLIC_LEAD_ENDPOINT="https://superstore-lead-relay.<account>.workers.dev" npm run build
   ```

## Demo & fallback behavior on the site

- **Production with `PUBLIC_LEAD_ENDPOINT` set:** Submits JSON via `POST` to the Worker; shows success or the direct phone call fallback (`+7 (931) 202-00-78`) on network error.
- **Production without `PUBLIC_LEAD_ENDPOINT`:** Prints a build warning and **never fakes success** — displays the call-us state (`+7 (931) 202-00-78`).
- **Explicit demo preview (`PUBLIC_DEMO_MODE=true` and empty `PUBLIC_LEAD_ENDPOINT`):** Shows a visible `"Демо: заявка не отправляется"` badge and previews the success screen locally.
