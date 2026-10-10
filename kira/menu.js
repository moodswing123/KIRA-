const { cmd, commands } = require('../command');
const config = require('../config');

cmd({
  pattern: 'menu',
  alias: ['help', 'commands'],
  desc: 'Show available bot commands',
  category: 'main',
  react: '📜',
  filename: __filename
}, async (conn, mek, m, { from }) => {
  const prefix = config.PREFIX || '.';
  const entries = commands
    .filter(item => item.pattern && !item.dontAddCommandList)
    .map(item => `• ${prefix}${item.pattern}${item.desc ? ` — ${item.desc}` : ''}`)
    .sort((a, b) => a.localeCompare(b));
  const text = [
    `╭━━━〔 ${config.BOT_NAME || 'Kira'} COMMANDS 〕━━━╮`,
    '',
    ...entries,
    '',
    `Use ${prefix}ping to check the bot.`,
    `╰━━━〔 ${config.DESCRIPTION || 'WhatsApp bot'} 〕━━━╯`
  ].join('\n');
  await conn.sendMessage(from, { text }, { quoted: mek });
});
