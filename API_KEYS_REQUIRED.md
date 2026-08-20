# Kira MD API-Key Audit

## Credentials that are required only for specific commands

| Environment variable | Commands affected | Provider | Required? |
|---|---|---|---|
| `OPENAI_API_KEY` (or legacy `OPEN_API_KEY`) | `.gpt`, `.gpt4`, and `.ai` when OpenAI is selected or used as the automatic provider | OpenAI | Required for OpenAI-backed responses; `.ai` has a Pollinations fallback. |
| `ANTHROPIC_API_KEY` | `.claude` | Anthropic Claude | Required for Claude responses; the handler attempts a fallback afterward. |
| `GOOGLE_AI_API_KEY` | `.gemini` | Google Gemini | Required for Gemini responses; the handler attempts a fallback afterward. |
| `REMOVE_BG_API_KEY` | `.removebg` | remove.bg | Required for the primary background-removal request. The code then attempts PhotoRoom. |
| `PHOTOROOM_API_KEY` | `.removebg` fallback | PhotoRoom | Required if the remove.bg request fails and the PhotoRoom fallback is to work. |

## Commands that do not require API keys

The remaining commands use the WhatsApp connection, local Node.js code, public HTTP endpoints, or local binaries. This includes `.imagine`, `.flux`, `.deepseek`, `.translate`, `.summarize`, `.essay`, `.code`, `.spell`, `.recipe`, and `.advice`, which use the current Pollinations fallback where applicable. Search commands use public endpoints without configured credentials. Downloader, converter, audio, group, moderation, economy, and utility commands do not read API-key environment variables, although some require `ffmpeg` to be installed.

## Non-key configuration

`OWNER_NUMBER` is required for phone-number pairing. It must contain digits only after normalization and include the country code. `BOT_PREFIX`, `BOT_MODE`, and the other values in `.env.example` are configuration values, not external API keys.

## Verification plan

After keys are provided, each configured provider should be tested with a minimal request through its corresponding command. Keys should be supplied through `.env` or environment variables and should not be committed to the archive or pasted into source files. A key is considered valid only when the provider returns a successful response rather than a fallback or authentication error.
