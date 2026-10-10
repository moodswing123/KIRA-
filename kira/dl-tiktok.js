const { cmd } = require('../command');
const axios = require('axios');

function parseTikTokUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!['https:', 'http:'].includes(url.protocol) || !(host === 'tiktok.com' || host.endsWith('.tiktok.com'))) return null;
    return url.href;
  } catch { return null; }
}

cmd({
  pattern: 'tiktok',
  alias: ['ttdl', 'tt', 'tiktokdl'],
  desc: 'Download a TikTok video',
  category: 'downloader',
  react: '📤',
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    const videoPage = parseTikTokUrl(String(q || '').trim());
    if (!videoPage) return await reply('Please provide a valid TikTok video URL.');
    await reply('Downloading TikTok video, please wait…');
    const apiUrl = `https://delirius-apiofc.vercel.app/download/tiktok?url=${encodeURIComponent(videoPage)}`;
    const { data } = await axios.get(apiUrl, { timeout: 25000 });
    const result = data?.data;
    const media = Array.isArray(result?.meta?.media) ? result.meta.media : [];
    const video = media.find(item => item?.type === 'video' && (item.org || item.url));
    const videoUrl = video?.org || video?.url;
    if (!data?.status || !/^https?:\/\//i.test(videoUrl || '')) {
      return await reply('❌ Could not retrieve this TikTok video. Try another public link.');
    }
    const author = result.author || {};
    const caption = [
      'TikTok video',
      result.title ? `Title: ${result.title}` : '',
      author.nickname ? `Creator: ${author.nickname}${author.username ? ` (@${author.username})` : ''}` : '',
      result.like != null ? `Likes: ${result.like}` : ''
    ].filter(Boolean).join('\n');
    await conn.sendMessage(from, {
      video: { url: videoUrl },
      caption,
      contextInfo: m?.sender ? { mentionedJid: [m.sender] } : undefined
    }, { quoted: mek });
  } catch (error) {
    console.error('TikTok downloader failed:', error.message);
    await reply('❌ Could not download that TikTok video. Please try again later.');
  }
});
