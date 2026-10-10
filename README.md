# Kira — Telegram × WhatsApp Bot

**Kira** is a feature-rich WhatsApp automation bot with a Telegram control panel, maintained by **Victory Tech**.

## Highlights

- WhatsApp command modules with configurable prefix and group features
- Telegram controls for pairing, status, and disconnect
- Persistent Baileys authentication in `sessions/`
- Fixed WhatsApp pairing code: **`KIRABOTS`**
- Baileys dependency pinned to stable **`@whiskeysockets/baileys 6.7.23`** for reliable fresh pairing.
- No QR or random pairing-code flow is used by the Telegram pairing command

## Configuration

1. Copy `.env.example` to `.env`.
2. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_OWNER_ID` to enable Telegram control.
3. Set `OWNER_NUMBER` and `DEV` to the owner’s international WhatsApp number.
4. Set `FORCE_JOIN_1_URL` and `FORCE_JOIN_2_URL` to the two Telegram channels/groups shown by the join buttons. Optional labels are `FORCE_JOIN_1_TEXT` and `FORCE_JOIN_2_TEXT`.
5. Install dependencies with `npm install`.
6. Start with `npm start`.

### Telegram commands

- `/start` — show Kira status and pairing help
- `/pair <international-number>` — start WhatsApp pairing and return `KIRABOTS`
- `/status` — show WhatsApp connection status
- `/disconnect` — disconnect the active WhatsApp session

### WhatsApp commands

- `.ping` — check whether the bot is responding
- `.menu` — list registered commands (`.help` and `.commands` are aliases)
- `.uptime` — show how long the bot has been running (`.runtime` and `.up` are aliases)

Telegram pairing is restricted to the numeric user ID configured in `TELEGRAM_OWNER_ID`.

## Validation

```bash
npm test
```

The test command checks JavaScript syntax, loads every Kira module, confirms commands register successfully, checks for stale branding, and verifies the fixed pairing configuration.

## Deployment notes

- Keep `sessions/` on persistent storage in production.
- Never commit `.env`, credentials, or generated session files.
- Configure credentials as host-managed secrets/environment variables; do not commit the Telegram bot token or owner ID.
- This bot uses an always-on Node.js process; it is not a serverless function.
- The HTTP health endpoint responds at `/` on `PORT` (default `9090`).
- Baileys' `restart required` close after pairing is treated as a reconnect, not a failed pairing.
- Auto-voice is inactive unless `AUTO_VOICE=true`; when enabled, it caches its map and logs upstream errors instead of sending an error to chats. Override the map with `AUTO_VOICE_MAP_URL` if needed.

## License

MIT
