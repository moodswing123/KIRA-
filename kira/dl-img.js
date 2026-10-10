const { cmd } = require('../command');
const axios = require('axios');

cmd({
  pattern: 'img',
  alias: ['image', 'googleimage', 'searchimg'],
  react: '🎢',
  desc: 'Search and download images',
  category: 'fun',
  use: '.img <keywords>',
  filename: __filename
}, async (conn, mek, m, { reply, args, from }) => {
  try {
    const query = args.join(' ').trim();
    if (!query) return await reply('🖼️ Provide a search query.\nExample: .img cute cats');
    await reply(`🔍 Searching images for “${query}”…`);
    const { data } = await axios.get(`https://apis.davidcyriltech.my.id/googleimage?query=${encodeURIComponent(query)}`, { timeout: 20000 });
    const results = Array.isArray(data?.results)
      ? data.results.filter(value => typeof value === 'string' && /^https?:\/\//i.test(value))
      : [];
    if (!data?.success || results.length === 0) return await reply('❌ No images found. Try different keywords.');
    for (const imageUrl of results.slice(0, 5)) {
      await conn.sendMessage(from, {
        image: { url: imageUrl },
        caption: `📷 Image results for: ${query}`
      }, { quoted: mek });
    }
  } catch (error) {
    console.error('Image search failed:', error.message);
    await reply('❌ Image search failed. Please try again later.');
  }
});
