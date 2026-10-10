const axios = require('axios');
const { cmd } = require('../command');

function isFacebookUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return (url.protocol === 'https:' || url.protocol === 'http:') &&
      (host === 'fb.watch' || host === 'fb.com' || host === 'facebook.com' || host.endsWith('.facebook.com'));
  } catch { return false; }
}

cmd({
  pattern: 'fb',
  alias: ['facebook', 'fbdl'],
  desc: 'Download Facebook videos',
  category: 'download',
  filename: __filename,
  use: '<Facebook URL>'
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q || !isFacebookUrl(q.trim())) {
      return await reply('Please provide a valid Facebook video URL.\nExample: .fb https://www.facebook.com/watch/...');
    }
    await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});
    const apiUrl = `https://www.velyn.biz.id/api/downloader/facebookdl?url=${encodeURIComponent(q.trim())}`;
    const { data } = await axios.get(apiUrl, { timeout: 25000 });
    const videoUrl = data?.data?.url;
    if (!data?.status || typeof videoUrl !== 'string' || !/^https?:\/\//i.test(videoUrl)) {
      return await reply('❌ Could not retrieve this Facebook video. Try another public video link.');
    }
    await conn.sendMessage(from, {
      video: { url: videoUrl },
      caption: '📥 Facebook video'
    }, { quoted: mek });
  } catch (error) {
    console.error('Facebook downloader failed:', error.message);
    await reply('❌ Could not download that Facebook video. Please try again later.');
  }
});
