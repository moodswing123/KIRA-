'use strict';
const assert = require('assert');
const commands = require('../commands');
const runtime = require('../index');
const helpers = require('../lib/helpers');

const owner = '111@s.whatsapp.net';
const nonOwner = '222@s.whatsapp.net';
const group = '999@g.us';
const groupRaw = sender => ({
  key: { remoteJid: group, participant: sender, fromMe: false, id: `test-${sender}` },
  message: { conversation: '.dashboard' }
});

const ownerCommands = Object.entries(commands).filter(([, command]) => command?.permissions === 'owner' || command?.ownerOnly);
assert(ownerCommands.length > 0, 'No owner commands were registered');
assert.strictEqual(runtime.hasPermission('owner', { isOwner: true, isGroup: true }), true, 'owner was rejected in group context');
assert.strictEqual(runtime.hasPermission('owner', { isOwner: false, isGroup: true }), false, 'non-owner passed owner gate in group context');
assert.strictEqual(helpers.resolveIsOwner(groupRaw(owner), owner, { ownerNumber: '111' }), true, 'group owner JID did not resolve');
assert.strictEqual(helpers.resolveIsOwner(groupRaw(nonOwner), nonOwner, { ownerNumber: '111' }), false, 'non-owner JID resolved as owner');

for (const [name, command] of ownerCommands) {
  assert(command.permissions === 'owner' || command.ownerOnly, `owner metadata missing for ${name}`);
}
console.log(`group owner permission matrix passed: ${ownerCommands.length} owner commands`);
console.log('owner accepted in group: yes');
console.log('non-owner rejected in group: yes');
