# 🤖 KIRA MD — Advanced WhatsApp Bot

**Kira MD** is a powerful WhatsApp bot with 700+ commands, built by **Victory Tech™**.

---

## ✨ Features

- ✅ **700+ Commands** — AI, Downloads, Games, Economy, Group Management & more
- ✅ **Pairing Code Authentication** — No QR scanning needed
- ✅ **AI Integration** — GPT, Claude, Gemini (free fallback via Pollinations)
- ✅ **Media Downloads** — TikTok, YouTube, Instagram, Facebook, Spotify, Twitter
- ✅ **Audio Effects** — Bass boost, deep voice, speed, reverse, robot & more
- ✅ **Group Management** — Promote, demote, kick, mute, anti-link, welcome/goodbye
- ✅ **Image Tools** — Enhance, recolor, dehaze, remove background, sticker maker
- ✅ **Economy System** — Coins, XP, leaderboard, daily/weekly rewards
- ✅ **Mini Games** — Tic-Tac-Toe, Hangman, Trivia, Number Guessing
- ✅ **Victory Tech™ Watermark** — All downloads & AI-generated media

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+
- npm or pnpm
- A WhatsApp account (separate from your main, recommended)

### 2. Install Dependencies
```bash
cd kira-md
bash setup.sh
```

If your hosting provider installs dependencies automatically, no manual setup
command is needed. The repository includes `.npmrc`, which forces npm to use
the public registry instead of a hosting provider's private registry. The
provider only needs to run its normal install step and `npm start`.

For manual installations, the setup script works on Termux, VPS servers,
cPanel-style panels, and other Node.js hosts. If you prefer to install
manually:
```bash
npm install --legacy-peer-deps --registry=https://registry.npmjs.org
```

### 3. Configure
```bash
cp .env.example .env
```
Edit `.env` and set your **OWNER_NUMBER** (your WhatsApp number with country code, no `+`):
```
OWNER_NUMBER=2347038253086
OWNER_NAME=Victory Tech
BOT_MODE=public
APIFY_API_TOKEN=your_apify_token
```

`APIFY_API_TOKEN` is required for every downloader except `.tiktok` and
`.tiktokmp3`. Keep the token private and never commit your `.env` file.

The bot uses the stable `@whiskeysockets/baileys` **6.7.22** release, caches the Baileys version between reconnects, skips full history replay, and requests the first pairing code sooner. If your network needs more startup time, increase `PAIRING_CODE_WAIT_MS` in `.env`.

### 4. Start the Bot
```bash
npm start
```

### 5. Link WhatsApp
On first run:
- A **pairing code** will appear in the terminal
- Open WhatsApp on your phone
- Go to **Settings → Linked Devices → Link a Device**
- Choose **Link with phone number instead**
- Enter the **latest** pairing code within 60 seconds

Use the full phone number with its country code in `OWNER_NUMBER`, with digits
only. For example: `2347038253086`. Do not use a local-format number.
If a code expires or WhatsApp says it could not link the device, stop the bot, remove only incomplete pairing state if no account is linked, restart it, and use the newest code; do not reuse a previous code. A real account-link test must be completed on your phone because a local diagnostic cannot authenticate a WhatsApp account.

if the first method fails then do this
1. <a href=Https://session.eclipse.name.ng> get your pair code here>
2. link to your WhatsApp account
3. copy your session id
4. go to this website <a href=https://www.base64decode.org/> to decode your session id>
5. go to your panel and create a directory named "auth_info_baileys"
6. create a file, input your decoded session id, save the file as creds.json
7. restart the panel
---

## 📋 Command Categories

| Category | Description |
|----------|-------------|
| 🤖 **AI** | ChatGPT, Claude, Gemini, DeepSeek, image generation |
| 📥 **Downloader** | YouTube, TikTok, Instagram, Facebook, Spotify, Twitter |
| 🎵 **Audio** | Bass boost, deep voice, speed, slow, reverse, robot |
| 🎮 **Games** | Tic-Tac-Toe, Hangman, Trivia, Number Guessing |
| 👥 **Group** | Promote, demote, kick, mute, anti-link, invite |
| 💰 **Economy** | Balance, daily, weekly, work, rob, leaderboard |
| 🔍 **Search** | Google, Wikipedia, Weather, News, Lyrics, Currency |
| 🔄 **Converter** | Sticker, TTS, image/video conversion |
| 🛠️ **Tools** | Enhance image, remove BG, QR code, font styles |
| 🛡️ **Admin** | Warn, ban, welcome/goodbye messages |
| 👑 **Owner** | Dashboard, broadcast, mode, restart, auto-features |
| 🎉 **Fun** | Jokes, quotes, roast, hack, ship calculator |
| ⚙️ **Utility** | Status, ping, time, uptime, settings |

---

## 📞 Support

Need help? Contact the owner directly:

**👤 Victory Tech**  
🔗 https://wa.me/2347038253086

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env`, then fill in the values you need. Keep the `.env` file private and never commit real API keys to GitHub.

### Bot and owner settings

| Variable | Description | Required/default |
|----------|-------------|------------------|
| `BOT_NAME` | Bot display name | `KIRA-MD` |
| `BOT_PREFIX` | Command prefix | `.` |
| `BOT_MODE` | `public` or `private` | `public`; `private` always enforces private mode |
| `OWNER_NUMBER` | WhatsApp owner number with country code and digits only | Required for owner commands |
| `OWNER_NAME` | Owner display name | `Victory Tech` |

### GPT and AI providers

| Variable | Used by | Required |
|----------|---------|----------|
| `OPENAI_API_KEY` | `.gpt`, `.gpt4`, and automatic AI provider selection | Optional |
| `OPEN_API_KEY` | Legacy alias for OpenAI when `OPENAI_API_KEY` is empty | Optional |
| `ANTHROPIC_API_KEY` | `.claude` | Optional |
| `GOOGLE_AI_API_KEY` | `.gemini` | Optional |
| `GEMINI_MODEL` | Optional Gemini model override | Optional; built-in default |

### Download and search providers

| Variable | Used by | Required |
|----------|---------|----------|
| `APIFY_API_TOKEN` | All non-TikTok downloader commands through `easyapi/all-in-one-media-downloader` | Required for non-TikTok downloads |
| `APIFY_ACTOR_ID` | Optional Apify Actor override | `easyapi~all-in-one-media-downloader` |
| `APIFY_USE_PROXY` | Enables the Apify proxy for Actor runs | `false` |
| `APIFY_PROXY_GROUPS` | Apify proxy groups when proxy use is enabled | `RESIDENTIAL` |
| `APIFY_TIMEOUT_MS` | Maximum time to wait for an Apify run | `300000` |
| `ZSTLAB_API_KEY` | Legacy ZSTLAB features outside the downloader module | Optional |
| `ZSTLAB_API_BASE_URL` | ZSTLAB API host | `https://api.zstlab.cyou` |

The `.tiktok` and `.tiktokmp3` commands intentionally remain on their existing TikWM implementation. All other downloader commands use Apify and send the resolved media directly through WhatsApp when the file is within the configured size limit; otherwise they return the Apify direct link.

### Optional image-processing providers

| Variable | Used by | Required |
|----------|---------|----------|
| `REMOVE_BG_API_KEY` | Background-removal provider | Optional |
| `PHOTOROOM_API_KEY` | Background-removal fallback provider | Optional |

> AI commands can fall back to the free Pollinations.ai service when a supported provider key is unavailable, subject to that service’s availability and limits.

---

## 🔧 Optional: Install ffmpeg

For audio effects, sticker creation, and media conversion:

```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# Termux
pkg install ffmpeg
```

---

## 📌 Key Commands

```
.menu           — Show all commands
.help <cmd>     — Get help for a specific command
.ping           — Check bot speed
.alive          — Check bot status
.support        — Get owner's contact link
.ai <question>  — Ask AI anything (free)
.imagine <text> — Generate AI image
.tiktok <url>   — Download TikTok video
.ytmp3 <url>    — Download YouTube as MP3
.play <song>    — Search & download song
.sticker        — Convert image to sticker
.menu           — Show all 700+ commands
.mode private    — Owner only: restrict bot commands to the owner
.mode public     — Owner only: allow other users to use bot commands
```

---

## ⚠️ Important Notes

- **Auth folder**: `auth_info_baileys/` — do NOT delete while bot is running
- **Data**: stored in `data/db.json` — auto-saved
- **Private mode**: set `BOT_MODE=private` to enforce private mode even if an older `data/db.json` contains `botMode: "public"`. Remove or change that environment setting before using `.public`.
- **Rate limiting**: WhatsApp may temporarily block the number if too many messages are sent too fast
- **Terms**: Use responsibly. Comply with WhatsApp's Terms of Service.

---

## 🌟 Credits

**Kira MD** — Built by **Victory Tech™**  
Based on Baileys WhatsApp library.

> _Powered by Victory Tech™_
