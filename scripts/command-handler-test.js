const assert = require('assert');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { BufferJSON } = require('baileys');
const { getMessageForRetry } = require('../lib/wa-message-retry');
const { processMessageUpsertBatch } = require('../lib/wa-upsert-batch');
const { commands } = require('../command');

for (const file of fs.readdirSync(path.join(__dirname, '../kira')).filter(name => name.endsWith('.js'))) {
  require(path.join(__dirname, '../kira', file));
}

const commandByName = name => commands.find(item => item.pattern === name);
const expected = ['ai', 'openai', 'deepseek', 'vv2', 'vv', 'block', 'unblock', 'version', 'couplepp', 'define', 'fb', 'img', 'tiktok', 'menu', 'ping', 'alive', 'uptime'];
for (const name of expected) assert(commandByName(name), `Missing WhatsApp command: ${name}`);

const mockData = url => {
  if (url.includes('/api/gpt?')) return { message: 'AI reply' };
  if (url.includes('/api/openai?')) return { result: 'OpenAI reply' };
  if (url.includes('/api/ai/deepseek?')) return { answer: 'DeepSeek reply' };
  if (url.includes('/couplepp')) return { success: true, male: 'https://example.test/male.jpg', female: 'https://example.test/female.jpg' };
  if (url.includes('/api/v2/entries/en/')) return [{ word: 'test', meanings: [{ definitions: [{ definition: 'A check.' }] }] }];
  if (url.includes('/facebookdl?')) return { status: true, data: { url: 'https://example.test/video.mp4' } };
  if (url.includes('/googleimage?')) return { success: true, results: ['https://example.test/image.jpg'] };
  if (url.includes('/download/tiktok?')) return { status: true, data: { title: 'Test', meta: { media: [{ type: 'video', org: 'https://example.test/video.mp4' }] } } };
  throw new Error(`Unexpected API request in mock test: ${url}`);
};

async function main() {
  const originalAxiosGet = axios.get;
  axios.get = async url => ({ data: mockData(String(url)) });
  const sent = [];
  const replies = [];
  const blockActions = [];
  const conn = {
    user: { id: '15551234567:0@s.whatsapp.net' },
    sendMessage: async (...args) => { sent.push(args); return {}; },
    updateBlockStatus: async (jid, action) => { blockActions.push([jid, action]); }
  };
  const from = '15551234567@s.whatsapp.net';
  const mek = { key: { id: 'mock-message', remoteJid: from, fromMe: true }, sender: from, messageTimestamp: Math.floor(Date.now() / 1000) };
  const mediaBuffer = Buffer.from('mock-media');
  const m = {
    sender: from,
    key: mek.key,
    mentionedJid: ['15557654321@s.whatsapp.net'],
    quoted: { sender: '15557654321@s.whatsapp.net', mtype: 'imageMessage', mimetype: 'image/jpeg', text: '', download: async () => mediaBuffer }
  };
  const ctx = {
    from, sender: from, senderNumber: '15551234567', botNumber: '15551234567', pushname: 'Test',
    q: 'test query', args: ['test', 'query'], text: 'test query', isGroup: false,
    isOwner: true, isCreator: true, isMe: true, isAdmins: false, isBotAdmins: false,
    react: async () => {}, reply: async text => { replies.push(String(text)); return {}; }
  };

  try {
    for (const name of expected) {
      const command = commandByName(name);
      const beforeSent = sent.length;
      const beforeReplies = replies.length;
      if (name === 'fb') ctx.q = 'https://www.facebook.com/watch/test';
      else if (name === 'tiktok') ctx.q = 'https://www.tiktok.com/@test/video/123';
      else if (name === 'block' || name === 'unblock') ctx.q = '';
      else if (name === 'vv' || name === 'vv2') ctx.q = '';
      else ctx.q = 'test query';
      ctx.args = ctx.q ? ctx.q.split(/\s+/) : [];
      await command.function(conn, mek, m, ctx);
      assert(sent.length + replies.length > beforeSent + beforeReplies || ['block', 'unblock'].includes(name), `${name} handler produced no result`);
    }
    assert(blockActions.some(([jid, action]) => jid === '15557654321@s.whatsapp.net' && action === 'block'), '.block did not reach updateBlockStatus');
    assert(blockActions.some(([jid, action]) => jid === '15557654321@s.whatsapp.net' && action === 'unblock'), '.unblock did not reach updateBlockStatus');
    assert(sent.some(([, payload]) => payload?.text?.includes('Pong!')), '.ping did not return a pong response');
    assert(sent.some(([, payload]) => payload?.text?.includes('COMMANDS')), '.menu did not return the command list');
    const originalMessage = { imageMessage: { mediaKey: Buffer.from([1, 2, 3]) } };
    const persisted = JSON.parse(JSON.stringify({
      id: 'retry-id', jid: 'retry-chat', message: { key: { id: 'retry-id', remoteJid: 'retry-chat' }, message: originalMessage }
    }, BufferJSON.replacer), BufferJSON.reviver);
    const retrieved = await getMessageForRetry({ id: 'retry-id', remoteJid: 'retry-chat' }, async (id, jid) => id === persisted.id && jid === persisted.jid ? persisted : null);
    assert(Buffer.isBuffer(retrieved?.imageMessage?.mediaKey), 'retry lookup did not restore binary message fields');
    assert.deepStrictEqual([...retrieved.imageMessage.mediaKey], [1, 2, 3], 'retry lookup returned different binary content');
    assert.strictEqual(await getMessageForRetry({ id: 'missing', remoteJid: 'retry-chat' }, async () => null), undefined, 'missing retry messages should return undefined');
    const processedBatch = [];
    await processMessageUpsertBatch({ messages: [
      { message: { senderKeyDistributionMessage: {} } },
      { message: { conversation: '.ping' } },
      { message: null }
    ] }, async item => { processedBatch.push(Object.keys(item.message)[0]); });
    assert.deepStrictEqual(processedBatch, ['senderKeyDistributionMessage', 'conversation'], 'all valid messages in an upsert batch should be processed');
    console.log(`Command handler mock test passed: ${expected.length} WhatsApp commands invoked.`);
  } finally {
    axios.get = originalAxiosGet;
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
