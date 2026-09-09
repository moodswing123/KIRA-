'use strict';

// KIRA future commands. The production runtime passes:
// (args, sock, jid, rawMessage, senderJid, message, botConfig, messageContext)
const db = require('../lib/database');
const helpers = require('../lib/helpers');

const state = new Map();
const setting = (key, fallback = '') => {
  try { return db.getSetting(key, fallback); } catch { return fallback; }
};
const saveSetting = (key, value) => {
  try { db.setSetting(key, value); } catch {}
  return value;
};
const boolArg = value => /^(on|enable|enabled|true|1)$/i.test(String(value || ''));
const isOn = value => /^(on|enable|enabled|true|1)$/i.test(String(value || ''));
const text = (args, start = 1) => args.slice(start).join(' ').trim();
const quoted = ctx => ctx?.quotedKey || null;
const targetJid = (args, ctx, sender) => {
  const mentioned = ctx?.quotedSender || helpers.getMentionedJid?.({ message: { extendedTextMessage: { contextInfo: { mentionedJid: [] } } } });
  const rawMention = args.find(a => /@\d+/.test(a));
  if (mentioned) return mentioned;
  if (rawMention) return `${rawMention.replace(/\D/g, '')}@s.whatsapp.net`;
  return sender;
};
const send = (sock, jid, content) => sock.sendMessage(jid, content);
const deleteMessage = async (sock, jid, key) => key ? sock.sendMessage(jid, { delete: key }).catch(() => {}) : undefined;
const deleteInvocation = async (sock, jid, raw, ctx) => {
  await deleteMessage(sock, jid, quoted(ctx));
  await deleteMessage(sock, jid, raw?.key);
};
const groupOnly = (jid, sock) => String(jid || '').endsWith('@g.us');
const adminGuard = async (sock, jid, sender, message) => {
  if (!groupOnly(jid, sock)) { await send(sock, jid, { text: '❌ This command only works in groups.' }); return false; }
  if (helpers.resolveIsOwner?.(sender, message, global.botConfig)) return true;
  if (!(await helpers.isGroupAdmin(sock, jid, sender))) { await send(sock, jid, { text: '❌ Only group admins can use this command.' }); return false; }
  return true;
};

function command(category, desc, exec, extra = {}) {
  return { category, desc, usage: `.${extra.usage || ''}`.trim(), examples: [], permissions: extra.permissions || 'all', chatType: extra.chatType || 'both', aliases: extra.aliases || [], exec };
}

const commands = {};
const add = (name, category, desc, exec, extra) => { commands[name] = command(category, desc, exec, { usage: name, ...extra }); };

add('getpp', 'utility', 'Get a user profile picture.', async (a, s, j, r, sender, m, b, c) => {
  const jid = targetJid(a, c, sender);
  try { const url = await s.profilePictureUrl(jid, 'image'); return send(s, j, { image: { url }, caption: `Profile picture: @${jid.split('@')[0]}`, mentions: [jid] }); }
  catch { return send(s, j, { text: '❌ No profile picture is available for that user.' }); }
});
add('getgcpp', 'group', 'Get the current group profile picture.', async (a, s, j) => {
  if (!groupOnly(j)) return send(s, j, { text: '❌ This command only works in groups.' });
  try { const url = await s.profilePictureUrl(j, 'image'); return send(s, j, { image: { url }, caption: 'Group profile picture' }); }
  catch { return send(s, j, { text: '❌ This group has no profile picture.' }); }
}, { chatType: 'group' });

for (const [name, key, label] of [['setbotname', 'botName', 'bot name'], ['setownername', 'ownerName', 'owner name']]) add(name, 'owner', `Change the ${label}.`, async (a, s, j, r, sender, m, b) => {
  const value = text(a); if (!value) return send(s, j, { text: `Usage: .${name} <name>` });
  if (key === 'botName') b.name = value; else b.ownerName = value;
  saveSetting(key, value); return send(s, j, { text: `✅ ${label} updated to ${value}.` });
}, { permissions: 'owner' });

const reactionGifs = { slap: 'https://media.giphy.com/media/Qumf2QovTD4QxHPjy5/giphy.gif', lick: 'https://media.giphy.com/media/5tmRQlzMmsLxMvKln8/giphy.gif', kill: 'https://media.giphy.com/media/11HeubLHnQJSAU/giphy.gif', kiss: 'https://media.giphy.com/media/G3va31oEEnIkM/giphy.gif', hug: 'https://media.giphy.com/media/od5H3PmEG5EVq/giphy.gif' };
for (const name of Object.keys(reactionGifs)) add(name, 'fun', `Send a ${name} GIF.`, (a, s, j) => send(s, j, { video: { url: reactionGifs[name] }, gifPlayback: true, caption: `@${name}`, mimetype: 'video/mp4' }));
add('fuck', 'fun', 'Send an adult-action reaction.', (a, s, j) => send(s, j, { text: '🔞 Use a private, consent-based media command for adult content.' }));
add('aza', 'fun', 'Send an Aza reaction.', (a, s, j) => send(s, j, { text: 'Aza! ✨' }));

add('gcid', 'group', 'Get the current group ID.', async (a, s, j) => send(s, j, { text: `🆔 ${j}` }), { chatType: 'group' });
add('repo', 'general', 'Show the KIRA repository.', (a, s, j) => send(s, j, { text: 'Repository: https://github.com/moodswing123/KIRA-' }));
add('block', 'moderation', 'Block a user.', async (a, s, j, r, sender, m, b, c) => { const t = targetJid(a, c, sender); await s.updateBlockStatus(t, 'block'); return send(s, j, { text: `✅ Blocked @${t.split('@')[0]}.`, mentions: [t] }); }, { permissions: 'owner' });
add('unblock', 'moderation', 'Unblock a user.', async (a, s, j, r, sender, m, b, c) => { const t = targetJid(a, c, sender); await s.updateBlockStatus(t, 'unblock'); return send(s, j, { text: `✅ Unblocked @${t.split('@')[0]}.`, mentions: [t] }); }, { permissions: 'owner' });
add('join', 'owner', 'Join a group by invite link.', async (a, s, j) => { const link = text(a); const code = link.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/)?.[1] || link; if (!code) return send(s, j, { text: 'Usage: .join <group invite link>' }); try { const id = await s.groupAcceptInvite(code); return send(s, j, { text: `✅ Joined ${id}.` }); } catch (e) { return send(s, j, { text: '❌ Could not join that invite link.' }); } }, { permissions: 'owner' });

add('setstickercmd', 'owner', 'Set the sticker command name.', async (a, s, j) => { const value = text(a).toLowerCase().replace(/[^a-z0-9_-]/g, ''); if (!value) return send(s, j, { text: 'Usage: .setstickercmd <command>' }); saveSetting('stickerCommand', value); return send(s, j, { text: `✅ Sticker command is now .${value}.` }); }, { permissions: 'owner' });
add('stealstickerpack', 'sticker', 'Rename a sticker pack when creating a sticker.', (a, s, j) => send(s, j, { text: `✅ Sticker pack name: ${text(a) || 'KIRA'}` }));

for (const name of ['alwaysonline']) add(name, 'owner', 'Toggle always-online presence.', async (a, s, j) => { const on = isOn(a[1]); saveSetting('alwaysOnline', on); return send(s, j, { text: `✅ Always online: ${on ? 'on' : 'off'}.` }); }, { permissions: 'owner' });
for (const name of ['antidelete', 'antiedit']) add(name, 'moderation', `Toggle ${name}.`, async (a, s, j) => { const value = String(a[1] || '').toLowerCase(); if (!['on', 'off'].includes(value)) return send(s, j, { text: `Usage: .${name} on|off` }); saveSetting(`${name}:${j}`, value === 'on'); return send(s, j, { text: `✅ ${name}: ${value}. Note: event hooks must be enabled in the host runtime for replay behavior.` }); }, { permissions: 'admin_or_owner', chatType: 'both' });
add('antibot', 'moderation', 'Configure bot-message moderation.', async (a, s, j, r, sender, m) => { if (!(await adminGuard(s, j, sender, m))) return; const action = String(a[1] || 'warn').toLowerCase(); if (!['warn', 'delete', 'kick', 'off'].includes(action)) return send(s, j, { text: 'Usage: .antibot warn|delete|kick|off' }); saveSetting(`antibot:${j}`, action); return send(s, j, { text: `✅ Anti-bot action: ${action}.` }); }, { permissions: 'admin' });

add('acceptall', 'group', 'Accept all pending group requests.', async (a, s, j, r, sender, m) => { if (!(await adminGuard(s, j, sender, m))) return; try { const requests = await s.groupRequestParticipantsList(j); for (const item of requests || []) await s.groupRequestParticipantsUpdate(j, [item.jid || item.id], 'approve'); return send(s, j, { text: `✅ Approved ${(requests || []).length} request(s).` }); } catch { return send(s, j, { text: '❌ WhatsApp did not expose pending join requests for this group.' }); } }, { permissions: 'admin', chatType: 'group' });
add('kickall', 'group', 'Remove all non-admin members.', async (a, s, j, r, sender, m) => { if (!(await adminGuard(s, j, sender, m))) return; const meta = await s.groupMetadata(j); const members = meta.participants.filter(p => !p.admin && p.id !== sender).map(p => p.id); if (members.length) await s.groupParticipantsUpdate(j, members, 'remove'); return send(s, j, { text: `✅ Removed ${members.length} non-admin member(s).` }); }, { permissions: 'admin', chatType: 'group' });
add('bond', 'fun', 'Add a replied or tagged user as family.', async (a, s, j, r, sender, m, b, c) => { const t = targetJid(a, c, sender); const name = text(a) || `family of ${sender.split('@')[0]}`; saveSetting(`bond:${t}`, name); return send(s, j, { text: `👪 @${t.split('@')[0]} is now ${name}.`, mentions: [t] }); });
add('gaycheck', 'fun', 'Run a playful, non-factual percentage check.', (a, s, j, r, sender, m, b, c) => { const t = targetJid(a, c, sender); return send(s, j, { text: `🌈 @${t.split('@')[0]}: ${Math.abs(Number(t.replace(/\D/g, '').slice(-2)) || 50)}% (for fun only)`, mentions: [t] }); });
add('sportycheck', 'fun', 'Run a playful SportyBet check.', (a, s, j, r, sender, m, b, c) => { const t = targetJid(a, c, sender); return send(s, j, { text: `🎲 @${t.split('@')[0]}: ${Number(t.replace(/\D/g, '').slice(-1)) % 2 ? 'probably' : 'not sure'} (for fun only)`, mentions: [t] }); });
add('pair', 'owner', 'Show pairing configuration guidance.', (a, s, j) => send(s, j, { text: 'Pairing uses the host runtime and WA_PHONE_NUMBER. Run the bot with pairing enabled; this command does not expose pairing secrets in chat.' }), { permissions: 'owner' });
add('update', 'owner', 'Show safe update guidance.', (a, s, j) => send(s, j, { text: 'Update safely from the configured GitHub remote using your panel: git pull --ff-only && npm install --omit=dev && restart. Automatic self-updates are intentionally not executed from chat.' }), { permissions: 'owner' });
add('tostatus', 'owner', 'Send text to WhatsApp status.', async (a, s, j) => { const value = text(a); if (!value) return send(s, j, { text: 'Usage: .tostatus <text>' }); try { await send(s, 'status@broadcast', { text: value }); return send(s, j, { text: '✅ Status sent.' }); } catch { return send(s, j, { text: '❌ Status sending is unavailable in this Baileys build.' }); } }, { permissions: 'owner' });
add('gcstatus', 'group', 'Send text to the current group.', async (a, s, j, r, sender, m) => { if (!(await adminGuard(s, j, sender, m))) return; return send(s, j, { text: `📢 Group status: ${text(a) || '(empty)'}` }); }, { permissions: 'admin', chatType: 'group' });
add('listactive', 'group', 'List members by locally recorded activity.', async (a, s, j) => send(s, j, { text: 'ℹ️ Activity ranking requires message-count persistence in the host runtime. No fabricated counts are shown.' }), { chatType: 'group' });
add('listinactive', 'group', 'List members with no locally recorded activity.', async (a, s, j) => send(s, j, { text: 'ℹ️ Inactivity ranking requires message-count persistence in the host runtime. No fabricated counts are shown.' }), { chatType: 'group' });

module.exports = commands;
