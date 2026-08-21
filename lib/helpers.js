'use strict';
// lib/helpers.js — Shared helper utilities for Kira MD

const { AsyncLocalStorage } = require('async_hooks');
const commandContextStorage = new AsyncLocalStorage();

// ── JID helpers ────────────────────────────────────────────────────────────
function normalizeJid(jid) {
  if (!jid) return '';
  return jid.replace(/^\+/, '').replace(/@.*$/, '') + '@s.whatsapp.net';
}

function stripDevice(jid) {
  return (jid || '').replace(/:\d+@/, '@');
}

function unwrapMessage(message) {
  let current = message?.message || message || null;
  for (let i = 0; i < 6 && current; i++) {
    const nested =
      current.ephemeralMessage?.message ||
      current.viewOnceMessage?.message ||
      current.viewOnceMessageV2?.message ||
      current.viewOnceMessageV2Extension?.message ||
      current.documentWithCaptionMessage?.message ||
      current.deviceSentMessage?.message ||
      current.editedMessage?.message;
    if (!nested) break;
    current = nested;
  }
  return current;
}

function getMessageText(message) {
  const msg = unwrapMessage(message);
  if (!msg) return '';
  const value =
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    msg.buttonsResponseMessage?.selectedButtonId ||
    msg.listResponseMessage?.singleSelectReply?.selectedRowId ||
    msg.templateButtonReplyMessage?.selectedId ||
    '';
  return String(value).trim();
}

function tokenizeCommand(body) {
  const tokens = [];
  const tokenPattern = /"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)'|(\S+)/g;
  let match;
  while ((match = tokenPattern.exec(body)) !== null) {
    const value = match[1] ?? match[2] ?? match[3] ?? '';
    tokens.push(value.replace(/\\(["'\\])/g, '$1'));
  }
  return tokens;
}

function parseCommandText(text, prefix) {
  const configuredPrefix = String(prefix ?? '.');
  const source = String(text || '');
  if (!configuredPrefix || !source.startsWith(configuredPrefix)) return null;

  const body = source.slice(configuredPrefix.length).trim();
  if (!body) return null;
  const tokens = tokenizeCommand(body);
  const command = tokens.shift()?.toLowerCase() || '';
  if (!command) return null;
  return { command, args: tokens, body };
}

function getMessageContext(message) {
  const msg = unwrapMessage(message);
  if (!msg) return null;

  const candidates = [
    msg.extendedTextMessage,
    msg.imageMessage,
    msg.videoMessage,
    msg.audioMessage,
    msg.stickerMessage,
    msg.documentMessage,
    msg.buttonsResponseMessage,
    msg.listResponseMessage,
    msg.templateButtonReplyMessage,
    ...Object.values(msg).filter(value => value && typeof value === 'object')
  ];
  const source = candidates.find(value => value?.contextInfo);
  const ctx = source?.contextInfo;
  if (!ctx?.quotedMessage) return null;

  const remoteJid = ctx.remoteJid || message?.key?.remoteJid || '';
  const participant = ctx.participant || ctx.participantAlt || '';
  const key = {
    remoteJid,
    id: ctx.stanzaId || '',
    fromMe: false,
    ...(participant ? { participant } : {})
  };

  return {
    quotedMessage: ctx.quotedMessage,
    quotedSender: participant,
    quotedParticipant: participant,
    stanzaId: ctx.stanzaId || '',
    participant,
    remoteJid,
    quotedKey: key,
    mediaType: getMessageType(ctx.quotedMessage)
  };
}

function getMessageType(message) {
  const msg = unwrapMessage({ message });
  if (!msg) return null;
  return Object.keys(msg).find(key => key.endsWith('Message')) || null;
}

function getMentionedJid(message) {
  const msg = unwrapMessage(message);
  if (!msg) return null;
  const candidates = [
    msg.extendedTextMessage,
    msg.imageMessage,
    msg.videoMessage,
    msg.audioMessage,
    msg.stickerMessage,
    msg.documentMessage,
    msg.buttonsResponseMessage,
    msg.listResponseMessage,
    ...Object.values(msg).filter(value => value && typeof value === 'object')
  ];
  const ctx = candidates.find(value => value?.contextInfo)?.contextInfo;
  return ctx?.mentionedJid?.[0] || null;
}

function getSenderJid(message, isGroup = isGroupJid(message?.key?.remoteJid)) {
  const key = message?.key || {};
  const remoteJid = key.remoteJid || '';
  if (isGroup) {
    // A group JID is a destination, never a user identity.
    const participant = key.participant || message?.participant || '';
    if (/@lid$/.test(participant) && (key.participantAlt || message?.participantAlt)) {
      return key.participantAlt || message.participantAlt;
    }
    return participant || key.participantAlt || message?.participantAlt || '';
  }
  // LID-based direct chats commonly carry the phone JID in the alternate field.
  if (/@lid$/.test(remoteJid) && (key.remoteJidAlt || message?.remoteJidAlt)) {
    return key.remoteJidAlt || message.remoteJidAlt;
  }
  return remoteJid || key.remoteJidAlt || message?.remoteJidAlt || '';
}

function isGroupJid(jid) {
  return typeof jid === 'string' && jid.endsWith('@g.us');
}

function comparableJid(jid) {
  const value = stripDevice(String(jid || ''));
  const [local, domain = ''] = value.split('@');
  if (domain === 's.whatsapp.net' || domain === 'c.us' || domain === 'lid') {
    return `user:${local.replace(/\D/g, '') || local}`;
  }
  return `${domain}:${local}`;
}

function sameJid(left, right) {
  return Boolean(left && right && comparableJid(left) === comparableJid(right));
}

async function getChatContext(sock, message) {
  const jid = message?.key?.remoteJid || '';
  const isGroup = isGroupJid(jid);
  const sender = getSenderJid(message, isGroup);
  const context = {
    jid,
    sender,
    isGroup,
    groupMetadata: null,
    isSenderAdmin: false,
    isBotAdmin: false,
    botJid: sock?.user?.id || ''
  };

  if (!isGroup || !jid || typeof sock?.groupMetadata !== 'function') return context;
  try {
    const metadata = await sock.groupMetadata(jid);
    context.groupMetadata = metadata;
    const participants = Array.isArray(metadata?.participants) ? metadata.participants : [];
    const senderParticipant = participants.find(p => participantMatches(p, sender));
    const botIds = [
      context.botJid,
      sock?.user?.lid,
      sock?.user?.jid,
      sock?.user?.phoneNumber,
      sock?.user?.phone
    ].filter(Boolean);
    const botParticipant = participants.find(p => botIds.some(id => participantMatches(p, id)));
    context.isSenderAdmin = participantIsAdmin(senderParticipant);
    context.isBotAdmin = botParticipant ? participantIsAdmin(botParticipant) : false;
  } catch (_) {
    // Command-level group checks still provide a clear response if metadata is unavailable.
  }
  return context;
}

function participantMatches(participant, jid) {
  if (!participant || !jid) return false;
  const ids = [participant.id, participant.jid, participant.phoneNumber, participant.phone, participant.idAlt, participant.lid].filter(Boolean);
  return ids.some(id => sameJid(id, jid));
}

function participantIsAdmin(participant) {
  if (!participant) return false;
  return participant.admin === 'admin' || participant.admin === 'superadmin' ||
    participant.isAdmin === true || participant.isSuperAdmin === true;
}

// ── Check if sender is a group admin ──────────────────────────────────────
async function isGroupAdmin(sock, jid, sender) {
  try {
    const meta = await sock.groupMetadata(jid);
    return meta.participants.some(
      p => participantMatches(p, sender) && participantIsAdmin(p)
    );
  } catch { return false; }
}

// ── Check if sender is the bot owner ──────────────────────────────────────
function resolveIsOwner(message, sender, botConfig) {
  const cfg = botConfig || global.botConfig || {};
  const ownerNum = String(cfg.ownerNumber || '').replace(/\D/g, '');
  const candidates = [
    sender,
    cfg.botJid,
    cfg.connectedJid,
    message?.key?.participant,
    message?.participant,
    message?.key?.participantAlt,
    message?.participantAlt,
    message?.key?.remoteJidAlt
  ];

  // In a direct chat the remote JID is also the sender. In a group it is the
  // group ID and must not be used for owner checks.
  const remoteJid = message?.key?.remoteJid || '';
  if (!remoteJid.includes('@g.us')) candidates.push(remoteJid);

  return candidates.some((candidate) => {
    const value = String(candidate || '');
    if (!value || value.includes('@g.us')) return false;
    if (cfg.botJid && sameJid(value, cfg.botJid)) return true;
    if (cfg.connectedJid && sameJid(value, cfg.connectedJid)) return true;
    const candidateNum = value.split('@')[0].split(':')[0].replace(/\D/g, '');
    return Boolean(ownerNum && candidateNum === ownerNum);
  });
}

// ── Toggle emoji ──────────────────────────────────────────────────────────
function toggleEmoji(val) {
  return val ? '✅' : '❌';
}

// ── Format large numbers ──────────────────────────────────────────────────
function formatNumber(n) {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

// ── Get group metadata safely ─────────────────────────────────────────────
async function getGroupMetadata(sock, jid) {
  try { return await sock.groupMetadata(jid); } catch { return null; }
}

// ── Random pick ───────────────────────────────────────────────────────────
function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Sleep helper ──────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function commandErrorMessage(command, error, context = {}) {
  const actual = error instanceof Error ? error : new Error(String(error || 'Unknown error'));
  const active = commandContextStorage.getStore() || {};
  const details = {
    command: command || active.command || 'unknown command',
    sender: context.sender || active.sender || 'unknown',
    jid: context.jid || active.jid || 'unknown'
  };
  console.error(
    `[Kira MD] ❌ ${details.command} failed | sender=${details.sender} | chat=${details.jid}`,
    actual.stack || actual.message
  );
  return `❌ ${details.command} failed. Please try again later.`;
}

function withCommandContext(context, callback) {
  return commandContextStorage.run(context || {}, callback);
}

module.exports = {
  normalizeJid, stripDevice, unwrapMessage, getMessageText,
  tokenizeCommand, parseCommandText, getMessageContext, getMessageType,
  getMentionedJid, getSenderJid, isGroupJid, sameJid, getChatContext,
  participantMatches, participantIsAdmin, isGroupAdmin, resolveIsOwner, toggleEmoji,
  formatNumber, getGroupMetadata, randomPick, sleep,
  commandErrorMessage, withCommandContext
};
