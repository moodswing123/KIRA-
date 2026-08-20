'use strict';
// commands/owner.js — Owner-only control commands for Kira MD
const fs   = require('fs');
const path = require('path');
const db   = require('../lib/database');
const {
  resolveIsOwner,
  getMentionedJid,
  formatNumber,
  normalizeJid,
  commandErrorMessage
} = require('../lib/helpers');

function ownerOnly(exec) {
  return async (args, sock, jid, isGroup, sender, message, botConfig) => {
    if (resolveIsOwner(message, sender, botConfig)) {
      return exec(args, sock, jid, isGroup, sender, message, botConfig);
    }
    const ownerNum = normalizeJid(botConfig?.ownerNumber || global.botConfig?.ownerNumber || '');
    return sock.sendMessage(jid, {
      text: ownerNum
        ? '🔒 This command is *owner-only*.'
        : '🔒 Owner not configured.\n\nSet *OWNER_NUMBER* in your .env file to enable owner commands.'
    });
  };
}

const ownerCommands = {
  owner: {
    category: 'general', desc: 'Show bot owner information',
    usage: '.owner', aliases: [], permissions: 'all',
    examples: ['.owner'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      const cfg = botConfig || global.botConfig || {};
      const ownerNumber = cfg.ownerNumber || 'Not set';
      await sock.sendMessage(jid, {
        text:
          `┏━━〔 👑 *Bot Owner* 〕━━┓\n` +
          `┃  👤 Name  : ${cfg.ownerName || 'Victory Tech'}\n` +
          `┃  📞 Number: ${ownerNumber}\n` +
          `┃  🤖 Bot   : KIRA-MD v1.0.0\n` +
          `┃  📞 DM    : ${ownerNumber !== 'Not set' ? `https://wa.me/${ownerNumber}` : 'Not available'}\n` +
          `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`
      });
    }
  },

  dashboard: {
    category: 'owner', desc: 'Full owner control dashboard',
    usage: '.dashboard', aliases: ['dash'], permissions: 'owner',
    examples: ['.dashboard'],
    exec: ownerOnly(async (args, sock, jid, isGroup, sender, message, botConfig) => {
      const stats  = db.stats();
      const cfg    = global.botConfig || {};
      const memMB  = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      const s      = Math.floor((Date.now() - (global.botStartTime || Date.now())) / 1000);
      const h      = Math.floor(s / 3600);
      const m      = Math.floor((s % 3600) / 60);
      const _idx   = require('./index');
       const total  = _idx.primaryNames?.length ||
         Object.keys(_idx).filter(k => typeof _idx[k]?.exec === 'function').length;
      const ownerJid = botConfig?.ownerJid || '';
      await sock.sendMessage(jid, {
        text:
          `🛠️ *Kira MD Owner Dashboard*\n\n` +
          `*📦 Bot Info*\n` +
          `├ Mode     : ${cfg.mode || 'public'}\n` +
          `├ Prefix   : ${cfg.prefix || '.'}\n` +
          `├ Uptime   : ${h}h ${m}m\n` +
          `├ Memory   : ${memMB} MB\n` +
          `└ Commands : ${total}\n\n` +
          `*📊 Database*\n` +
          `├ Users    : ${stats.users}\n` +
          `├ Groups   : ${stats.groups}\n` +
          `└ Banned   : ${stats.banned}\n\n` +
          `*⚙️ My Settings*\n` +
          `├ AutoStatus  : ${db.getOwnerSetting(ownerJid, 'autoStatus', false) ? '✅' : '❌'}\n` +
          `├ AutoReact   : ${db.getOwnerSetting(ownerJid, 'autoStatusReact', false) ? '✅' : '❌'}\n` +
          `├ AutoRead    : ${db.getOwnerSetting(ownerJid, 'autoRead', false) ? '✅' : '❌'}\n` +
          `├ AutoTyping  : ${db.getOwnerSetting(ownerJid, 'autoTyping', false) ? '✅' : '❌'}\n` +
          `└ AntiCall    : ${db.getOwnerSetting(ownerJid, 'antiCall', false) ? '✅' : '❌'}\n\n` +
          `_Kira MD — Powered by Victory Tech™_`
      });
    })
  },

  commandtest: {
    category: 'owner', desc: 'Inspect command registry health',
    usage: '.commandtest', aliases: ['cmdtest', 'commandhealth'], permissions: 'owner',
    examples: ['.commandtest'],
    exec: ownerOnly(async (args, sock, jid) => {
      const registry = require('./index');
      const health = typeof registry.healthReport === 'function'
        ? registry.healthReport()
        : null;

      if (!health) {
        return sock.sendMessage(jid, {
          text: '🧪 *KIRA-MD COMMAND HEALTH*\n\n❌ Command registry health is unavailable.'
        });
      }

      const brokenDetails = [
        ...health.missingExec,
        ...health.invalidMetadata,
        ...health.failedModules.map(item => `${item.file}: ${item.error}`)
      ];
      const duplicateDetails = [...health.duplicateNames, ...health.duplicateAliases];
      const lines = [
        '🧪 *KIRA-MD COMMAND HEALTH*',
        '',
        `✅ Loaded: ${health.loaded}`,
        `🔗 Aliases: ${health.aliases}`,
        `✅ Validated: ${health.validated}`,
        `❌ Broken: ${health.broken}`,
        `⚠️ Duplicate commands: ${health.duplicateNames.length}`,
        `⚠️ Duplicate aliases: ${health.duplicateAliases.length}`,
        `📂 Failed modules: ${health.failedModules.length}`,
        `🧩 Missing exec: ${health.missingExec.length}`,
        `📝 Invalid metadata: ${health.invalidMetadata.length}`,
        '',
        'ℹ️ Executed successfully: not measured by registry loading.'
      ];

      if (duplicateDetails.length || brokenDetails.length) {
        lines.push('', '*Details:*');
        for (const detail of [...duplicateDetails, ...brokenDetails].slice(0, 20)) {
          lines.push(`• ${detail}`);
        }
      }

      await sock.sendMessage(jid, { text: lines.join('\n') });
    })
  },

  mode: {
    category: 'owner', desc: 'Set bot mode (public/private)',
    usage: '.mode <public|private>', aliases: [], permissions: 'owner',
    examples: ['.mode public', '.mode private'],
    exec: ownerOnly(async (args, sock, jid, isGroup, sender, message, botConfig) => {
      const m = args[0]?.toLowerCase();
      if (!['public', 'private'].includes(m)) {
        return sock.sendMessage(jid, { text: '❌ Usage: .mode public OR .mode private' });
      }
      if (botConfig) botConfig.mode = m;
      if (global.botConfig) global.botConfig.mode = m;
      db.setSetting('botMode', m);
      await sock.sendMessage(jid, { text: `🔒 Bot mode set to *${m.toUpperCase()}*\n\n${m === 'private' ? '🔒 Only owner can use commands.' : '🌐 Everyone can use commands.'}` });
    })
  },

  broadcast: {
    category: 'owner', desc: 'Broadcast a message to all groups or DMs',
    usage: '.broadcast <message>', aliases: ['bc', 'announce'], permissions: 'owner',
    examples: ['.broadcast Kira MD is now online! 🎉'],
    exec: ownerOnly(async (args, sock, jid) => {
      const msg = args.join(' ').trim();
      if (!msg) return sock.sendMessage(jid, { text: '❌ Usage: .broadcast <message>' });
      await sock.sendMessage(jid, { text: `📢 *Broadcasting message...*\n\n_"${msg}"_\n\n⏳ Sending to all groups...` });
      try {
        const groups = await sock.groupFetchAllParticipating();
        let sent = 0;
        for (const gid of Object.keys(groups)) {
          try {
            await sock.sendMessage(gid, { text: `📢 *Broadcast Message*\n\n${msg}\n\n_— Kira MD by Victory Tech™_` });
            sent++;
            await new Promise(r => setTimeout(r, 1000));
          } catch {}
        }
        await sock.sendMessage(jid, { text: `✅ *Broadcast sent!*\n\nDelivered to *${sent}* groups.` });
      } catch (err) {
      await sock.sendMessage(jid, { text: commandErrorMessage('broadcast', err, { jid }) });
      }
    })
  },

  adduser: {
    category: 'owner', desc: 'Add a user to a group',
    usage: '.adduser <number>', aliases: ['add'], permissions: 'owner',
    chatType: 'group',
    requiresBotAdmin: true,
    examples: ['.adduser 2349012345678'],
    exec: ownerOnly(async (args, sock, jid, isGroup) => {
      if (!isGroup) return sock.sendMessage(jid, { text: '❌ This command only works in groups.' });
      const number = args[0]?.replace(/\D/g, '');
      if (!number) return sock.sendMessage(jid, { text: '❌ Usage: .adduser <phone number>' });
      const userJid = `${number}@s.whatsapp.net`;
      try {
        await sock.groupParticipantsUpdate(jid, [userJid], 'add');
        await sock.sendMessage(jid, { text: `✅ Added *+${number}* to the group.` });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('add user', err, { jid }) });
      }
    })
  },

  autostatus: {
    category: 'owner', desc: 'Toggle auto-view status updates',
    usage: '.autostatus', aliases: [], permissions: 'owner',
    examples: ['.autostatus'],
    exec: ownerOnly(async (args, sock, jid, isGroup, sender, message, botConfig) => {
      const ownerJid = botConfig?.ownerJid || sender;
      const current  = db.getOwnerSetting(ownerJid, 'autoStatus', false);
      db.setOwnerSetting(ownerJid, 'autoStatus', !current);
      await sock.sendMessage(jid, {
        text: `👁️ *Auto-Status:* ${!current ? '✅ Enabled' : '❌ Disabled'}\n\n${!current ? 'Bot will now automatically view status updates.' : 'Bot will no longer view status updates.'}`
      });
    })
  },

  autoread: {
    category: 'owner', desc: 'Toggle auto-read all messages',
    usage: '.autoread', aliases: [], permissions: 'owner',
    examples: ['.autoread'],
    exec: ownerOnly(async (args, sock, jid, isGroup, sender, message, botConfig) => {
      const ownerJid = botConfig?.ownerJid || sender;
      const current  = db.getOwnerSetting(ownerJid, 'autoRead', false);
      db.setOwnerSetting(ownerJid, 'autoRead', !current);
      await sock.sendMessage(jid, {
        text: `📖 *Auto-Read:* ${!current ? '✅ Enabled' : '❌ Disabled'}`
      });
    })
  },

  anticall: {
    category: 'owner', desc: 'Toggle anti-call (auto-reject incoming calls)',
    usage: '.anticall', aliases: [], permissions: 'owner',
    examples: ['.anticall'],
    exec: ownerOnly(async (args, sock, jid, isGroup, sender, message, botConfig) => {
      const ownerJid = botConfig?.ownerJid || sender;
      const current  = db.getOwnerSetting(ownerJid, 'antiCall', false);
      db.setOwnerSetting(ownerJid, 'antiCall', !current);
      await sock.sendMessage(jid, {
        text: `📵 *Anti-Call:* ${!current ? '✅ Enabled' : '❌ Disabled'}\n\n${!current ? 'Bot will auto-reject incoming calls.' : 'Incoming calls will no longer be rejected.'}`
      });
    })
  },

  restart: {
    category: 'owner', desc: 'Restart the bot',
    usage: '.restart', aliases: ['reboot'], permissions: 'owner',
    examples: ['.restart'],
    exec: ownerOnly(async (args, sock, jid) => {
      await sock.sendMessage(jid, { text: '🔄 *Restarting Kira MD...*\n\n_See you in a few seconds!_' });
      setTimeout(() => process.exit(0), 1000);
    })
  },

  shutdown: {
    category: 'owner', desc: 'Shutdown the bot',
    usage: '.shutdown', aliases: ['stop', 'off'], permissions: 'owner',
    examples: ['.shutdown'],
    exec: ownerOnly(async (args, sock, jid) => {
      await sock.sendMessage(jid, { text: '⛔ *Kira MD shutting down...*\n\n_Goodbye!_' });
      setTimeout(() => process.exit(0), 1000);
    })
  },

  listgroups: {
    category: 'owner', desc: 'List all groups the bot is in',
    usage: '.listgroups', aliases: ['groups', 'mygroups'], permissions: 'owner',
    examples: ['.listgroups'],
    exec: ownerOnly(async (args, sock, jid) => {
      try {
        const groups = await sock.groupFetchAllParticipating();
        const gList  = Object.values(groups);
        if (!gList.length) return sock.sendMessage(jid, { text: '📋 Bot is not in any groups.' });
        const lines = gList.slice(0, 30).map((g, i) => `${i + 1}. *${g.subject}* (${g.participants.length} members)`).join('\n');
        await sock.sendMessage(jid, { text: `📋 *Bot Groups (${gList.length})*\n\n${lines}${gList.length > 30 ? `\n\n...and ${gList.length - 30} more` : ''}` });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('list groups', err, { jid }) });
      }
    })
  },

  leavegroup: {
    category: 'owner', desc: 'Make bot leave a group',
    usage: '.leavegroup [group id or in current group]', aliases: ['leave'], permissions: 'owner',
    chatType: 'group',
    examples: ['.leavegroup'],
    exec: ownerOnly(async (args, sock, jid, isGroup) => {
      if (!isGroup) return sock.sendMessage(jid, { text: '❌ Use this command inside a group.' });
      await sock.sendMessage(jid, { text: '👋 *Leaving this group...*\n\n_Goodbye!_' });
      setTimeout(async () => {
        try { await sock.groupLeave(jid); } catch {}
      }, 1500);
    })
  }
};

module.exports = ownerCommands;
