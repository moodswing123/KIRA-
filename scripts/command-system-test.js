'use strict';

// Safe command-dispatch tests. Baileys and provider SDKs are stubbed so this
// script never connects to WhatsApp or calls external APIs.
const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;
const noop = async () => Buffer.from('');
const stubs = new Map([
  ['dotenv', { config() {} }],
  ['pino', () => ({})],
  ['axios', { get: async () => ({ data: {} }), post: async () => ({ data: {} }) }],
  ['openai', { OpenAI: class {} }],
  ['@anthropic-ai/sdk', class {}],
  ['@google/generative-ai', { GoogleGenerativeAI: class {} }],
  ['@whiskeysockets/baileys', {
    default() {},
    DisconnectReason: {},
    useMultiFileAuthState: async () => ({
      state: { creds: { registered: true } },
      saveCreds() {}
    }),
    fetchLatestBaileysVersion: async () => ({ version: [1, 0, 0] }),
    jidNormalizedUser: id => id,
    downloadMediaMessage: noop,
    downloadContentFromMessage: async function* () {}
  }]
]);

Module._load = function patchedLoad(request, parent, isMain) {
  return stubs.has(request)
    ? stubs.get(request)
    : originalLoad.call(this, request, parent, isMain);
};

process.env.BOT_PREFIX = '.';
process.env.BOT_MODE = 'public';
process.env.OWNER_NUMBER = '2348000000000';

const db = require('../lib/database');
const { botConfig, handleMessage, hasPermission, getCommandHealth } = require('../index');
const registry = require('../commands');
const { commandErrorMessage } = require('../lib/helpers');
const sent = [];
const sock = {
  user: { id: '9999999999999:1@s.whatsapp.net' },
  async groupMetadata() {
    return {
      subject: 'Isolated test group',
      participants: [
        { id: '2348000000000@s.whatsapp.net', admin: 'admin' },
        { id: '2348111111111@s.whatsapp.net', admin: null },
        { id: '9999999999999@s.whatsapp.net', admin: this.botIsAdmin ? 'admin' : null }
      ]
    };
  },
  async sendMessage(jid, content) {
    if (this.failMenuMedia && (content?.video || content?.image)) {
      throw new Error('simulated expired menu media URL');
    }
    sent.push({ jid, content });
    return { key: { id: 'test-sent' } };
  },
  async sendPresenceUpdate() {}
};

function message(jid, text, key = {}) {
  return {
    key: { remoteJid: jid, fromMe: false, id: `test-${sent.length}`, ...key },
    message: { conversation: text }
  };
}

async function dispatch(jid, text, key = {}) {
  const before = sent.length;
  await handleMessage(sock, message(jid, text, key));
  return sent.slice(before);
}

async function main() {
  const dm = '2348111111111@s.whatsapp.net';
  const owner = '2348000000000@s.whatsapp.net';
  const group = '12345-678@g.us';

  const health = getCommandHealth();
  assert(health && health.loaded > 0, 'registry should load commands');
  assert.strictEqual(health.failedModules.length, 0, 'core modules should load');
  assert.strictEqual(health.duplicateNames.length, 0, 'duplicate command names');
  assert.strictEqual(health.duplicateAliases.length, 0, 'duplicate aliases');

  assert.strictEqual((await dispatch(dm, 'random text')).length, 0, 'random text executed');
  assert.strictEqual((await dispatch(dm, '.')).length, 0, 'empty command executed');
  assert.strictEqual((await dispatch(dm, '.notarealcommand')).length, 0, 'invalid command executed');

  assert((await dispatch(dm, '.ping')).some(item => /Pong/.test(item.content.text || '')), 'valid command failed');
  assert((await dispatch(dm, '.speed')).some(item => /Pong/.test(item.content.text || '')), 'alias failed');
  assert((await dispatch(dm, '.PING')).some(item => /Pong/.test(item.content.text || '')), 'uppercase command failed');
  assert((await dispatch(dm, '.ping', { fromMe: true })).some(item => /Pong/.test(item.content.text || '')), 'owner self-command failed');
  assert.strictEqual((await dispatch(dm, 'ordinary owner text', { fromMe: true })).length, 0, 'ordinary self-message should be ignored');

  // Verify owner-controlled mode transitions and routing in DMs and groups.
  await dispatch(owner, '.private', { fromMe: true });
  assert.strictEqual(db.getSetting('botMode'), 'private', 'private mode was not persisted');
  assert.strictEqual(process.env.BOT_MODE, 'public', 'test must keep public env fallback to catch override bugs');
  // An explicit private environment setting must not be weakened by a stale
  // persisted public setting.
  process.env.BOT_MODE = 'private';
  db.setSetting('botMode', 'public');
  assert.strictEqual(
    (await dispatch(dm, '.ping')).length,
    0,
    'BOT_MODE=private must override a stale persisted public setting'
  );
  db.setSetting('botMode', 'private');
  process.env.BOT_MODE = 'public';
  // A connected bot JID is a comparison target, not an incoming sender.
  // Regression coverage: it must not make every user look like the owner.
  botConfig.botJid = sock.user.id;
  botConfig.connectedJid = sock.user.id;
  const blockedDm = await dispatch(dm, '.ping');
  assert.strictEqual(blockedDm.length, 0, 'private mode must silently ignore another DM user');
  const blockedGroup = await dispatch(group, '.ping', { participant: dm });
  assert.strictEqual(blockedGroup.length, 0, 'private mode must silently ignore another group user');
  db.updateGroup(group, { antiLink: true, antiLinkAction: 'warn' });
  const blockedAutomaticResponse = await dispatch(
    group,
    'please review https://example.com',
    { participant: dm }
  );
  assert.strictEqual(
    blockedAutomaticResponse.length,
    0,
    'private mode must silence automatic group responses too'
  );
  db.updateGroup(group, { antiLink: false });
  const ownerPrivate = await dispatch(owner, '.ping', { fromMe: true });
  assert(ownerPrivate.some(item => /Pong/.test(item.content.text || '')), 'owner command failed in private mode');
  // Linked-device owner commands can target another chat while fromMe points
  // to the account owner rather than the chat recipient.
  assert(
    (await dispatch(dm, '.ping', { fromMe: true })).some(item => /Pong/.test(item.content.text || '')),
    'fromMe owner command failed in private mode'
  );
  await dispatch(owner, '.public', { fromMe: true });
  assert((await dispatch(dm, '.ping')).some(item => /Pong/.test(item.content.text || '')), 'public mode did not allow another DM user');
  assert((await dispatch(group, '.ping', { participant: dm })).some(item => /Pong/.test(item.content.text || '')), 'public mode did not allow another group user');

  // A previously configured menu media URL can expire after the bot starts.
  // Menu delivery must fall back to text instead of entering the generic
  // command-failure path.
  db.setSetting('menuVideoUrl', 'https://example.com/menu.mp4');
  sock.failMenuMedia = true;
  try {
    const menuFallback = await dispatch(dm, '.menu');
    assert(menuFallback.some(item => /COMMAND CENTER/.test(item.content.text || '')), 'menu did not fall back to text after media failure');
  } finally {
    sock.failMenuMedia = false;
    db.setSetting('menuVideoUrl', '');
    db.setSetting('menuImageUrl', '');
  }

  const help = await dispatch(dm, '.help ping');
  assert(help.some(item => /Help/.test(item.content.text || '') && /\.ping/.test(item.content.text || '')), 'arguments failed');
  assert((await dispatch(dm, '.help')).some(item => /Usage/.test(item.content.text || '')), 'missing argument handling failed');

  assert((await dispatch(dm, '.groupinfo')).some(item => /only works in groups/.test(item.content.text || '')), 'DM group guard failed');
  assert((await dispatch(group, '.tagall hello', { participant: dm }))
    .some(item => /Only group admins/.test(item.content.text || '')), 'unauthorized admin command executed');
  assert((await dispatch(group, '.tagall hello', { participant: owner }))
    .some(item => /hello/.test(item.content.text || '')), 'authorized admin command failed');
  assert((await dispatch(dm, '.dashboard')).some(item => /owner-only/.test(item.content.text || '')), 'unauthorized owner command executed');
  assert((await dispatch(owner, '.dashboard')).some(item => /Owner Dashboard/.test(item.content.text || '')), 'owner command failed');
  const healthMessage = await dispatch(owner, '.commandtest');
  assert(healthMessage.some(item => /KIRA-MD COMMAND HEALTH/.test(item.content.text || '')), 'command health command failed');
  assert(healthMessage.some(item => /Executed successfully: not measured/.test(item.content.text || '')), 'health distinction missing');

  sock.botIsAdmin = false;
  try {
    const botAdminGuard = await dispatch(group, '.mute', { participant: owner });
    assert(botAdminGuard.some(item => /need to be a group admin/.test(item.content.text || '')), 'bot-admin guard failed');
  } finally {
    sock.botIsAdmin = true;
  }

  const originalBanned = db.isUserBanned;
  db.isUserBanned = () => true;
  try {
    assert.strictEqual((await dispatch(dm, '.ping')).length, 0, 'banned user executed');
  } finally {
    db.isUserBanned = originalBanned;
  }

  assert.strictEqual(hasPermission('owner', { isOwner: false, isGroup: false }), false);
  assert.strictEqual(hasPermission('owner', { isOwner: true, isGroup: false }), true);
  assert.strictEqual(hasPermission('admin', { isOwner: false, isGroup: false, isSenderAdmin: true }), false);
  assert.strictEqual(hasPermission('admin', { isOwner: false, isGroup: true, isSenderAdmin: true }), true);

  const originalPing = registry.ping.exec;
  registry.ping.exec = async () => {
    throw new Error('SECRET_API_KEY=must-not-be-sent');
  };
  try {
    const failure = await dispatch(dm, '.ping');
    const failureText = failure.map(item => item.content.text || '').join('\n');
    assert(/failed safely/i.test(failureText), 'handler failure should be user-friendly');
    assert(!/SECRET_API_KEY|must-not-be-sent/.test(failureText), 'handler leaked raw error');
  } finally {
    registry.ping.exec = originalPing;
  }

  const redacted = commandErrorMessage('test command', new Error('TOKEN=hidden'), {
    sender: dm,
    jid: dm
  });
  assert(!/TOKEN=hidden/.test(redacted), 'local error helper leaked raw error');

  console.log(`command dispatch tests passed: ${health.loaded} commands, ${health.aliases} aliases`);
}

main().catch(error => {
  console.error(`command dispatch tests failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});