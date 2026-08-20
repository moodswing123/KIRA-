'use strict';
// commands/settings.js — Bot settings display for Kira MD
const settingsCommands = {
  settings: {
    category: 'utility', desc: 'Show current bot settings',
    usage: '.settings', aliases: ['config'], permissions: 'all',
    examples: ['.settings'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      const cfg = botConfig || global.botConfig || {};
      await sock.sendMessage(jid, {
        text:
          `⚙️ *Kira MD Settings*\n\n` +
          `👑 Owner   : ${cfg.ownerName || 'Victory Tech'}\n` +
          `🔖 Prefix  : ${cfg.prefix || '.'}\n` +
          `🔒 Mode    : ${cfg.mode || 'public'}\n` +
          `🏷️  Version : v${cfg.version || '1.0.0'}\n` +
          `✅ Status  : Active\n\n` +
          `_Powered by Victory Tech™_`
      });
    }
  },
  prefix: {
    category: 'utility', desc: 'Show the current command prefix',
    usage: '.prefix', aliases: [], permissions: 'all',
    examples: ['.prefix'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      const p = (botConfig || global.botConfig || {}).prefix || '.';
      await sock.sendMessage(jid, { text: `🔤 Current prefix: *${p}*\n\nExample: *${p}menu*` });
    }
  },
  privacy: {
    category: 'utility', desc: 'Show current bot privacy mode',
    usage: '.privacy', aliases: [], permissions: 'all',
    examples: ['.privacy'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      const mode = (botConfig || global.botConfig || {}).mode || 'public';
      await sock.sendMessage(jid, {
        text: `🔒 *Privacy Mode*\n\nCurrent: *${mode}*\n\n${mode === 'private' ? '🔒 Bot only responds to the owner.' : '🌐 Bot responds to everyone.'}`
      });
    }
  }
};
module.exports = settingsCommands;
