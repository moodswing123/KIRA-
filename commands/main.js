'use strict';
// commands/main.js — Menu, ping, alive, help for Kira MD
const fs   = require('fs');
const path = require('path');
const db   = require('../lib/database');

const MENU_IMAGE_PNG  = path.join(__dirname, '..', 'assets', 'menu.png');
const MENU_IMAGE_JPG  = path.join(__dirname, '..', 'assets', 'menu.jpg');
const LOCAL_MENU_IMAGE_PATH = fs.existsSync(MENU_IMAGE_PNG) ? MENU_IMAGE_PNG : (fs.existsSync(MENU_IMAGE_JPG) ? MENU_IMAGE_JPG : null);

function getMenuImageUrl() {
  const value = db.getSetting('menuImageUrl', '');
  return /^https:\/\/[^\s]+$/i.test(String(value || '').trim()) ? String(value).trim() : '';
}

let PKG_VERSION = '1.0.0';
try { PKG_VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version || PKG_VERSION; } catch (_) {}

let _lastPing = null;
function getUptime() {
  const s   = Math.floor((Date.now() - (global.botStartTime || Date.now())) / 1000);
  const d   = Math.floor(s / 86400);
  const h   = Math.floor((s % 86400) / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${sec}s`].filter(Boolean).join(' ');
}
function getMemMB() { return Math.round(process.memoryUsage().heapUsed / 1024 / 1024); }
function fmtPing(ms) { return ms == null ? '—' : `${ms} ms`; }

const CATEGORY_META = {
  moderation: { label: '🛡️ Admin' },
  ai:         { label: '🤖 AI' },
  audio:      { label: '🎵 Audio' },
  downloader: { label: '📥 Downloader' },
  fun:        { label: '🎉 Fun' },
  games:      { label: '🎮 Games' },
  group:      { label: '👥 Group' },
  general:    { label: '🔧 General' },
  economy:    { label: '💰 Economy' },
  owner:      { label: '👑 Owner' },
  search:     { label: '🔍 Search' },
  converter:  { label: '🔄 Converter' },
  sticker:    { label: '🛠️ Tools' },
  utility:    { label: '⚙️ Utility' },
  movies:     { label: '🎬 Movies' },
  anime:      { label: '🌸 Anime' },
  sports:     { label: '⚽ Sports' },
  religion:   { label: '📖 Religion' },
  canvas:     { label: '🖼️ Canvas' },
};

function buildMainMenu(cfg, allCmds, catReg, catOrder) {
  const prefix = cfg?.prefix || '.';
  const botName = cfg?.name || 'KIRA-MD';
  const owner = cfg?.ownerName || 'Victory Tech';
  const ownerNumber = cfg?.ownerNumber || '';
  const mode = String(cfg?.mode || 'public').toLowerCase();
  const modeCap = mode.charAt(0).toUpperCase() + mode.slice(1);
  const total = allCmds ? (allCmds.primaryNames?.length || Object.keys(allCmds).length) : 0;
  const order = catOrder || Object.keys(catReg);
  const cats = order.filter(category => catReg[category]?.length);
  const modeMark = mode === 'public' ? '● PUBLIC' : '◉ PRIVATE';

  let out =
    `╭━━━━━━━━━━━━━━━━━━━━━━╮\n` +
    `┃   ✦ *${botName} COMMAND CENTER* ✦\n` +
    `┃   _Your smart WhatsApp assistant_\n` +
    `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
    `╭─〔 *BOT PROFILE* 〕────────╮\n` +
    `│ 👑 Owner   : ${owner}\n` +
    `│ ⚡ Commands: ${total}\n` +
    `│ 🔖 Prefix  : ${prefix}\n` +
    `│ ◈ Mode     : ${modeMark}\n` +
    `│ ⏱ Uptime   : ${getUptime()}\n` +
    `│ ◇ Version  : v${PKG_VERSION}\n` +
    `╰──────────────────────────╯\n\n` +
    `╭─〔 *QUICK ACCESS* 〕───────╮\n` +
    `│ ${prefix}menu\n` +
    `│ ${prefix}help <command>\n` +
    `│ ${prefix}ping\n` +
    `│ ${prefix}info\n` +
    `╰──────────────────────────╯\n`;

  let section = 0;
  for (const category of cats) {
    const names = [...new Set(catReg[category])].sort();
    const meta = CATEGORY_META[category] || { label: category.charAt(0).toUpperCase() + category.slice(1) };
    const entries = names
      .map(name => ({ name, cmd: allCmds[name] }))
      .filter(({ cmd }) => cmd?.desc);
    if (!entries.length) continue;
    section += 1;

    out += `\n╭─〔 ${String(section).padStart(2, '0')} · *${meta.label}* 〕\n`;
    for (const { name, cmd } of entries) {
      // Keep the command itself on a dedicated line; aliases are intentionally
      // omitted here so the menu remains clean. Use .help for full details.
      out += `│\n│  ✧ *${prefix}${name}*\n│    ${cmd.desc}\n`;
    }
    out += `╰──────────────────────────╯\n`;
  }

  out +=
    `\n╭━━━━━━━━━━━━━━━━━━━━━━╮\n` +
    `┃  ✦ *HOW TO USE KIRA*\n` +
    `┃  Type a command with the prefix *${prefix}*\n` +
    `┃  Example: *${prefix}help play*\n` +
    `┃  Mode: *${modeCap}*\n` +
    `┃  Support: ${ownerNumber ? `https://wa.me/${ownerNumber}` : 'Owner not configured'}\n` +
    `╰━━━━━━━━━━━━━━━━━━━━━━╯\n` +
    `_Professional automation • Powered by Victory Tech™_`;
  return out;
}

const mainCommands = {
  menu: {
    category: 'general', desc: 'Show full command menu',
    usage: '.menu', aliases: ['commands', 'list'], permissions: 'all',
    examples: ['.menu'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      const cfg     = botConfig || global.botConfig || {};
      const allCmds = require('./index');
      const catReg  = allCmds.categoryRegistry || {};
      const catOrder = allCmds.CATEGORY_ORDER || [];
      const text    = buildMainMenu(cfg, allCmds, catReg, catOrder);

      const remoteImage = getMenuImageUrl();
      if (remoteImage) {
        await sock.sendMessage(jid, {
          image:   { url: remoteImage },
          caption: text
        });
      } else if (LOCAL_MENU_IMAGE_PATH && fs.existsSync(LOCAL_MENU_IMAGE_PATH)) {
        await sock.sendMessage(jid, {
          image:   fs.readFileSync(LOCAL_MENU_IMAGE_PATH),
          caption: text
        });
      } else {
        await sock.sendMessage(jid, { text });
      }
    }
  },

  ping: {
    category: 'general', desc: 'Check bot response speed',
    usage: '.ping', aliases: ['speed', 'test'], permissions: 'all',
    examples: ['.ping'],
    exec: async (args, sock, jid) => {
      const start = Date.now();
      const sent  = await sock.sendMessage(jid, { text: '🏓 *Pong!*\n\n_Measuring latency..._' });
      const ms    = Date.now() - start;
      _lastPing   = ms;
      const bar   = ms < 200 ? '🟢 Excellent' : ms < 500 ? '🟡 Good' : '🔴 High';
      await sock.sendMessage(jid, { text: `🏓 *Pong!*\n\n⚡ Ping: *${ms} ms*\n📶 Status: ${bar}` });
    }
  },

  alive: {
    category: 'general', desc: 'Check if bot is running',
    usage: '.alive', aliases: ['bot', 'check'], permissions: 'all',
    examples: ['.alive'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      const cfg = botConfig || global.botConfig || {};
      await sock.sendMessage(jid, {
        text:
          `╔═══〔 🤖 *KIRA-MD* 〕═══╗\n` +
          `║  ✅ Bot is *Online & Active*\n` +
          `║  ⏱️  Uptime  : ${getUptime()}\n` +
          `║  💾 Memory  : ${getMemMB()} MB\n` +
          `║  🚀 Ping    : ${fmtPing(_lastPing)}\n` +
          `║  👑 Owner   : ${cfg.ownerName || 'Victory Tech'}\n` +
          `║  🔖 Prefix  : ${cfg.prefix || '.'}\n` +
          `║  🌟 Version : v${PKG_VERSION}\n` +
          `╚══════════════════════╝\n\n` +
          `_Powered by Victory Tech™_`
      });
    }
  },

  help: {
    category: 'general', desc: 'Get help for a specific command',
    usage: '.help <command>', aliases: [], permissions: 'all',
    examples: ['.help tiktok', '.help ai'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      const cfg     = botConfig || global.botConfig || {};
      const prefix  = cfg.prefix || '.';
      const name    = args[0]?.toLowerCase();
      if (!name) {
        return sock.sendMessage(jid, {
          text: `❓ *Help*\n\nUsage: *${prefix}help <command>*\nExample: *${prefix}help tiktok*\n\nType *${prefix}menu* to see all commands.`
        });
      }
      const allCmds = require('./index');
      const cmd     = allCmds[name];
      if (!cmd) {
        return sock.sendMessage(jid, { text: `❌ Command *${prefix}${name}* not found.\n\nType *${prefix}menu* to see all commands.` });
      }
      let out =
        `📖 *Help — ${prefix}${name}*\n\n` +
        `📝 *Description:* ${cmd.desc || '—'}\n` +
        `📌 *Usage:* ${cmd.usage || `${prefix}${name}`}\n` +
        `🏷️  *Category:* ${cmd.category || 'utility'}\n` +
        `🔒 *Permission:* ${cmd.permissions || 'all'}\n`;
      if (cmd.aliases?.length) out += `🔀 *Aliases:* ${cmd.aliases.map(a => `${prefix}${a}`).join(', ')}\n`;
      if (cmd.examples?.length) out += `\n💡 *Examples:*\n${cmd.examples.map(e => `• ${e}`).join('\n')}`;
      await sock.sendMessage(jid, { text: out });
    }
  },

  info: {
    category: 'general', desc: 'Show bot information',
    usage: '.info', aliases: ['about', 'botinfo'], permissions: 'all',
    examples: ['.info'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      const cfg = botConfig || global.botConfig || {};
      const ownerNumber = cfg.ownerNumber || '';
      await sock.sendMessage(jid, {
        text:
          `╔═══〔 ℹ️ *Bot Info* 〕═══╗\n` +
          `║  🤖 Name    : KIRA-MD\n` +
          `║  👑 Owner   : ${cfg.ownerName || 'Victory Tech'}\n` +
          `║  🌟 Version : v${PKG_VERSION}\n` +
          `║  📦 Commands: ${(require('./index').primaryNames?.length || Object.keys(require('./index')).length)}+\n` +
          `║  🔖 Prefix  : ${cfg.prefix || '.'}\n` +
          `║  🔒 Mode    : ${cfg.mode || 'public'}\n` +
          `║  ⏱️  Uptime  : ${getUptime()}\n` +
          `╚══════════════════════╝\n\n` +
           `🌐 *Powered by Victory Tech™*\n` +
           `📞 Support: ${ownerNumber ? `https://wa.me/${ownerNumber}` : 'Owner number is not configured'}`
      });
    }
  },

  support: {
    category: 'general', desc: 'Get support — contact owner directly',
    usage: '.support', aliases: ['contact', 'help2', 'dm'], permissions: 'all',
    examples: ['.support'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      const ownerNumber = (botConfig || global.botConfig || {}).ownerNumber;
      await sock.sendMessage(jid, {
        text:
          `╔═══〔 📞 *Support* 〕═══╗\n` +
          `║\n` +
          `║  Need help? Contact the owner:\n` +
          `║\n` +
          `║  👤 *Victory Tech*\n` +
           `║  🔗 ${ownerNumber ? `https://wa.me/${ownerNumber}` : 'Owner number is not configured'}\n` +
          `║\n` +
          `║  Click the link above to open\n` +
          `║  a chat directly with the owner.\n` +
          `║\n` +
          `╚══════════════════════╝\n\n` +
          `_Kira MD — Powered by Victory Tech™_`
      });
    }
  },

  time: {
    category: 'utility', desc: 'Show current date and time',
    usage: '.time', aliases: ['date', 'clock'], permissions: 'all',
    examples: ['.time'],
    exec: async (args, sock, jid) => {
      const now = new Date();
      await sock.sendMessage(jid, {
        text:
          `╔══〔 🕐 *Time* 〕══╗\n` +
          `┃ 📅 Date     : ${now.toLocaleDateString('en-GB')}\n` +
          `┃ 🕐 Time     : ${now.toLocaleTimeString()}\n` +
          `┃ 🌍 Timezone : ${Intl.DateTimeFormat().resolvedOptions().timeZone}\n` +
          `╚══════════════════╝`
      });
    }
  },

  uptime: {
    category: 'general', desc: 'Show how long the bot has been running',
    usage: '.uptime', aliases: [], permissions: 'all',
    examples: ['.uptime'],
    exec: async (args, sock, jid) => {
      await sock.sendMessage(jid, { text: `⏱️ *Uptime:* ${getUptime()}` });
    }
  },

  status: {
    category: 'utility', desc: 'Full bot status report',
    usage: '.status', aliases: [], permissions: 'all',
    examples: ['.status'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      const cfg   = botConfig || global.botConfig || {};
      const stats = db.stats();
      const registry = require('./index');
      const total = registry.primaryNames?.length || Object.keys(registry).length;
      await sock.sendMessage(jid, {
        text:
          `┏━━〔 🟢 *Bot Status* 〕━━┓\n` +
          `┃ ⏱️  Uptime    : ${getUptime()}\n` +
          `┃ 🚀 Ping      : ${fmtPing(_lastPing)}\n` +
          `┃ 💾 Memory    : ${getMemMB()} MB\n` +
          `┃ 🔒 Mode      : ${cfg.mode || 'public'}\n` +
          `┃ 📦 Commands  : ${total}\n` +
          `┃ ─────────────────────\n` +
          `┃ 👤 Users     : ${stats.users}\n` +
          `┃ 👥 Groups    : ${stats.groups}\n` +
          `┃ 🚫 Banned    : ${stats.banned}\n` +
          `┗━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
          `_Kira MD — Powered by Victory Tech™_`
      });
    }
  }
};

module.exports = mainCommands;
