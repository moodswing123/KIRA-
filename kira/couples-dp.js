const { cmd } = require('../command');
const axios = require('axios');

cmd({
  pattern: 'couplepp',
  alias: ['couple', 'cpp'],
  react: '💑',
  desc: 'Get a male and female couple profile picture',
  category: 'image',
  use: '.couplepp',
  filename: __filename
}, async (conn, mek, m, { from, reply }) => {
  try {
    await reply('💑 Fetching couple profile pictures…');
    const { data } = await axios.get('https://api.davidcyriltech.my.id/couplepp', { timeout: 20000 });
    const male = data?.male;
    const female = data?.female;
    const urls = [male, female].filter(value => typeof value === 'string' && /^https?:\/\//i.test(value));
    if (!data?.success || urls.length === 0) {
      return await reply('❌ Couple pictures are unavailable right now. Please try again later.');
    }
    if (male && /^https?:\/\//i.test(male)) {
      await conn.sendMessage(from, { image: { url: male }, caption: '👨 Couple profile picture' }, { quoted: mek });
    }
    if (female && /^https?:\/\//i.test(female)) {
      await conn.sendMessage(from, { image: { url: female }, caption: '👩 Couple profile picture' }, { quoted: mek });
    }
  } catch (error) {
    console.error('Couple profile command failed:', error.message);
    await reply('❌ Could not fetch couple profile pictures. Please try again later.');
  }
});
