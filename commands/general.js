'use strict';
// commands/general.js — General utility commands for Kira MD
const db = require('../lib/database');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { getMessageContext, getMentionedJid, commandErrorMessage } = require('../lib/helpers');

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

  hidetag: {
    category: 'group', desc: 'Mention all group members without displaying the tag list',
    usage: '.hidetag [message]', aliases: ['silenttag'], permissions: 'admin',
    chatType: 'group',
    examples: ['.hidetag Important announcement'],
    exec: async (args, sock, jid, isGroup) => {
      if (!isGroup) return sock.sendMessage(jid, { text: '❌ This command only works in groups.' });
      try {
        const meta = await sock.groupMetadata(jid);
        const participants = (meta.participants || []).map(p => p.id || p.jid).filter(Boolean);
        if (!participants.length) return sock.sendMessage(jid, { text: '❌ No group members were found.' });
        const body = args.join(' ').trim() || '⁣';
        await sock.sendMessage(jid, { text: body, mentions: participants });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('hidetag', err, { jid }) });
      }
    }
  },

  device: {
    category: 'utility', desc: 'Reveal the device and account type from a replied message',
    usage: '.device (reply to a user message)', aliases: ['checkdevice'], permissions: 'owner',
    examples: ['.device (reply to a user message)'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig, chatContext) => {
      const quoted = message?.message?.extendedTextMessage?.contextInfo;
      if (!chatContext?.isOwner) {
        return sock.sendMessage(jid, {
          text: '𐀪𐀪 *KIRA-MD:* Owner only.'
        }, { quoted: message });
      }
      if (!quoted || !quoted.stanzaId || !quoted.participant) {
        return sock.sendMessage(jid, {
          text: '𐀪𐀪 *KIRA-MD:* Reply to a user’s recent message to reveal their device.'
        }, { quoted: message });
      }

      const quotedId = String(quoted.stanzaId);
      const userJid = quoted.participant;
      let device = 'I O S';
      if (quotedId.startsWith('3EB0')) device = 'W A - W E B';
      else if (quotedId.startsWith('BAE5')) device = 'A N D R O I D';
      else if (quotedId.startsWith('BAE9')) device = 'I O S';
      else if (quotedId.length > 21) device = 'A N D R O I D';

      let accountType = 'P E R S O N A L';
      try {
        if (typeof sock.getBusinessProfile === 'function') {
          const bizProfile = await sock.getBusinessProfile(userJid);
          if (bizProfile && (bizProfile.description || bizProfile.category || bizProfile.address || bizProfile.website)) {
            accountType = 'B U S I N E S S';
          }
        }
      } catch (_) {
        // Non-business accounts commonly reject this lookup; keep PERSONAL.
      }

      const text =
        `╭─❖ *KIRA-MD DEVICE REPORT* ❖─╮\n` +
        `│\n` +
        `│ 📱 Device  : *${device}*\n` +
        `│ 💼 Account : *${accountType}*\n` +
        `│ 👤 User    : @${userJid.split('@')[0].split(':')[0]}\n` +
        `│\n` +
        `╰─ Powered by *Victory Tech™* ─╯`;
      return sock.sendMessage(jid, {
        text,
        mentions: [userJid]
      }, { quoted: message });
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
