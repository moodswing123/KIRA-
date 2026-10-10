const { cmd } = require('../command');
const { runtime } = require('../lib/functions');
const config = require('../config');

cmd({
  pattern: 'uptime',
  alias: ['runtime', 'up'],
  desc: 'Show how long the bot has been running',
  category: 'main',
  react: '⏱️',
  filename: __filename
}, async (conn, mek, m, { reply }) => {
  const elapsed = runtime(process.uptime());
  const started = new Date(Date.now() - process.uptime() * 1000).toLocaleString();
  return await reply(`⏱️ *${config.BOT_NAME || 'Kira'} uptime*\nRunning for: ${elapsed}\nStarted: ${started}`);
});
