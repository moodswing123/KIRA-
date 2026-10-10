const { cmd } = require('../command');
const os = require('os');
const { runtime } = require('../lib/functions');
const config = require('../config');

cmd({
  pattern: 'alive',
  alias: ['status', 'live', 'a'],
  desc: 'Check whether the bot is online',
  category: 'main',
  react: '🎉',
  filename: __filename
}, async (conn, mek, m, { from, reply }) => {
  const status = [
    `🤖 *${config.BOT_NAME || 'Kira'} is active and online*`,
    `Owner: ${config.OWNER_NAME || 'Bot owner'}`,
    `Version: ${require('../package.json').version}`,
    `Prefix: ${config.PREFIX || '.'}`,
    `Mode: ${config.MODE || 'public'}`,
    `Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB / ${(os.totalmem() / 1024 / 1024).toFixed(1)} MB`,
    `Uptime: ${runtime(process.uptime())}`,
    config.DESCRIPTION || ''
  ].filter(Boolean).join('\n');

  if (config.MENU_IMAGE_URL) {
    try {
      return await conn.sendMessage(from, { image: { url: config.MENU_IMAGE_URL }, caption: status }, { quoted: mek });
    } catch (error) {
      console.warn('Alive menu image unavailable; sending text status:', error.message);
    }
  }
  return await reply(status);
});
