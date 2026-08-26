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

function ownerSettingsJid(botConfig, sender) {
  return botConfig?.ownerJid || (botConfig?.ownerNumber ? `${botConfig.ownerNumber}@s.whatsapp.net` : sender);
}

function targetUserJid(args, message) {
  const mentioned = getMentionedJid(message);
  if (mentioned) return normalizeJid(mentioned);
  const ctx = require('../lib/helpers').getMessageContext(message);
  if (ctx?.quotedSender) return normalizeJid(ctx.quotedSender);
  const digits = String(args[0] || '').replace(/\D/g, '');
  return digits ? `${digits}@s.whatsapp.net` : '';
}

function getSudoUsers(botConfig, sender) {
  const value = db.getOwnerSetting(ownerSettingsJid(botConfig, sender), 'sudoUsers', []);
  return Array.isArray(value) ? value.map(normalizeJid).filter(Boolean) : [];
}

async function applyBotMode(mode, sock, jid, botConfig) {
  if (botConfig) botConfig.mode = mode;
  if (global.botConfig) global.botConfig.mode = mode;
  db.setSetting('botMode', mode);
  await sock.sendMessage(jid, {
    text: `🔒 Bot mode set to *${mode.toUpperCase()}*\n\n${mode === 'private' ? '🔒 Only owner can use commands.' : '🌐 Everyone can use commands.'}`
  });
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

  setmenuimage: {
    category: 'owner', desc: 'Set the remote image used by the menu',
    usage: '.setmenuimage <image URL>', aliases: ['menuimage'], permissions: 'owner',
    examples: ['.setmenuimage https://example.com/menu.jpg'],
    exec: ownerOnly(async (args, sock, jid) => {
      const url = String(args[0] || '').trim();
      if (!/^https?:\/\/[^\s]+$/i.test(url)) {
        return sock.sendMessage(jid, {
          text: '❌ Usage: .setmenuimage <http(s) image URL>\n\nThe link may be hosted anywhere, but it must point directly to an image file.'
        });
      }
      try {
        const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(15000) });
        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        if (!response.ok || !contentType.startsWith('image/')) {
          throw new Error(`URL returned ${response.status || 'an invalid response'}${contentType ? ` (${contentType})` : ''}`);
        }
        db.setSetting('menuImageUrl', url);
        await sock.sendMessage(jid, {
          text: `✅ *Menu image updated.*\n\n${url}\n\nUse *.menu* to preview it. The setting will survive restarts.`
        });
      } catch (err) {
        await sock.sendMessage(jid, {
          text: `❌ That link could not be validated as a direct image.\n\n${err.message}\n\nUse the direct image file URL, not an HTML page or gallery link.`
        });
      }
    })
  },

  setmenuvideo: {
    category: 'owner', desc: 'Set the remote video used by the menu',
    usage: '.setmenuvideo <video URL>', aliases: ['menuvideo'], permissions: 'owner',
    examples: ['.setmenuvideo https://example.com/menu.mp4'],
    exec: ownerOnly(async (args, sock, jid) => {
      const url = String(args[0] || '').trim();
      if (!/^https?:\/\/[^\s]+$/i.test(url)) {
        return sock.sendMessage(jid, { text: '❌ Usage: .setmenuvideo <http(s) video URL>' });
      }
      try {
        const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(15000) });
        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        if (!response.ok || !contentType.startsWith('video/')) {
          throw new Error(`URL returned ${response.status || 'an invalid response'}${contentType ? ` (${contentType})` : ''}`);
        }
        db.setSetting('menuVideoUrl', url);
        await sock.sendMessage(jid, {
          text: `✅ *Menu video updated.*\n\n${url}\n\nUse *.menu* to preview it. The setting will survive restarts.`
        });
      } catch (err) {
        await sock.sendMessage(jid, {
          text: `❌ That link could not be validated as a direct video.\n\n${err.message}\n\nUse a direct video file URL, not an HTML page.`
        });
      }
    })
  },

  clearmenuvideo: {
    category: 'owner', desc: 'Remove the remote menu video',
    usage: '.clearmenuvideo', aliases: ['resetmenuvideo'], permissions: 'owner',
    examples: ['.clearmenuvideo'],
    exec: ownerOnly(async (args, sock, jid) => {
      db.setSetting('menuVideoUrl', '');
      await sock.sendMessage(jid, { text: '✅ Remote menu video cleared. The menu image or local fallback will be used.' });
    })
  },

  clearmenuimage: {
    category: 'owner', desc: 'Remove the remote menu image',
    usage: '.clearmenuimage', aliases: ['resetmenuimage'], permissions: 'owner',
    examples: ['.clearmenuimage'],
    exec: ownerOnly(async (args, sock, jid) => {
      db.setSetting('menuImageUrl', '');
      await sock.sendMessage(jid, { text: '✅ Remote menu image cleared. The local menu image fallback will be used.' });
    })
  },

  addsudo: {
    category: 'owner', desc: 'Allow a user to use the bot while private mode is enabled',
    usage: '.addsudo <number> (or mention/reply)', aliases: ['sudoadd'], permissions: 'owner',
    examples: ['.addsudo 2348012345678', '.addsudo @2348012345678'],
    exec: ownerOnly(async (args, sock, jid, isGroup, sender, message, botConfig) => {
      const target = targetUserJid(args, message);
      if (!target) return sock.sendMessage(jid, { text: '❌ Usage: .addsudo <number> or mention/reply to a user.' });
      const settingsJid = ownerSettingsJid(botConfig, sender);
      const users = getSudoUsers(botConfig, sender);
      if (!users.includes(target)) users.push(target);
      db.setOwnerSetting(settingsJid, 'sudoUsers', users);
      await sock.sendMessage(jid, { text: `✅ Sudo access granted to *${target.split('@')[0]}*.` });
    })
  },

  delsudocommands: {
    category: 'owner', desc: 'Remove delegated private-mode access from a user',
    usage: '.delsudocommands <number> (or mention/reply)', aliases: ['delsudocommans', 'delsudo', 'sudooff'], permissions: 'owner',
    examples: ['.delsudocommands 2348012345678', '.delsudocommans @2348012345678'],
    exec: ownerOnly(async (args, sock, jid, isGroup, sender, message, botConfig) => {
      const target = targetUserJid(args, message);
      if (!target) return sock.sendMessage(jid, { text: '❌ Usage: .delsudocommands <number> or mention/reply to a user.' });
      const settingsJid = ownerSettingsJid(botConfig, sender);
      const users = getSudoUsers(botConfig, sender);
      db.setOwnerSetting(settingsJid, 'sudoUsers', users.filter(user => user !== target));
      await sock.sendMessage(jid, { text: `✅ Sudo access removed from *${target.split('@')[0]}*.` });
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
      await applyBotMode(m, sock, jid, botConfig);
    })
  },

  public: {
    category: 'owner', desc: 'Enable public mode',
    usage: '.public', aliases: [], permissions: 'owner',
    examples: ['.public'],
    exec: ownerOnly(async (args, sock, jid, isGroup, sender, message, botConfig) => {
      await applyBotMode('public', sock, jid, botConfig);
    })
  },

  private: {
    category: 'owner', desc: 'Enable private mode',
    usage: '.private', aliases: [], permissions: 'owner',
    examples: ['.private'],
    exec: ownerOnly(async (args, sock, jid, isGroup, sender, message, botConfig) => {
      await applyBotMode('private', sock, jid, botConfig);
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
