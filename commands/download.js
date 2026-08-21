'use strict';
// commands/download.js — Download commands for Kira MD
// All downloads append "Powered by Victory Tech™" watermark
const { exec } = require('child_process');
const { promisify } = require('util');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const axios = require('axios');
const { commandErrorMessage } = require('../lib/helpers');
const zstlab = require('../lib/zstlab');

const execAsync     = promisify(exec);
const { execFile }  = require('child_process');
const execFileAsync = promisify(execFile);

const WATERMARK = '\n\n_Powered by Victory Tech™_';

function tmpFile(ext) {
  return path.join(os.tmpdir(), `kiramd_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
}

function assertYouTubeUrl(url) {
  if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/[\w\-?=&#%.+/]+$/.test(url)) {
    throw new Error('Invalid YouTube URL');
  }
}

// ── cobalt.tools — multi-platform downloader ─────────────────────────────
async function cobaltFetch(url, downloadMode = 'auto', audioFormat = 'mp3') {
  const { data } = await axios.post(
    'https://api.cobalt.tools/',
    { url, downloadMode, audioFormat, filenameStyle: 'basic', quality: '720' },
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'User-Agent':   'Kira-MD/1.0'
      },
      timeout: 30000
    }
  );
  if (data.status === 'error') throw new Error(data.error?.code || 'cobalt error');
  if (data.status === 'picker') {
    const item   = Array.isArray(data.picker) ? data.picker[0] : null;
    const picked = item?.url || item?.thumb || null;
    if (!picked) throw new Error('cobalt returned an empty picker list');
    return picked;
  }
  const resolved = typeof data.url === 'string' ? data.url
                 : Array.isArray(data.url)       ? data.url[0]
                 : null;
  if (!resolved) throw new Error('cobalt returned no usable URL');
  return resolved;
}

// ── yt-dlp helper ─────────────────────────────────────────────────────────
async function ytDlpAvailable() {
  try { await execFileAsync('yt-dlp', ['--version']); return true; } catch { return false; }
}

async function ytDlpDownload(url, format = 'audio', quality = '720') {
  assertYouTubeUrl(url);
  const outTemplate = tmpFile('');
  const clientArgs  = ['--extractor-args', 'youtube:player_client=android,web'];
  const args = format === 'audio'
    ? ['-x', '--audio-format', 'mp3', '--audio-quality', '5',
       '-o', outTemplate + '.%(ext)s', url,
       '--no-playlist', '--max-filesize', '90m', ...clientArgs]
    : ['-f', `best[height<=${quality}][ext=mp4]/best[height<=${quality}]/best[ext=mp4]/best`,
       '-o', outTemplate + '.%(ext)s', url,
       '--no-playlist', '--max-filesize', '90m', ...clientArgs];
  await execFileAsync('yt-dlp', args, { timeout: 180000 });
  const dir   = path.dirname(outTemplate);
  const base  = path.basename(outTemplate);
  const found = fs.readdirSync(dir).find(f => f.startsWith(base) && f !== base);
  if (!found) throw new Error('yt-dlp produced no output file');
  return path.join(dir, found);
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

// ── MediaFire ─────────────────────────────────────────────────────────────
async function mediaFireDl(url) {
  const { data: html } = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000
  });
  const match = html.match(/href="(https?:\/\/download\d*\.mediafire\.com\/[^"]+)"/);
  if (!match) throw new Error('Could not extract MediaFire download link');
  return match[1];
}

async function zstSocialUrl(url) {
  return zstlab.firstUrl(await zstlab.get('/api/v1/media/social', { url }));
}

async function zstYoutubeSearchUrl(query) {
  const result = await zstlab.get('/api/v1/youtube/search-download', { q: query, limit: '5' });
  const first = Array.isArray(result.videos) ? result.videos[0] : null;
  if (!first?.downloadEndpoint) throw new Error('ZSTLAB returned no YouTube result');
  const endpoint = new URL(first.downloadEndpoint, zstlab.BASE_URL);
  const resolved = await zstlab.get(endpoint.pathname, Object.fromEntries(endpoint.searchParams));
  return zstlab.firstUrl(resolved);
}

const downloadCommands = {
  // ── YouTube Video ────────────────────────────────────────────────────────
  ytdl: {
    category: 'downloader', desc: 'Download YouTube video',
    usage: '.ytdl <url> [quality]', aliases: ['yt', 'youtube', 'ytv'], permissions: 'all',
    examples: ['.ytdl https://youtu.be/xxxxx', '.ytdl https://youtu.be/xxxxx 360'],
    exec: async (args, sock, jid) => {
      const url     = args[0];
      const quality = args[1] || '720';
      if (!url || !url.match(/youtube\.com|youtu\.be/)) {
        return sock.sendMessage(jid, { text: `📹 *YouTube Downloader*\n\nUsage: *.ytdl <url>*\nExample: *.ytdl https://youtu.be/xxxxx*${WATERMARK}` });
      }
      await sock.sendMessage(jid, { text: `📹 *Downloading YouTube video...*\n\n🔗 ${url}\n⏳ Please wait...` });
      let tempFile = null;
      try {
        if (zstlab.isConfigured()) {
          try {
            const result = await zstlab.get('/api/v1/youtube/download', { url, quality });
            const downloadUrl = zstlab.firstUrl(result);
            if (!downloadUrl) throw new Error('ZSTLAB returned no YouTube download URL');
            await sock.sendMessage(jid, { text: `📹 *YouTube Download Ready*\n\n🔗 ${downloadUrl}${WATERMARK}` });
            return;
          } catch (zstErr) {
            console.warn('[ZSTLAB] YouTube download failed; using local/public fallback:', zstErr.message);
          }
        }
        if (await ytDlpAvailable()) {
          tempFile = await ytDlpDownload(url, 'video', quality);
          const buf  = fs.readFileSync(tempFile);
          await sock.sendMessage(jid, {
            video:   buf,
            caption: `📹 *YouTube Video*\n\n🔗 ${url}${WATERMARK}`,
            mimetype: 'video/mp4'
          });
        } else {
          const dlUrl = await cobaltFetch(url, 'auto');
          await sock.sendMessage(jid, {
            text:
              `📹 *YouTube Download Ready*\n\n` +
              `🔗 *Direct Link:*\n${dlUrl}\n\n` +
              `_Click to download — link expires soon._${WATERMARK}`
          });
        }
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('YouTube download', err, { jid }) });
      } finally {
        if (tempFile) try { fs.unlinkSync(tempFile); } catch {}
      }
    }
  },

  // ── YouTube Audio (MP3) ──────────────────────────────────────────────────
  ytmp3: {
    category: 'downloader', desc: 'Download YouTube video as MP3 audio',
    usage: '.ytmp3 <url>', aliases: ['ymp3', 'ytaudio', 'ytsong'], permissions: 'all',
    examples: ['.ytmp3 https://youtu.be/xxxxx'],
    exec: async (args, sock, jid) => {
      const url = args[0];
      if (!url || !url.match(/youtube\.com|youtu\.be/)) {
        return sock.sendMessage(jid, { text: `🎵 *YouTube MP3*\n\nUsage: *.ytmp3 <url>*${WATERMARK}` });
      }
      await sock.sendMessage(jid, { text: `🎵 *Extracting audio...*\n\n🔗 ${url}\n⏳ Please wait...` });
      let tempFile = null;
      try {
        if (await ytDlpAvailable()) {
          tempFile = await ytDlpDownload(url, 'audio');
          const buf  = fs.readFileSync(tempFile);
          await sock.sendMessage(jid, {
            audio:    buf,
            mimetype: 'audio/mpeg',
            caption:  `🎵 *YouTube Audio*\n\n🔗 ${url}${WATERMARK}`
          });
        } else {
          const dlUrl = await cobaltFetch(url, 'audio', 'mp3');
          await sock.sendMessage(jid, {
            text:
              `🎵 *YouTube MP3 Ready*\n\n` +
              `🔗 *Download Link:*\n${dlUrl}\n\n` +
              `_Click to download MP3._${WATERMARK}`
          });
        }
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('YouTube MP3 download', err, { jid }) });
      } finally {
        if (tempFile) try { fs.unlinkSync(tempFile); } catch {}
      }
    }
  },

  // ── YouTube Search + Play ────────────────────────────────────────────────
  play: {
    category: 'downloader', desc: 'Search YouTube and download the top result as audio',
    usage: '.play <song name>', aliases: ['song', 'music'], permissions: 'all',
    examples: ['.play Wizkid Essence', '.play Burna Boy Last Last'],
    exec: async (args, sock, jid) => {
      const query = args.join(' ').trim();
      if (!query) return sock.sendMessage(jid, { text: `🎵 *Play*\n\nUsage: *.play <song name>*${WATERMARK}` });
      await sock.sendMessage(jid, { text: `🔍 *Searching:* _"${query}"_...` });
      let tempFile = null;
      try {
        if (zstlab.isConfigured()) {
          try {
            const downloadUrl = await zstYoutubeSearchUrl(query);
            if (!downloadUrl) throw new Error('ZSTLAB returned no playable URL');
            await sock.sendMessage(jid, { text: `🎵 *${query}*\n\n🔗 ${downloadUrl}${WATERMARK}` });
            return;
          } catch (zstErr) {
            console.warn('[ZSTLAB] YouTube search failed; using local/public fallback:', zstErr.message);
          }
        }
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
        if (await ytDlpAvailable()) {
          tempFile = await ytDlpDownload(videoUrl, 'audio');
          const buf = fs.readFileSync(tempFile);
          await sock.sendMessage(jid, {
            audio:    buf,
            mimetype: 'audio/mpeg',
            caption:  `🎵 *${query}*\n\n🔗 ${videoUrl}${WATERMARK}`
          });
        } else {
          const dlUrl = await cobaltFetch(videoUrl, 'audio', 'mp3');
          await sock.sendMessage(jid, { text: `🎵 *${query}*\n\n🔗 ${dlUrl}${WATERMARK}` });
        }
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('play download', err, { jid }) });
      } finally {
        if (tempFile) try { fs.unlinkSync(tempFile); } catch {}
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
    category: 'downloader', desc: 'Download Instagram post, reel or story',
    usage: '.igdl <url>', aliases: ['ig', 'instagram', 'insta'], permissions: 'all',
    examples: ['.igdl https://www.instagram.com/p/xxxxx/', '.igdl https://www.instagram.com/reel/xxxxx/'],
    exec: async (args, sock, jid) => {
      const url = args[0];
      if (!url || !url.includes('instagram.com')) {
        return sock.sendMessage(jid, { text: `📸 *Instagram Downloader*\n\nUsage: *.igdl <url>*${WATERMARK}` });
      }
      await sock.sendMessage(jid, { text: `📸 *Downloading from Instagram...*\n\n⏳ Please wait...` });
      try {
        let dlUrl;
        if (zstlab.isConfigured()) {
          try { dlUrl = await zstSocialUrl(url); }
          catch (zstErr) { console.warn('[ZSTLAB] Social download failed; using Cobalt fallback:', zstErr.message); }
        }
        if (!dlUrl) dlUrl = await cobaltFetch(url, 'auto');
        const resp  = await axios.get(dlUrl, { responseType: 'arraybuffer', timeout: 60000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const ct    = resp.headers['content-type'] || '';
        const buf   = Buffer.from(resp.data);
        if (ct.startsWith('video/') || ct.includes('mp4')) {
          await sock.sendMessage(jid, {
            video: buf, caption: `📸 *Instagram Video*\n\n🔗 ${url}${WATERMARK}`, mimetype: 'video/mp4'
          });
        } else {
          await sock.sendMessage(jid, {
            image: buf, caption: `📸 *Instagram Photo*\n\n🔗 ${url}${WATERMARK}`
          });
        }
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('Instagram download', err, { jid }) });
      }
    }
  },

  // ── Facebook ─────────────────────────────────────────────────────────────
  fbdl: {
    category: 'downloader', desc: 'Download Facebook video',
    usage: '.fbdl <url>', aliases: ['fb', 'facebook'], permissions: 'all',
    examples: ['.fbdl https://www.facebook.com/watch?v=123456'],
    exec: async (args, sock, jid) => {
      const url = args[0];
      if (!url || !url.includes('facebook.com') && !url.includes('fb.watch')) {
        return sock.sendMessage(jid, { text: `📘 *Facebook Downloader*\n\nUsage: *.fbdl <url>*${WATERMARK}` });
      }
      await sock.sendMessage(jid, { text: `📘 *Downloading Facebook video...*\n\n⏳ Please wait...` });
      try {
        let dlUrl;
        if (zstlab.isConfigured()) {
          try { dlUrl = await zstSocialUrl(url); }
          catch (zstErr) { console.warn('[ZSTLAB] Social download failed; using Cobalt fallback:', zstErr.message); }
        }
        if (!dlUrl) dlUrl = await cobaltFetch(url, 'auto');
        const resp  = await axios.get(dlUrl, { responseType: 'arraybuffer', timeout: 60000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const buf   = Buffer.from(resp.data);
        await sock.sendMessage(jid, {
          video: buf, caption: `📘 *Facebook Video*\n\n🔗 ${url}${WATERMARK}`, mimetype: 'video/mp4'
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('Facebook download', err, { jid }) });
      }
    }
  },

  // ── Twitter / X ───────────────────────────────────────────────────────────
  twitter: {
    category: 'downloader', desc: 'Download Twitter/X video or GIF',
    usage: '.twitter <url>', aliases: ['twit', 'xdl', 'tweet'], permissions: 'all',
    examples: ['.twitter https://twitter.com/user/status/123456789'],
    exec: async (args, sock, jid) => {
      const url = args[0];
      if (!url || (!url.includes('twitter.com') && !url.includes('x.com') && !url.includes('t.co'))) {
        return sock.sendMessage(jid, { text: `🐦 *Twitter Downloader*\n\nUsage: *.twitter <url>*${WATERMARK}` });
      }
      await sock.sendMessage(jid, { text: `🐦 *Downloading from Twitter/X...*` });
      try {
        let dlUrl;
        if (zstlab.isConfigured()) {
          try { dlUrl = await zstSocialUrl(url); }
          catch (zstErr) { console.warn('[ZSTLAB] Social download failed; using Cobalt fallback:', zstErr.message); }
        }
        if (!dlUrl) dlUrl = await cobaltFetch(url, 'auto');
        const resp  = await axios.get(dlUrl, { responseType: 'arraybuffer', timeout: 60000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const buf   = Buffer.from(resp.data);
        await sock.sendMessage(jid, {
          video: buf, caption: `🐦 *Twitter/X Video*\n\n🔗 ${url}${WATERMARK}`, mimetype: 'video/mp4'
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('Twitter download', err, { jid }) });
      }
    }
  },

  // ── Spotify (metadata + YouTube audio) ──────────────────────────────────
  spotify: {
    category: 'downloader', desc: 'Download Spotify track audio via YouTube',
    usage: '.spotify <url or song name>', aliases: ['sp', 'spot'], permissions: 'all',
    examples: ['.spotify https://open.spotify.com/track/xxxx', '.spotify Davido FEM'],
    exec: async (args, sock, jid) => {
      const input = args.join(' ').trim();
      if (!input) return sock.sendMessage(jid, { text: `🎧 *Spotify Downloader*\n\nUsage: *.spotify <track url or song name>*${WATERMARK}` });
      await sock.sendMessage(jid, { text: `🎧 *Searching for track...*\n\n_"${input}"_` });
      let tempFile = null;
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
        if (zstlab.isConfigured() && input.includes('spotify.com/track/')) {
          try {
            const result = await zstlab.get('/api/v1/download/spotify', { url: input });
            const downloadUrl = zstlab.firstUrl(result);
            if (!downloadUrl) throw new Error('ZSTLAB returned no Spotify download URL');
            await sock.sendMessage(jid, { text: `🎧 *${query}*\n\n🔗 ${downloadUrl}${WATERMARK}` });
            return;
          } catch (zstErr) {
            console.warn('[ZSTLAB] Spotify download failed; using YouTube fallback:', zstErr.message);
          }
        }
        // Search YouTube
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' audio')}`;
        const { data: html } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
        const match = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
        if (!match) throw new Error('No matching song found on YouTube');
        const videoUrl = `https://www.youtube.com/watch?v=${match[1]}`;
        if (await ytDlpAvailable()) {
          tempFile = await ytDlpDownload(videoUrl, 'audio');
          const buf = fs.readFileSync(tempFile);
          await sock.sendMessage(jid, {
            audio:    buf,
            mimetype: 'audio/mpeg',
            caption:  `🎧 *${query}*\n\n_Downloaded via YouTube._${WATERMARK}`
          });
        } else {
          const dlUrl = await cobaltFetch(videoUrl, 'audio', 'mp3');
          await sock.sendMessage(jid, { text: `🎧 *${query}*\n\n🔗 ${dlUrl}${WATERMARK}` });
        }
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('Spotify download', err, { jid }) });
      } finally {
        if (tempFile) try { fs.unlinkSync(tempFile); } catch {}
      }
    }
  },

  // ── MediaFire ────────────────────────────────────────────────────────────
  mediafire: {
    category: 'downloader', desc: 'Download file from MediaFire',
    usage: '.mediafire <url>', aliases: ['mf'], permissions: 'all',
    examples: ['.mediafire https://www.mediafire.com/file/xxx'],
    exec: async (args, sock, jid) => {
      const url = args[0];
      if (!url || !url.includes('mediafire.com')) {
        return sock.sendMessage(jid, { text: `📁 *MediaFire Downloader*\n\nUsage: *.mediafire <url>*${WATERMARK}` });
      }
      await sock.sendMessage(jid, { text: `📁 Extracting MediaFire download link...` });
      try {
        let dlUrl;
        if (zstlab.isConfigured()) {
          try { dlUrl = zstlab.firstUrl(await zstlab.get('/api/v1/download/mediafire', { url })); }
          catch (zstErr) { console.warn('[ZSTLAB] MediaFire download failed; using page extraction fallback:', zstErr.message); }
        }
        if (!dlUrl) dlUrl = await mediaFireDl(url);
        const filename = decodeURIComponent(dlUrl.split('/').pop().split('?')[0]);
        await sock.sendMessage(jid, {
          text:
            `📁 *MediaFire Download Ready*\n\n` +
            `📎 *File:* ${filename}\n\n` +
            `🔗 *Direct Link:*\n${dlUrl}\n\n` +
            `_Click the link to download directly._${WATERMARK}`
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('MediaFire download', err, { jid }) });
      }
    }
  },

  // ── Pinterest Image ───────────────────────────────────────────────────────
  pinterest: {
    category: 'downloader', desc: 'Download Pinterest image',
    usage: '.pinterest <url>', aliases: ['pin', 'pinimg'], permissions: 'all',
    examples: ['.pinterest https://pin.it/xxxxx'],
    exec: async (args, sock, jid) => {
      const url = args[0];
      if (!url || (!url.includes('pinterest') && !url.includes('pin.it'))) {
        return sock.sendMessage(jid, { text: `📌 *Pinterest Downloader*\n\nUsage: *.pinterest <url>*${WATERMARK}` });
      }
      await sock.sendMessage(jid, { text: `📌 *Downloading from Pinterest...*` });
      try {
        let dlUrl;
        if (zstlab.isConfigured()) {
          try { dlUrl = await zstSocialUrl(url); }
          catch (zstErr) { console.warn('[ZSTLAB] Social download failed; using Cobalt fallback:', zstErr.message); }
        }
        if (!dlUrl) dlUrl = await cobaltFetch(url, 'auto');
        const resp  = await axios.get(dlUrl, { responseType: 'arraybuffer', timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const buf   = Buffer.from(resp.data);
        const ct    = resp.headers['content-type'] || '';
        if (ct.startsWith('video/')) {
          await sock.sendMessage(jid, { video: buf, caption: `📌 *Pinterest Video*${WATERMARK}`, mimetype: 'video/mp4' });
        } else {
          await sock.sendMessage(jid, { image: buf, caption: `📌 *Pinterest Image*${WATERMARK}` });
        }
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('Pinterest download', err, { jid }) });
      }
    }
  }
};

module.exports = downloadCommands;
