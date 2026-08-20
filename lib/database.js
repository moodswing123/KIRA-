'use strict';
// lib/database.js — In-memory JSON database for Kira MD
// Persists to data/db.json on writes so data survives restarts.
const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

function loadDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        return {
          users: data.users && typeof data.users === 'object' ? data.users : {},
          groups: data.groups && typeof data.groups === 'object' ? data.groups : {},
          banned: data.banned && typeof data.banned === 'object' ? data.banned : {},
          ownerSettings: data.ownerSettings && typeof data.ownerSettings === 'object' ? data.ownerSettings : {},
          settings: data.settings && typeof data.settings === 'object' ? data.settings : {}
        };
      }
    }
  } catch (_) {}
  return { users: {}, groups: {}, banned: {}, ownerSettings: {}, settings: {} };
}

let _db = loadDb();
let _saveTimer = null;

function save() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try { fs.writeFileSync(DB_PATH, JSON.stringify(_db, null, 2)); } catch (_) {}
  }, 1000);
}

// ── Users ──────────────────────────────────────────────────────────────────
function getUser(jid) {
  const id = stripJid(jid);
  if (!_db.users[id]) {
    _db.users[id] = {
      id,
      balance: 0,
      xp: 0,
      level: 1,
      warnings: 0,
      daily: null,
      weekly: null,
      bank: 0,
      createdAt: Date.now()
    };
    save();
  }
  return _db.users[id];
}

function updateUser(jid, updates) {
  const u = getUser(jid);
  Object.assign(u, updates);
  save();
  return u;
}

function addCoins(jid, amount) {
  const u = getUser(jid);
  u.balance = (u.balance || 0) + amount;
  save();
  return u.balance;
}

function removeCoins(jid, amount) {
  const u = getUser(jid);
  u.balance = Math.max(0, (u.balance || 0) - amount);
  save();
  return u.balance;
}

function addXP(jid, amount) {
  const u = getUser(jid);
  u.xp = (u.xp || 0) + amount;
  // Level up every 500 XP
  const newLevel = Math.floor(u.xp / 500) + 1;
  u.level = newLevel;
  save();
  return u;
}

function addWarning(jid) {
  const u = getUser(jid);
  u.warnings = (u.warnings || 0) + 1;
  save();
  return u.warnings;
}

function clearWarnings(jid) {
  const u = getUser(jid);
  u.warnings = 0;
  save();
}

function banUser(jid) {
  const id = stripJid(jid);
  _db.banned[id] = { bannedAt: Date.now() };
  save();
}

function unbanUser(jid) {
  const id = stripJid(jid);
  delete _db.banned[id];
  save();
}

function isUserBanned(jid) {
  return !!_db.banned[stripJid(jid)];
}

function getLeaderboard(field, limit = 10) {
  return Object.values(_db.users)
    .filter(u => u[field] !== undefined)
    .sort((a, b) => (b[field] || 0) - (a[field] || 0))
    .slice(0, limit);
}

// ── Groups ─────────────────────────────────────────────────────────────────
function getGroup(jid) {
  const id = stripJid(jid);
  if (!_db.groups[id]) {
    _db.groups[id] = {
      id,
      antiLink: false,
      antiLinkAction: 'delete',
      antiSpam: false,
      antiFlood: false,
      welcome: false,
      goodbye: false,
      sWelcome: null,
      sGoodbye: null,
      maxWarnings: 3,
      warnings: {},
      createdAt: Date.now()
    };
    save();
  }
  return _db.groups[id];
}

function updateGroup(jid, updates) {
  const g = getGroup(jid);
  Object.assign(g, updates);
  save();
  return g;
}

function toggleGroup(jid, field) {
  const g = getGroup(jid);
  g[field] = !g[field];
  save();
  return g[field];
}

// ── Owner settings ─────────────────────────────────────────────────────────
function getOwnerSetting(jid, key, defaultVal = false) {
  const id = stripJid(jid);
  if (!_db.ownerSettings[id]) _db.ownerSettings[id] = {};
  const val = _db.ownerSettings[id][key];
  return val === undefined ? defaultVal : val;
}

function setOwnerSetting(jid, key, value) {
  const id = stripJid(jid);
  if (!_db.ownerSettings[id]) _db.ownerSettings[id] = {};
  _db.ownerSettings[id][key] = value;
  save();
}

// ── Bot settings ───────────────────────────────────────────────────────────
// These settings are intentionally separate from owner settings so a mode
// change is shared by all chats and survives a restart.
function getSetting(key, defaultVal = null) {
  const val = _db.settings[key];
  return val === undefined ? defaultVal : val;
}

function setSetting(key, value) {
  _db.settings[key] = value;
  save();
}

// ── Stats ──────────────────────────────────────────────────────────────────
function stats() {
  return {
    users:   Object.keys(_db.users).length,
    groups:  Object.keys(_db.groups).length,
    banned:  Object.keys(_db.banned).length
  };
}

function exportAll() { return JSON.parse(JSON.stringify(_db)); }
function importAll(data) { _db = data; save(); }

// ── Helpers ────────────────────────────────────────────────────────────────
function stripJid(jid) {
  return (jid || '').replace(/[:@].*/g, '').replace(/^\+/, '');
}

module.exports = {
  getUser, updateUser, addCoins, removeCoins, addXP,
  addWarning, clearWarnings, banUser, unbanUser, isUserBanned,
  getLeaderboard, getGroup, updateGroup, toggleGroup,
  getOwnerSetting, setOwnerSetting,
  getSetting, setSetting,
  stats, exportAll, importAll
};
