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
```

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
If a code expires or WhatsApp says it could not link the device, restart the
bot and use the newest code; do not reuse a previous code.

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

| Variable | Description | Default |
|----------|-------------|---------|
| `BOT_NAME` | Bot display name | `KIRA-MD` |
| `BOT_PREFIX` | Command prefix | `.` |
| `BOT_MODE` | `public` or `private` | `public` |
| `OWNER_NUMBER` | Your WhatsApp number | (required) |
| `OWNER_NAME` | Your name | `Victory Tech` |
| `OPENAI_API_KEY` | OpenAI key (optional) | — |
| `ANTHROPIC_API_KEY` | Claude key (optional) | — |
| `GOOGLE_AI_API_KEY` | Gemini key (optional) | — |

> 💡 AI commands work without API keys using the free Pollinations.ai service.

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
- **Rate limiting**: WhatsApp may temporarily block the number if too many messages are sent too fast
- **Terms**: Use responsibly. Comply with WhatsApp's Terms of Service.

---

## 🌟 Credits

**Kira MD** — Built by **Victory Tech™**  
Based on Baileys WhatsApp library.

> _Powered by Victory Tech™_
