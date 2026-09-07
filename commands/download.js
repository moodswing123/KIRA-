'use strict';
// commands/download.js — Download commands for Kira MD
// All downloads append "Powered by Victory Tech™" watermark
const axios = require('axios');
const { commandErrorMessage } = require('../lib/helpers');
const apify = require('../lib/apify');

const WATERMARK = '\n\n_Powered by Victory Tech™_';

async function sendApifyDownload(sock, jid, link, {
  preferredType = null,
  caption,
  label = 'Download'
} = {}) {
  const resolved = await apify.resolveMedia(link, preferredType);
  const media = resolved.media;

  try {
    const { buffer, contentType } = await apify.downloadMedia(media);
    const type = String(media.type || '').toLowerCase();
    const extension = String(media.extension || '').toLowerCase();
    const isAudio = type === 'audio' || contentType.startsWith('audio/') ||
      ['mp3', 'm4a', 'aac', 'ogg', 'wav'].includes(extension);
    const isImage = type === 'image' || contentType.startsWith('image/') ||
      ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension);
    const isVideo = type === 'video' || contentType.startsWith('video/') ||
      ['mp4', 'webm', 'mov', 'mkv'].includes(extension);

    if (isAudio) {
      await sock.sendMessage(jid, {
        audio: buffer,
        mimetype: contentType || 'audio/mpeg',
        caption
      });
    } else if (isImage) {
      await sock.sendMessage(jid, { image: buffer, caption });
    } else if (isVideo) {
      await sock.sendMessage(jid, {
        video: buffer,
        caption,
        mimetype: contentType || 'video/mp4'
      });
    } else {
      const filename = decodeURIComponent(
        String(media.url).split('/').pop()?.split('?')[0] || `${label.toLowerCase()}.bin`
      );
      await sock.sendMessage(jid, {
        document: buffer,
        fileName: filename,
        mimetype: contentType || 'application/octet-stream',
        caption
      });
    }
  } catch (downloadError) {
    // Keep the command useful when WhatsApp cannot accept a large asset:
    // return the Apify-hosted link instead of dropping the result.
    await sock.sendMessage(jid, {
      text:
        `${caption}\n\n` +
        `🔗 *Direct Link:*\n${media.url}\n\n` +
        `_The media was resolved by Apify but could not be attached here: ${downloadError.message}_`
    });
  }

  return media;
}

// ── TikTok via tikwm.com ──────────────────────────────────────────────────
async function tikwmFetch(url) {
  const { data } = await axios.post(
    'https://www.tikwm.com/api/',
    new URLSearchParams({ url, hd: '1' }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Kira-MD/1.0' }, timeout: 20000 }
  );
  if (data.code !== 0 || !data.data) throw new Error(data.msg || 'tikwm API failed');
  const d = data.data;
  return {
    title:     d.title    || 'TikTok Video',
    author:    d.author?.nickname || 'Unknown',
    duration:  d.duration || 0,
    videoUrl:  d.hdplay   || d.play,
    audioUrl:  d.music    || null,
    thumbnail: d.cover    || null,
    views:     d.play_count || 0,
    likes:     d.digg_count || 0
  };
}

const downloadCommands = {
  // ── YouTube Video ────────────────────────────────────────────────────────
  ytdl: {
    category: 'downloader', commandTimeoutMs: 180000, desc: 'Download YouTube video',
    usage: '.ytdl <url> [quality]', aliases: ['yt', 'youtube', 'ytv'], permissions: 'all',
    examples: ['.ytdl https://youtu.be/xxxxx', '.ytdl https://youtu.be/xxxxx 360'],
    exec: async (args, sock, jid) => {
      const url     = args[0];
      const quality = args[1] || '720';
      if (!url || !url.match(/youtube\.com|youtu\.be/)) {
        return sock.sendMessage(jid, { text: `📹 *YouTube Downloader*\n\nUsage: *.ytdl <url>*\nExample: *.ytdl https://youtu.be/xxxxx*${WATERMARK}` });
      }
      await sock.sendMessage(jid, { text: `📹 *Downloading YouTube video...*\n\n🔗 ${url}\n⏳ Please wait...` });
      try {
        await sendApifyDownload(sock, jid, url, {
          preferredType: 'video',
          label: `YouTube ${quality}p video`,
          caption: `📹 *YouTube Video*\n\n🔗 ${url}${WATERMARK}`
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('YouTube download', err, { jid }) });
      }
    }
  },

  // ── YouTube Audio (MP3) ──────────────────────────────────────────────────
  ytmp3: {
    category: 'downloader', commandTimeoutMs: 180000, desc: 'Download YouTube video as MP3 audio',
    usage: '.ytmp3 <url>', aliases: ['ymp3', 'ytaudio', 'ytsong'], permissions: 'all',
    examples: ['.ytmp3 https://youtu.be/xxxxx'],
    exec: async (args, sock, jid) => {
      const url = args[0];
      if (!url || !url.match(/youtube\.com|youtu\.be/)) {
        return sock.sendMessage(jid, { text: `🎵 *YouTube MP3*\n\nUsage: *.ytmp3 <url>*${WATERMARK}` });
      }
      await sock.sendMessage(jid, { text: `🎵 *Extracting audio...*\n\n🔗 ${url}\n⏳ Please wait...` });
      try {
        await sendApifyDownload(sock, jid, url, {
          preferredType: 'audio',
          label: 'YouTube MP3',
          caption: `🎵 *YouTube Audio*\n\n🔗 ${url}${WATERMARK}`
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('YouTube MP3 download', err, { jid }) });
      }
    }
  },

  // ── YouTube Search + Play ────────────────────────────────────────────────
  play: {
    category: 'downloader', commandTimeoutMs: 180000, desc: 'Search YouTube and download the top result as audio',
    usage: '.play <song name>', aliases: ['song', 'music'], permissions: 'all',
    examples: ['.play Wizkid Essence', '.play Burna Boy Last Last'],
    exec: async (args, sock, jid) => {
      const query = args.join(' ').trim();
      if (!query) return sock.sendMessage(jid, { text: `🎵 *Play*\n\nUsage: *.play <song name>*${WATERMARK}` });
      await sock.sendMessage(jid, { text: `🔍 *Searching:* _"${query}"_...` });
      try {
        // Search via YouTube oEmbed / search scrape
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        const { data: html } = await axios.get(searchUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000
        });
        const match = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
        if (!match) throw new Error('No results found');
        const videoId  = match[1];
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        await sock.sendMessage(jid, { text: `🎵 *Found! Downloading...*\n\n🔗 ${videoUrl}` });
        await sendApifyDownload(sock, jid, videoUrl, {
          preferredType: 'audio',
          label: query,
          caption: `🎵 *${query}*\n\n🔗 ${videoUrl}${WATERMARK}`
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('play download', err, { jid }) });
      }
    }
  },

  // ── TikTok ───────────────────────────────────────────────────────────────
  tiktok: {
    category: 'downloader', desc: 'Download TikTok video (no watermark)',
    usage: '.tiktok <url>', aliases: ['tt', 'tik', 'ttdl'], permissions: 'all',
    examples: ['.tiktok https://www.tiktok.com/@user/video/123456789'],
    exec: async (args, sock, jid) => {
      const url = args[0];
      if (!url || !url.includes('tiktok.com')) {
        return sock.sendMessage(jid, { text: `📱 *TikTok Downloader*\n\nUsage: *.tiktok <url>*${WATERMARK}` });
      }
      await sock.sendMessage(jid, { text: `📱 *Downloading TikTok video...*\n\n⏳ Please wait...` });
      try {
        const info = await tikwmFetch(url);
        const resp = await axios.get(info.videoUrl, { responseType: 'arraybuffer', timeout: 60000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        await sock.sendMessage(jid, {
          video:   Buffer.from(resp.data),
          caption:
            `📱 *TikTok Video*\n\n` +
            `👤 *Author:* ${info.author}\n` +
            `📝 *Title:* ${info.title.slice(0, 80)}\n` +
            `⏱️ *Duration:* ${info.duration}s\n` +
            `❤️ *Likes:* ${(info.likes || 0).toLocaleString()}${WATERMARK}`,
          mimetype: 'video/mp4'
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('TikTok download', err, { jid }) });
      }
    }
  },

  // ── TikTok Audio ─────────────────────────────────────────────────────────
  tiktokmp3: {
    category: 'downloader', desc: 'Download TikTok audio/sound',
    usage: '.tiktokmp3 <url>', aliases: ['ttaudio', 'ttsound'], permissions: 'all',
    examples: ['.tiktokmp3 https://www.tiktok.com/@user/video/123456789'],
    exec: async (args, sock, jid) => {
      const url = args[0];
      if (!url || !url.includes('tiktok.com')) {
        return sock.sendMessage(jid, { text: `🎵 *TikTok Audio*\n\nUsage: *.tiktokmp3 <url>*${WATERMARK}` });
      }
      await sock.sendMessage(jid, { text: `🎵 *Extracting TikTok audio...*` });
      try {
        const info = await tikwmFetch(url);
        if (!info.audioUrl) throw new Error('No audio found for this TikTok');
        const resp = await axios.get(info.audioUrl, { responseType: 'arraybuffer', timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        await sock.sendMessage(jid, {
          audio:    Buffer.from(resp.data),
          mimetype: 'audio/mpeg',
          caption:  `🎵 *TikTok Audio*\n\n📝 ${info.title.slice(0, 80)}${WATERMARK}`
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('TikTok audio download', err, { jid }) });
      }
    }
  },

  // ── Instagram ────────────────────────────────────────────────────────────
  igdl: {
    category: 'downloader', commandTimeoutMs: 180000, desc: 'Download Instagram post, reel or story',
    usage: '.igdl <url>', aliases: ['ig', 'instagram', 'insta'], permissions: 'all',
    examples: ['.igdl https://www.instagram.com/p/xxxxx/', '.igdl https://www.instagram.com/reel/xxxxx/'],
    exec: async (args, sock, jid) => {
      const url = args[0];
      if (!url || !url.includes('instagram.com')) {
        return sock.sendMessage(jid, { text: `📸 *Instagram Downloader*\n\nUsage: *.igdl <url>*${WATERMARK}` });
      }
      await sock.sendMessage(jid, { text: `📸 *Downloading from Instagram...*\n\n⏳ Please wait...` });
      try {
        await sendApifyDownload(sock, jid, url, {
          label: 'Instagram media',
          caption: `📸 *Instagram Download*\n\n🔗 ${url}${WATERMARK}`
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('Instagram download', err, { jid }) });
      }
    }
  },

  // ── Facebook ─────────────────────────────────────────────────────────────
  fbdl: {
    category: 'downloader', commandTimeoutMs: 180000, desc: 'Download Facebook video',
    usage: '.fbdl <url>', aliases: ['fb', 'facebook'], permissions: 'all',
    examples: ['.fbdl https://www.facebook.com/watch?v=123456'],
    exec: async (args, sock, jid) => {
      const url = args[0];
      if (!url || !url.includes('facebook.com') && !url.includes('fb.watch')) {
        return sock.sendMessage(jid, { text: `📘 *Facebook Downloader*\n\nUsage: *.fbdl <url>*${WATERMARK}` });
      }
      await sock.sendMessage(jid, { text: `📘 *Downloading Facebook video...*\n\n⏳ Please wait...` });
      try {
        await sendApifyDownload(sock, jid, url, {
          preferredType: 'video',
          label: 'Facebook video',
          caption: `📘 *Facebook Video*\n\n🔗 ${url}${WATERMARK}`
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('Facebook download', err, { jid }) });
      }
    }
  },

  // ── Twitter / X ───────────────────────────────────────────────────────────
  twitter: {
    category: 'downloader', commandTimeoutMs: 180000, desc: 'Download Twitter/X video or GIF',
    usage: '.twitter <url>', aliases: ['twit', 'xdl', 'tweet'], permissions: 'all',
    examples: ['.twitter https://twitter.com/user/status/123456789'],
    exec: async (args, sock, jid) => {
      const url = args[0];
      if (!url || (!url.includes('twitter.com') && !url.includes('x.com') && !url.includes('t.co'))) {
        return sock.sendMessage(jid, { text: `🐦 *Twitter Downloader*\n\nUsage: *.twitter <url>*${WATERMARK}` });
      }
      await sock.sendMessage(jid, { text: `🐦 *Downloading from Twitter/X...*` });
      try {
        await sendApifyDownload(sock, jid, url, {
          preferredType: 'video',
          label: 'Twitter/X video',
          caption: `🐦 *Twitter/X Video*\n\n🔗 ${url}${WATERMARK}`
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('Twitter download', err, { jid }) });
      }
    }
  },

  // ── Spotify (metadata + YouTube audio) ──────────────────────────────────
  spotify: {
    category: 'downloader', commandTimeoutMs: 180000, desc: 'Download Spotify track audio via YouTube',
    usage: '.spotify <url or song name>', aliases: ['sp', 'spot'], permissions: 'all',
    examples: ['.spotify https://open.spotify.com/track/xxxx', '.spotify Davido FEM'],
    exec: async (args, sock, jid) => {
      const input = args.join(' ').trim();
      if (!input) return sock.sendMessage(jid, { text: `🎧 *Spotify Downloader*\n\nUsage: *.spotify <track url or song name>*${WATERMARK}` });
      await sock.sendMessage(jid, { text: `🎧 *Searching for track...*\n\n_"${input}"_` });
      try {
        // Extract song title from Spotify URL or use raw query
        let query = input;
        if (input.includes('spotify.com/track/')) {
          const id      = input.match(/track\/([A-Za-z0-9]+)/)?.[1];
          if (!id) throw new Error('Invalid Spotify track URL');
          // Resolve title via oEmbed
          const { data } = await axios.get(`https://open.spotify.com/oembed?url=${encodeURIComponent(input)}`, { timeout: 10000 });
          query = data.title || id;
        }
        // Search YouTube
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' audio')}`;
        const { data: html } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
        const match = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
        if (!match) throw new Error('No matching song found on YouTube');
        const videoUrl = `https://www.youtube.com/watch?v=${match[1]}`;
        await sendApifyDownload(sock, jid, videoUrl, {
          preferredType: 'audio',
          label: query,
          caption: `🎧 *${query}*\n\n_Downloaded through Apify._${WATERMARK}`
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('Spotify download', err, { jid }) });
      }
    }
  },

  // ── MediaFire ────────────────────────────────────────────────────────────
  mediafire: {
    category: 'downloader', commandTimeoutMs: 180000, desc: 'Download file from MediaFire',
    usage: '.mediafire <url>', aliases: ['mf'], permissions: 'all',
    examples: ['.mediafire https://www.mediafire.com/file/xxx'],
    exec: async (args, sock, jid) => {
      const url = args[0];
      if (!url || !url.includes('mediafire.com')) {
        return sock.sendMessage(jid, { text: `📁 *MediaFire Downloader*\n\nUsage: *.mediafire <url>*${WATERMARK}` });
      }
      await sock.sendMessage(jid, { text: `📁 Extracting MediaFire download link...` });
      try {
        await sendApifyDownload(sock, jid, url, {
          label: 'MediaFire file',
          caption: `📁 *MediaFire Download*\n\n🔗 ${url}${WATERMARK}`
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('MediaFire download', err, { jid }) });
      }
    }
  },

  // ── Pinterest Image ───────────────────────────────────────────────────────
  pinterest: {
    category: 'downloader', commandTimeoutMs: 180000, desc: 'Download Pinterest image',
    usage: '.pinterest <url>', aliases: ['pin', 'pinimg'], permissions: 'all',
    examples: ['.pinterest https://pin.it/xxxxx'],
    exec: async (args, sock, jid) => {
      const url = args[0];
      if (!url || (!url.includes('pinterest') && !url.includes('pin.it'))) {
        return sock.sendMessage(jid, { text: `📌 *Pinterest Downloader*\n\nUsage: *.pinterest <url>*${WATERMARK}` });
      }
      await sock.sendMessage(jid, { text: `📌 *Downloading from Pinterest...*` });
      try {
        await sendApifyDownload(sock, jid, url, {
          label: 'Pinterest media',
          caption: `📌 *Pinterest Download*\n\n🔗 ${url}${WATERMARK}`
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('Pinterest download', err, { jid }) });
      }
    }
  }
};

module.exports = downloadCommands;
