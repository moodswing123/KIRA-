'use strict';

// KIRA future commands. The production runtime passes:
// (args, sock, jid, rawMessage, senderJid, message, botConfig, messageContext)
const db = require('../lib/database');
const helpers = require('../lib/helpers');
const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');

const state = new Map();
const azaFile = path.join(__dirname, '..', 'data', 'aza-settings.json');
const azaSettings = (() => { try { return JSON.parse(fs.readFileSync(azaFile, 'utf8')); } catch { return {}; } })();
const saveAzaSettings = () => { fs.mkdirSync(path.dirname(azaFile), { recursive: true }); fs.writeFileSync(azaFile, JSON.stringify(azaSettings, null, 2)); };
const hookState = new WeakMap();
const setting = (key, fallback = '') => {
  try { return db.getSetting(key, fallback); } catch { return fallback; }
};
const saveSetting = (key, value) => {
  try { db.setSetting(key, value); } catch {}
  return value;
};
const boolArg = value => /^(on|enable|enabled|true|1)$/i.test(String(value || ''));
const isOn = value => /^(on|enable|enabled|true|1)$/i.test(String(value || ''));
// The dispatcher passes only tokens after the command: .setbotname KIRA => ['KIRA'].
const text = (args, start = 0) => args.slice(start).join(' ').trim();
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
const azaReceipt = (account, bank) => `|￣￣￣￣￣￣￣￣￣￣|\n        \n          ${account}\n                ${bank}\n             \n           \n|＿＿＿＿＿＿＿＿＿＿|\n                \\ (•◡•) / \n                  \\      / \n                   ——\n                   |     |\n                   |_   |_`;
const messageText = msg => msg?.conversation || msg?.extendedTextMessage?.text || msg?.imageMessage?.caption || msg?.videoMessage?.caption || '';
const messageMedia = msg => msg?.imageMessage || msg?.videoMessage || msg?.audioMessage || msg?.documentMessage || msg?.stickerMessage || null;
const quotedRaw = ctx => ctx?.quotedMessage ? { key: ctx.quotedKey, message: ctx.quotedMessage } : null;
const ownerJid = botConfig => botConfig?.ownerJid || botConfig?.owner || process.env.OWNER_JID || process.env.OWNER_NUMBER && `${process.env.OWNER_NUMBER.replace(/\D/g, '')}@s.whatsapp.net`;
const isOwner = (sender, botConfig) => {
  const digits = value => String(value || '').replace(/\D/g, '');
  const senderDigits = digits(sender);
  const candidates = [botConfig?.ownerJid, botConfig?.ownerNumber, botConfig?.owner, process.env.OWNER_JID, process.env.OWNER_NUMBER, process.env.WA_OWNER_JIDS];
  return Boolean(senderDigits && candidates.some(value => digits(value) === senderDigits || String(value || '').split(',').some(item => digits(item) === senderDigits)));
};
const destinationFor = (mode, chat, botConfig) => mode === 'dm' ? ownerJid(botConfig) : chat;
const forwardCached = async (sock, entry, mode, botConfig, caption) => {
  const destination = destinationFor(mode, entry.chat, botConfig);
  if (!destination || !entry.message) return;
  try { await sock.sendMessage(destination, { forward: { key: entry.key, message: entry.message }, caption }); }
  catch { await sock.sendMessage(destination, { text: `${caption}\n${messageText(entry.message) || '[media message]'}` }); }
};
const installEventHooks = (sock, botConfig) => {
  if (!sock?.ev || hookState.has(sock)) return;
  const cache = new Map();
  const settings = { deleteMode: new Map(), editMode: new Map() };
  sock.ev.on('messages.upsert', ({ messages = [] }) => {
    for (const msg of messages) if (msg?.key?.id && msg.message) {
      cache.set(msg.key.id, { key: msg.key, message: msg.message, chat: msg.key.remoteJid });
      if (cache.size > 1000) cache.delete(cache.keys().next().value);
      const sticker = msg.message.stickerMessage;
      const stickerContext = sticker?.contextInfo;
      const configured = String(setting('stickerCommand', '')).toLowerCase();
      if (sticker && stickerContext?.quotedMessage && configured) {
        const registry = require('../commands');
        const handler = registry[configured];
        if (handler?.exec) {
          const sender = msg.key.participant || msg.key.remoteJid;
          Promise.resolve(handler.exec([], sock, msg.key.remoteJid, msg, sender, msg, botConfig, helpers.getMessageContext(msg))).catch(() => {});
        }
      }
    }
  });
  sock.ev.on('messages.delete', async event => {
    const keys = event?.keys || event?.messages || [];
    for (const key of keys) { const entry = cache.get(key.id); const mode = settings.deleteMode.get(key.remoteJid); if (entry && mode) await forwardCached(sock, entry, mode, botConfig, '🗑️ Deleted message'); }
  });
  sock.ev.on('messages.update', async updates => {
    for (const item of updates || []) {
      const mode = settings.editMode.get(item?.key?.remoteJid); const entry = cache.get(item?.key?.id);
      if (mode && entry && item.update?.message) await forwardCached(sock, { ...entry, message: item.update.message }, mode, botConfig, '✏️ Edited message');
      if (entry && item.update?.message) cache.set(item.key.id, { ...entry, message: item.update.message });
    }
  });
  hookState.set(sock, { settings, cache });
};
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
const add = (name, category, desc, exec, extra = {}) => {
  const ownerOnly = extra.permissions === 'owner';
  const wrapped = ownerOnly ? async (...args) => {
    const [, sock, jid, , sender, message, botConfig] = args;
    if (!isOwner(sender, botConfig) && !helpers.resolveIsOwner?.(sender, message, botConfig)) return send(sock, jid, { text: '❌ Owner permission required.' });
    return exec(...args);
  } : exec;
  commands[name] = command(category, desc, wrapped, { usage: name, ...extra, permissions: ownerOnly ? 'all' : extra.permissions });
};

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
add('aza', 'fun', 'Configure and display the Aza payment details.', async (a, s, j, r, sender) => {
  const key = sender || j;
  const value = text(a);
  const configured = azaSettings[key];
  const phase = state.get(key);
  if (phase === 'account') {
    if (!/^\d{10}$/.test(value)) return send(s, j, { text: '❌ The account number must contain exactly 10 digits. Please send .aza <10-digit account number>.' });
    state.set(key, { step: 'bank', account: value });
    return send(s, j, { text: '✅ Account number received. Now send .aza <bank name>.' });
  }
  if (phase?.step === 'bank') {
    if (!value || /^\d+$/.test(value)) return send(s, j, { text: '❌ Please send the bank name, for example: .aza Opay' });
    azaSettings[key] = { account: phase.account, bank: value };
    saveAzaSettings(); state.delete(key);
    return send(s, j, { text: azaReceipt(phase.account, value) });
  }
  if (!configured) {
    state.set(key, 'account');
    return send(s, j, { text: 'Please enter the 10-digit account number first: .aza <account number>' });
  }
  return send(s, j, { text: azaReceipt(configured.account, configured.bank) });
});

add('gcid', 'group', 'Get the current group ID.', async (a, s, j) => send(s, j, { text: `🆔 ${j}` }), { chatType: 'group' });
add('repo', 'general', 'Show the KIRA repository.', (a, s, j) => send(s, j, { text: 'Repository: https://github.com/moodswing123/KIRA-' }));
for (const [name, action] of [['block', 'block'], ['unblock', 'unblock']]) add(name, 'moderation', `${action} a tagged or replied user.`, async (a, s, j, r, sender, m, b, c) => {
  const target = targetJid(a, c, sender);
  if (!target || target === sender) return send(s, j, { text: `❌ Reply to or tag the user to ${action}.` });
  try { await s.updateBlockStatus(target, action); return send(s, j, { text: `✅ ${action === 'block' ? 'Blocked' : 'Unblocked'} @${target.split('@')[0]}.`, mentions: [target] }); }
  catch (err) { return send(s, j, { text: `❌ Could not ${action} that user. Check that the bot account has permission and try again.` }); }
}, { permissions: 'owner', chatType: 'both' });
add('join', 'owner', 'Join a group by invite link.', async (a, s, j) => { const link = text(a); const code = link.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/)?.[1] || link; if (!code) return send(s, j, { text: 'Usage: .join <group invite link>' }); try { const id = await s.groupAcceptInvite(code); return send(s, j, { text: `✅ Joined ${id}.` }); } catch (e) { return send(s, j, { text: '❌ Could not join that invite link.' }); } }, { permissions: 'owner' });

add('setstickercmd', 'owner', 'Make replied stickers execute an existing command.', async (a, s, j) => {
  const value = text(a).toLowerCase().replace(/^\./, '').replace(/[^a-z0-9_-]/g, '');
  if (!value) return send(s, j, { text: 'Usage: .setstickercmd <existing command name>' });
  const registry = require('../commands');
  if (!registry[value]?.exec) return send(s, j, { text: `❌ .${value} is not a loaded command. Choose an existing command such as .vv.` });
  saveSetting('stickerCommand', value);
  return send(s, j, { text: `✅ Replied stickers will now execute .${value} on their quoted message.` });
}, { permissions: 'owner' });
add('stealsticker', 'sticker', 'Steal a sticker and use the supplied pack name.', async (a, s, j, r, sender, m, b, c) => {
  const name = text(a) || 'KIRA';
  const legacy = require('../commands/converter').stealsticker;
  if (legacy?.exec) return legacy.exec([name], s, j, r, sender, m, b, c);
  return send(s, j, { text: '❌ Sticker handler is unavailable.' });
});
add('stealstickerpack', 'sticker', 'Rename a sticker pack when creating a sticker.', async (a, s, j, r, sender, m, b, c) => commands.stealsticker.exec(a, s, j, r, sender, m, b, c));

for (const name of ['alwaysonline']) add(name, 'owner', 'Toggle always-online presence.', async (a, s, j) => { const on = isOn(a[0]); saveSetting('alwaysOnline', on); return send(s, j, { text: `✅ Always online: ${on ? 'on' : 'off'}.` }); }, { permissions: 'owner' });
for (const name of ['antidelete', 'antiedit']) add(name, 'moderation', `Toggle ${name}.`, async (a, s, j, r, sender, m, b) => {
  installEventHooks(s, b);
  const mode = String(a[1] || '').toLowerCase();
  if (!['on', 'off'].includes(String(a[0] || '').toLowerCase()) || (a[0].toLowerCase() === 'on' && !['dm', 'chat'].includes(mode))) return send(s, j, { text: `Usage: .${name} on dm|chat or .${name} off` });
  const hooks = hookState.get(s); const map = name === 'antidelete' ? hooks.settings.deleteMode : hooks.settings.editMode;
  map.set(j, a[0].toLowerCase() === 'on' ? mode : null);
  saveSetting(`${name}:${j}`, a[0].toLowerCase() === 'on' ? mode : false);
  return send(s, j, { text: `✅ ${name}: ${a[0].toLowerCase()}${a[0].toLowerCase() === 'on' ? `; forwarding to ${mode === 'dm' ? 'your DM' : 'the originating chat'}` : ''}.` });
}, { permissions: 'admin_or_owner', chatType: 'both' });
add('antibot', 'moderation', 'Configure bot-message moderation.', async (a, s, j, r, sender, m) => { if (!(await adminGuard(s, j, sender, m))) return; const action = String(a[0] || 'warn').toLowerCase(); if (!['warn', 'delete', 'kick', 'off'].includes(action)) return send(s, j, { text: 'Usage: .antibot warn|delete|kick|off' }); saveSetting(`antibot:${j}`, action); return send(s, j, { text: `✅ Anti-bot action: ${action}.` }); }, { permissions: 'admin' });

add('acceptall', 'group', 'Accept all pending group requests.', async (a, s, j, r, sender, m) => { if (!(await adminGuard(s, j, sender, m))) return; try { const requests = await s.groupRequestParticipantsList(j); for (const item of requests || []) await s.groupRequestParticipantsUpdate(j, [item.jid || item.id], 'approve'); return send(s, j, { text: `✅ Approved ${(requests || []).length} request(s).` }); } catch { return send(s, j, { text: '❌ WhatsApp did not expose pending join requests for this group.' }); } }, { permissions: 'admin', chatType: 'group' });
add('kickall', 'group', 'Remove all non-admin members.', async (a, s, j, r, sender, m) => { if (!(await adminGuard(s, j, sender, m))) return; const meta = await s.groupMetadata(j); const members = meta.participants.filter(p => !p.admin && p.id !== sender).map(p => p.id); if (members.length) await s.groupParticipantsUpdate(j, members, 'remove'); return send(s, j, { text: `✅ Removed ${members.length} non-admin member(s).` }); }, { permissions: 'admin', chatType: 'group' });
add('kick', 'group', 'Remove a tagged or replied user.', async (a, s, j, r, sender, m, b, c) => { if (!(await adminGuard(s, j, sender, m))) return; const target = targetJid(a, c, sender); if (target === sender) return send(s, j, { text: '❌ Tag or reply to the member you want to remove.' }); try { await s.groupParticipantsUpdate(j, [target], 'remove'); return send(s, j, { text: `✅ Removed @${target.split('@')[0]}.`, mentions: [target] }); } catch { return send(s, j, { text: '❌ Could not remove that member. Make sure the bot is a group admin.' }); } }, { permissions: 'admin', chatType: 'group' });
add('bond', 'fun', 'Add a replied or tagged user as family.', async (a, s, j, r, sender, m, b, c) => { const t = targetJid(a, c, sender); const name = text(a) || `family of ${sender.split('@')[0]}`; saveSetting(`bond:${t}`, name); return send(s, j, { text: `👪 @${t.split('@')[0]} is now ${name}.`, mentions: [t] }); });
add('gaycheck', 'fun', 'Run a playful, non-factual percentage check.', (a, s, j, r, sender, m, b, c) => { const t = targetJid(a, c, sender); return send(s, j, { text: `🌈 @${t.split('@')[0]}: ${Math.abs(Number(t.replace(/\D/g, '').slice(-2)) || 50)}% (for fun only)`, mentions: [t] }); });
add('sportycheck', 'fun', 'Run a playful SportyBet check.', (a, s, j, r, sender, m, b, c) => { const t = targetJid(a, c, sender); return send(s, j, { text: `🎲 @${t.split('@')[0]}: ${Number(t.replace(/\D/g, '').slice(-1)) % 2 ? 'probably' : 'not sure'} (for fun only)`, mentions: [t] }); });
add('pair', 'owner', 'Show pairing configuration guidance.', (a, s, j) => send(s, j, { text: 'Pairing uses the host runtime and WA_PHONE_NUMBER. Run the bot with pairing enabled; this command does not expose pairing secrets in chat.' }), { permissions: 'owner' });
add('update', 'owner', 'Pull the configured repository and restart the bot.', async (a, s, j) => {
  await send(s, j, { text: '⏳ Updating from the configured GitHub remote. The bot will restart after a successful fast-forward pull.' });
  return new Promise(resolve => execFile('bash', ['-lc', 'git pull --ff-only && npm install --omit=dev --no-audit --no-fund'], { cwd: process.cwd(), timeout: 120000 }, async (error, stdout, stderr) => {
    if (error) { await send(s, j, { text: `❌ Update failed safely: ${String(stderr || error.message).slice(-800)}` }); return resolve(); }
    await send(s, j, { text: '✅ Update installed. Restarting now.' });
    setTimeout(() => process.exit(0), 800);
    resolve();
  }));
}, { permissions: 'owner' });
add('restart', 'owner', 'Restart the bot without leaving a dead process.', async (a, s, j) => {
  await send(s, j, { text: '♻️ Restarting KIRA safely…' });
  setTimeout(() => {
    if (typeof process.send === 'function') {
      process.send({ type: 'restart', reason: 'chat-command' });
      return setTimeout(() => process.exit(0), 300);
    }
    const child = spawn(process.execPath, process.argv.slice(1), { detached: true, stdio: 'inherit', env: process.env });
    child.unref();
    process.exit(0);
  }, 500);
}, { permissions: 'owner' });
add('tostatus', 'owner', 'Send replied media to WhatsApp status.', async (a, s, j, r, sender, m, b, c) => {
  const media = messageMedia(c?.quotedMessage);
  if (!media) return send(s, j, { text: '❌ Reply to an image, video, audio, document, or sticker. Text-only status is not supported.' });
  try {
    const quoted = quotedRaw(c);
    const data = await s.downloadMediaMessage(quoted, 'buffer', {}, { logger: s.logger });
    const type = media.mimetype?.startsWith('video') ? 'video' : media.mimetype?.startsWith('audio') ? 'audio' : media.mimetype?.startsWith('image') ? 'image' : media.mimetype?.startsWith('application') ? 'document' : 'sticker';
    await send(s, 'status@broadcast', { [type]: data, mimetype: media.mimetype, caption: media.caption || undefined, fileName: media.fileName || undefined, gifPlayback: type === 'video' && Boolean(media.gifPlayback) });
    return send(s, j, { text: '✅ Media posted to your status.' });
  } catch { return send(s, j, { text: '❌ Could not download or post that media. Reply directly to the media and try again.' }); }
}, { permissions: 'owner' });
add('gcstatus', 'group', 'Send text to the current group.', async (a, s, j, r, sender, m) => { if (!(await adminGuard(s, j, sender, m))) return; return send(s, j, { text: `📢 Group status: ${text(a) || '(empty)'}` }); }, { permissions: 'admin', chatType: 'group' });
add('listactive', 'group', 'List members by locally recorded activity.', async (a, s, j) => send(s, j, { text: 'ℹ️ Activity ranking requires message-count persistence in the host runtime. No fabricated counts are shown.' }), { chatType: 'group' });
add('listinactive', 'group', 'List members with no locally recorded activity.', async (a, s, j) => send(s, j, { text: 'ℹ️ Inactivity ranking requires message-count persistence in the host runtime. No fabricated counts are shown.' }), { chatType: 'group' });

module.exports = commands;
