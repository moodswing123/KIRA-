const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

let stickerMapCache;
let stickerMapCacheTime = 0;
let lastFetchWarningAt = 0;
const STICKER_MAP_URL = process.env.AUTO_STICKER_MAP_URL || 'https://raw.githubusercontent.com/JawadYT36/KHAN-DATA/main/autosticker.json';

cmd({ on: 'body' }, async (conn, mek, m, { from, body }) => {
  if (config.AUTO_STICKER !== 'true' || !body) return;
  try {
    if (!stickerMapCache || Date.now() - stickerMapCacheTime > 5 * 60 * 1000) {
      const response = await axios.get(STICKER_MAP_URL, { timeout: 10000 });
      if (!response.data || typeof response.data !== 'object' || Array.isArray(response.data)) throw new Error('Sticker map response is not a JSON object');
      stickerMapCache = response.data;
      stickerMapCacheTime = Date.now();
    }
    const keyword = Object.keys(stickerMapCache).find(value => body.toLowerCase() === value.toLowerCase());
    if (!keyword) return;
    await conn.sendMessage(from, { sticker: { url: stickerMapCache[keyword] }, package: 'KIRA' }, { quoted: mek });
  } catch (error) {
    if (Date.now() - lastFetchWarningAt > 60 * 60 * 1000) {
      console.warn('AutoSticker is temporarily unavailable; check AUTO_STICKER_MAP_URL:', error.message);
      lastFetchWarningAt = Date.now();
    }
    stickerMapCache = null;
  }
});
