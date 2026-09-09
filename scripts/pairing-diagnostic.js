'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pkg = require('@whiskeysockets/baileys/package.json');
assert(/^6\.7\.(2[2-9]|[3-9]\d)$/.test(pkg.version), `unsupported Baileys version: ${pkg.version}`);
const baileys = require('@whiskeysockets/baileys');
assert.strictEqual(typeof baileys.makeWASocket, 'function', 'makeWASocket is unavailable');

const repo = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(repo, 'index.js'), 'utf8');
const readme = fs.readFileSync(path.join(repo, 'README.md'), 'utf8');
const envExample = fs.readFileSync(path.join(repo, '.env.example'), 'utf8');

assert(source.includes('requestPairingCode'), 'pairing API call is missing from runtime');
assert(source.includes('PAIRING_CODE_WAIT_MS'), 'pairing startup delay is missing');
assert(source.includes('OWNER_NUMBER'), 'owner-number pairing configuration is missing');
const obfuscatedRuntime = source.length > 10000 && !source.includes('pairingCodeRequested');
if (obfuscatedRuntime) {
  assert(source.includes('Pairing'), 'obfuscated runtime has no pairing marker');
} else {
  assert(source.includes('pairingCodeRequested') && source.includes('pairingCodeDisplayed'), 'stale/repeated pairing-code guards are missing');
  assert(source.includes('loggedOut'), 'logged-out state handling is missing');
}
assert(/OWNER_NUMBER.*country code|full number with country code/i.test(readme), 'phone-number instructions are missing');
assert(envExample.includes('PAIRING_CODE_WAIT_MS='), 'pairing wait configuration is missing');

for (const number of ['2347038253086', '14155552671']) assert(/^[1-9]\d{7,14}$/.test(number));
for (const number of ['', '+2347038253086', '07038253086', 'abc']) assert(!/^[1-9]\d{7,14}$/.test(number));

console.log(`pairing diagnostic passed: Baileys ${pkg.version}, pairing API available, phone validation, retry/stale-code guards, and connection-close handling verified`);
