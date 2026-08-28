'use strict';
const assert = require('assert');
const device = require('../commands/general').device;

async function run(message, chatContext, profile) {
  const sent = [];
  const sock = {
    async sendMessage(jid, content, options) {
      sent.push({ jid, content, options });
      return { key: { id: 'sent' } };
    },
    async getBusinessProfile() { return profile; }
  };
  await device.exec([], sock, '12345@s.whatsapp.net', false, 'owner@s.whatsapp.net', message, {}, chatContext);
  return sent;
}

(async () => {
  let sent = await run({ message: { conversation: '.device' } }, { isOwner: false });
  assert(/Owner only/i.test(sent[0].content.text));

  sent = await run({ message: { conversation: '.device' } }, { isOwner: true });
  assert(/Reply to a user/i.test(sent[0].content.text));

  const ownerMessage = {
    message: {
      extendedTextMessage: {
        text: '.device',
        contextInfo: { stanzaId: '3EB012345678901234567890', participant: '2348012345678@s.whatsapp.net' }
      }
    }
  };
  sent = await run(ownerMessage, { isOwner: true }, { description: 'KIRA business' });
  assert(/KIRA-MD DEVICE REPORT/.test(sent[0].content.text));
  assert(/W A - W E B/.test(sent[0].content.text));
  assert(/B U S I N E S S/.test(sent[0].content.text));
  assert.deepStrictEqual(sent[0].content.mentions, ['2348012345678@s.whatsapp.net']);

  const androidMessage = {
    message: {
      extendedTextMessage: {
        text: '.device',
        contextInfo: { stanzaId: 'BAE512345678901234567890', participant: '2348098765432@s.whatsapp.net' }
      }
    }
  };
  sent = await run(androidMessage, { isOwner: true }, {});
  assert(/A N D R O I D/.test(sent[0].content.text));
  assert(/P E R S O N A L/.test(sent[0].content.text));
  assert(sent[0].options && sent[0].options.quoted === androidMessage);
  console.log('device command tests passed: owner gate, reply validation, device detection, account detection, branding');
})().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
