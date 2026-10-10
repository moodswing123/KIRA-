const { cmd } = require('../command');
const config = require('../config');

cmd({
  pattern: 'ping',
  alias: ['p'],
  desc: 'Check whether the bot is responding',
  category: 'main',
  react: '🏓',
  filename: __filename
}, async (conn, mek, m, { from }) => {
  const sentAt = Number(mek.messageTimestamp || 0) * 1000;
  const latency = sentAt ? Math.max(0, Date.now() - sentAt) : 0;
  await conn.sendMessage(from, {
    text: `🏓 Pong! ${config.BOT_NAME || 'Kira'} is online.${latency ? `\n⏱️ ${latency} ms` : ''}`
  }, { quoted: mek });
});
