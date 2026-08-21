# Kira MD Command Requirements Audit

The project currently registers **143 primary commands and 179 aliases**. This audit distinguishes provider credentials from public web services, local binaries, WhatsApp media/session requirements, and commands that run entirely locally.

## Commands that require configured API keys

| Commands | Required variable | Requirement |
|---|---|---|
| `.gpt`, `.chatgpt`, `.openai` | `OPENAI_API_KEY` (or legacy `OPEN_API_KEY`) | OpenAI chat completion. |
| `.gpt4` | `OPENAI_API_KEY` (or legacy `OPEN_API_KEY`) | OpenAI GPT-4 request. The selected model must remain available to the key/account. |
| `.claude` | `ANTHROPIC_API_KEY` | Anthropic Claude request. |
| `.gemini` | `GOOGLE_AI_API_KEY` | Google Gemini request. Optional `GEMINI_MODEL` selects the model; the current default in this project is `gemini-3.6-flash`. |
| `.removebg`, `.rmbg`, `.nobg`, `.cutout` | `REMOVE_BG_API_KEY` or fallback `PHOTOROOM_API_KEY` | Background removal. A key is strongly recommended; the remove.bg `DEMO` fallback is not suitable for reliable production use. |

## AI commands with an optional OpenAI key and a public fallback

| Commands | Behavior |
|---|---|
| `.ai`, `.ask` | Uses OpenAI when `OPENAI_API_KEY` or `OPEN_API_KEY` is configured; otherwise uses Pollinations. |
| `.translate`, `.tr` | Uses the same automatic AI path as `.ai`; no dedicated translation key. |
| `.summarize`, `.sum`, `.tldr` | Uses the same automatic AI path as `.ai`; no dedicated summarization key. |
| `.essay`, `.write` | Uses the same automatic AI path as `.ai`; no dedicated essay key. |
| `.code`, `.coding`, `.program` | Uses the same automatic AI path as `.ai`; no dedicated coding key. |
| `.spell`, `.grammar`, `.correct` | Uses the same automatic AI path as `.ai`; no dedicated spelling key. |
| `.recipe`, `.cook` | Uses the same automatic AI path as `.ai`; no dedicated recipe key. |
| `.advice` | Uses the same automatic AI path as `.ai`; no dedicated advice key. |
| `.deepseek`, `.ds` | Uses Pollinations’ DeepSeek route; no user-supplied DeepSeek key is read by this project. |
| `.imagine`, `.gen`, `.draw`, `.image` | Uses Pollinations image generation; no user-supplied key is read. |
| `.flux`, `.fluxai` | Uses Pollinations Flux image generation; no user-supplied key is read. |

If a keyed AI request fails, the implementation attempts the Pollinations fallback. Availability and rate limits of those public services can change independently of the bot.

## Download and media commands: no configured user API key, but internet access is required

| Commands | External dependency | Additional requirement |
|---|---|---|
| `.ytdl`, `.yt`, `.youtube`, `.ytv` | `yt-dlp` when installed; otherwise `cobalt.tools` | `yt-dlp` is recommended for direct video delivery. Without it, the command returns a temporary download link. |
| `.ytmp3`, `.ymp3`, `.ytaudio`, `.ytsong` | `yt-dlp` when installed; otherwise `cobalt.tools` | `yt-dlp` is recommended for direct MP3 delivery. If `yt-dlp` is used, FFmpeg is normally required for audio extraction. |
| `.play`, `.song`, `.music` | YouTube HTML search, then `yt-dlp` or `cobalt.tools` | No API key. Requires outbound internet access; `yt-dlp` is recommended for sending the audio file directly. |
| `.tiktok`, `.tt`, `.tik`, `.ttdl` | `tikwm.com` plus the returned media URL | No API key. Requires outbound internet access. |
| `.tiktokmp3`, `.ttaudio`, `.ttsound` | `tikwm.com` plus the returned audio URL | No API key. Requires outbound internet access. |
| `.igdl`, `.ig`, `.instagram`, `.insta` | `cobalt.tools` plus the returned media URL | No API key. Requires outbound internet access. |
| `.fbdl`, `.fb`, `.facebook` | `cobalt.tools` plus the returned media URL | No API key. Requires outbound internet access. |
| `.twitter`, `.twit`, `.xdl`, `.tweet` | `cobalt.tools` plus the returned media URL | No API key. Requires outbound internet access. |
| `.spotify`, `.sp`, `.spot` | Spotify oEmbed, YouTube search, then `yt-dlp` or `cobalt.tools` | No Spotify API key in this implementation. `yt-dlp` is recommended for direct audio delivery. |
| `.mediafire`, `.mf` | MediaFire page extraction | No API key. Requires outbound internet access. |
| `.pinterest`, `.pin`, `.pinimg` | `cobalt.tools` plus the returned media URL | No API key. Requires outbound internet access. |

### Important distinction for `.play` and MP3 commands

`.play` does **not** require an API key. It searches YouTube by downloading the public results page, then uses `yt-dlp` if available. `.ytmp3` also does not require an API key, but direct MP3 creation is more reliable when both `yt-dlp` and FFmpeg are installed. If `yt-dlp` is missing, the bot relies on the public Cobalt service and generally sends a temporary link instead of an audio file.

## Conversion and audio commands: local FFmpeg, not API keys

| Commands | Requirement |
|---|---|
| `.tomp3`, `.toaudio`, `.extractaudio` | Reply to audio/video media; requires the `ffmpeg` executable. |
| `.tomp4`, `.togif`, `.tov` | Reply to sticker/image/video media; requires the `ffmpeg` executable. |
| `.sticker`, `.s`, `.stiker`, `.stik` | Reply to image/video or send an image; requires the `ffmpeg` executable for conversion. |
| `.bass`, `.deep`, `.fast`, `.slow`, `.reverse`, `.robot`, `.chipmunk`, `.smooth` | Reply to audio/voice media; requires the `ffmpeg` executable. |
| `.toimg` | Reply to a sticker; uses WhatsApp media download and does not require FFmpeg or an API key. |
| `.tts`, `.speak`, `.voice`, `.say` | Uses Google Translate TTS public endpoints; no API key is configured, but internet access is required. |

On a Linux host, verify FFmpeg with:

```bash
ffmpeg -version
```

## Image and utility commands

| Commands | Requirement |
|---|---|
| `.enhance`, `.hd`, `.sharpen` | Reply to an image; calls the external Vyro AI image endpoint used by the project. No user API variable is read, but internet access is required and the public service may impose limits. |
| `.recolor`, `.colorize`, `.colourize` | Reply to an image; same Vyro AI endpoint requirement. |
| `.dehaze`, `.defog`, `.clearimage` | Reply to an image; same Vyro AI endpoint requirement. |
| `.font`, `.fancy`, `.fancytext`, `.fontgen` | Runs locally; no API key. |
| `.qr`, `.qrcode`, `.makeqr` | Uses QR Server’s public endpoint; no API key, internet required. |
| `.tourl`, `.upload`, `.getlink` | Uploads replied media to Catbox; no API key, internet required. |
| `.screenshot`, `.ss`, `.snap`, `.webshot` | Uses Microlink’s public screenshot endpoint; no user key is configured, internet required. The source also contains an unused placeholder Screenshot Machine URL. |

## Search and information commands: public endpoints, no user API keys

| Commands | Public service |
|---|---|
| `.google` | DuckDuckGo instant-answer endpoint and Google search links. |
| `.github` | GitHub public API. Private repository access is not configured. |
| `.npm` | npm registry. |
| `.lyrics` | lyrics.ovh. |
| `.wikipedia` | Wikipedia REST API. |
| `.weather` | wttr.in. |
| `.news` | Hacker News Firebase API. |
| `.currency` | ExchangeRate API public endpoint. |
| `.wikimedia` | Wikimedia Commons API. |
| `.bible` | bible-api.com. |

These commands do not read an API-key environment variable, but they can fail if the host blocks outbound HTTPS or if a public endpoint rate-limits the server.

## Local-only and WhatsApp-context commands

The general, economy, fun, games, group, moderation, owner, main, and settings commands do not require third-party API keys unless noted above. They may still require a specific chat context, permissions, a quoted message, group-admin status, or the bot itself to be a group administrator.

Examples include `.ping`, `.menu`, `.help`, `.alive`, `.balance`, `.daily`, `.work`, `.tictactoe`, `.hangman`, `.truth`, `.dare`, `.joke`, `.quote`, `.font`, `.runtime`, `.groupinfo`, `.members`, `.promote`, `.kick`, `.warn`, `.ban`, `.settings`, `.privacy`, `.public`, `.private`, and `.mode`.

Owner control commands additionally require `OWNER_NUMBER` to match the WhatsApp account controlling the bot. Group administration commands require the bot to be an administrator in the target group when their metadata declares `requiresBotAdmin`.

## Environment variable summary

```env
OWNER_NUMBER=234XXXXXXXXXX
BOT_MODE=public
BOT_PREFIX=.
OPENAI_API_KEY=
OPEN_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_AI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash
REMOVE_BG_API_KEY=
PHOTOROOM_API_KEY=
```

Never commit real values to GitHub or include them in a ZIP archive. Configure them as private Pterodactyl variables or in a local `.env` file that remains excluded by `.gitignore`.
