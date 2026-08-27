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

const MESSAGE_HANDLER_TIMEOUT_MS = 60000;
const COMMAND_HANDLER_TIMEOUT_MS = 45000;

function withTimeout(task, timeoutMs, label) {
  let timer;
  const operation = typeof task === 'function' ? Promise.resolve().then(task) : Promise.resolve(task);
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
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
  const directMediaType = current?.imageMessage?.viewOnce ? 'image' :
    current?.videoMessage?.viewOnce ? 'video' :
    current?.audioMessage?.viewOnce ? 'audio' : null;
  if (directMediaType) sawViewOnce = true;
  if (!sawViewOnce) return null;
  const type = current?.imageMessage ? 'image' : current?.videoMessage ? 'video' : current?.audioMessage ? 'audio' : null;
  return type ? { message: current, media: current[`${type}Message`], type } : null;
}

function findReactionMessage(message) {
  let current = message?.message || message || null;
  for (let i = 0; i < 8 && current; i++) {
    if (current.reactionMessage) return current.reactionMessage;
    const protocol = current.protocolMessage;
    if (protocol?.reactionMessage) return protocol.reactionMessage;
    if (protocol?.editedMessage?.message?.reactionMessage) return protocol.editedMessage.message.reactionMessage;
    const nested = current.ephemeralMessage?.message ||
      current.deviceSentMessage?.message || current.editedMessage?.message ||
      protocol?.editedMessage?.message;
    if (!nested) break;
    current = nested;
  }
  return null;
}

function findReferencedMessageKey(message) {
  const reaction = findReactionMessage(message);
  if (reaction?.key?.id) return reaction.key;
  let current = message?.message || message || null;
  for (let i = 0; i < 8 && current; i++) {
    if (current.protocolMessage?.key?.id) return current.protocolMessage.key;
    const nested = current.ephemeralMessage?.message || current.deviceSentMessage?.message || current.editedMessage?.message;
    if (!nested) break;
    current = nested;
  }
  return null;
}

function getEmojiReplyContext(message) {
  const context = helpers.getMessageContext(message);
  if (context?.quotedMessage) return context;

  const reaction = findReactionMessage(message);
  const targetKey = findReferencedMessageKey(message) || reaction?.key;
  const emoji = reaction?.text || reaction?.emoji || '';
  if (!emoji || !targetKey?.id) return null;
  const remoteJid = targetKey.remoteJid || context?.remoteJid || message?.key?.remoteJid || '';
  const quotedMessage = findStoredMessage(remoteJid, targetKey.id);
  debug(`VIEW-ONCE reference text=${JSON.stringify(emoji)} target=${remoteJid}:${targetKey.id} cached=${Boolean(msgCache.get(`${remoteJid}:${targetKey.id}`))} stored=${Boolean(quotedMessage)}`);
  if (!quotedMessage) return null;
  return {
    quotedMessage,
    quotedSender: targetKey.participant || '',
    quotedParticipant: targetKey.participant || '',
    stanzaId: targetKey.id,
    participant: targetKey.participant || '',
    remoteJid,
    quotedKey: targetKey,
    mediaType: helpers.getMessageType ? helpers.getMessageType(quotedMessage) : null,
    emoji
  };
}

async function forwardViewOnceToOwner(sock, ownerJid, emoji, context, fallbackJid, downloadMedia = downloadMediaMessage) {
  const viewOnce = getViewOncePayload(context?.quotedMessage);
  if (!viewOnce) {
    log('VIEW-ONCE save skipped: quoted message has no supported view-once wrapper/media');
    return false;
  }
  if (!ownerJid) {
    log('VIEW-ONCE save skipped: owner DM JID is unavailable');
    return false;
  }
  log(`VIEW-ONCE save start type=${viewOnce.type} target=${context.remoteJid || fallbackJid}:${context.stanzaId || 'unknown'}`);
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
  log(`VIEW-ONCE media downloaded type=${viewOnce.type} bytes=${buffer?.length || 0}`);
  if (viewOnce.type === 'image') {
    await sock.sendMessage(ownerJid, { image: buffer, caption: `👁️ Saved from view-once reply ${emoji}` });
  } else if (viewOnce.type === 'video') {
    await sock.sendMessage(ownerJid, { video: buffer, caption: `👁️ Saved from view-once reply ${emoji}` });
  } else {
    await sock.sendMessage(ownerJid, { audio: buffer, mimetype: 'audio/ogg; codecs=opus', ptt: true });
  }
  log(`VIEW-ONCE forwarded to owner=${ownerJid} type=${viewOnce.type}`);
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
  // A mode changed with .private/.public is persisted and remains authoritative
  // across restarts. BOT_MODE is only the first-run fallback.
  mode:        normalizeBotMode(
    db.getSetting('botMode', null) || process.env.BOT_MODE || 'public'
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
const LOCAL_MESSAGE_STORE_PATH = path.join(__dirname, 'data', 'view_once_messages.json');
let localMessageStore = new Map();
let localStoreTimer = null;
try {
  const saved = JSON.parse(fs.readFileSync(LOCAL_MESSAGE_STORE_PATH, 'utf8'));
  if (saved && typeof saved === 'object') localMessageStore = new Map(Object.entries(saved));
} catch {}

function hasViewOnceWrapper(content) {
  let current = content;
  for (let i = 0; i < 8 && current; i++) {
    const keys = Object.keys(current);
    if (keys.some(key => /viewOnceMessage/i.test(key))) return true;
    if (current.imageMessage?.viewOnce || current.videoMessage?.viewOnce || current.audioMessage?.viewOnce) return true;
    current = current.ephemeralMessage?.message || current.deviceSentMessage?.message || current.editedMessage?.message || null;
  }
  return false;
}

function persistLocalMessage(key, content) {
  if (!hasViewOnceWrapper(content)) return;
  localMessageStore.set(key, content);
  while (localMessageStore.size > 200) localMessageStore.delete(localMessageStore.keys().next().value);
  if (localStoreTimer) clearTimeout(localStoreTimer);
  localStoreTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(LOCAL_MESSAGE_STORE_PATH), { recursive: true });
      fs.writeFileSync(LOCAL_MESSAGE_STORE_PATH, JSON.stringify(Object.fromEntries(localMessageStore)));
    } catch {}
  }, 250);
}

function findStoredMessage(jid, id) {
  if (!jid || !id) return null;
  const key = `${jid}:${id}`;
  return msgCache.get(key) || localMessageStore.get(key) || null;
}

function cacheMsg(jid, id, content) {
  const key = `${jid}:${id}`;
  msgCache.set(key, content);
  persistLocalMessage(key, content);
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
let reconnectTimer = null;
let activeSocket = null;

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToWhatsApp().catch((error) => {
      err('Reconnect attempt failed', error);
      scheduleReconnect();
    });
  }, 5000);
}

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
      return findStoredMessage(key.remoteJid, key.id) || undefined;
    }
  });
  activeSocket = sock;

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
      // Ignore close events from an obsolete socket after a reconnect.
      if (activeSocket !== sock) return;
      activeSocket = null;
      const code = lastDisconnect?.error?.output?.statusCode;
      err(`Connection closed (code ${code ?? 'unknown'})`);
      if (code === DisconnectReason.loggedOut) {
        warn('Logged out — delete auth_info_baileys/ folder and restart');
      } else {
        log('Reconnecting in 5 seconds...');
        scheduleReconnect();
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
  // Baileys may emit overlapping upsert batches. Process them serially so
  // long-running commands and reconnect traffic cannot race command state.
  let upsertQueue = Promise.resolve();
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    upsertQueue = upsertQueue.then(async () => {
    const batch = Array.isArray(messages) ? messages : [];
    log(`UPSERT batch type=${type || 'unknown'} count=${batch.length}`);

    // Cache every event type first. Outgoing owner messages can arrive as `append`,
    // while the later native reaction usually arrives as `notify`.
    for (const [index, message] of batch.entries()) {
      const raw = message?.message || {};
      const keys = Object.keys(raw);
      const keyText = keys.join(',') || 'none';
      const contextInfo = raw.extendedTextMessage?.contextInfo ||
        raw.imageMessage?.contextInfo || raw.videoMessage?.contextInfo ||
        raw.audioMessage?.contextInfo || raw.documentMessage?.contextInfo ||
        raw.ephemeralMessage?.message?.extendedTextMessage?.contextInfo || null;
      const reaction = findReactionMessage(message);
      const hasViewOnce = /viewOnce|viewOnceMessageV2Extension/i.test(keyText) ||
        Boolean(raw.ephemeralMessage?.message && /viewOnce|viewOnceMessageV2Extension/i.test(Object.keys(raw.ephemeralMessage.message).join(',')));
      const hasQuoted = Boolean(contextInfo?.quotedMessage);
      const hasReaction = Boolean(reaction);
      const jid = message?.key?.remoteJid || 'unknown';
      const participant = message?.key?.participant || message?.participant || '';
      log(`UPSERT item=${index} type=${type || 'unknown'} id=${message?.key?.id || 'unknown'} fromMe=${Boolean(message?.key?.fromMe)} chat=${jid} participant=${participant || 'none'} keys=${keyText} quoted=${hasQuoted} reaction=${hasReaction} reactionText=${hasReaction ? Boolean(reaction.text) : false} viewOnce=${hasViewOnce}`);

      if (message.key?.remoteJid && message.key?.id && message.message) {
        cacheMsg(message.key.remoteJid, message.key.id, message.message);
      }
    }

    // New messages are normally `notify`, but replies composed on the linked
    // owner device may arrive as `append`. Dispatch only relevant append
    // events so history replay does not execute ordinary commands.
    const hasRelevantContext = batch.some((message) => {
      const raw = message?.message || {};
      const quoted = Boolean(
        raw.extendedTextMessage?.contextInfo?.quotedMessage ||
        raw.imageMessage?.contextInfo?.quotedMessage ||
        raw.videoMessage?.contextInfo?.quotedMessage ||
        raw.audioMessage?.contextInfo?.quotedMessage ||
        raw.ephemeralMessage?.message?.extendedTextMessage?.contextInfo?.quotedMessage
      );
      return quoted || Boolean(findReactionMessage(message));
    });
    const shouldDispatch = type === 'notify' || hasRelevantContext;
    log(`UPSERT dispatch=${shouldDispatch ? 'yes' : 'cache-only'} type=${type || 'unknown'} relevantContext=${hasRelevantContext}`);
    if (!shouldDispatch) return;

          for (const message of batch) {
        try {
          await withTimeout(
            () => handleMessage(sock, message),
            MESSAGE_HANDLER_TIMEOUT_MS,
            'Message handler'
          );
        } catch (e) {
          err('Message handler recovered after failure/timeout', e);
        }
      }
    }).catch((e) => err('Unhandled messages.upsert queue error', e));
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

  // Log only reaction/view-once-shaped events before text extraction. This is
  // intentionally metadata-only: no message content or media is printed.
  const rawKeys = Object.keys(message.message || {});
  const hasReactionShape = rawKeys.some(key => /reaction|viewOnce|ephemeral|protocol/i.test(key));
  if (hasReactionShape) {
    log(`EVENT shape keys=${rawKeys.join(',')} sender=${sender} chat=${jid} id=${message.key.id || 'unknown'}`);
  }

  // ── Extract plain text from all message types ─────────────────────────
  const reactionText = findReactionMessage(message)?.text || findReactionMessage(message)?.emoji || '';
  const text = helpers.getMessageText(message) || reactionText;

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
  // Read the persisted setting for every command. This prevents a stale
  // in-memory value or panel BOT_MODE default from reopening private mode
  // after a reconnect/restart.
  const activeMode = normalizeBotMode(
    db.getSetting('botMode', null) || botConfig.mode || process.env.BOT_MODE || 'public'
  );
  botConfig.mode = activeMode;
  const isOwner = helpers.resolveIsOwner(message, sender, botConfig);
  const ownerSettingsJid = botConfig.ownerJid || (botConfig.ownerNumber ? `${botConfig.ownerNumber}@s.whatsapp.net` : sender);
  const sudoUsers = db.getOwnerSetting(ownerSettingsJid, 'sudoUsers', []);
  const isSudo = Array.isArray(sudoUsers) && sudoUsers.some(user => helpers.sameJid(user, sender));
  if (activeMode === 'private' && !isOwner && !isSudo) {
    await sock.sendMessage(jid, {
      text: '🔒 Kira MD is currently in *private mode* and can only be used by the owner or approved sudo users.'
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
      () => withTimeout(
        () => handler.exec(args, sock, jid, isGroup, sender, message, botConfig, chatContext),
        COMMAND_HANDLER_TIMEOUT_MS,
        `.${command} command`
      )
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
