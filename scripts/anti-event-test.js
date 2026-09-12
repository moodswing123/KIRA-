'use strict';
const assert = require('assert');
const commands = require('../plugins/future-commands');
const sent = [];
const events = {};
const owner = '111@s.whatsapp.net';
const group = '999@g.us';
const sock = {
  sendMessage: async (jid, content) => sent.push({ jid, content }),
  ev: { on: (name, handler) => { events[name] = handler; } }
};
const context = { quotedKey: { remoteJid: group, id: 'q' }, quotedMessage: { conversation: 'quoted' } };
const botConfig = { ownerNumber: '999' };

(async () => {
  await commands.antidelete.exec(['on', 'dm'], sock, group, {}, owner, {}, botConfig, context);
  await commands.antiedit.exec(['on', 'dm'], sock, group, {}, owner, {}, botConfig, context);
  events['messages.upsert']({ messages: [
    { key: { remoteJid: group, id: 'delete-me' }, message: { conversation: 'secret deleted text' } },
    { key: { remoteJid: group, id: 'edit-me' }, message: { conversation: 'before edit' } }
  ] });
  await events['messages.update']([{ key: { remoteJid: group, id: 'revoke-event' }, update: { message: { protocolMessage: { type: 0, key: { remoteJid: group, id: 'delete-me' } } } } }]);
  await events['messages.upsert']({ messages: [{ key: { remoteJid: group, id: 'edit-event' }, message: { protocolMessage: { key: { remoteJid: group, id: 'edit-me' }, editedMessage: { message: { conversation: 'after edit' } } } } }] });
  assert(sent.some(item => item.jid === owner && item.content?.caption === '🗑️ Deleted message'), 'delete was not forwarded to configuring user DM');
  assert(sent.some(item => item.jid === owner && item.content?.caption === '✏️ Edited message'), 'edit was not forwarded to configuring user DM');
  console.log('anti-event protocol forwarding passed');
})();
