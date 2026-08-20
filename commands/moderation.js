'use strict';
// commands/moderation.js — Warn, ban, welcome/goodbye configuration
const fs   = require('fs');
const path = require('path');
const db   = require('../lib/database');
const {
  getMentionedJid,
  isGroupAdmin,
  resolveIsOwner,
  getMessageContext,
  commandErrorMessage
} = require('../lib/helpers');

const IMAGES_DIR = path.join(__dirname, '../data/group_images');
fs.mkdirSync(IMAGES_DIR, { recursive: true });

async function saveGroupImage(sock, jid, message, type) {
  const context = getMessageContext(message);
  const quotedMsg = context?.quotedMessage;
  const imgMsg = quotedMsg?.imageMessage || message.message?.imageMessage;
  if (!imgMsg) return sock.sendMessage(jid, { text: `❌ Reply to an image with .set${type}image` });
  try {
    const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
    const stream = await downloadContentFromMessage(imgMsg, 'image');
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer  = Buffer.concat(chunks);
    const groupId = jid.replace(/@.*/g, '');
    const imgPath = path.join(IMAGES_DIR, `${type}_${groupId}.jpg`);
    fs.writeFileSync(imgPath, buffer);
    await sock.sendMessage(jid, { text: `✅ Custom ${type} image saved!` });
  } catch (err) {
    await sock.sendMessage(jid, { text: commandErrorMessage(`set ${type} image`, err, { jid }) });
  }
}

function deleteGroupImage(jid, type) {
  const groupId = jid.replace(/@.*/g, '');
  const imgPath = path.join(IMAGES_DIR, `${type}_${groupId}.jpg`);
  try { if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath); } catch {}
}

async function requireAdmin(sock, jid, isGroup, sender, message, botConfig) {
  if (!isGroup) { await sock.sendMessage(jid, { text: '❌ This command only works in groups.' }); return false; }
  if (resolveIsOwner(message, sender, botConfig)) return true;
  if (!await isGroupAdmin(sock, jid, sender)) {
    await sock.sendMessage(jid, { text: '❌ Only group admins can use this command.' }); return false;
  }
  return true;
}

const moderationCommands = {
  warn: {
    category: 'moderation', desc: 'Issue a warning to a member',
    usage: '.warn @user [reason]', aliases: [], permissions: 'admin',
    examples: ['.warn @user Spamming'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      if (!await requireAdmin(sock, jid, isGroup, sender, message, botConfig)) return;
      const target = getMentionedJid(message);
      if (!target) return sock.sendMessage(jid, { text: '❌ Usage: .warn @user [reason]' });
      const reason   = args.filter(a => !a.startsWith('@')).join(' ') || 'No reason given';
      const count    = db.addWarning(target);
      const settings = db.getGroup(jid);
      const maxWarn  = settings.maxWarnings || 3;
      let extra = '';
      if (count >= maxWarn) {
        try { await sock.groupParticipantsUpdate(jid, [target], 'remove'); extra = `\n\n🚫 Reached ${maxWarn} warnings — *kicked*.`; db.clearWarnings(target); }
        catch (err) {
          commandErrorMessage('warn kick', err, { jid });
          extra = '\n\n⚠️ Could not complete the automatic moderation action.';
        }
      }
      await sock.sendMessage(jid, {
        text: `⚠️ *Warning Issued*\n\n👤 User   : @${target.split('@')[0]}\n📝 Reason : ${reason}\n🔢 Count  : ${count}/${maxWarn}${extra}`,
        mentions: [target]
      });
    }
  },

  unwarn: {
    category: 'moderation', desc: 'Clear all warnings for a member',
    usage: '.unwarn @user', aliases: ['clearwarns'], permissions: 'admin',
    examples: ['.unwarn @user'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      if (!await requireAdmin(sock, jid, isGroup, sender, message, botConfig)) return;
      const target = getMentionedJid(message);
      if (!target) return sock.sendMessage(jid, { text: '❌ Usage: .unwarn @user' });
      db.clearWarnings(target);
      await sock.sendMessage(jid, {
        text: `✅ Warnings cleared for @${target.split('@')[0]}`, mentions: [target]
      });
    }
  },

  ban: {
    category: 'moderation', desc: 'Ban a user from using the bot',
    usage: '.ban @user', aliases: [], permissions: 'admin',
    examples: ['.ban @user'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      if (!await requireAdmin(sock, jid, isGroup, sender, message, botConfig)) return;
      const target = getMentionedJid(message);
      if (!target) return sock.sendMessage(jid, { text: '❌ Usage: .ban @user' });
      db.banUser(target);
      await sock.sendMessage(jid, {
        text: `🚫 @${target.split('@')[0]} has been *banned* from using the bot.`, mentions: [target]
      });
    }
  },

  unban: {
    category: 'moderation', desc: 'Unban a user',
    usage: '.unban @user', aliases: [], permissions: 'admin',
    examples: ['.unban @user'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      if (!await requireAdmin(sock, jid, isGroup, sender, message, botConfig)) return;
      const target = getMentionedJid(message);
      if (!target) return sock.sendMessage(jid, { text: '❌ Usage: .unban @user' });
      db.unbanUser(target);
      await sock.sendMessage(jid, {
        text: `✅ @${target.split('@')[0]} has been *unbanned*.`, mentions: [target]
      });
    }
  },

  setwelcome: {
    category: 'moderation', desc: 'Set a custom welcome message',
    usage: '.setwelcome <message>', aliases: [], permissions: 'admin',
    examples: ['.setwelcome Welcome {name} to {group}!'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      if (!await requireAdmin(sock, jid, isGroup, sender, message, botConfig)) return;
      const text = args.join(' ').trim();
      if (!text) return sock.sendMessage(jid, { text: '❌ Provide a welcome message. Use {name} for username, {group} for group name.' });
      db.updateGroup(jid, { sWelcome: text, welcome: true });
      await sock.sendMessage(jid, {
        text: `✅ *Custom welcome message set!*\n\n_"${text}"_\n\nWelcome messages are now *enabled*.`
      });
    }
  },

  setgoodbye: {
    category: 'moderation', desc: 'Set a custom goodbye message',
    usage: '.setgoodbye <message>', aliases: [], permissions: 'admin',
    examples: ['.setgoodbye Goodbye {name}, we\'ll miss you!'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      if (!await requireAdmin(sock, jid, isGroup, sender, message, botConfig)) return;
      const text = args.join(' ').trim();
      if (!text) return sock.sendMessage(jid, { text: '❌ Provide a goodbye message. Use {name} for username.' });
      db.updateGroup(jid, { sGoodbye: text, goodbye: true });
      await sock.sendMessage(jid, { text: `✅ *Custom goodbye message set!*\n\n_"${text}"_` });
    }
  },

  setwelcomeimage: {
    category: 'moderation', desc: 'Set a custom welcome image (reply to image)',
    usage: '.setwelcomeimage', aliases: [], permissions: 'admin',
    examples: ['.setwelcomeimage (reply to an image)'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      if (!await requireAdmin(sock, jid, isGroup, sender, message, botConfig)) return;
      await saveGroupImage(sock, jid, message, 'welcome');
    }
  },

  setgoodbyeimage: {
    category: 'moderation', desc: 'Set a custom goodbye image (reply to image)',
    usage: '.setgoodbyeimage', aliases: [], permissions: 'admin',
    examples: ['.setgoodbyeimage (reply to an image)'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      if (!await requireAdmin(sock, jid, isGroup, sender, message, botConfig)) return;
      await saveGroupImage(sock, jid, message, 'goodbye');
    }
  },

  del: {
    category: 'moderation', desc: 'Delete a message (reply to it)',
    usage: '.del', aliases: ['delete', 'unsend'], permissions: 'admin_or_owner',
    chatType: 'both',
    examples: ['.del (reply to message to delete)'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      if (isGroup) {
        if (!await requireAdmin(sock, jid, isGroup, sender, message, botConfig)) return;
      } else {
        if (!resolveIsOwner(message, sender, botConfig)) {
          return sock.sendMessage(jid, { text: '❌ Only the owner can delete messages in DMs.' });
        }
      }

      const context = getMessageContext(message);
      const stanzaId = context?.stanzaId;
      const participant = context?.quotedParticipant;

      if (!stanzaId) {
        return sock.sendMessage(jid, { text: '❌ Reply to the message you want to delete, then type .del' });
      }

      const stripJid = id => (id || '').replace(/^\+/, '').replace(/[:@].*/g, '');
      const botNum   = stripJid(sock.user?.id);
      const quotedBy = stripJid(participant);
      const fromMe   = Boolean(botNum && quotedBy && botNum === quotedBy);

      const deleteKey = {
        remoteJid:  jid,
        id:         stanzaId,
        fromMe,
        ...(isGroup && participant ? { participant } : {})
      };

      try {
        await sock.sendMessage(jid, { delete: deleteKey });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('delete message', err, { jid }) });
      }
    }
  }
};

module.exports = moderationCommands;
