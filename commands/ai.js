'use strict';
// commands/ai.js — AI commands with multi-provider support + pollinations fallback
const axios = require('axios');
const { commandErrorMessage } = require('../lib/helpers');

const WATERMARK = '\n\n_Powered by Victory Tech™_';

async function askOpenAI(query, model = 'gpt-3.5-turbo') {
  const { OpenAI } = require('openai');
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
  const client = new OpenAI({ apiKey });
  const res = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: query }],
    max_tokens: 1024
  });
  return res.choices[0].message.content.trim();
}

async function askClaude(query) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await client.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 1024,
    messages: [{ role: 'user', content: query }]
  });
  return res.content[0].text.trim();
}

async function askGemini(query) {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const { data } = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { contents: [{ role: 'user', parts: [{ text: query }] }] },
    { params: { key: apiKey }, timeout: 60000 }
  );
  const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
  if (!text) throw new Error('Gemini returned an empty response');
  return text;
}

async function askPollinations(query, model = 'openai') {
  const seed = Math.floor(Math.random() * 99999);
  const url  = `https://text.pollinations.ai/${encodeURIComponent(query)}?model=${model}&seed=${seed}`;
  const res  = await axios.get(url, {
    timeout: 60000, responseType: 'text',
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/plain, */*' }
  });
  const text = typeof res.data === 'string' ? res.data.trim() : String(res.data || '').trim();
  if (!text) throw new Error('Empty response from AI service');
  return text;
}

async function handleAI(args, sock, jid, opts = {}) {
  const { label = 'AI', provider = 'auto', model } = opts;
  const query = args.join(' ').trim();

  if (!query) {
    return sock.sendMessage(jid, {
      text: `❌ Please include a question.\n\n*Usage:* .${label.toLowerCase()} <question>`
    });
  }

  await sock.sendMessage(jid, { text: `🤖 *${label}* is thinking...\n\n_"${query}"_` });

  try {
    let answer;
    if (provider === 'openai') {
      if (!process.env.OPENAI_API_KEY && !process.env.OPEN_API_KEY) throw new Error('OPENAI_API_KEY not set');
      answer = await askOpenAI(query, model);
    } else if (provider === 'claude') {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
      answer = await askClaude(query);
    } else if (provider === 'gemini') {
      if (!process.env.GOOGLE_AI_API_KEY) throw new Error('GOOGLE_AI_API_KEY not set');
      answer = await askGemini(query);
    } else if (provider === 'deepseek') {
      answer = await askPollinations(query, 'deepseek');
    } else {
      answer = (process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY)
        ? await askOpenAI(query)
        : await askPollinations(query, 'openai');
    }
    await sock.sendMessage(jid, {
      text: `🤖 *${label}*\n\n❓ ${query}\n\n💬 ${answer}`
    });
  } catch (err) {
    try {
      const fallback = await askPollinations(query, 'openai');
      await sock.sendMessage(jid, {
        text: `🤖 *${label}* _(free tier)_\n\n❓ ${query}\n\n💬 ${fallback}`
      });
    } catch (fallbackErr) {
      await sock.sendMessage(jid, {
        text: commandErrorMessage(label, fallbackErr || err, { jid })
      });
    }
  }
}

const aiCommands = {
  ai: {
    category: 'ai', desc: 'Ask AI (auto-selects best available model)',
    usage: '.ai <question>', aliases: ['ask'], permissions: 'all',
    examples: ['.ai What is the capital of Nigeria?', '.ai Explain gravity'],
    exec: async (args, sock, jid) => handleAI(args, sock, jid, { label: 'Kira AI', provider: 'auto' })
  },

  gpt: {
    category: 'ai', desc: 'Ask ChatGPT (OpenAI GPT-3.5)',
    usage: '.gpt <question>', aliases: ['chatgpt', 'openai'], permissions: 'all',
    examples: ['.gpt Write a poem about the moon'],
    exec: async (args, sock, jid) => handleAI(args, sock, jid, { label: 'ChatGPT', provider: 'openai' })
  },

  gpt4: {
    category: 'ai', desc: 'Ask GPT-4 (requires OpenAI key)',
    usage: '.gpt4 <question>', aliases: [], permissions: 'all',
    examples: ['.gpt4 Explain quantum computing'],
    exec: async (args, sock, jid) => handleAI(args, sock, jid, { label: 'GPT-4', provider: 'openai', model: 'gpt-4' })
  },

  claude: {
    category: 'ai', desc: 'Ask Claude AI (Anthropic)',
    usage: '.claude <question>', aliases: [], permissions: 'all',
    examples: ['.claude Summarize machine learning'],
    exec: async (args, sock, jid) => handleAI(args, sock, jid, { label: 'Claude', provider: 'claude' })
  },

  gemini: {
    category: 'ai', desc: 'Ask Google Gemini AI',
    usage: '.gemini <question>', aliases: [], permissions: 'all',
    examples: ['.gemini How does a black hole form?'],
    exec: async (args, sock, jid) => handleAI(args, sock, jid, { label: 'Gemini', provider: 'gemini' })
  },

  deepseek: {
    category: 'ai', desc: 'Ask DeepSeek AI (free)',
    usage: '.deepseek <question>', aliases: ['ds'], permissions: 'all',
    examples: ['.deepseek Solve this math problem: 2x + 5 = 15'],
    exec: async (args, sock, jid) => handleAI(args, sock, jid, { label: 'DeepSeek', provider: 'deepseek' })
  },

  imagine: {
    category: 'ai', desc: 'Generate an AI image from a text prompt',
    usage: '.imagine <prompt>', aliases: ['gen', 'draw', 'image'], permissions: 'all',
    examples: ['.imagine a beautiful sunset over Lagos', '.imagine anime girl with blue hair'],
    exec: async (args, sock, jid) => {
      const prompt = args.join(' ').trim();
      if (!prompt) return sock.sendMessage(jid, { text: '❌ Usage: .imagine <description>\n\nExample: .imagine a golden lion in the forest' });
      await sock.sendMessage(jid, { text: `🎨 *Generating image...*\n\n_"${prompt}"_\n\n_This may take 10-30 seconds..._` });
      try {
        const seed  = Math.floor(Math.random() * 999999);
        const model = 'flux';
        const url   = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=${model}&seed=${seed}&width=1024&height=1024&nologo=true`;
        const resp  = await axios.get(url, {
          responseType: 'arraybuffer', timeout: 60000,
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://pollinations.ai/',
            'Accept': 'image/webp,image/*,*/*;q=0.8'
          }
        });
        const ct = resp.headers['content-type'] || '';
        if (!ct.startsWith('image/')) throw new Error('Service returned non-image response. Try again.');
        await sock.sendMessage(jid, {
          image:   Buffer.from(resp.data),
          caption: `🎨 *AI Generated Image*\n\n_"${prompt}"_${WATERMARK}`
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('image generation', err, { jid }) });
      }
    }
  },

  flux: {
    category: 'ai', desc: 'Generate a high-quality Flux AI image',
    usage: '.flux <prompt>', aliases: ['fluxai'], permissions: 'all',
    examples: ['.flux realistic portrait of a Nigerian warrior'],
    exec: async (args, sock, jid) => {
      const prompt = args.join(' ').trim();
      if (!prompt) return sock.sendMessage(jid, { text: '❌ Usage: .flux <description>' });
      await sock.sendMessage(jid, { text: `🎨 *Flux AI generating...*\n\n_"${prompt}"_` });
      try {
        const seed = Math.floor(Math.random() * 999999);
        const url  = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=flux-pro&seed=${seed}&width=1024&height=1024&nologo=true`;
        const resp = await axios.get(url, {
          responseType: 'arraybuffer', timeout: 60000,
          headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://pollinations.ai/' }
        });
        const ct = resp.headers['content-type'] || '';
        if (!ct.startsWith('image/')) throw new Error('Service returned non-image response. Try again.');
        await sock.sendMessage(jid, {
          image:   Buffer.from(resp.data),
          caption: `🎨 *Flux AI Image*\n\n_"${prompt}"_${WATERMARK}`
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('Flux image generation', err, { jid }) });
      }
    }
  },

  translate: {
    category: 'ai', desc: 'Translate text to any language',
    usage: '.translate <language> | <text>', aliases: ['tr'], permissions: 'all',
    examples: ['.translate Spanish | Hello world', '.translate Yoruba | Good morning'],
    exec: async (args, sock, jid) => {
      const input = args.join(' ').trim();
      if (!input) return sock.sendMessage(jid, { text: '❌ Usage: .translate <language> | <text>' });
      const [lang, ...rest] = input.split('|');
      const text = rest.join('|').trim();
      if (!text) return sock.sendMessage(jid, { text: '❌ Usage: .translate <language> | <text>' });
      await handleAI(
        [`Translate this to ${lang.trim()}, reply with only the translation: "${text}"`],
        sock, jid, { label: 'Translate', provider: 'auto' }
      );
    }
  },

  summarize: {
    category: 'ai', desc: 'Summarize a long piece of text',
    usage: '.summarize <text>', aliases: ['sum', 'tldr'], permissions: 'all',
    examples: ['.summarize <paste long article here>'],
    exec: async (args, sock, jid) => {
      const text = args.join(' ').trim();
      if (!text) return sock.sendMessage(jid, { text: '❌ Usage: .summarize <long text>' });
      await handleAI(
        [`Summarize the following in 3-5 bullet points:\n\n${text}`],
        sock, jid, { label: 'Summarize', provider: 'auto' }
      );
    }
  },

  essay: {
    category: 'ai', desc: 'Write an essay on any topic',
    usage: '.essay <topic>', aliases: ['write'], permissions: 'all',
    examples: ['.essay The impact of technology on education in Nigeria'],
    exec: async (args, sock, jid) => {
      const topic = args.join(' ').trim();
      if (!topic) return sock.sendMessage(jid, { text: '❌ Usage: .essay <topic>' });
      await handleAI(
        [`Write a concise, well-structured essay (3-4 paragraphs) on the topic: "${topic}"`],
        sock, jid, { label: 'Essay', provider: 'auto' }
      );
    }
  },

  code: {
    category: 'ai', desc: 'Generate or explain code',
    usage: '.code <description or question>', aliases: ['coding', 'program'], permissions: 'all',
    examples: ['.code Write a function to reverse a string in Python', '.code Explain what async/await does'],
    exec: async (args, sock, jid) => {
      const query = args.join(' ').trim();
      if (!query) return sock.sendMessage(jid, { text: '❌ Usage: .code <coding question or task>' });
      await handleAI(
        [`You are a helpful programming assistant. ${query}`],
        sock, jid, { label: 'Code Assistant', provider: 'auto' }
      );
    }
  },

  spell: {
    category: 'ai', desc: 'Check and correct spelling/grammar',
    usage: '.spell <text>', aliases: ['grammar', 'correct'], permissions: 'all',
    examples: ['.spell i am going to the markt tomorro'],
    exec: async (args, sock, jid) => {
      const text = args.join(' ').trim();
      if (!text) return sock.sendMessage(jid, { text: '❌ Usage: .spell <text to check>' });
      await handleAI(
        [`Correct the spelling and grammar of this text, then show original vs corrected: "${text}"`],
        sock, jid, { label: 'Spell Check', provider: 'auto' }
      );
    }
  },

  recipe: {
    category: 'ai', desc: 'Get a recipe for any dish',
    usage: '.recipe <dish name>', aliases: ['cook'], permissions: 'all',
    examples: ['.recipe Jollof rice', '.recipe Egusi soup'],
    exec: async (args, sock, jid) => {
      const dish = args.join(' ').trim();
      if (!dish) return sock.sendMessage(jid, { text: '❌ Usage: .recipe <dish name>' });
      await handleAI(
        [`Give me a clear recipe for "${dish}" with ingredients and step-by-step instructions.`],
        sock, jid, { label: 'Recipe', provider: 'auto' }
      );
    }
  },

  advice: {
    category: 'ai', desc: 'Get AI advice on any topic',
    usage: '.advice <situation>', aliases: [], permissions: 'all',
    examples: ['.advice How do I deal with stress at work?'],
    exec: async (args, sock, jid) => {
      const q = args.join(' ').trim();
      if (!q) return sock.sendMessage(jid, { text: '❌ Usage: .advice <your situation>' });
      await handleAI([`Give helpful, practical advice for: "${q}"`], sock, jid, { label: 'Advice', provider: 'auto' });
    }
  }
};

module.exports = aiCommands;
