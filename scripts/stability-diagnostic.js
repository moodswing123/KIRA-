'use strict';
const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const source = fs.readFileSync(require.resolve('../index'), 'utf8');

assert(source.includes('let reconnectTimer = null'), 'reconnect guard missing');
assert(source.includes('if (reconnectTimer) return'), 'duplicate reconnect protection missing');
assert(source.includes("let upsertQueue = Promise.resolve()"), 'upsert serialization missing');
assert(source.includes('MESSAGE_HANDLER_TIMEOUT_MS = 60000'), 'message timeout missing');
assert(source.includes('COMMAND_HANDLER_TIMEOUT_MS = 45000'), 'command timeout missing');
assert(source.includes("activeMode = normalizeBotMode"), 'authoritative mode read missing');

const originalLoad = Module._load;
const stubs = new Map([
  ['dotenv', { config() {} }],
  ['pino', () => ({})],
  ['axios', { get: async () => ({ data: {} }), post: async () => ({ data: {} }) }],
  ['openai', { OpenAI: class {} }],
  ['@anthropic-ai/sdk', class {}],
  ['@google/generative-ai', { GoogleGenerativeAI: class {} }],
  ['@whiskeysockets/baileys', {
    default() {}, DisconnectReason: {},
    useMultiFileAuthState: async () => ({ state: { creds: { registered: true } }, saveCreds() {} }),
    fetchLatestBaileysVersion: async () => ({ version: [1, 0, 0] }),
    jidNormalizedUser: id => id,
    downloadMediaMessage: async () => Buffer.from(''),
    downloadContentFromMessage: async function* () {}
  }]
]);
Module._load = function(request, parent, isMain) {
  return stubs.has(request) ? stubs.get(request) : originalLoad.call(this, request, parent, isMain);
};
process.env.BOT_MODE = 'public';
process.env.OWNER_NUMBER = '2348000000000';
const { handleMessage } = require('../index');
const sent = [];
const sock = {
  user: { id: '9999999999999:1@s.whatsapp.net' },
  async sendMessage(jid, content) { sent.push({ jid, content }); return { key: { id: `sent-${sent.length}` } }; },
  async sendPresenceUpdate() {}
};
function msg(i) {
  return { key: { remoteJid: '2348111111111@s.whatsapp.net', fromMe: false, id: `stress-${i}` }, message: { conversation: '.ping' } };
}
(async () => {
  const start = process.memoryUsage().heapUsed;
  for (let i = 0; i < 2500; i++) await handleMessage(sock, msg(i));
  if (global.gc) global.gc();
  const end = process.memoryUsage().heapUsed;
  const growthMB = (end - start) / 1024 / 1024;
  assert.strictEqual(sent.length, 5000, 'stress reply count mismatch');
  assert(growthMB < 40, `unexpected heap growth: ${growthMB.toFixed(2)} MB`);
  console.log(JSON.stringify({
    staticGuards: 'pass',
    messagesProcessed: 2500,
    repliesSent: sent.length,
    repliesPerCommand: 2,
    heapGrowthMB: Number(growthMB.toFixed(2)),
    result: 'pass'
  }, null, 2));
})().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
