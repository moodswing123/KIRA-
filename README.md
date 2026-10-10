# Kira — Telegram × WhatsApp Bot

**Kira** is a feature-rich WhatsApp automation bot with a Telegram control panel, maintained by **Victory Tech**.

## Highlights

- WhatsApp command modules with configurable prefix and group features
- Telegram controls for pairing, status, and disconnect
- Persistent Baileys authentication in `sessions/`
- Fixed WhatsApp pairing code: **`KIRABOTS`**
- Baileys dependency aligned with the reference implementation: **`7.0.0-rc13`**
- No QR or random pairing-code flow is used by the Telegram pairing command

## Configuration

1. Copy `.env.example` to `.env`.
2. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_OWNER_ID` to enable Telegram control.
3. Set `OWNER_NUMBER` and `DEV` to the owner’s international WhatsApp number.
4. Install dependencies with `npm install`.
5. Start with `npm start`.

### Telegram commands

- `/start` — show Kira status and pairing help
- `/pair <international-number>` — start WhatsApp pairing and return `KIRABOTS`
- `/status` — show WhatsApp connection status
- `/disconnect` — disconnect the active WhatsApp session

Telegram pairing is restricted to the numeric user ID configured in `TELEGRAM_OWNER_ID`.

## Validation

```bash
npm test
```

The test command checks JavaScript syntax, loads every Kira module, confirms commands register successfully, checks for stale branding, and verifies the fixed pairing configuration.

## Deployment notes

- Keep `sessions/` on persistent storage in production.
- Never commit `.env`, credentials, or generated session files.
- This bot uses an always-on Node.js process; it is not a serverless function.
- The HTTP health endpoint responds at `/` on `PORT` (default `9090`).

## License

MIT
