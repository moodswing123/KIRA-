'use strict';
// commands/search.js — Search commands via free public APIs
const axios = require('axios');
const { commandErrorMessage } = require('../lib/helpers');

async function googleSearch(query) {
  const res = await axios.get('https://api.duckduckgo.com/', {
    params: { q: query, format: 'json', no_html: 1, skip_disambig: 1 },
    timeout: 10000
  });
  const d = res.data;
  if (d.AbstractText) return `🔍 *${d.Heading}*\n\n${d.AbstractText}\n\n🔗 ${d.AbstractURL || 'N/A'}`;
  if (d.Answer)       return `🔍 *Answer*\n\n${d.Answer}`;
  return `🔍 No instant result for "*${query}*".\n\nSearch online: https://google.com/search?q=${encodeURIComponent(query)}`;
}

const searchCommands = {
  google: {
    category: 'search', desc: 'Search Google / DuckDuckGo instant answers',
    usage: '.google <query>', aliases: ['search', 'ddg', 'find'], permissions: 'all',
    examples: ['.google capital of Nigeria', '.google Node.js'],
    exec: async (args, sock, jid) => {
      const q = args.join(' ').trim();
      if (!q) return sock.sendMessage(jid, { text: '❌ Usage: .google <query>' });
      await sock.sendMessage(jid, { text: `🔍 Searching: _"${q}"_...` });
      try { await sock.sendMessage(jid, { text: await googleSearch(q) }); }
      catch (err) { await sock.sendMessage(jid, { text: commandErrorMessage('search', err, { jid }) }); }
    }
  },

  github: {
    category: 'search', desc: 'Search GitHub repositories',
    usage: '.github <repo or user/repo>', aliases: [], permissions: 'all',
    examples: ['.github baileys', '.github facebook/react'],
    exec: async (args, sock, jid) => {
      const q = args.join(' ').trim();
      if (!q) return sock.sendMessage(jid, { text: '❌ Usage: .github <query or user/repo>' });
      await sock.sendMessage(jid, { text: `🐙 Searching GitHub: _"${q}"_...` });
      try {
        if (/^[\w.-]+\/[\w.-]+$/.test(q)) {
          const { data: r } = await axios.get(`https://api.github.com/repos/${q}`, { timeout: 10000 });
          await sock.sendMessage(jid, {
            text:
              `🐙 *${r.full_name}*\n\n` +
              `📝 ${r.description || 'No description'}\n\n` +
              `⭐ Stars    : ${r.stargazers_count.toLocaleString()}\n` +
              `🍴 Forks    : ${r.forks_count.toLocaleString()}\n` +
              `📦 Language : ${r.language || 'N/A'}\n` +
              `🔗 URL      : ${r.html_url}`
          });
        } else {
          const { data } = await axios.get('https://api.github.com/search/repositories', {
            params: { q, sort: 'stars', per_page: 3 }, timeout: 10000
          });
          if (!data.items?.length) return sock.sendMessage(jid, { text: '❌ No repos found.' });
          const lines = data.items.map(r =>
            `🔹 *${r.full_name}* ⭐${r.stargazers_count.toLocaleString()}\n   ${r.description?.slice(0, 60) || '—'}\n   ${r.html_url}`
          ).join('\n\n');
          await sock.sendMessage(jid, { text: `🐙 *GitHub Results for "${q}"*\n\n${lines}` });
        }
      } catch (err) { await sock.sendMessage(jid, { text: commandErrorMessage('GitHub search', err, { jid }) }); }
    }
  },

  npm: {
    category: 'search', desc: 'Search npm packages',
    usage: '.npm <package>', aliases: [], permissions: 'all',
    examples: ['.npm axios', '.npm baileys'],
    exec: async (args, sock, jid) => {
      const q = args.join(' ').trim();
      if (!q) return sock.sendMessage(jid, { text: '❌ Usage: .npm <package name>' });
      await sock.sendMessage(jid, { text: `📦 Searching npm: _"${q}"_...` });
      try {
        const { data } = await axios.get(`https://registry.npmjs.org/${encodeURIComponent(q)}`, { timeout: 10000 });
        const latest   = data['dist-tags']?.latest;
        const version  = data.versions?.[latest];
        await sock.sendMessage(jid, {
          text:
            `📦 *${data.name}* v${latest || '?'}\n\n` +
            `📝 ${data.description || 'No description'}\n\n` +
            `📥 Weekly downloads info via npm\n` +
            `🔗 https://npmjs.com/package/${data.name}`
        });
      } catch (err) { await sock.sendMessage(jid, { text: commandErrorMessage('npm search', err, { jid }) }); }
    }
  },

  lyrics: {
    category: 'search', desc: 'Find song lyrics',
    usage: '.lyrics <song name>', aliases: ['lyric'], permissions: 'all',
    examples: ['.lyrics Wizkid Essence', '.lyrics Starboy'],
    exec: async (args, sock, jid) => {
      const q = args.join(' ').trim();
      if (!q) return sock.sendMessage(jid, { text: '❌ Usage: .lyrics <song name>' });
      await sock.sendMessage(jid, { text: `🎵 Searching lyrics: _"${q}"_...` });
      try {
        const { data } = await axios.get(`https://api.lyrics.ovh/suggest/${encodeURIComponent(q)}`, { timeout: 10000 });
        if (!data.data?.length) throw new Error('No songs found');
        const song   = data.data[0];
        const { data: lyricsData } = await axios.get(
          `https://api.lyrics.ovh/v1/${encodeURIComponent(song.artist.name)}/${encodeURIComponent(song.title.name || song.title)}`,
          { timeout: 10000 }
        );
        const lyrics = lyricsData.lyrics?.slice(0, 3000) || 'No lyrics found.';
        await sock.sendMessage(jid, {
          text: `🎵 *${song.title.name || song.title}* — *${song.artist.name}*\n\n${lyrics}`
        });
      } catch (err) { await sock.sendMessage(jid, { text: commandErrorMessage('lyrics search', err, { jid }) }); }
    }
  },

  wikipedia: {
    category: 'search', desc: 'Search Wikipedia for information',
    usage: '.wikipedia <query>', aliases: ['wiki', 'wp'], permissions: 'all',
    examples: ['.wikipedia Nigeria', '.wikipedia Albert Einstein'],
    exec: async (args, sock, jid) => {
      const q = args.join(' ').trim();
      if (!q) return sock.sendMessage(jid, { text: '❌ Usage: .wikipedia <query>' });
      await sock.sendMessage(jid, { text: `📖 Searching Wikipedia: _"${q}"_...` });
      try {
        const { data } = await axios.get('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(q), { timeout: 10000 });
        if (!data.extract) throw new Error('No article found');
        await sock.sendMessage(jid, {
          text:
            `📖 *${data.title}*\n\n${data.extract.slice(0, 1500)}...\n\n🔗 ${data.content_urls?.desktop?.page || 'N/A'}`
        });
      } catch (err) { await sock.sendMessage(jid, { text: commandErrorMessage('Wikipedia search', err, { jid }) }); }
    }
  },

  weather: {
    category: 'search', desc: 'Get current weather for any city',
    usage: '.weather <city>', aliases: ['climate', 'temp'], permissions: 'all',
    examples: ['.weather Lagos', '.weather London'],
    exec: async (args, sock, jid) => {
      const city = args.join(' ').trim();
      if (!city) return sock.sendMessage(jid, { text: '❌ Usage: .weather <city>' });
      await sock.sendMessage(jid, { text: `🌤️ Fetching weather for _${city}_...` });
      try {
        const { data } = await axios.get(
          `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
          { timeout: 10000 }
        );
        const cur  = data.current_condition?.[0];
        const area = data.nearest_area?.[0];
        if (!cur) throw new Error('City not found');
        const areaName = area?.areaName?.[0]?.value || city;
        await sock.sendMessage(jid, {
          text:
            `🌤️ *Weather — ${areaName}*\n\n` +
            `🌡️ Temperature : ${cur.temp_C}°C / ${cur.temp_F}°F\n` +
            `💧 Humidity    : ${cur.humidity}%\n` +
            `💨 Wind        : ${cur.windspeedKmph} km/h\n` +
            `☁️  Description : ${cur.weatherDesc?.[0]?.value || 'N/A'}\n` +
            `👁️  Visibility  : ${cur.visibility} km\n` +
            `🌡️ Feels Like  : ${cur.FeelsLikeC}°C`
        });
      } catch (err) { await sock.sendMessage(jid, { text: commandErrorMessage('weather lookup', err, { jid }) }); }
    }
  },

  news: {
    category: 'search', desc: 'Get latest tech headlines',
    usage: '.news [category]', aliases: ['headlines'], permissions: 'all',
    examples: ['.news', '.news tech'],
    exec: async (args, sock, jid) => {
      await sock.sendMessage(jid, { text: `📰 Fetching latest news...` });
      try {
        const { data } = await axios.get('https://hacker-news.firebaseio.com/v0/topstories.json', { timeout: 10000 });
        const ids = data.slice(0, 5);
        const stories = await Promise.all(ids.map(id =>
          axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { timeout: 5000 }).then(r => r.data)
        ));
        const lines = stories.map((s, i) =>
          `${i + 1}. *${s.title}*\n   🔗 ${s.url || 'no link'}`
        ).join('\n\n');
        await sock.sendMessage(jid, { text: `📰 *Top Tech News*\n\n${lines}` });
      } catch (err) { await sock.sendMessage(jid, { text: commandErrorMessage('news lookup', err, { jid }) }); }
    }
  },

  currency: {
    category: 'search', desc: 'Convert currency amounts',
    usage: '.currency <amount> <from> to <to>', aliases: ['convert', 'fx', 'exchange'], permissions: 'all',
    examples: ['.currency 100 USD to NGN', '.currency 50 EUR to GBP'],
    exec: async (args, sock, jid) => {
      const amount = parseFloat(args[0]);
      const from   = (args[1] || '').toUpperCase();
      const to     = (args[3] || '').toUpperCase();
      if (!amount || !from || !to) return sock.sendMessage(jid, { text: '❌ Usage: .currency <amount> <from> to <to>' });
      try {
        const { data } = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from}`, { timeout: 10000 });
        const rate = data.rates[to];
        if (!rate) throw new Error(`Unknown currency: ${to}`);
        const result = (amount * rate).toFixed(2);
        await sock.sendMessage(jid, {
          text:
            `💱 *Currency Conversion*\n\n` +
            `💵 ${amount} ${from}\n` +
            `= 💰 *${result} ${to}*\n\n` +
            `📊 Rate: 1 ${from} = ${rate.toFixed(4)} ${to}`
        });
      } catch (err) { await sock.sendMessage(jid, { text: commandErrorMessage('currency conversion', err, { jid }) }); }
    }
  },

  wikimedia: {
    category: 'search', desc: 'Search images on Wikimedia Commons',
    usage: '.wikimedia <query>', aliases: [], permissions: 'all',
    examples: ['.wikimedia lion', '.wikimedia Eiffel Tower'],
    exec: async (args, sock, jid) => {
      const q = args.join(' ').trim();
      if (!q) return sock.sendMessage(jid, { text: '❌ Usage: .wikimedia <query>' });
      await sock.sendMessage(jid, { text: `🌐 Searching Wikimedia for _"${q}"_...` });
      try {
        const { data } = await axios.get('https://commons.wikimedia.org/w/api.php', {
          params: { action: 'query', generator: 'search', gsrsearch: q, gsrlimit: 6, prop: 'imageinfo', iiprop: 'url', format: 'json' },
          timeout: 10000
        });
        const pages = data.query?.pages;
        if (!pages) return sock.sendMessage(jid, { text: `😔 No images found for "${q}".` });
        const urls = Object.values(pages).map(p => p.imageinfo?.[0]?.url).filter(Boolean).slice(0, 3);
        if (!urls.length) return sock.sendMessage(jid, { text: `😔 No images found for "${q}".` });
        for (let i = 0; i < urls.length; i++) {
          await sock.sendMessage(jid, { image: { url: urls[i] }, caption: `🌐 Wikimedia result ${i + 1} for "${q}"` });
        }
      } catch (err) { await sock.sendMessage(jid, { text: commandErrorMessage('Wikimedia search', err, { jid }) }); }
    }
  },

  bible: {
    category: 'search', desc: 'Get a Bible verse',
    usage: '.bible <book chapter:verse>', aliases: ['verse', 'bibleverse'], permissions: 'all',
    examples: ['.bible John 3:16', '.bible Psalms 23:1'],
    exec: async (args, sock, jid) => {
      const query = args.join(' ').trim();
      if (!query) return sock.sendMessage(jid, { text: '❌ Usage: .bible <book chapter:verse>\n\nExample: .bible John 3:16' });
      try {
        const { data } = await axios.get(
          `https://bible-api.com/${encodeURIComponent(query)}`,
          { timeout: 10000 }
        );
        await sock.sendMessage(jid, {
          text: `📖 *${data.reference}*\n\n_"${data.text.trim()}"_\n\n— ${data.translation_name}`
        });
      } catch (err) { await sock.sendMessage(jid, { text: `❌ Bible verse not found. Try: .bible John 3:16` }); }
    }
  }
};

module.exports = searchCommands;
