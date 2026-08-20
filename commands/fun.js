'use strict';
// commands/fun.js — Fun & entertainment commands
const axios = require('axios');
const { commandErrorMessage } = require('../lib/helpers');

const JOKES = [
  "Why don't scientists trust atoms? Because they make up everything! 😂",
  "I told my wife she was drawing her eyebrows too high. She looked surprised! 😂",
  "What do you call a fake noodle? An impasta! 😂",
  "Why did the scarecrow win an award? He was outstanding in his field! 🌾",
  "I'm reading a book about anti-gravity. It's impossible to put down! 📚",
  "Why do cows wear bells? Because their horns don't work! 🐄",
  "What did the ocean say to the beach? Nothing, it just waved! 🌊",
  "Why did the math book look so sad? Because it had too many problems! 📖",
  "What do you call a bear with no teeth? A gummy bear! 🐻",
  "I asked the librarian if they had books on paranoia. She whispered: They're right behind you! 📚",
  "What do you call a sleeping dinosaur? A dino-snore! 🦕",
  "Why can't you give Elsa a balloon? She'll let it go! ❄️",
  "What do you call a fish without eyes? A fsh! 🐠",
  "How does the moon cut his hair? Eclipse it! 🌙",
  "Why did the bicycle fall over? It was two-tired! 🚲"
];

const QUOTES = [
  "The only way to do great work is to love what you do. — Steve Jobs",
  "Life is what happens when you're busy making other plans. — John Lennon",
  "The future belongs to those who believe in the beauty of their dreams. — Eleanor Roosevelt",
  "It does not matter how slowly you go as long as you do not stop. — Confucius",
  "Success is not final, failure is not fatal: it is the courage to continue that counts. — Winston Churchill",
  "The only impossible journey is the one you never begin. — Tony Robbins",
  "In the middle of every difficulty lies opportunity. — Albert Einstein",
  "It always seems impossible until it's done. — Nelson Mandela",
  "Be yourself; everyone else is already taken. — Oscar Wilde",
  "Two things are infinite: the universe and human stupidity. — Albert Einstein",
  "You only live once, but if you do it right, once is enough. — Mae West",
  "Be the change that you wish to see in the world. — Mahatma Gandhi",
  "The greatest glory in living lies not in never falling, but in rising every time we fall. — Nelson Mandela",
  "The way to get started is to quit talking and begin doing. — Walt Disney",
  "Your time is limited, so don't waste it living someone else's life. — Steve Jobs"
];

const DARES = [
  "Sing a song in your highest possible voice.",
  "Do 20 jumping jacks right now.",
  "Text a friend 'I love you' without any explanation.",
  "Imitate a celebrity for 1 minute.",
  "Speak in an accent for the next 5 minutes.",
  "Send a silly selfie to the group.",
  "Do your best dance move and describe it here.",
  "Call someone and say 'I know what you did' then hang up.",
  "Talk in rhymes for the next 3 messages.",
  "Write a love poem in 1 minute.",
  "Describe your day using only emojis.",
  "Give a compliment to every member of the group.",
  "Type with your elbows for your next 3 messages.",
  "Speak only in questions for 5 minutes.",
  "Do your best villain monologue."
];

const TRUTHS = [
  "What is the most embarrassing thing that has ever happened to you?",
  "Have you ever lied to get out of trouble? What was the lie?",
  "What is your biggest fear in life?",
  "What is the most childish thing you still do?",
  "Have you ever had a crush on a friend's partner?",
  "What is the weirdest dream you've ever had?",
  "What is one thing you've never told anyone?",
  "What is your biggest regret so far?",
  "Have you ever cheated on a test?",
  "What is something you're really bad at but pretend to be good at?",
  "What was the last thing you searched on Google?",
  "If you could switch lives with anyone for a day, who would it be?",
  "What is the most annoying habit you have?",
  "What would you do with $1 million?",
  "What is the strangest thing you have ever eaten?"
];

const funCommands = {
  joke: {
    category: 'fun', desc: 'Get a random funny joke',
    usage: '.joke', aliases: ['jokes', 'laugh'], permissions: 'all',
    examples: ['.joke'],
    exec: async (args, sock, jid) => {
      try {
        const { data } = await axios.get('https://official-joke-api.appspot.com/random_joke', { timeout: 5000 });
        await sock.sendMessage(jid, { text: `😂 *Joke Time!*\n\n${data.setup}\n\n_${data.punchline}_` });
      } catch {
        const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
        await sock.sendMessage(jid, { text: `😂 *Joke Time!*\n\n${joke}` });
      }
    }
  },

  quote: {
    category: 'fun', desc: 'Get an inspirational quote',
    usage: '.quote', aliases: ['motivation', 'inspire', 'qod'], permissions: 'all',
    examples: ['.quote'],
    exec: async (args, sock, jid) => {
      try {
        const { data } = await axios.get('https://api.quotable.io/random', { timeout: 5000 });
        await sock.sendMessage(jid, { text: `✨ *Quote of the Moment*\n\n_"${data.content}"_\n\n— ${data.author}` });
      } catch {
        const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
        await sock.sendMessage(jid, { text: `✨ *Quote of the Moment*\n\n_"${q}"_` });
      }
    }
  },

  dare: {
    category: 'fun', desc: 'Get a random dare challenge',
    usage: '.dare', aliases: ['challenge'], permissions: 'all',
    examples: ['.dare'],
    exec: async (args, sock, jid) => {
      const dare = DARES[Math.floor(Math.random() * DARES.length)];
      await sock.sendMessage(jid, { text: `🎯 *DARE!*\n\n${dare}\n\n_Do you accept? 😈_` });
    }
  },

  truth: {
    category: 'fun', desc: 'Get a random truth question',
    usage: '.truth', aliases: ['question', 'truthq'], permissions: 'all',
    examples: ['.truth'],
    exec: async (args, sock, jid) => {
      const truth = TRUTHS[Math.floor(Math.random() * TRUTHS.length)];
      await sock.sendMessage(jid, { text: `🤔 *TRUTH!*\n\n${truth}\n\n_Be honest! 👀_` });
    }
  },

  ship: {
    category: 'fun', desc: 'Calculate the love compatibility between two people',
    usage: '.ship <name1> + <name2>', aliases: ['love', 'couple'], permissions: 'all',
    examples: ['.ship John + Jane', '.ship @user1 + @user2'],
    exec: async (args, sock, jid) => {
      const input  = args.join(' ');
      const parts  = input.split('+').map(s => s.trim());
      if (parts.length < 2) {
        return sock.sendMessage(jid, { text: '❌ Usage: .ship <name1> + <name2>' });
      }
      const [p1, p2] = parts;
      const score    = Math.floor(Math.random() * 101);
      const bar      = '❤️'.repeat(Math.round(score / 10)) + '🖤'.repeat(10 - Math.round(score / 10));
      const emoji    = score >= 80 ? '💕 Perfect Match!' : score >= 60 ? '💓 Great Match!' : score >= 40 ? '💙 Pretty Good!' : '🤍 Not So Much...';
      await sock.sendMessage(jid, {
        text:
          `💘 *Ship Calculator*\n\n` +
          `👤 ${p1}\n` +
          `👤 ${p2}\n\n` +
          `${bar}\n\n` +
          `❤️ *Compatibility:* ${score}%\n` +
          `${emoji}`
      });
    }
  },

  roast: {
    category: 'fun', desc: 'Get a funny roast for someone',
    usage: '.roast [@user]', aliases: ['burn'], permissions: 'all',
    examples: ['.roast @friend'],
    exec: async (args, sock, jid, isGroup, sender, message) => {
      const { getMentionedJid } = require('../lib/helpers');
      const target = getMentionedJid(message) || sender;
      const name   = target.split('@')[0];
      const roasts = [
        "I'd call you a joke, but jokes are actually funny! 😂",
        "You're the reason they put instructions on shampoo bottles! 😅",
        "Your birth certificate is an apology letter from the condom factory! 💀",
        "I've seen better heads on a pimple! 😂",
        "You're not stupid — you just have bad luck thinking! 🤔",
        "You bring everyone so much joy when you leave the room! 😂",
        "When I look at you, I think about what could have been... if the sperm chose differently! 😅",
        "If laughter is the best medicine, your face must be curing the world! 💊"
      ];
      const roast = roasts[Math.floor(Math.random() * roasts.length)];
      await sock.sendMessage(jid, {
        text: `🔥 *Roasting @${name}...*\n\n${roast}`,
        mentions: [target]
      });
    }
  },

  hack: {
    category: 'fun', desc: 'Fake-hack someone (just for fun)',
    usage: '.hack [@user]', aliases: [], permissions: 'all',
    examples: ['.hack @friend'],
    exec: async (args, sock, jid, isGroup, sender, message) => {
      const { getMentionedJid } = require('../lib/helpers');
      const target = getMentionedJid(message) || sender;
      const name   = target.split('@')[0];
      await sock.sendMessage(jid, {
        text:
          `💻 *Hacking @${name}...*\n\n` +
          `[▓▓░░░░░░░░] 20% — Scanning ports...\n` +
          `[▓▓▓▓▓░░░░░] 50% — Bypassing firewall...\n` +
          `[▓▓▓▓▓▓▓▓░░] 80% — Accessing database...\n` +
          `[▓▓▓▓▓▓▓▓▓▓] 100% — Done!\n\n` +
          `✅ *Successfully hacked @${name}!*\n` +
          `📧 Emails stolen: ${Math.floor(Math.random() * 9999)}\n` +
          `💳 Cards found: ${Math.floor(Math.random() * 5)}\n` +
          `🔑 Passwords: ************\n\n` +
          `_This is just for fun. Stay safe online! 😄_`,
        mentions: [target]
      });
    }
  },

  rate: {
    category: 'fun', desc: 'Rate someone on various metrics',
    usage: '.rate [@user]', aliases: ['rank'], permissions: 'all',
    examples: ['.rate @user'],
    exec: async (args, sock, jid, isGroup, sender, message) => {
      const { getMentionedJid } = require('../lib/helpers');
      const target = getMentionedJid(message) || sender;
      const name   = target.split('@')[0];
      const r      = () => Math.floor(Math.random() * 101);
      await sock.sendMessage(jid, {
        text:
          `📊 *Rating @${name}*\n\n` +
          `😎 Swag       : ${r()}%\n` +
          `🧠 Smart      : ${r()}%\n` +
          `💪 Strength   : ${r()}%\n` +
          `💰 Wealth     : ${r()}%\n` +
          `😂 Funny      : ${r()}%\n` +
          `💕 Loveable   : ${r()}%\n` +
          `🎯 Skillful   : ${r()}%\n` +
          `👑 Boss Level : ${r()}%\n\n` +
          `_Results are purely random! 😅_`,
        mentions: [target]
      });
    }
  },

  compliment: {
    category: 'fun', desc: 'Send a nice compliment to someone',
    usage: '.compliment [@user]', aliases: ['praise', 'nice'], permissions: 'all',
    examples: ['.compliment @user'],
    exec: async (args, sock, jid, isGroup, sender, message) => {
      const { getMentionedJid } = require('../lib/helpers');
      const target = getMentionedJid(message) || sender;
      const name   = target.split('@')[0];
      const compliments = [
        "You have an incredible ability to brighten up any room! ☀️",
        "Your kindness makes the world a better place! 💙",
        "You're more fun than bubble wrap! 🎉",
        "You have the best laugh! 😄",
        "Your smile can melt anyone's heart! 💕",
        "You're genuinely a wonderful human being! 🌟",
        "The world is a better place with you in it! 🌍",
        "You make even the boring things fun! 🎈"
      ];
      await sock.sendMessage(jid, {
        text: `💐 *Compliment for @${name}*\n\n${compliments[Math.floor(Math.random() * compliments.length)]}`,
        mentions: [target]
      });
    }
  },

  waifu: {
    category: 'fun', desc: 'Get a random anime waifu image',
    usage: '.waifu', aliases: ['anime', 'animegirl'], permissions: 'all',
    examples: ['.waifu'],
    exec: async (args, sock, jid) => {
      try {
        const { data } = await axios.get('https://api.waifu.pics/sfw/waifu', { timeout: 10000 });
        const resp = await axios.get(data.url, { responseType: 'arraybuffer', timeout: 30000 });
        await sock.sendMessage(jid, { image: Buffer.from(resp.data), caption: '🌸 *Waifu!*' });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('waifu lookup', err, { jid }) });
      }
    }
  },

  meme: {
    category: 'fun', desc: 'Get a random meme',
    usage: '.meme', aliases: ['randommeme'], permissions: 'all',
    examples: ['.meme'],
    exec: async (args, sock, jid) => {
      try {
        const { data } = await axios.get('https://meme-api.com/gimme', { timeout: 10000 });
        if (!data.url) throw new Error('No meme found');
        const resp = await axios.get(data.url, { responseType: 'arraybuffer', timeout: 30000 });
        await sock.sendMessage(jid, {
          image:   Buffer.from(resp.data),
          caption: `😂 *${data.title}*\n\n👍 ${data.ups} upvotes — r/${data.subreddit}`
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('meme lookup', err, { jid }) });
      }
    }
  },

  flip: {
    category: 'fun', desc: 'Flip a coin — heads or tails',
    usage: '.flip', aliases: ['coin', 'coinflip'], permissions: 'all',
    examples: ['.flip'],
    exec: async (args, sock, jid) => {
      const result = Math.random() < 0.5 ? '🪙 *HEADS!*' : '🪙 *TAILS!*';
      await sock.sendMessage(jid, { text: `${result}\n\n_Coin flipped!_` });
    }
  },

  dice: {
    category: 'fun', desc: 'Roll a dice',
    usage: '.dice [sides]', aliases: ['roll', 'd6'], permissions: 'all',
    examples: ['.dice', '.dice 20'],
    exec: async (args, sock, jid) => {
      const sides  = parseInt(args[0]) || 6;
      const result = Math.floor(Math.random() * sides) + 1;
      await sock.sendMessage(jid, { text: `🎲 *Rolled a ${sides}-sided dice!*\n\nResult: *${result}*` });
    }
  },

  '8ball': {
    category: 'fun', desc: 'Ask the magic 8-ball a yes/no question',
    usage: '.8ball <question>', aliases: ['magic8', 'eightball'], permissions: 'all',
    examples: ['.8ball Will I be rich?', '.8ball Am I lucky today?'],
    exec: async (args, sock, jid) => {
      const q = args.join(' ').trim();
      if (!q) return sock.sendMessage(jid, { text: '❌ Usage: .8ball <question>' });
      const answers = [
        '🟢 It is certain.', '🟢 It is decidedly so.', '🟢 Without a doubt.',
        '🟢 Yes, definitely.', '🟢 You may rely on it.', '🟢 As I see it, yes.',
        '🟢 Most likely.', '🟢 Outlook good.', '🟢 Yes.', '🟢 Signs point to yes.',
        '🟡 Reply hazy, try again.', '🟡 Ask again later.', '🟡 Better not tell you now.',
        '🟡 Cannot predict now.', '🟡 Concentrate and ask again.',
        '🔴 Don\'t count on it.', '🔴 My reply is no.', '🔴 My sources say no.',
        '🔴 Outlook not so good.', '🔴 Very doubtful.'
      ];
      const answer = answers[Math.floor(Math.random() * answers.length)];
      await sock.sendMessage(jid, { text: `🎱 *Magic 8-Ball*\n\n❓ ${q}\n\n${answer}` });
    }
  }
};

module.exports = funCommands;
