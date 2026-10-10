const axios = require('axios');
const { cmd } = require('../command');

cmd({
  pattern: 'define',
  desc: 'Get the definition of a word',
  react: '🔍',
  category: 'search',
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    const word = String(q || '').trim();
    if (!word) return await reply('Please provide a word to define.\nUsage: .define <word>');
    const { data } = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { timeout: 15000 });
    const entry = Array.isArray(data) ? data[0] : null;
    const meaning = entry?.meanings?.[0];
    const definitionData = meaning?.definitions?.[0];
    if (!entry || !definitionData?.definition) return await reply('🚫 No definition found. Check the spelling and try again.');

    const synonyms = Array.isArray(definitionData.synonyms) && definitionData.synonyms.length
      ? definitionData.synonyms.join(', ')
      : 'No synonyms available';
    const phonetic = entry.phonetics?.find(item => item?.text)?.text || entry.phonetic || 'No phonetics available';
    const audio = entry.phonetics?.find(item => item?.audio)?.audio;
    const text = [
      `📖 *Word:* ${entry.word || word}`,
      `🗣️ *Pronunciation:* ${phonetic}`,
      `📚 *Definition:* ${definitionData.definition}`,
      `✍️ *Example:* ${definitionData.example || 'No example available'}`,
      `📝 *Synonyms:* ${synonyms}`
    ].join('\n');
    await reply(text);
    if (audio && /^https?:\/\//i.test(audio)) {
      try { await conn.sendMessage(from, { audio: { url: audio }, mimetype: 'audio/mpeg' }, { quoted: mek }); }
      catch (audioError) { console.warn('Dictionary pronunciation audio unavailable:', audioError.message); }
    }
  } catch (error) {
    if (error.response?.status === 404) return await reply('🚫 Word not found. Please check the spelling and try again.');
    console.error('Dictionary command failed:', error.message);
    return await reply('⚠️ Could not fetch the definition. Please try again later.');
  }
});
