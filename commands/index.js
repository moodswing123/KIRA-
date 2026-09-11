'use strict';
// commands/index.js — Central command loader + registry for Kira MD
const fs   = require('fs');
const path = require('path');

const allCommands      = {};
const categoryRegistry = {};
const primaryCommands  = new Map();
const aliasCommands    = new Map();
const validatedCommands = new Set();
const loadReport       = {
  loadedModules: [],
  failedModules: [],
  duplicateNames: [],
  duplicateAliases: [],
  invalidCommands: [],
  missingExec: [],
  invalidMetadata: []
};

const CATEGORY_ORDER = [
  'moderation', 'ai', 'audio', 'downloader', 'fun', 'games',
  'group', 'general', 'economy', 'owner', 'search', 'converter',
  'sticker', 'utility',
  'movies', 'anime', 'sports', 'religion', 'canvas'
];

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function recordInvalid(sourceLabel, message, kind = 'invalidMetadata') {
  const detail = `${sourceLabel || 'module'}: ${message}`;
  loadReport[kind].push(detail);
  if (kind !== 'invalidCommands') loadReport.invalidCommands.push(detail);
}

function register(mod, sourceLabel) {
  if (!mod || typeof mod !== 'object') {
    recordInvalid(sourceLabel, 'module export is not an object');
    return 0;
  }

  let registered = 0;
  for (const [rawName, cmd] of Object.entries(mod)) {
    if (rawName.startsWith('_')) continue;
    if (typeof cmd?.exec !== 'function') {
      if (cmd != null) {
        const detail = `${sourceLabel || 'module'}:${rawName} has no exec function`;
        loadReport.missingExec.push(detail);
        loadReport.invalidCommands.push(detail);
      }
      continue;
    }

    const name = normalizeName(rawName);
    const category = normalizeName(cmd.category || 'utility') || 'utility';
    const permissions = normalizeName(cmd.permissions || 'all') || 'all';
    const validPermissions = new Set(['all', 'admin', 'owner', 'admin_or_owner']);
    const validChatTypes = new Set(['both', 'group', 'dm']);
    let metadataValid = true;

    if (!/^[a-z0-9_][a-z0-9_-]*$/.test(name)) {
      recordInvalid(sourceLabel, `${rawName} has an invalid command name`);
      continue;
    }
    if (!validPermissions.has(permissions)) {
      recordInvalid(sourceLabel, `${name} has invalid permissions "${permissions}"`);
      continue;
    }
    if (cmd.chatType != null && !validChatTypes.has(normalizeName(cmd.chatType))) {
      recordInvalid(sourceLabel, `${name} has invalid chatType "${cmd.chatType}"`);
      metadataValid = false;
    }
    if (cmd.aliases != null && !Array.isArray(cmd.aliases)) {
      recordInvalid(sourceLabel, `${name} aliases must be an array`);
      metadataValid = false;
    }
    if (primaryCommands.has(name) || aliasCommands.has(name)) {
      const existing = primaryCommands.get(name) || aliasCommands.get(name);
      const isPlugin = sourceLabel && !sourceLabel.startsWith('./');
      const isLegacyCore = existing.source && existing.source.startsWith('./');
      if (!isPlugin && !isLegacyCore && primaryCommands.has(name)) continue;
      const detail = `"${name}" (${sourceLabel || 'module'} conflicts with ${existing.source})`;
      if (isPlugin && isLegacyCore && primaryCommands.has(name)) {
        primaryCommands.delete(name);
      } else {
        loadReport.duplicateNames.push(detail);
        console.warn(`[CommandLoader] Duplicate command name ${detail} — keeping the first registration`);
        continue;
      }
    }

    const command = {
      ...cmd,
      category,
      permissions,
      chatType: cmd.chatType ||
        (category === 'group' || permissions === 'admin' ||
         permissions === 'admin_or_owner' ||
         (category === 'moderation' && permissions === 'admin')
          ? 'group'
          : 'both'),
      aliases: Array.isArray(cmd.aliases)
        ? cmd.aliases.map(normalizeName).filter(Boolean)
        : []
    };
    primaryCommands.set(name, { command, source: sourceLabel || 'module' });
    if (metadataValid) validatedCommands.add(name);
    allCommands[name] = command;
    if (!categoryRegistry[category]) categoryRegistry[category] = [];
    categoryRegistry[category].push(name);
    registered++;

    for (const alias of command.aliases) {
      if (!/^[a-z0-9_][a-z0-9_-]*$/.test(alias)) {
        recordInvalid(sourceLabel, `${name} has invalid alias "${alias}"`);
        continue;
      }
      if (primaryCommands.has(alias) || aliasCommands.has(alias)) {
        const existing = primaryCommands.get(alias) || aliasCommands.get(alias);
        const detail = `"${alias}" (${sourceLabel || 'module'}:${name} conflicts with ${existing.source})`;
        loadReport.duplicateAliases.push(detail);
        console.warn(`[CommandLoader] Duplicate alias ${detail} — keeping the first registration`);
        continue;
      }
      aliasCommands.set(alias, { command, source: `${sourceLabel || 'module'}:${name}` });
      allCommands[alias] = command;
    }
  }
  return registered;
}

const pluginsDir = path.join(__dirname, '../plugins');
const pluginFiles = fs.existsSync(pluginsDir)
  ? fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js')).sort()
  : [];

for (const file of pluginFiles) {
  try {
    const plugin = require(path.join(pluginsDir, file));
    const cmds = plugin.commands || plugin;
    if (typeof cmds === 'object') {
      const loaded = register(cmds, file);
      loadReport.loadedModules.push({ file, commands: loaded });
      console.log(`[Plugin] Loaded ${file} (${loaded} commands)`);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    loadReport.failedModules.push({ file, error: reason });
    console.error(`[Plugin] Failed to load ${file}:`, reason);
  }
}

const coreFiles = [
  './main', './general', './ai', './download', './search',
  './converter', './tools', './group', './moderation',
  './fun', './games', './audio', './economy', './settings', './owner'
];

for (const file of coreFiles) {
  try {
    const loaded = register(require(file), file);
    loadReport.loadedModules.push({ file, commands: loaded });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    loadReport.failedModules.push({ file, error: reason });
    console.error(`[CommandLoader] Failed to load ${file}:`, reason);
  }
}


for (const cat of Object.keys(categoryRegistry)) categoryRegistry[cat].sort();

Object.defineProperties(allCommands, {
  categoryRegistry: { value: categoryRegistry, enumerable: false },
  CATEGORY_ORDER: { value: CATEGORY_ORDER, enumerable: false },
  loadReport: { value: loadReport, enumerable: false },
  primaryNames: { value: [...primaryCommands.keys()], enumerable: false },
  aliasNames: { value: [...aliasCommands.keys()], enumerable: false }
});

function getHealthReport() {
  const broken = [
    ...loadReport.failedModules,
    ...loadReport.missingExec,
    ...loadReport.invalidMetadata
  ];
  return {
    loaded: primaryCommands.size,
    aliases: aliasCommands.size,
    validated: validatedCommands.size,
    executedSuccessfully: null,
    broken: broken.length,
    missingExec: [...loadReport.missingExec],
    duplicateNames: [...loadReport.duplicateNames],
    duplicateAliases: [...loadReport.duplicateAliases],
    failedModules: loadReport.failedModules.map(item => ({ ...item })),
    invalidMetadata: [...loadReport.invalidMetadata],
    invalidCommands: [...loadReport.invalidCommands]
  };
}

Object.defineProperty(allCommands, 'healthReport', {
  value: getHealthReport,
  enumerable: false
});

console.log(
  `[CommandLoader] Loaded ${primaryCommands.size} commands and ${aliasCommands.size} aliases` +
  ` from ${loadReport.loadedModules.length} modules`
);
console.log(
  `[CommandLoader] Validated ${primaryCommands.size} commands; ` +
  `broken=${loadReport.failedModules.length + loadReport.missingExec.length + loadReport.invalidMetadata.length}`
);
if (loadReport.failedModules.length) {
  console.error(`[CommandLoader] Failed modules: ${loadReport.failedModules.map(m => m.file).join(', ')}`);
}
if (loadReport.invalidCommands.length) {
  console.warn(`[CommandLoader] Invalid exports: ${loadReport.invalidCommands.join('; ')}`);
}

module.exports = allCommands;
