const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

let voiceMapCache;
let voiceMapCacheTime = 0;
let lastFetchWarningAt = 0;
const VOICE_MAP_URL = process.env.AUTO_VOICE_MAP_URL || 'https://raw.githubusercontent.com/JawadYT36/KHAN-DATA/main/autovoice.json';
const CACHE_TTL_MS = 5 * 60 * 1000;
const WARNING_INTERVAL_MS = 60 * 60 * 1000;

cmd({ on: 'body' }, async (conn, m, msg, { from, body }) => {
  // Do not hit the remote map on every incoming message while this feature is disabled.
  if (config.AUTO_VOICE !== 'true' || !body) return;
  try {
    if (!voiceMapCache || Date.now() - voiceMapCacheTime > CACHE_TTL_MS) {
      const response = await axios.get(VOICE_MAP_URL, { timeout: 10000 });
      if (!response.data || typeof response.data !== 'object' || Array.isArray(response.data)) throw new Error('Voice map response is not a JSON object');
      voiceMapCache = response.data;
      voiceMapCacheTime = Date.now();
    }
    const match = Object.keys(voiceMapCache).find(keyword => body.toLowerCase() === keyword.toLowerCase());
    if (!match) return;
    const audioUrl = voiceMapCache[match];
    if (typeof audioUrl !== 'string' || !/\.(mp3|m4a)(?:$|[?#])/i.test(audioUrl)) return;
    await conn.sendPresenceUpdate('recording', from);
    await conn.sendMessage(from, { audio: { url: audioUrl }, mimetype: 'audio/mpeg', ptt: true }, { quoted: m });
  } catch (error) {
    // An upstream 404 used to be sent to the chat on every message. Keep failures in logs,
    // rate-limited, and retry later in case the source comes back.
    if (Date.now() - lastFetchWarningAt > WARNING_INTERVAL_MS) {
      console.warn('AutoVoice is temporarily unavailable; check AUTO_VOICE_MAP_URL:', error.message);
      lastFetchWarningAt = Date.now();
    }
    voiceMapCache = null;
  }
});
