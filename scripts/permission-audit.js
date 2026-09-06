'use strict';
const assert = require('assert');
const registry = require('../commands');
const allowedPermissions = new Set(['all', 'owner', 'admin', 'admin_or_owner']);
const allowedChatTypes = new Set(['both', 'group', 'dm']);
const primaryNames = registry.primaryNames || [];
const aliasNames = registry.aliasNames || [];
const invalid = [];
const groupOnly = [];
const ownerOnly = [];
const adminOnly = [];
const aliasesWithoutTarget = [];

for (const name of primaryNames) {
  const command = registry[name];
  if (!command || typeof command.exec !== 'function') invalid.push(`${name}: missing exec`);
  const permission = String(command?.permissions || 'all').toLowerCase();
  const chatType = String(command?.chatType || 'both').toLowerCase();
  if (!allowedPermissions.has(permission)) invalid.push(`${name}: invalid permission ${permission}`);
  if (!allowedChatTypes.has(chatType)) invalid.push(`${name}: invalid chatType ${chatType}`);
  if (chatType === 'group') groupOnly.push(name);
  if (permission === 'owner') ownerOnly.push(name);
  if (permission === 'admin' || permission === 'admin_or_owner') adminOnly.push(name);
}
for (const alias of aliasNames) {
  if (!registry[alias] || typeof registry[alias].exec !== 'function') aliasesWithoutTarget.push(alias);
}
const health = registry.healthReport();
const report = {
  primaryCommands: primaryNames.length,
  aliases: aliasNames.length,
  health,
  invalidMetadata: invalid,
  aliasesWithoutTarget,
  ownerOnlyCount: ownerOnly.length,
  adminRestrictedCount: adminOnly.length,
  groupOnlyCount: groupOnly.length,
  ownerOnlyCommands: ownerOnly,
  adminRestrictedCommands: adminOnly,
  groupOnlyCommands: groupOnly,
  sudoModel: 'Sudo users can run all non-owner commands, including admin commands; owner-only settings and sensitive controls remain owner-only.'
};
console.log(JSON.stringify(report, null, 2));
assert.strictEqual(health.broken, 0, 'loader reports broken commands');
assert.strictEqual(invalid.length, 0, 'invalid permission metadata');
assert.strictEqual(aliasesWithoutTarget.length, 0, 'aliases point to missing handlers');
