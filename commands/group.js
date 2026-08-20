'use strict';
// commands/group.js — Group management + protection toggles
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const db = require('../lib/database');
const {
  getMentionedJid,
  isGroupAdmin,
  normalizeJid,
  toggleEmoji,
  resolveIsOwner,
  commandErrorMessage
} = require('../lib/helpers');

async function requireAdmin(sock, jid, isGroup, sender, message, botConfig) {
  if (!isGroup) {
    await sock.sendMessage(jid, { text: '❌ This command only works in groups.' });
    return false;
  }
  if (resolveIsOwner(message, sender, botConfig)) return true;
  const admin = await isGroupAdmin(sock, jid, sender);
  if (!admin) {
    await sock.sendMessage(jid, { text: '❌ Only group admins can use this command.' });
    return false;
  }
  return true;
}

function makeToggle(fieldKey, label, emoji) {
  return {
    category: 'group', desc: `Toggle ${label} on/off`,
    usage: `.${fieldKey}`, aliases: [], permissions: 'admin',
    examples: [`.${fieldKey}`],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      if (!await requireAdmin(sock, jid, isGroup, sender, message, botConfig)) return;
      const val = db.toggleGroup(jid, fieldKey);
      await sock.sendMessage(jid, { text: `${emoji} ${label}: ${val ? '✅ Enabled' : '❌ Disabled'}` });
    }
  };
}

const groupCommands = {

  promote: {
    category: 'group', desc: 'Promote a member to admin',
    usage: '.promote @user', aliases: [], permissions: 'admin',
    requiresBotAdmin: true,
    examples: ['.promote @user'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      if (!await requireAdmin(sock, jid, isGroup, sender, message, botConfig)) return;
      const target = getMentionedJid(message);
      if (!target) return sock.sendMessage(jid, { text: '❌ Usage: .promote @user' });
      try {
        await sock.groupParticipantsUpdate(jid, [target], 'promote');
        await sock.sendMessage(jid, {
          text: `⬆️ @${target.split('@')[0]} promoted to *admin*!`, mentions: [target]
        });
      } catch (err) { await sock.sendMessage(jid, { text: commandErrorMessage('promote', err, { jid }) }); }
    }
  },

  demote: {
    category: 'group', desc: 'Demote an admin to member',
    usage: '.demote @user', aliases: [], permissions: 'admin',
    requiresBotAdmin: true,
    examples: ['.demote @user'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      if (!await requireAdmin(sock, jid, isGroup, sender, message, botConfig)) return;
      const target = getMentionedJid(message);
      if (!target) return sock.sendMessage(jid, { text: '❌ Usage: .demote @user' });
      try {
        await sock.groupParticipantsUpdate(jid, [target], 'demote');
        await sock.sendMessage(jid, {
          text: `⬇️ @${target.split('@')[0]} has been *demoted*.`, mentions: [target]
        });
      } catch (err) { await sock.sendMessage(jid, { text: commandErrorMessage('demote', err, { jid }) }); }
    }
  },

  kick: {
    category: 'group', desc: 'Remove a member from the group',
    usage: '.kick @user', aliases: ['remove'], permissions: 'admin',
    requiresBotAdmin: true,
    examples: ['.kick @user'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      if (!await requireAdmin(sock, jid, isGroup, sender, message, botConfig)) return;
      const target = getMentionedJid(message);
      if (!target) return sock.sendMessage(jid, { text: '❌ Usage: .kick @user' });
      try {
        await sock.groupParticipantsUpdate(jid, [target], 'remove');
        await sock.sendMessage(jid, {
          text: `👢 @${target.split('@')[0]} was *removed* from the group.`, mentions: [target]
        });
      } catch (err) { await sock.sendMessage(jid, { text: commandErrorMessage('remove member', err, { jid }) }); }
    }
  },

  mute: {
    category: 'group', desc: 'Mute the group (only admins can send)',
    usage: '.mute', aliases: [], permissions: 'admin',
    requiresBotAdmin: true,
    examples: ['.mute'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      if (!await requireAdmin(sock, jid, isGroup, sender, message, botConfig)) return;
      try {
        await sock.groupSettingUpdate(jid, 'announcement');
        await sock.sendMessage(jid, { text: '🔇 *Group muted.* Only admins can send messages.' });
      } catch (err) { await sock.sendMessage(jid, { text: commandErrorMessage('mute group', err, { jid }) }); }
    }
  },

  unmute: {
    category: 'group', desc: 'Unmute the group (everyone can send)',
    usage: '.unmute', aliases: [], permissions: 'admin',
    requiresBotAdmin: true,
    examples: ['.unmute'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      if (!await requireAdmin(sock, jid, isGroup, sender, message, botConfig)) return;
      try {
        await sock.groupSettingUpdate(jid, 'not_announcement');
        await sock.sendMessage(jid, { text: '🔊 *Group unmuted.* Everyone can send messages.' });
      } catch (err) { await sock.sendMessage(jid, { text: commandErrorMessage('unmute group', err, { jid }) }); }
    }
  },

  lock: {
    category: 'group', desc: 'Lock group settings (only admins can edit)',
    usage: '.lock', aliases: [], permissions: 'admin',
    requiresBotAdmin: true,
    examples: ['.lock'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      if (!await requireAdmin(sock, jid, isGroup, sender, message, botConfig)) return;
      try {
        await sock.groupSettingUpdate(jid, 'locked');
        await sock.sendMessage(jid, { text: '🔒 *Group locked.* Only admins can edit group info.' });
      } catch (err) { await sock.sendMessage(jid, { text: commandErrorMessage('lock group', err, { jid }) }); }
    }
  },

  unlock: {
    category: 'group', desc: 'Unlock group settings (everyone can edit)',
    usage: '.unlock', aliases: [], permissions: 'admin',
    requiresBotAdmin: true,
    examples: ['.unlock'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      if (!await requireAdmin(sock, jid, isGroup, sender, message, botConfig)) return;
      try {
        await sock.groupSettingUpdate(jid, 'unlocked');
        await sock.sendMessage(jid, { text: '🔓 *Group unlocked.* Everyone can edit group info.' });
      } catch (err) { await sock.sendMessage(jid, { text: commandErrorMessage('unlock group', err, { jid }) }); }
    }
  },

  invite: {
    category: 'group', desc: 'Get the group invite link',
    usage: '.invite', aliases: ['link', 'invitelink'], permissions: 'admin',
    requiresBotAdmin: true,
    examples: ['.invite'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      if (!await requireAdmin(sock, jid, isGroup, sender, message, botConfig)) return;
      try {
        const code = await sock.groupInviteCode(jid);
        await sock.sendMessage(jid, {
          text: `🔗 *Group Invite Link*\n\nhttps://chat.whatsapp.com/${code}\n\n_Share this link to invite people to the group._`
        });
      } catch (err) { await sock.sendMessage(jid, { text: commandErrorMessage('get invite link', err, { jid }) }); }
    }
  },

  revoke: {
    category: 'group', desc: 'Revoke and reset the group invite link',
    usage: '.revoke', aliases: ['resetlink'], permissions: 'admin',
    requiresBotAdmin: true,
    examples: ['.revoke'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      if (!await requireAdmin(sock, jid, isGroup, sender, message, botConfig)) return;
      try {
        await sock.groupRevokeInvite(jid);
        await sock.sendMessage(jid, { text: '♻️ *Invite link has been revoked.* Generate a new one with .invite' });
      } catch (err) { await sock.sendMessage(jid, { text: commandErrorMessage('revoke invite link', err, { jid }) }); }
    }
  },

  welcome:    makeToggle('welcome',  'Welcome Messages', '👋'),
  goodbye:    makeToggle('goodbye',  'Goodbye Messages', '👋'),
  antispam:   makeToggle('antiSpam', 'Anti-Spam',        '🛡️'),
  antiflood:  makeToggle('antiFlood','Anti-Flood',       '🌊'),

  antilink: {
    category: 'group', desc: 'Manage anti-link protection',
    usage: '.antilink <on|off|set delete|kick|warn|status>', aliases: [], permissions: 'admin',
    examples: ['.antilink on', '.antilink off', '.antilink set kick'],
    exec: async (args, sock, jid, isGroup, sender, message, botConfig) => {
      if (!await requireAdmin(sock, jid, isGroup, sender, message, botConfig)) return;
      const prefix = (botConfig || global.botConfig || {}).prefix || '.';
      const sub = (args[0] || 'status').toLowerCase();

      if (sub === 'status') {
        const g = db.getGroup(jid);
        return sock.sendMessage(jid, {
          text: `🔗 *Anti-Link:* ${g.antiLink ? '✅ Enabled' : '❌ Disabled'}\nAction: *${g.antiLinkAction || 'delete'}*`
        });
      }

      if (sub === 'on') {
        db.updateGroup(jid, { antiLink: true });
        const action = db.getGroup(jid).antiLinkAction || 'delete';
        return sock.sendMessage(jid, {
          text: `🔗 *Anti-Link: ✅ Enabled*\nAction: *${action}*\n\n_Change action with: ${prefix}antilink set delete|kick|warn_`
        });
      }

      if (sub === 'off') {
        db.updateGroup(jid, { antiLink: false });
        return sock.sendMessage(jid, { text: '🔗 *Anti-Link: ❌ Disabled*' });
      }

      if (sub === 'set') {
        const action = (args[1] || '').toLowerCase();
        if (!['delete', 'kick', 'warn'].includes(action)) {
          return sock.sendMessage(jid, {
            text:
              `❌ Invalid action. Choose one:\n\n` +
              `• *delete* — remove link, notify only\n` +
              `• *kick*   — remove link + kick sender\n` +
              `• *warn*   — remove link + warn (kick at max warnings)\n\n` +
              `Usage: *${prefix}antilink set delete|kick|warn*`
          });
        }
        db.updateGroup(jid, { antiLinkAction: action, antiLink: true });
        return sock.sendMessage(jid, {
          text: `🔗 *Anti-Link Updated*\n\nAction: *${action.toUpperCase()}*\nState: ✅ Enabled`
        });
      }

      return sock.sendMessage(jid, {
        text: `❓ Unknown sub-command.\n\nUsage: *${prefix}antilink <on|off|set delete|kick|warn|status>*`
      });
    }
  }
};

module.exports = groupCommands;
