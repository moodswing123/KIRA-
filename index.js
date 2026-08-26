'use strict';
// index.js — Kira MD WhatsApp Bot by Victory Tech
// Powered by @whiskeysockets/baileys v7

require('dotenv').config();

const path = require('path');
const fs   = require('fs');
const pino = require('pino');

const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  downloadMediaMessage
} = require('@whiskeysockets/baileys');

function normalizePhoneNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.startsWith('00') ? digits.slice(2) : digits;
}

function normalizeBotMode(value) {
  return String(value || '').toLowerCase() === 'private' ? 'private' : 'public';
}

function ownerContact(botConfig) {
  const number = botConfig?.ownerNumber;
  return number ? `https://wa.me/${number}` : 'Owner number is not configured';
}

function isEmojiOnly(text) {
  const value = String(text || '').trim();
  if (!value || value.length > 64) return false;
  const components = [...value];
  const allowed = /^(?:\p{Emoji}|\p{Emoji_Component}|\p{Extended_Pictographic}|\p{Regional_Indicator}|\uFE0F|\u200D|\u20E3|[\u{E0020}-\u{E007E}]|\u{E007F})$/u;
  const hasKeycap = /[0-9#*]\uFE0F?\u20E3/u.test(value);
  const hasEmojiBase = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}/u.test(value) || hasKeycap;
  return hasEmojiBase && components.every(component => allowed.test(component));
}

function getViewOncePayload(quoted) {
  let current = quoted || null;
  let sawViewOnce = false;
  for (let i = 0; i < 8 && current; i++) {
    if (current.viewOnceMessage?.message) {
      sawViewOnce = true;
      current = current.viewOnceMessage.message;
      continue;
    }
    if (current.viewOnceMessageV2?.message) {
      sawViewOnce = true;
      current = current.viewOnceMessageV2.message;
      continue;
    }
    if (current.viewOnceMessageV2Extension?.message) {
      sawViewOnce = true;
      current = current.viewOnceMessageV2Extension.message;
      continue;
    }
    const nested = current.ephemeralMessage?.message ||
      current.documentWithCaptionMessage?.message ||
      current.deviceSentMessage?.message ||
      current.editedMessage?.message;
    if (nested) {
      current = nested;
      continue;
    }
    break;
  }
  if (!sawViewOnce) return null;
  const type = current?.imageMessage ? 'image' : current?.videoMessage ? 'video' : current?.audioMessage ? 'audio' : null;
  return type ? { message: current, media: current[`${type}Message`], type } : null;
}

function findReactionMessage(message) {
  let current = message?.message || message || null;
  for (let i = 0; i < 8 && current; i++) {
    if (current.reactionMessage) return current.reactionMessage;
    const nested = current.ephemeralMessage?.message ||
      current.deviceSentMessage?.message || current.editedMessage?.message;
    if (!nested) break;
    current = nested;
  }
  return null;
}

function getEmojiReplyContext(message) {
  const context = helpers.getMessageContext(message);
  if (context?.quotedMessage) return context;

  const reaction = findReactionMessage(message);
  const targetKey = reaction?.key;
  if (!reaction?.text || !targetKey?.id) return null;
  const remoteJid = targetKey.remoteJid || message?.key?.remoteJid || '';
  const quotedMessage = msgCache.get(`${remoteJid}:${targetKey.id}`);
  debug(`VIEW-ONCE reaction text=${JSON.stringify(reaction.text)} target=${remoteJid}:${targetKey.id} cached=${Boolean(quotedMessage)}`);
  if (!quotedMessage) return null;
  return {
    quotedMessage,
    quotedSender: targetKey.participant || '',
    quotedParticipant: targetKey.participant || '',
    stanzaId: targetKey.id,
    participant: targetKey.participant || '',
    remoteJid,
    quotedKey: targetKey,
    mediaType: helpers.getMessageType ? helpers.getMessageType(quotedMessage) : null
  };
}

async function forwardViewOnceToOwner(sock, ownerJid, emoji, context, fallbackJid, downloadMedia = downloadMediaMessage) {
  const viewOnce = getViewOncePayload(context?.quotedMessage);
  if (!viewOnce || !ownerJid) return false;
  const fakeMessage = {
    key: {
      remoteJid: context.remoteJid || fallbackJid,
      id: context.stanzaId,
      participant: context.participant,
      fromMe: false
    },
    message: viewOnce.message
  };
  const buffer = await downloadMedia(fakeMessage, 'buffer', { reuploadRequest: sock.updateMediaMessage });
  if (viewOnce.type === 'image') {
    await sock.sendMessage(ownerJid, { image: buffer, caption: `👁️ Saved from view-once reply ${emoji}` });
  } else if (viewOnce.type === 'video') {
    await sock.sendMessage(ownerJid, { video: buffer, caption: `👁️ Saved from view-once reply ${emoji}` });
  } else {
    await sock.sendMessage(ownerJid, { audio: buffer, mimetype: 'audio/ogg; codecs=opus', ptt: true });
  }
  return true;
}

const db         = require('./lib/database');
const helpers    = require('./lib/helpers');
const fontStyles = require('./lib/font');

// ── Config ─────────────────────────────────────────────────────────────────
const botConfig = {
  name:        process.env.BOT_NAME    || 'KIRA-MD',
  version:     '1.0.0',
  prefix:      String(process.env.BOT_PREFIX || '.').trim() || '.',
  // An explicit hosting-panel value is authoritative; persisted mode is used
  // only when BOT_MODE is intentionally left unset.
  mode:        normalizeBotMode(
    Object.prototype.hasOwnProperty.call(process.env, 'BOT_MODE') && String(process.env.BOT_MODE).trim()
      ? process.env.BOT_MODE
      : db.getSetting('botMode', 'public')
  ),
  ownerNumber: normalizePhoneNumber(process.env.OWNER_NUMBER),
  ownerName:   process.env.OWNER_NAME  || 'Victory Tech',
  ownerJid:    '',
  description: process.env.BOT_DESCRIPTION || 'Advanced WhatsApp Bot by Victory Tech'
};

global.botConfig    = botConfig;
global.botStartTime = Date.now();

// ── Logger — silent in prod, enable debug by setting LOG_LEVEL=debug ────────
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const logger = pino({
  level: 'silent'   // Baileys internal logger kept silent; we use console.log
});

function log(msg)  { console.log(`[Kira MD] ${msg}`); }
function warn(msg) { console.warn(`[Kira MD] ⚠️  ${msg}`); }
function err(msg, e) { console.error(`[Kira MD] ❌ ${msg}`, e?.message || ''); }
function debug(msg) { if (process.env.LOG_LEVEL === 'debug') console.log(`[DEBUG] ${msg}`); }
function logCommandFailure(command, sender, jid, error) {
  const actual = error instanceof Error ? error : new Error(String(error || 'Unknown error'));
  console.error(
    `[Kira MD] ❌ Command failure: .${command} | sender=${sender || 'unknown'} | chat=${jid || 'unknown'}`,
    actual.stack || actual.message
  );
}

// ── Auth state dir ─────────────────────────────────────────────────────────
const AUTH_DIR = path.join(__dirname, 'auth_info_baileys');
fs.mkdirSync(AUTH_DIR, { recursive: true });
fs.mkdirSync(path.join(__dirname, 'data', 'group_images'), { recursive: true });

// ── Command registry — loaded ONCE at startup ──────────────────────────────
let allCommands = {};
try {
  allCommands = require('./commands/index');
  const health = typeof allCommands.healthReport === 'function'
    ? allCommands.healthReport()
    : {
        loaded: allCommands.primaryNames?.length || 0,
        aliases: allCommands.aliasNames?.length || 0,
        broken: 0,
        failedModules: []
      };
  log(`🤖 KIRA-MD COMMAND SYSTEM | Prefix: ${botConfig.prefix} | Mode: ${botConfig.mode}`);
  log(`Commands loaded: ${health.loaded} | Aliases loaded: ${health.aliases}`);
  log(`Broken commands: ${health.broken} | Command loader: ${health.broken ? 'CHECK REQUIRED' : 'READY'}`);
  for (const failed of health.failedModules || []) {
    console.error(`[Kira MD] ❌ ${failed.file} — Reason: ${failed.error}`);
  }
} catch (e) {
  err('Failed to load commands — bot will not respond to any commands', e);
}

// ── Pre-load games module so trivia check is available in handler ──────────
let gamesModule = null;
try { gamesModule = require('./commands/games'); } catch {}

// ── Message cache for quoted-message lookups ───────────────────────────────
const msgCache = new Map();
function cacheMsg(jid, id, content) {
  msgCache.set(`${jid}:${id}`, content);
  if (msgCache.size > 500) msgCache.delete(msgCache.keys().next().value);
}

// ── Banner ─────────────────────────────────────────────────────────────────
function printBanner() {
  const health = typeof allCommands.healthReport === 'function'
    ? allCommands.healthReport()
    : {
        loaded: allCommands.primaryNames?.length || 0,
        aliases: allCommands.aliasNames?.length || 0,
        broken: 0
      };
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║        🤖  K I R A  -  M D  🤖          ║');
  console.log('║    Advanced WhatsApp Bot v1.0.0           ║');
  console.log('║    Powered by Victory Tech™               ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`\n  Prefix  : ${botConfig.prefix}`);
  console.log(`  Owner   : ${botConfig.ownerName} (${botConfig.ownerNumber || '⚠ NOT SET — edit .env'})`);
  console.log(`  Mode    : ${botConfig.mode}`);
  console.log(`  Commands loaded: ${health.loaded}`);
  console.log(`  Aliases loaded : ${health.aliases}`);
  console.log(`  Broken commands: ${health.broken}`);
  console.log(`  Command loader : ${health.broken ? 'CHECK REQUIRED' : 'READY'}\n`);
  for (const failed of health.failedModules || []) {
    console.error(`  ❌ ${failed.file} — Reason: ${failed.error}`);
  }
}

// ── Main connection ────────────────────────────────────────────────────────
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version }          = await fetchLatestBaileysVersion();

  log(`Using Baileys v${version.join('.')}`);

  const sock = makeWASocket({
    version,
    logger,
    auth:  state,
    printQRInTerminal:              false,
    browser:                        ['Kira MD', 'Chrome', '120.0'],
    syncFullHistory:                false,
    markOnlineOnConnect:            false,
    generateHighQualityLinkPreview: false,
    // Return undefined when we don't have a cached message — safe for v7
    getMessage: async (key) => {
      return msgCache.get(`${key.remoteJid}:${key.id}`) || undefined;
    }
  });

  // Apply the selected style to bot-generated text and captions centrally.
  // Incoming user text and command arguments are never transformed.
  const rawSendMessage = sock.sendMessage.bind(sock);
  sock.sendMessage = async (chatJid, content, options) => {
    const style = db.getSetting('botFont', 'plain');
    return rawSendMessage(chatJid, fontStyles.styleOutgoingContent(content, style), options);
  };

  // ── Save credentials whenever they update ─────────────────────────────
  sock.ev.on('creds.update', saveCreds);

  // Pairing-code state is kept per socket so reconnects cannot reuse a stale
  // code or leave a retry timer running against a closed WebSocket.
  let pairingCodeRequested = false;
  let pairingCodeDisplayed = false;
  const pairingNumber = botConfig.ownerNumber;
  let pairingTimer;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const requestPairingCode = async (attempt = 1) => {
    if (pairingCodeRequested || pairingCodeDisplayed || state.creds.registered) return;
    pairingCodeRequested = true;
    try {
      if (typeof sock.requestPairingCode !== 'function') {
        throw new Error('This Baileys build does not support phone-number pairing');
      }
      // The socket must have had time to initialise its WebSocket before the
      // pairing request. Do not depend on waitForConnectionUpdate: that helper
      // is not present in every Baileys release and can race the event stream.
      await wait(4000);
      if (state.creds.registered || pairingCodeDisplayed) return;
      const code = await sock.requestPairingCode(pairingNumber);
      pairingCodeDisplayed = true;
      console.log('\n╔══════════════════════════════════════════╗');
      console.log(`║  🔑 NEW PAIRING CODE : ${String(code).padEnd(18)}║`);
      console.log('╚══════════════════════════════════════════╝');
      console.log('  1. Open WhatsApp on your phone');
      console.log('  2. Settings → Linked Devices → Link a Device');
      console.log('  3. Choose “Link with phone number instead”');
      console.log('  4. Enter THIS latest code within 60 seconds');
      console.log('  ⚠️ Use only this newest code; do not request another one\n');
    } catch (e) {
      pairingCodeRequested = false;
      err(`Pairing code request failed (attempt ${attempt}/5)`, e);
      if (attempt < 5 && !state.creds.registered) {
        const retryDelay = Math.min(4000 * attempt, 20000);
        pairingTimer = setTimeout(() => requestPairingCode(attempt + 1), retryDelay);
      } else {
        warn('Pairing failed. Confirm OWNER_NUMBER includes the country code, then remove stale auth_info_baileys and restart.');
      }
    }
  };

  if (!state.creds.registered && pairingNumber) {
    if (!/^[1-9]\d{7,14}$/.test(pairingNumber)) {
      warn('OWNER_NUMBER is invalid — use the full number with country code, for example 2347038253086');
    } else {
      // Schedule only after the socket and all event handlers below are set up.
      pairingTimer = setTimeout(() => requestPairingCode(), 1500);
    }
  } else if (!state.creds.registered && !pairingNumber) {
    warn('OWNER_NUMBER not set in .env — set it so a pairing code can be generated');
  }

  // ── Connection lifecycle ───────────────────────────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      debug('Baileys emitted a QR update; pairing code request is scheduled separately');
    }

    if (connection === 'open') {
      const jid = jidNormalizedUser(sock.user?.id || '');
      botConfig.connectedJid = jid;
      botConfig.botJid = jid;
      botConfig.ownerJid = botConfig.ownerNumber
        ? `${botConfig.ownerNumber}@s.whatsapp.net`
        : jid;
      if (pairingTimer) clearTimeout(pairingTimer);
      pairingCodeDisplayed = true;
      log(`✅ Connected as ${jid}`);
      log('Bot is online and ready to receive messages!');
    }

    if (connection === 'close') {
      if (pairingTimer) clearTimeout(pairingTimer);
      const code = lastDisconnect?.error?.output?.statusCode;
      err(`Connection closed (code ${code ?? 'unknown'})`);
      if (code === DisconnectReason.loggedOut) {
        warn('Logged out — delete auth_info_baileys/ folder and restart');
      } else {
        log('Reconnecting in 5 seconds...');
        setTimeout(connectToWhatsApp, 5000);
      }
    }
  });

  // ── Call rejection ─────────────────────────────────────────────────────
  sock.ev.on('call', async (calls) => {
    for (const call of calls) {
      if (!botConfig.ownerJid) continue;
      if (!db.getOwnerSetting(botConfig.ownerJid, 'antiCall', false)) continue;
      if (call.status === 'offer') {
        try { await sock.rejectCall(call.id, call.from); } catch {}
        try {
          await sock.sendMessage(call.from, {
            text: `📵 This bot does not accept calls.\n\nFor support: ${ownerContact(botConfig)}`
          });
        } catch {}
      }
    }
  });

  // ── Group participant events (welcome / goodbye) ────────────────────────
  sock.ev.on('group-participants.update', async ({ id: jid, participants, action }) => {
    const gs = db.getGroup(jid);
    for (const participant of participants) {
      try {
        const meta = await sock.groupMetadata(jid);
        const gName = meta.subject;
        const num   = participant.split('@')[0];

        if (action === 'add' && gs.welcome) {
          const text = (gs.sWelcome || 'Welcome @{name} to *{group}*! 👋')
            .replace('{name}', `@${num}`).replace('{group}', gName);
          const img = path.join(__dirname, 'data', 'group_images', `welcome_${jid.replace(/@.*/,'')}.jpg`);
          if (fs.existsSync(img)) {
            await sock.sendMessage(jid, { image: fs.readFileSync(img), caption: text, mentions: [participant] });
          } else {
            await sock.sendMessage(jid, { text, mentions: [participant] });
          }
        }

        if (action === 'remove' && gs.goodbye) {
          const text = (gs.sGoodbye || "Goodbye @{name}! We'll miss you 👋")
            .replace('{name}', `@${num}`).replace('{group}', gName);
          const img = path.join(__dirname, 'data', 'group_images', `goodbye_${jid.replace(/@.*/,'')}.jpg`);
          if (fs.existsSync(img)) {
            await sock.sendMessage(jid, { image: fs.readFileSync(img), caption: text, mentions: [participant] });
          } else {
            await sock.sendMessage(jid, { text, mentions: [participant] });
          }
        }
      } catch {}
    }
  });

  // ── Incoming messages ──────────────────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    // Cache every event type first. Outgoing owner messages can arrive as `append`,
    // while the later native reaction usually arrives as `notify`.
    for (const message of messages) {
      if (message.key?.remoteJid && message.key?.id && message.message) {
        cacheMsg(message.key.remoteJid, message.key.id, message.message);
      }
    }
    // `notify` = new messages pushed to device; history events are cache-only.
    if (type !== 'notify') return;

    for (const message of messages) {
      try {
        await handleMessage(sock, message);
      } catch (e) {
        err('Unhandled error in message handler', e);
      }
    }
  });

  return sock;
}

// ── Message handler ────────────────────────────────────────────────────────
async function handleMessage(sock, message) {
  // ── Basic guards ──────────────────────────────────────────────────────
  if (!message?.message)        return; // no content
  if (!message.key.remoteJid)   return; // no destination

  const jid      = message.key.remoteJid;
  const isGroup  = helpers.isGroupJid(jid);
  const sender   = helpers.getSenderJid(message, isGroup);
  if (!sender) return;

  // ── Extract plain text from all message types ─────────────────────────
  const text = helpers.getMessageText(message);

  debug(`MSG from ${sender} in ${jid}: "${text.slice(0, 80)}"`);

  if (!text) return; // no usable text

  // An owner emoji reply to view-once media saves that media directly to the owner DM.
  const emojiContext = getEmojiReplyContext(message);
  const ownerForViewOnce = botConfig.ownerJid || (botConfig.ownerNumber ? `${botConfig.ownerNumber}@s.whatsapp.net` : '');
  const ownerReaction = Boolean(message.key?.fromMe) || helpers.resolveIsOwner(message, sender, botConfig);
  if (isEmojiOnly(text) && emojiContext?.quotedMessage && ownerReaction) {
    try {
      if (await forwardViewOnceToOwner(sock, ownerForViewOnce, text.trim(), emojiContext, jid)) return;
    } catch (e) {
      await sock.sendMessage(ownerForViewOnce || jid, {
        text: `❌ Could not save the view-once media.\n\n${e.message || 'Media download failed.'}`
      }).catch(() => {});
      return;
    }
  }

  // WhatsApp marks messages sent from the linked owner account as fromMe.
  // Allow only prefixed self-commands; ordinary bot replies are not commands
  // and remain ignored, preventing response loops.
  const prefix = botConfig.prefix || '.';
  if (message.key.fromMe && !text.startsWith(prefix)) return;

  // ── Auto-read ─────────────────────────────────────────────────────────
  if (botConfig.ownerJid && db.getOwnerSetting(botConfig.ownerJid, 'autoRead', false)) {
    sock.readMessages([message.key]).catch(() => {});
  }

  // ── Trivia live-answer check (no prefix needed) ───────────────────────
  if (gamesModule?._checkTrivia) {
    try {
      const tr = gamesModule._checkTrivia(text, jid);
      if (tr?.correct) {
        await sock.sendMessage(jid, {
          text: `🎉 *Correct!* @${sender.split('@')[0]} got it!\n\nAnswer: *${String(tr.answer).toUpperCase()}*`,
          mentions: [sender]
        });
      }
    } catch {}
  }

  // ── Anti-link enforcement (groups only) ───────────────────────────────
  if (isGroup) {
    const gs = db.getGroup(jid);
    if (gs.antiLink) {
      const linkRe = /(https?:\/\/|www\.|chat\.whatsapp\.com|t\.me\/)/i;
      if (linkRe.test(text)) {
        const isAdmin = await helpers.isGroupAdmin(sock, jid, sender).catch(() => false);
        const isOwner = helpers.resolveIsOwner(message, sender, botConfig);
        if (!isAdmin && !isOwner) {
          // Every configured action removes the offending message first.
          try { await sock.sendMessage(jid, { delete: message.key }); } catch {}
          const action = ['delete', 'warn', 'kick'].includes(String(gs.antiLinkAction || '').toLowerCase())
            ? String(gs.antiLinkAction).toLowerCase()
            : 'delete';

          if (action === 'warn') {
            const count = db.addWarning(sender);
            const max = gs.maxWarnings || 3;
            await sock.sendMessage(jid, {
              text: `🔗 @${sender.split('@')[0]} links are not allowed here! ⚠️ Warning ${count}/${max}`,
              mentions: [sender]
            }).catch(() => {});
            if (count >= max) {
              try {
                await sock.groupParticipantsUpdate(jid, [sender], 'remove');
                db.clearWarnings(sender);
              } catch {}
            }
          } else if (action === 'kick') {
            try { await sock.groupParticipantsUpdate(jid, [sender], 'remove'); } catch {}
          }
          // action === 'delete' intentionally stops after deleting the message.
          return;
        }
      }
    }
  }

  // ── Must start with prefix ─────────────────────────────────────────────
  if (!text.startsWith(prefix)) return;

  // ── Private-mode guard ────────────────────────────────────────────────
  // Private mode applies to all bot behavior, not only prefixed commands.
  // Keep the response limited to command-like messages so normal chat is not
  // interrupted, while making it clear to other users why their command did
  // not run.
  const isOwner = helpers.resolveIsOwner(message, sender, botConfig);
  const ownerSettingsJid = botConfig.ownerJid || (botConfig.ownerNumber ? `${botConfig.ownerNumber}@s.whatsapp.net` : sender);
  const sudoUsers = db.getOwnerSetting(ownerSettingsJid, 'sudoUsers', []);
  const isSudo = Array.isArray(sudoUsers) && sudoUsers.some(user => helpers.sameJid(user, sender));
  if (botConfig.mode === 'private' && !isOwner && !isSudo) {
    await sock.sendMessage(jid, {
      text: '🔒 Kira MD is currently in *private mode* and can only be used by the owner.'
    });
    return;
  }

  // ── Global ban check ──────────────────────────────────────────────────
  if (db.isUserBanned(sender)) return;

  // ── Parse command and args ────────────────────────────────────────────
  const parsed = helpers.parseCommandText(text, prefix);
  if (!parsed) return;
  const { command, args } = parsed;

  debug(`Command: .${command} | args: [${args.join(', ')}] | from: ${sender}`);

  const handler = allCommands[command];
  if (!handler || typeof handler.exec !== 'function') {
    debug(`Unknown command: .${command}`);
    return; // silently ignore unknown commands
  }

  const chatContext = await helpers.getChatContext(sock, message);
  chatContext.isOwner = isOwner;
  chatContext.isSudo = isSudo;
  chatContext.messageContext = helpers.getMessageContext(message);

  if (!isChatTypeAllowed(handler, chatContext)) {
    await sock.sendMessage(jid, {
      text: handler.chatType === 'dm'
        ? '❌ This command only works in private chats.'
        : '❌ This command only works in groups.'
    });
    return;
  }

  if (!hasPermission(handler.permissions, chatContext)) {
    const permissionMessage = handler.permissions === 'owner'
      ? '🔒 This command is *owner-only*.'
      : handler.permissions === 'admin_or_owner'
        ? '❌ Only group admins or the owner can use this command.'
      : '❌ Only group admins can use this command.';
    await sock.sendMessage(jid, { text: permissionMessage });
    return;
  }

  if (handler.requiresBotAdmin && chatContext.isGroup && !chatContext.isBotAdmin) {
    await sock.sendMessage(jid, {
      text: '❌ I need to be a group admin to use this command.'
    });
    return;
  }

  // ── XP reward ─────────────────────────────────────────────────────────
  try { db.addXP(sender, 10); } catch {}

  // ── Typing indicator ──────────────────────────────────────────────────
  if (botConfig.ownerJid && db.getOwnerSetting(botConfig.ownerJid, 'autoTyping', false)) {
    sock.sendPresenceUpdate('composing', jid).catch(() => {});
  }

  // ── Execute command ───────────────────────────────────────────────────
  try {
    await helpers.withCommandContext(
      { command: `.${command}`, sender, jid },
      () => handler.exec(args, sock, jid, isGroup, sender, message, botConfig, chatContext)
    );
    log(`.${command} executed for ${sender.split('@')[0]}`);
  } catch (e) {
    logCommandFailure(command, sender, jid, e);
    try {
      await sock.sendMessage(jid, {
        text: `❌ *Command failed safely.*\n\nThe command could not complete. Please try again later.\n\n_Contact support: ${ownerContact(botConfig)}_`
      });
    } catch {}
  }

  // ── Clear typing indicator ────────────────────────────────────────────
  if (botConfig.ownerJid && db.getOwnerSetting(botConfig.ownerJid, 'autoTyping', false)) {
    sock.sendPresenceUpdate('paused', jid).catch(() => {});
  }
}

function isChatTypeAllowed(handler, context) {
  const type = handler?.chatType || 'both';
  return type === 'both' ||
    (type === 'group' && context.isGroup) ||
    (type === 'dm' && !context.isGroup);
}

function hasPermission(permission, context) {
  switch (String(permission || 'all').toLowerCase()) {
    case 'owner':
      return context.isOwner;
    case 'admin':
    case 'admin_or_owner':
      return context.isOwner || (context.isGroup && context.isSenderAdmin);
    case 'all':
    default:
      return true;
  }
}

// ── Graceful shutdown ──────────────────────────────────────────────────────
process.on('uncaughtException',  (e) => err('Uncaught exception', e));
process.on('unhandledRejection', (e) => err('Unhandled rejection', e));

// ── Start ─────────────────────────────────────────────────────────────────
// The generic Pterodactyl Node template may invoke .js files through
// `ts-node --esm`. In that mode require.main !== module, so the old guard
// silently skipped startup and the panel saw a clean exit (code 0).
const launchedAsScript = process.argv[1]
  ? path.resolve(process.argv[1]) === __filename
  : false;
if (require.main === module || launchedAsScript) {
  printBanner();
  connectToWhatsApp().catch((e) => {
    err('Fatal startup error', e);
    process.exit(1);
  });
}

module.exports = {
  botConfig,
  handleMessage,
  parseCommandText: helpers.parseCommandText,
  getSenderJid: helpers.getSenderJid,
  isChatTypeAllowed,
  hasPermission,
  getCommandHealth: () => typeof allCommands.healthReport === 'function'
    ? allCommands.healthReport()
    : null,
  isEmojiOnly,
  getViewOncePayload,
  getEmojiReplyContext,
  cacheMsg,
  forwardViewOnceToOwner
};
