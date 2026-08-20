'use strict';
// commands/games.js — Mini-games for Kira MD

const GAME_TTL_MS    = 15 * 60 * 1000;
const ticTacToeGames = new Map();
const hangmanGames   = new Map();
const guessGames     = new Map();

function touch(map, jid) { const e = map.get(jid); if (e) e.expires = Date.now() + GAME_TTL_MS; }
function sweepExpired() {
  const now = Date.now();
  for (const map of [ticTacToeGames, hangmanGames, guessGames]) {
    for (const [key, val] of map) if (val.expires && val.expires < now) map.delete(key);
  }
}
setInterval(sweepExpired, 5 * 60 * 1000).unref();

const TRIVIA = [
  { q: 'What is the capital of Nigeria?', a: ['abuja'] },
  { q: 'What is 7 × 8?', a: ['56'] },
  { q: 'Which planet is known as the Red Planet?', a: ['mars'] },
  { q: 'What language is WhatsApp written in?', a: ['erlang'] },
  { q: 'How many sides does a hexagon have?', a: ['6', 'six'] },
  { q: 'Who invented the telephone?', a: ['bell', 'alexander graham bell'] },
  { q: 'What is the boiling point of water in °C?', a: ['100'] },
  { q: 'Which ocean is the largest?', a: ['pacific', 'pacific ocean'] },
  { q: 'What does HTML stand for?', a: ['hypertext markup language'] },
  { q: 'How many bytes in a kilobyte?', a: ['1024'] },
  { q: 'What color do you get mixing blue and yellow?', a: ['green'] },
  { q: 'What is the fastest land animal?', a: ['cheetah'] },
  { q: 'What year did World War II end?', a: ['1945'] },
  { q: 'Who wrote Romeo and Juliet?', a: ['shakespeare', 'william shakespeare'] },
  { q: 'What is the square root of 144?', a: ['12'] },
  { q: 'How many continents are there?', a: ['7', 'seven'] },
  { q: 'What is the largest country by area?', a: ['russia'] },
  { q: 'Which element has the symbol Au?', a: ['gold'] },
  { q: 'What is the capital of France?', a: ['paris'] },
  { q: 'How many hours are in a day?', a: ['24', 'twenty-four'] }
];
const activeTrivia = new Map();

const HANGMAN_WORDS = [
  'javascript', 'typescript', 'python', 'algorithm', 'database',
  'network', 'security', 'framework', 'variable', 'function',
  'whatsapp', 'programming', 'developer', 'interface', 'keyboard',
  'monitor', 'software', 'hardware', 'internet', 'blockchain',
  'nigeria', 'football', 'chocolate', 'adventure', 'telephone'
];

function renderTTT(board) {
  const s = ['1','2','3','4','5','6','7','8','9'];
  return board.map((v, i) => v === 'X' ? '❌' : v === 'O' ? '⭕' : `${s[i]}️⃣`).reduce((acc, v, i) => {
    acc += v; if ((i + 1) % 3 === 0) acc += '\n'; return acc;
  }, '');
}

function checkTTTWin(b) {
  return [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
    .some(([a,c,d]) => b[a] && b[a] === b[c] && b[a] === b[d]);
}

function renderHangman(game) {
  const display = game.word.split('').map(c => game.guessed.has(c) ? c : '_').join(' ');
  const wrong   = [...game.guessed].filter(c => !game.word.includes(c));
  return `💀 *Hangman* — ${game.lives} lives left\n\nWord : ${display}\nWrong: ${wrong.join(', ') || '—'}\nGuessed: ${[...game.guessed].join(', ') || '—'}`;
}

const gamesCommands = {
  tictactoe: {
    category: 'games', desc: 'Play Tic-Tac-Toe (reply to start)',
    usage: '.tictactoe [@opponent | <1-9>]', aliases: ['ttt'],
    permissions: 'all', examples: ['.tictactoe @user', '.tictactoe 5'],
    exec: async (args, sock, jid, isGroup, sender, message) => {
      const game = ticTacToeGames.get(jid);
      const { getMentionedJid } = require('../lib/helpers');
      const opponent = getMentionedJid(message);
      const moveArg  = parseInt(args[0]);

      if (!game) {
        if (!opponent) {
          return sock.sendMessage(jid, { text: '🎮 *Tic-Tac-Toe*\n\nMention someone to start a game!\nUsage: *.tictactoe @user*' });
        }
        const newGame = { board: Array(9).fill(null), turn: sender, players: { [sender]: 'X', [opponent]: 'O' }, expires: Date.now() + GAME_TTL_MS };
        ticTacToeGames.set(jid, newGame);
        return sock.sendMessage(jid, {
          text:
            `🎮 *Tic-Tac-Toe started!*\n\n` +
            `❌ @${sender.split('@')[0]} vs ⭕ @${opponent.split('@')[0]}\n\n` +
            `${renderTTT(newGame.board)}\n\n` +
            `❌ @${sender.split('@')[0]}'s turn! Type *.ttt <1-9>* to place.`,
          mentions: [sender, opponent]
        });
      }

      touch(ticTacToeGames, jid);
      if (game.turn !== sender) return sock.sendMessage(jid, { text: `⏳ It's not your turn!` });
      if (!moveArg || moveArg < 1 || moveArg > 9 || game.board[moveArg - 1]) {
        return sock.sendMessage(jid, { text: `❌ Invalid move. Pick 1-9 on an empty square.` });
      }

      const symbol = game.players[sender];
      game.board[moveArg - 1] = symbol;

      if (checkTTTWin(game.board)) {
        ticTacToeGames.delete(jid);
        return sock.sendMessage(jid, {
          text: `${renderTTT(game.board)}\n\n🏆 *@${sender.split('@')[0]} wins!*`,
          mentions: [sender]
        });
      }

      if (game.board.every(Boolean)) {
        ticTacToeGames.delete(jid);
        return sock.sendMessage(jid, { text: `${renderTTT(game.board)}\n\n🤝 *It's a draw!*` });
      }

      const next = Object.keys(game.players).find(p => p !== sender);
      game.turn = next;
      await sock.sendMessage(jid, {
        text: `${renderTTT(game.board)}\n\n${game.players[next]} @${next.split('@')[0]}'s turn!`,
        mentions: [next]
      });
    }
  },

  hangman: {
    category: 'games', desc: 'Play Hangman word guessing game',
    usage: '.hangman [start|<letter>|give up]', aliases: ['hm'],
    permissions: 'all', examples: ['.hangman start', '.hangman a', '.hangman give up'],
    exec: async (args, sock, jid) => {
      const sub = (args[0] || '').toLowerCase();
      const game = hangmanGames.get(jid);

      if (!game || sub === 'start') {
        const word = HANGMAN_WORDS[Math.floor(Math.random() * HANGMAN_WORDS.length)];
        const newGame = { word, guessed: new Set(), lives: 6, expires: Date.now() + GAME_TTL_MS };
        hangmanGames.set(jid, newGame);
        return sock.sendMessage(jid, { text: `💀 *Hangman Started!*\n\n${renderHangman(newGame)}\n\nGuess a letter: *.hangman <letter>*` });
      }

      if (sub === 'give' && args[1] === 'up') {
        const word = game.word;
        hangmanGames.delete(jid);
        return sock.sendMessage(jid, { text: `🏳️ You gave up! The word was: *${word.toUpperCase()}*` });
      }

      touch(hangmanGames, jid);
      if (sub.length !== 1 || !/[a-z]/.test(sub)) {
        return sock.sendMessage(jid, { text: `❌ Guess one letter at a time. Example: *.hangman a*` });
      }

      if (game.guessed.has(sub)) return sock.sendMessage(jid, { text: `⚠️ You already guessed *${sub}*!` });
      game.guessed.add(sub);

      if (!game.word.includes(sub)) {
        game.lives--;
        if (game.lives <= 0) {
          const word = game.word;
          hangmanGames.delete(jid);
          return sock.sendMessage(jid, { text: `💀 *Game Over!*\n\nYou ran out of lives!\nThe word was: *${word.toUpperCase()}*` });
        }
        await sock.sendMessage(jid, { text: `❌ *${sub.toUpperCase()}* is not in the word!\n\n${renderHangman(game)}` });
      } else {
        const display = game.word.split('').map(c => game.guessed.has(c) ? c : '_').join(' ');
        if (!display.includes('_')) {
          hangmanGames.delete(jid);
          return sock.sendMessage(jid, { text: `🎉 *You won!*\n\nThe word was: *${game.word.toUpperCase()}*` });
        }
        await sock.sendMessage(jid, { text: `✅ *${sub.toUpperCase()}* is correct!\n\n${renderHangman(game)}` });
      }
    }
  },

  guess: {
    category: 'games', desc: 'Guess the number game (1-100)',
    usage: '.guess [start|<number>]', aliases: ['guessnumber', 'numguess'],
    permissions: 'all', examples: ['.guess start', '.guess 42'],
    exec: async (args, sock, jid) => {
      const sub  = (args[0] || '').toLowerCase();
      const game = guessGames.get(jid);

      if (!game || sub === 'start') {
        const number = Math.floor(Math.random() * 100) + 1;
        guessGames.set(jid, { number, tries: 0, expires: Date.now() + GAME_TTL_MS });
        return sock.sendMessage(jid, { text: `🎯 *Guess the Number!*\n\nI'm thinking of a number between *1-100*.\nUse *.guess <number>* to guess!` });
      }

      const num = parseInt(args[0]);
      if (isNaN(num) || num < 1 || num > 100) {
        return sock.sendMessage(jid, { text: `❌ Guess a number between 1-100. Example: *.guess 50*` });
      }

      touch(guessGames, jid);
      game.tries++;

      if (num === game.number) {
        guessGames.delete(jid);
        return sock.sendMessage(jid, { text: `🎉 *Correct!* The number was *${game.number}*!\n\n🏆 You got it in *${game.tries}* ${game.tries === 1 ? 'try' : 'tries'}!` });
      }

      const hint = num < game.number ? '⬆️ *Higher!*' : '⬇️ *Lower!*';
      await sock.sendMessage(jid, { text: `${hint}\n\nGuess #${game.tries} — Try again!` });
    }
  },

  trivia: {
    category: 'games', desc: 'Answer a trivia question',
    usage: '.trivia', aliases: ['quiz'], permissions: 'all', examples: ['.trivia'],
    exec: async (args, sock, jid, isGroup, sender) => {
      const q = TRIVIA[Math.floor(Math.random() * TRIVIA.length)];
      activeTrivia.set(jid, { ...q, asker: sender, expires: Date.now() + 60000 });
      await sock.sendMessage(jid, {
        text: `🎯 *Trivia Question!*\n\n❓ ${q.q}\n\n_Reply with your answer! You have 60 seconds._`
      });
      setTimeout(() => {
        const active = activeTrivia.get(jid);
        if (active && active.q === q.q) {
          activeTrivia.delete(jid);
          sock.sendMessage(jid, { text: `⏰ *Time's up!*\n\nThe answer was: *${q.a[0].toUpperCase()}*` }).catch(() => {});
        }
      }, 60000);
    }
  },

  trivia_answer: {
    category: 'games', desc: 'Internal trivia answer handler (auto)',
    usage: '.trivia_answer', aliases: [], permissions: 'all',
    examples: [],
    exec: async (args, sock, jid, isGroup, sender, message) => {}
  }
};

// Export trivia state so main bot can check messages
gamesCommands._checkTrivia = function(text, jid) {
  const active = activeTrivia.get(jid);
  if (!active) return null;
  if (active.expires < Date.now()) { activeTrivia.delete(jid); return null; }
  if (active.a.includes(text.toLowerCase().trim())) {
    activeTrivia.delete(jid);
    return { correct: true, answer: active.a[0] };
  }
  return { correct: false };
};

module.exports = gamesCommands;
