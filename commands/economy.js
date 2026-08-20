'use strict';
// commands/economy.js — Virtual economy commands for Kira MD
const db = require('../lib/database');
const { formatNumber } = require('../lib/helpers');

const DAILY_AMOUNT  = 500;
const WEEKLY_AMOUNT = 2500;
const WORK_MIN      = 100;
const WORK_MAX      = 800;

const economyCommands = {
  balance: {
    category: 'economy', desc: 'Check your coin balance',
    usage: '.balance', aliases: ['bal', 'coins', 'wallet'], permissions: 'all',
    examples: ['.balance'],
    exec: async (args, sock, jid, isGroup, sender) => {
      const user = db.getUser(sender);
      await sock.sendMessage(jid, {
        text:
          `💰 *Balance*\n\n` +
          `👤 @${sender.split('@')[0]}\n` +
          `💵 Coins   : ${formatNumber(user.balance)}\n` +
          `🏦 Bank    : ${formatNumber(user.bank || 0)}\n` +
          `📊 Total   : ${formatNumber((user.balance || 0) + (user.bank || 0))}`,
        mentions: [sender]
      });
    }
  },

  daily: {
    category: 'economy', desc: `Claim your daily ${DAILY_AMOUNT} coins reward`,
    usage: '.daily', aliases: ['dailyreward', 'claim'], permissions: 'all',
    examples: ['.daily'],
    exec: async (args, sock, jid, isGroup, sender) => {
      const user    = db.getUser(sender);
      const now     = Date.now();
      const lastDaily = user.daily || 0;
      const cooldown  = 24 * 60 * 60 * 1000;

      if (now - lastDaily < cooldown) {
        const remaining = cooldown - (now - lastDaily);
        const h = Math.floor(remaining / 3600000);
        const m = Math.floor((remaining % 3600000) / 60000);
        return sock.sendMessage(jid, {
          text: `⏳ *Daily already claimed!*\n\nCome back in: *${h}h ${m}m*`
        });
      }

      db.addCoins(sender, DAILY_AMOUNT);
      db.updateUser(sender, { daily: now });
      await sock.sendMessage(jid, {
        text:
          `✅ *Daily Reward Claimed!*\n\n` +
          `💰 You received *${formatNumber(DAILY_AMOUNT)} coins*!\n` +
          `💵 New balance: *${formatNumber(db.getUser(sender).balance)} coins*`
      });
    }
  },

  weekly: {
    category: 'economy', desc: `Claim your weekly ${WEEKLY_AMOUNT} coins reward`,
    usage: '.weekly', aliases: ['weeklyreward'], permissions: 'all',
    examples: ['.weekly'],
    exec: async (args, sock, jid, isGroup, sender) => {
      const user      = db.getUser(sender);
      const now       = Date.now();
      const lastWeekly = user.weekly || 0;
      const cooldown   = 7 * 24 * 60 * 60 * 1000;

      if (now - lastWeekly < cooldown) {
        const remaining = cooldown - (now - lastWeekly);
        const d = Math.floor(remaining / 86400000);
        const h = Math.floor((remaining % 86400000) / 3600000);
        return sock.sendMessage(jid, {
          text: `⏳ *Weekly already claimed!*\n\nCome back in: *${d}d ${h}h*`
        });
      }

      db.addCoins(sender, WEEKLY_AMOUNT);
      db.updateUser(sender, { weekly: now });
      await sock.sendMessage(jid, {
        text:
          `✅ *Weekly Reward Claimed!*\n\n` +
          `💰 You received *${formatNumber(WEEKLY_AMOUNT)} coins*!\n` +
          `💵 New balance: *${formatNumber(db.getUser(sender).balance)} coins*`
      });
    }
  },

  work: {
    category: 'economy', desc: 'Work to earn random coins',
    usage: '.work', aliases: ['earn', 'job'], permissions: 'all',
    examples: ['.work'],
    exec: async (args, sock, jid, isGroup, sender) => {
      const user      = db.getUser(sender);
      const now       = Date.now();
      const lastWork  = user.lastWork || 0;
      const cooldown  = 30 * 60 * 1000; // 30 min

      if (now - lastWork < cooldown) {
        const remaining = cooldown - (now - lastWork);
        const m = Math.ceil(remaining / 60000);
        return sock.sendMessage(jid, { text: `⏳ You're tired! Rest for *${m} more minutes*.` });
      }

      const jobs = [
        'delivered food 🍔', 'fixed a computer 💻', 'drove a taxi 🚕',
        'sold groceries 🛒', 'repaired a phone 📱', 'cooked at a restaurant 👨‍🍳',
        'wrote an article ✍️', 'designed a logo 🎨', 'taught a class 📚',
        'sold clothes at the market 👕'
      ];
      const job    = jobs[Math.floor(Math.random() * jobs.length)];
      const earned = Math.floor(Math.random() * (WORK_MAX - WORK_MIN + 1)) + WORK_MIN;

      db.addCoins(sender, earned);
      db.updateUser(sender, { lastWork: now });
      await sock.sendMessage(jid, {
        text:
          `💼 *Work Complete!*\n\n` +
          `You ${job} and earned *${formatNumber(earned)} coins*!\n\n` +
          `💵 New balance: *${formatNumber(db.getUser(sender).balance)} coins*`
      });
    }
  },

  deposit: {
    category: 'economy', desc: 'Deposit coins into your bank',
    usage: '.deposit <amount|all>', aliases: ['dep'], permissions: 'all',
    examples: ['.deposit 500', '.deposit all'],
    exec: async (args, sock, jid, isGroup, sender) => {
      const user   = db.getUser(sender);
      const input  = (args[0] || '').toLowerCase();
      const amount = input === 'all' ? user.balance : parseInt(input);

      if (!amount || amount <= 0) return sock.sendMessage(jid, { text: '❌ Usage: .deposit <amount|all>' });
      if (amount > user.balance) return sock.sendMessage(jid, { text: `❌ You only have *${formatNumber(user.balance)} coins*!` });

      db.removeCoins(sender, amount);
      db.updateUser(sender, { bank: (user.bank || 0) + amount });
      const updated = db.getUser(sender);
      await sock.sendMessage(jid, {
        text:
          `🏦 *Deposited!*\n\n` +
          `💰 Amount : +${formatNumber(amount)} coins\n` +
          `💵 Wallet : ${formatNumber(updated.balance)} coins\n` +
          `🏦 Bank   : ${formatNumber(updated.bank)} coins`
      });
    }
  },

  withdraw: {
    category: 'economy', desc: 'Withdraw coins from your bank',
    usage: '.withdraw <amount|all>', aliases: ['with'], permissions: 'all',
    examples: ['.withdraw 500', '.withdraw all'],
    exec: async (args, sock, jid, isGroup, sender) => {
      const user   = db.getUser(sender);
      const input  = (args[0] || '').toLowerCase();
      const amount = input === 'all' ? (user.bank || 0) : parseInt(input);

      if (!amount || amount <= 0) return sock.sendMessage(jid, { text: '❌ Usage: .withdraw <amount|all>' });
      if (amount > (user.bank || 0)) return sock.sendMessage(jid, { text: `❌ Your bank only has *${formatNumber(user.bank || 0)} coins*!` });

      db.addCoins(sender, amount);
      db.updateUser(sender, { bank: (user.bank || 0) - amount });
      const updated = db.getUser(sender);
      await sock.sendMessage(jid, {
        text:
          `🏦 *Withdrawn!*\n\n` +
          `💰 Amount : +${formatNumber(amount)} coins\n` +
          `💵 Wallet : ${formatNumber(updated.balance)} coins\n` +
          `🏦 Bank   : ${formatNumber(updated.bank)} coins`
      });
    }
  },

  transfer: {
    category: 'economy', desc: 'Send coins to another user',
    usage: '.transfer @user <amount>', aliases: ['send', 'give'], permissions: 'all',
    examples: ['.transfer @user 500'],
    exec: async (args, sock, jid, isGroup, sender, message) => {
      const { getMentionedJid } = require('../lib/helpers');
      const target = getMentionedJid(message);
      const amount = parseInt(args.find(a => /^\d+$/.test(a)));

      if (!target || !amount || amount <= 0) {
        return sock.sendMessage(jid, { text: '❌ Usage: .transfer @user <amount>' });
      }
      if (target === sender) return sock.sendMessage(jid, { text: '❌ You cannot send coins to yourself!' });

      const user = db.getUser(sender);
      if (amount > user.balance) return sock.sendMessage(jid, { text: `❌ You only have *${formatNumber(user.balance)} coins*!` });

      db.removeCoins(sender, amount);
      db.addCoins(target, amount);

      await sock.sendMessage(jid, {
        text:
          `💸 *Transfer Sent!*\n\n` +
          `💰 Amount : ${formatNumber(amount)} coins\n` +
          `📤 From   : @${sender.split('@')[0]}\n` +
          `📥 To     : @${target.split('@')[0]}\n\n` +
          `💵 Your balance: ${formatNumber(db.getUser(sender).balance)} coins`,
        mentions: [sender, target]
      });
    }
  },

  rob: {
    category: 'economy', desc: 'Attempt to rob another user',
    usage: '.rob @user', aliases: ['robbery'], permissions: 'all',
    examples: ['.rob @user'],
    exec: async (args, sock, jid, isGroup, sender, message) => {
      const { getMentionedJid } = require('../lib/helpers');
      const target = getMentionedJid(message);
      if (!target || target === sender) return sock.sendMessage(jid, { text: '❌ Mention someone to rob!' });

      const victim  = db.getUser(target);
      const robber  = db.getUser(sender);
      const success = Math.random() < 0.4; // 40% success rate

      if (!success) {
        const fine = Math.min(Math.floor(Math.random() * 300) + 100, robber.balance);
        db.removeCoins(sender, fine);
        return sock.sendMessage(jid, {
          text: `🚔 *You got caught!*\n\nYou tried to rob @${target.split('@')[0]} but the police arrested you!\n💸 Fine: *${formatNumber(fine)} coins*`,
          mentions: [target]
        });
      }

      if (victim.balance < 100) {
        return sock.sendMessage(jid, {
          text: `😅 @${target.split('@')[0]} is too broke to rob!`, mentions: [target]
        });
      }

      const stolen = Math.min(Math.floor(victim.balance * 0.3), 1000);
      db.removeCoins(target, stolen);
      db.addCoins(sender, stolen);

      await sock.sendMessage(jid, {
        text:
          `😈 *Successful Robbery!*\n\n` +
          `You robbed @${target.split('@')[0]} and stole *${formatNumber(stolen)} coins*!\n\n` +
          `💰 Your balance: ${formatNumber(db.getUser(sender).balance)} coins`,
        mentions: [target]
      });
    }
  },

  leaderboard: {
    category: 'economy', desc: 'Top 10 richest users',
    usage: '.leaderboard', aliases: ['lb', 'rich', 'top'], permissions: 'all',
    examples: ['.leaderboard'],
    exec: async (args, sock, jid) => {
      const top      = db.getLeaderboard('balance', 10);
      if (!top.length) return sock.sendMessage(jid, { text: '📊 No users in the leaderboard yet.' });
      const medals   = ['🥇', '🥈', '🥉'];
      const rows     = top.map((u, i) => `${medals[i] || `${i + 1}.`} @${u.id} — ${formatNumber(u.balance)} coins`).join('\n');
      const mentions = top.map(u => `${u.id}@s.whatsapp.net`);
      await sock.sendMessage(jid, { text: `🏆 *Coin Leaderboard*\n\n${rows}`, mentions });
    }
  },

  xpleaderboard: {
    category: 'economy', desc: 'Top 10 highest XP users',
    usage: '.xpleaderboard', aliases: ['xplb', 'xptop'], permissions: 'all',
    examples: ['.xpleaderboard'],
    exec: async (args, sock, jid) => {
      const top  = db.getLeaderboard('xp', 10);
      if (!top.length) return sock.sendMessage(jid, { text: '📊 No users yet.' });
      const rows = top.map((u, i) => `${i + 1}. @${u.id} — ${formatNumber(u.xp)} XP (Lv.${u.level})`).join('\n');
      const mentions = top.map(u => `${u.id}@s.whatsapp.net`);
      await sock.sendMessage(jid, { text: `⭐ *XP Leaderboard*\n\n${rows}`, mentions });
    }
  },

  profile: {
    category: 'economy', desc: 'View your full profile and stats',
    usage: '.profile', aliases: ['me', 'stats'], permissions: 'all',
    examples: ['.profile'],
    exec: async (args, sock, jid, isGroup, sender) => {
      const user   = db.getUser(sender);
      const xpNext = Math.max(0, (user.level * 500) - user.xp);
      await sock.sendMessage(jid, {
        text:
          `👤 *Profile — @${sender.split('@')[0]}*\n\n` +
          `💰 Balance : ${formatNumber(user.balance)} coins\n` +
          `🏦 Bank    : ${formatNumber(user.bank || 0)} coins\n` +
          `⭐ XP      : ${formatNumber(user.xp)}\n` +
          `🏅 Level   : ${user.level}\n` +
          `📈 Next Lv : ${formatNumber(xpNext)} XP needed\n` +
          `⚠️ Warnings: ${user.warnings}\n` +
          `📅 Joined  : ${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}`,
        mentions: [sender]
      });
    }
  }
};

module.exports = economyCommands;
