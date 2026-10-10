const fs = require('fs');
const path = require('path');
const os = require('os');
const { cmd, commands } = require('../command');
const { runtime } = require('../lib/functions');
const packageInfo = require('../package.json');

cmd({
  pattern: 'version',
  alias: ['chkiraog', 'cupdate', 'checkupdate'],
  react: '🚀',
  desc: "Check the bot's version and system status",
  category: 'info',
  filename: __filename
}, async (conn, mek, m, { from, pushname, reply }) => {
  try {
    const pluginDir = path.join(__dirname);
    const pluginCount = fs.readdirSync(pluginDir).filter(file => file.endsWith('.js')).length;
    const commandCount = commands.filter(item => item.pattern).length;
    const memoryMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const text = [
      `🤖 *${packageInfo.name || 'Kira'} status*`,
      pushname ? `Hello, ${pushname}.` : '',
      `Version: ${packageInfo.version || 'unknown'}`,
      `Commands: ${commandCount}`,
      `Plugins: ${pluginCount}`,
      `Uptime: ${runtime(process.uptime())}`,
      `Memory: ${memoryMb} MB`,
      `Host: ${os.hostname()}`
    ].filter(Boolean).join('\n');
    return await reply(text);
  } catch (error) {
    console.error('Version command failed:', error.message);
    return await reply('❌ Could not read local bot status.');
  }
});
