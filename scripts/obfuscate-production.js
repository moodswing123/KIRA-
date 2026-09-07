'use strict';
const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const root = path.resolve(__dirname, '..');
const targets = [
  'index.js',
  ...fs.readdirSync(path.join(root, 'lib')).filter(name => name.endsWith('.js')).map(name => path.join('lib', name)),
  ...fs.readdirSync(path.join(root, 'commands')).filter(name => name.endsWith('.js') && name !== 'index.js').map(name => path.join('commands', name))
];

const options = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: false,
  splitStrings: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayThreshold: 0.75,
  transformObjectKeys: false,
  unicodeEscapeSequence: false
};

for (const relative of targets) {
  const file = path.join(root, relative);
  const source = fs.readFileSync(file, 'utf8');
  const result = JavaScriptObfuscator.obfuscate(source, options);
  fs.writeFileSync(file, result.getObfuscatedCode() + '\n', 'utf8');
  console.log(`obfuscated ${relative}`);
}
console.log(`obfuscated ${targets.length} runtime files`);
