const { cmd } = require('../command');
const axios = require('axios');

async function answerWithApi({ conn, from, q, reply, react, service, url, extract }) {
  try {
    if (!q) return await reply(`Please provide a message for ${service}.\nExample: .${service.toLowerCase()} Hello`);
    const { data } = await axios.get(url(q), { timeout: 20000 });
    const answer = extract(data);
    if (typeof answer !== 'string' || !answer.trim()) {
      if (react) await react('❌').catch(() => {});
      return await reply(`${service} failed to respond. Please try again later.`);
    }
    await reply(`${service} response:\n\n${answer}`);
    if (react) await react('✅').catch(() => {});
  } catch (error) {
    console.error(`${service} command failed:`, error.message);
    if (react) await react('❌').catch(() => {});
    await reply(`An error occurred while communicating with ${service}.`);
  }
}

cmd({
  pattern: 'ai',
  alias: ['bot', 'victorytech', 'gpt', 'gpt4', 'bing'],
  desc: 'Chat with an AI model',
  category: 'ai',
  react: '🤖',
  filename: __filename
}, async (conn, mek, m, { from, q, reply, react }) => answerWithApi({
  conn, from, q, reply, react, service: 'AI',
  url: query => `https://lance-frank-asta.onrender.com/api/gpt?q=${encodeURIComponent(query)}`,
  extract: data => data?.message
}));

cmd({
  pattern: 'openai',
  alias: ['chatgpt', 'gpt3', 'open-gpt'],
  desc: 'Chat with OpenAI',
  category: 'ai',
  react: '🧠',
  filename: __filename
}, async (conn, mek, m, { from, q, reply, react }) => answerWithApi({
  conn, from, q, reply, react, service: 'OpenAI',
  url: query => `https://vapis.my.id/api/openai?q=${encodeURIComponent(query)}`,
  extract: data => data?.result
}));

cmd({
  pattern: 'deepseek',
  alias: ['deep', 'seekai'],
  desc: 'Chat with DeepSeek AI',
  category: 'ai',
  react: '🧠',
  filename: __filename
}, async (conn, mek, m, { from, q, reply, react }) => answerWithApi({
  conn, from, q, reply, react, service: 'DeepSeek AI',
  url: query => `https://api.ryzendesu.vip/api/ai/deepseek?text=${encodeURIComponent(query)}`,
  extract: data => data?.answer
}));
