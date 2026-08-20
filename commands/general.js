'use strict';
// commands/general.js — General utility commands for Kira MD
const db = require('../lib/database');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { getMessageContext, commandErrorMessage } = require('../lib/helpers');

function getCtx(message) {
  return getMessageContext(message);
}

const generalCommands = {

  vv: {
    category: 'owner',
    desc: 'Reveal a view-once image, video, or voice note (reply to it)',
    usage: '.vv', aliases: ['viewonce', 'vv2'],
    permissions: 'owner',
    examples: ['.vv (reply to a view-once message)'],
    exec: async (args, sock, jid, isGroup, sender, message) => {
      const ctx    = getCtx(message);
      const quoted = ctx?.quotedMessage;

      if (!quoted) {
        return sock.sendMessage(jid, {
          text: `👁️ *View Once Revealer*\n\nReply to a *view-once* image or video with *.vv* to reveal it.`
        });
      }

      const voMsg =
        quoted.viewOnceMessage?.message          ||
        quoted.viewOnceMessageV2?.message         ||
        quoted.viewOnceMessageV2Extension?.message;

      const imgMsg   = voMsg?.imageMessage   || quoted.imageMessage;
      const videoMsg = voMsg?.videoMessage   || quoted.videoMessage;
      const audioMsg = voMsg?.audioMessage   || quoted.audioMessage;

      if (!imgMsg && !videoMsg && !audioMsg) {
        return sock.sendMessage(jid, {
          text: `❌ The replied message doesn't contain a view-once image, video, or voice note.\n\n_Make sure you are replying directly to the view-once message._`
        });
      }

      const fakeMsg = {
        key: {
          remoteJid:   ctx.remoteJid || jid,
          id:          ctx.stanzaId || message.key.id,
          participant: ctx.participant || message.key.participant,
          fromMe:      false
        },
        message: voMsg || quoted
      };

      const reuploaderCtx = { reuploadRequest: sock.updateMediaMessage };

      try {
        if (imgMsg) {
          const buffer = await downloadMediaMessage(fakeMsg, 'buffer', reuploaderCtx);
          await sock.sendMessage(jid, { image: buffer, caption: `👁️ *View Once Revealed*` });
        } else if (videoMsg) {
          const buffer = await downloadMediaMessage(fakeMsg, 'buffer', reuploaderCtx);
          await sock.sendMessage(jid, { video: buffer, caption: `👁️ *View Once Revealed*` });
        } else if (audioMsg) {
          const buffer = await downloadMediaMessage(fakeMsg, 'buffer', reuploaderCtx);
          await sock.sendMessage(jid, { audio: buffer, mimetype: 'audio/ogg; codecs=opus', ptt: true });
        }
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('reveal view-once', err, { jid }) });
      }
    }
  },

  stealsticker: {
    category: 'general',
    desc: 'Steal a sticker from another bot or group (reply to sticker)',
    usage: '.stealsticker', aliases: ['steal', 'getsticker'],
    permissions: 'all',
    examples: ['.stealsticker (reply to a sticker)'],
    exec: async (args, sock, jid, isGroup, sender, message) => {
      const ctx    = getCtx(message);
      const quoted = ctx?.quotedMessage;
      if (!quoted?.stickerMessage) {
        return sock.sendMessage(jid, { text: `🎭 Reply to a *sticker* with *.stealsticker* to save it.` });
      }
      try {
        const fakeMsg = {
          key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant, fromMe: false },
          message: quoted
        };
        const buf = await downloadMediaMessage(fakeMsg, 'buffer', { reuploadRequest: sock.updateMediaMessage });
        await sock.sendMessage(jid, { sticker: buf });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('steal sticker', err, { jid }) });
      }
    }
  },

  tagall: {
    category: 'group', desc: 'Tag all members in the group',
    usage: '.tagall [message]', aliases: ['mentionall', 'everyone', 'all'], permissions: 'admin',
    chatType: 'group',
    examples: ['.tagall Meeting at 9pm', '.tagall'],
    exec: async (args, sock, jid, isGroup) => {
      if (!isGroup) return sock.sendMessage(jid, { text: '❌ This command only works in groups.' });
      try {
        const meta = await sock.groupMetadata(jid);
        const participants = meta.participants.map(p => p.id);
        const msg = args.join(' ').trim() || '📢 *Attention everyone!*';
        const mentionText = participants.map(p => `@${p.split('@')[0]}`).join(' ');
        await sock.sendMessage(jid, {
          text: `${msg}\n\n${mentionText}`,
          mentions: participants
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('tag all members', err, { jid }) });
      }
    }
  },

  groupinfo: {
    category: 'group', desc: 'Show group information and stats',
    usage: '.groupinfo', aliases: ['ginfo', 'gstats', 'groupstats'], permissions: 'all',
    chatType: 'group',
    examples: ['.groupinfo'],
    exec: async (args, sock, jid, isGroup) => {
      if (!isGroup) return sock.sendMessage(jid, { text: '❌ This command only works in groups.' });
      try {
        const meta    = await sock.groupMetadata(jid);
        const admins  = meta.participants.filter(p => p.admin).length;
        const created = meta.creation ? new Date(meta.creation * 1000).toLocaleDateString('en-GB') : 'Unknown';
        await sock.sendMessage(jid, {
          text:
            `╔═══〔 👥 *Group Info* 〕═══╗\n` +
            `║  📝 Name    : ${meta.subject}\n` +
            `║  👤 Members : ${meta.participants.length}\n` +
            `║  👑 Admins  : ${admins}\n` +
            `║  📅 Created : ${created}\n` +
            `║  🆔 ID      : ${jid.split('@')[0]}\n` +
            `╚══════════════════════╝`
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('get group info', err, { jid }) });
      }
    }
  },

  members: {
    category: 'group', desc: 'List all group members',
    usage: '.members', aliases: ['memberlist'], permissions: 'all',
    chatType: 'group',
    examples: ['.members'],
    exec: async (args, sock, jid, isGroup) => {
      if (!isGroup) return sock.sendMessage(jid, { text: '❌ This command only works in groups.' });
      try {
        const meta    = await sock.groupMetadata(jid);
        const members = meta.participants;
        const lines   = members.map((p, i) =>
          `${i + 1}. @${p.id.split('@')[0]}${p.admin ? ' 👑' : ''}`
        ).join('\n');
        await sock.sendMessage(jid, {
          text: `👥 *Members (${members.length})*\n\n${lines}`,
          mentions: members.map(p => p.id)
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('list group members', err, { jid }) });
      }
    }
  },

  runtime: {
    category: 'utility', desc: 'Show bot runtime and memory info',
    usage: '.runtime', aliases: ['sysinfo'], permissions: 'all',
    examples: ['.runtime'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      const cfg   = botConfig || global.botConfig || {};
      const mem   = process.memoryUsage();
      const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
      const rssMB  = Math.round(mem.rss       / 1024 / 1024);
      const s      = Math.floor((Date.now() - (global.botStartTime || Date.now())) / 1000);
      const d      = Math.floor(s / 86400);
      const h      = Math.floor((s % 86400) / 3600);
      const m      = Math.floor((s % 3600) / 60);
      const sec    = s % 60;
      const uptime = [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${sec}s`].filter(Boolean).join(' ');
      await sock.sendMessage(jid, {
        text:
          `┏━━〔 ⚙️ *Runtime Info* 〕━━┓\n` +
          `┃  🤖 Bot      : KIRA-MD\n` +
          `┃  🏷️  Version  : v1.0.0\n` +
          `┃  ⏱️  Uptime   : ${uptime}\n` +
          `┃  💾 Heap     : ${heapMB} MB\n` +
          `┃  📦 RSS      : ${rssMB} MB\n` +
          `┃  🔧 Node.js  : ${process.version}\n` +
          `┃  🖥️  Platform : ${process.platform}\n` +
          `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`
      });
    }
  }
};

module.exports = generalCommands;
