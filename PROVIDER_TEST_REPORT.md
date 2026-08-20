# Provider Test Report

The bot’s provider request paths were tested with the supplied credentials in a transient process. Credentials were not written to this report.

| Bot command | Provider | Result | Diagnosis |
|---|---|---|---|
| `.gpt` | OpenAI | **Passed** | The supplied OpenAI credential was accepted by the bot’s configured `gpt-3.5-turbo` request path. |
| `.claude` | Anthropic | **Failed — HTTP 403** | Anthropic rejected the credential. It is likely invalid, revoked, restricted, expired, or incorrectly copied. |
| `.gemini` | Google Gemini | **Passed after repair** | The key was accepted. The bot’s old Gemini SDK/model path returned 404, so the command was updated to use the current v1beta REST endpoint and `gemini-3.6-flash`. |

## Code change made

`commands/ai.js` now uses `GEMINI_MODEL` when provided, otherwise defaults to `gemini-3.6-flash`. It calls the current Gemini v1beta `generateContent` endpoint directly instead of the outdated SDK path that was requesting an unavailable model.

The command regression suite still passes with 141 commands and 179 aliases registered, with zero broken command registrations.

## Security note

These credentials were exposed in chat. Rotate all three keys from their provider dashboards, especially the Anthropic key that returned HTTP 403, and then place replacement values only in the deployment environment or a local `.env` file. Do not commit them to Git or include them in a project archive.
