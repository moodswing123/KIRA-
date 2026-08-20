'use strict';
// commands/converter.js — Media conversion commands for Kira MD
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const axios = require('axios');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { spawn } = require('child_process');
const { getMessageContext, commandErrorMessage } = require('../lib/helpers');

function tmpFile(ext) {
  return path.join(os.tmpdir(), `kiramd_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
}

function getCtx(message) {
  return getMessageContext(message);
}

async function dlQuoted(sock, jid, message, quotedMsg) {
  const ctx = getCtx(message);
  const fake = {
    key: {
      remoteJid: ctx?.remoteJid || jid,
      id: ctx?.stanzaId || message.key.id,
      participant: ctx?.participant || message.key.participant,
      fromMe: false
    },
    message: quotedMsg
  };
  return downloadMediaMessage(fake, 'buffer', { reuploadRequest: sock.updateMediaMessage });
}

function ffmpegRun(inputPath, outputPath, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-y', '-i', inputPath, ...extraArgs, outputPath]);
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${stderr.slice(-400)}`)));
    proc.on('error', () => reject(new Error('ffmpeg is not installed.\nAsk your host to run: sudo apt install ffmpeg')));
  });
}

const converterCommands = {
  toimg: {
    category: 'converter', desc: 'Convert a sticker to an image (reply to sticker)',
    usage: '.toimg', aliases: [], permissions: 'all',
    examples: ['.toimg (reply to a sticker)'],
    exec: async (args, sock, jid, isGroup, sender, message) => {
      const ctx    = getCtx(message);
      const quoted = ctx?.quotedMessage;
      if (!quoted?.stickerMessage) {
        return sock.sendMessage(jid, { text: `🖼️ *Sticker → Image*\n\nReply to a *sticker* with *.toimg* to convert it.` });
      }
      await sock.sendMessage(jid, { text: `🖼️ Converting sticker to image...` });
      try {
        const buf = await dlQuoted(sock, jid, message, quoted);
        await sock.sendMessage(jid, { image: buf, caption: `🖼️ *Here's your image!*`, mimetype: 'image/webp' });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('conversion', err, { jid }) });
      }
    }
  },

  tomp3: {
    category: 'converter', desc: 'Convert video/voice to MP3 audio (reply to media)',
    usage: '.tomp3', aliases: ['toaudio', 'extractaudio'], permissions: 'all',
    examples: ['.tomp3 (reply to a video or audio)'],
    exec: async (args, sock, jid, isGroup, sender, message) => {
      const ctx    = getCtx(message);
      const quoted = ctx?.quotedMessage;
      const mediaMsg = quoted?.videoMessage || quoted?.audioMessage;
      if (!mediaMsg) {
        return sock.sendMessage(jid, { text: `🎵 *Video → MP3*\n\nReply to a *video or audio* with *.tomp3*` });
      }
      await sock.sendMessage(jid, { text: `🎵 Converting to MP3...` });
      const inFile  = tmpFile('.tmp');
      const outFile = tmpFile('.mp3');
      try {
        const buf = await dlQuoted(sock, jid, message, quoted);
        fs.writeFileSync(inFile, buf);
        await ffmpegRun(inFile, outFile, ['-vn', '-acodec', 'libmp3lame', '-q:a', '2']);
        const mp3 = fs.readFileSync(outFile);
        await sock.sendMessage(jid, { audio: mp3, mimetype: 'audio/mpeg' });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('conversion', err, { jid }) });
      } finally {
        for (const f of [inFile, outFile]) try { fs.unlinkSync(f); } catch {}
      }
    }
  },

  tomp4: {
    category: 'converter', desc: 'Convert a sticker/GIF to MP4 video',
    usage: '.tomp4', aliases: ['togif', 'tov'], permissions: 'all',
    examples: ['.tomp4 (reply to sticker or GIF)'],
    exec: async (args, sock, jid, isGroup, sender, message) => {
      const ctx    = getCtx(message);
      const quoted = ctx?.quotedMessage;
      const mediaMsg = quoted?.stickerMessage || quoted?.videoMessage || quoted?.imageMessage;
      if (!mediaMsg) return sock.sendMessage(jid, { text: `🎬 Reply to a sticker or image with *.tomp4*` });
      await sock.sendMessage(jid, { text: `🎬 Converting to MP4...` });
      const inFile  = tmpFile('.webp');
      const outFile = tmpFile('.mp4');
      try {
        const buf = await dlQuoted(sock, jid, message, quoted);
        fs.writeFileSync(inFile, buf);
        await ffmpegRun(inFile, outFile, ['-vcodec', 'libx264', '-acodec', 'aac']);
        const mp4 = fs.readFileSync(outFile);
        await sock.sendMessage(jid, { video: mp4, mimetype: 'video/mp4' });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('conversion', err, { jid }) });
      } finally {
        for (const f of [inFile, outFile]) try { fs.unlinkSync(f); } catch {}
      }
    }
  },

  sticker: {
    category: 'sticker', desc: 'Convert image/video to sticker (reply to media)',
    usage: '.sticker [pack name]', aliases: ['s', 'stiker', 'stik'], permissions: 'all',
    examples: ['.sticker', '.sticker Kira Pack'],
    exec: async (args, sock, jid, isGroup, sender, message) => {
      const ctx    = getCtx(message);
      const quoted = ctx?.quotedMessage;
      const mediaMsg = quoted?.imageMessage || quoted?.videoMessage || quoted?.stickerMessage;
      const directImg = message.message?.imageMessage;
      const targetMsg = mediaMsg || directImg;

      if (!targetMsg) {
        return sock.sendMessage(jid, { text: `🎭 *Make Sticker*\n\nReply to an *image or video* with *.sticker* to convert it.` });
      }
      await sock.sendMessage(jid, { text: `🎭 Creating sticker...` });
      const inFile  = tmpFile('.tmp');
      const outFile = tmpFile('.webp');
      try {
        let buf;
        if (mediaMsg) {
          buf = await dlQuoted(sock, jid, message, quoted);
        } else {
          buf = await downloadMediaMessage(message, 'buffer', { reuploadRequest: sock.updateMediaMessage });
        }
        fs.writeFileSync(inFile, buf);
        await ffmpegRun(inFile, outFile, [
          '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
          '-loop', '0', '-ss', '00:00:00.0', '-t', '5',
          '-vsync', '0', '-b:v', '500k'
        ]);
        const webp = fs.readFileSync(outFile);
        await sock.sendMessage(jid, { sticker: webp });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('sticker conversion', err, { jid }) });
      } finally {
        for (const f of [inFile, outFile]) try { fs.unlinkSync(f); } catch {}
      }
    }
  },

  tts: {
    category: 'converter', desc: 'Text-to-speech (converts text to voice)',
    usage: '.tts [lang] <text>', aliases: ['speak', 'voice', 'say'], permissions: 'all',
    examples: ['.tts Hello, my name is Kira!', '.tts es Hola mundo'],
    exec: async (args, sock, jid) => {
      if (!args.length) return sock.sendMessage(jid, { text: '❌ Usage: .tts [language] <text>' });

      const LANGS = ['af','ar','bg','ca','cs','cy','da','de','el','en','eo','es','et','fi','fr','hi','hr','hu','hy','id','is','it','ja','ko','lt','lv','mk','ml','mr','ms','nl','no','pl','pt','ro','ru','sk','sl','sq','sr','sv','sw','ta','te','th','tr','uk','ur','vi','zh-CN','zh-TW'];
      let lang = 'en';
      let textArgs = args;
      if (args[0] && LANGS.includes(args[0].toLowerCase())) {
        lang     = args[0].toLowerCase();
        textArgs = args.slice(1);
      }
      const text = textArgs.join(' ').trim();
      if (!text) return sock.sendMessage(jid, { text: '❌ Please provide text to speak.' });

      await sock.sendMessage(jid, { text: `🔊 Converting to speech...` });

      const encodedText = encodeURIComponent(text.slice(0, 200));
      const services    = [
        `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodedText}`,
        `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=gtx&q=${encodedText}`
      ];

      let audioBuf = null;
      for (const url of services) {
        try {
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
              'Referer':    'https://translate.google.com/'
            },
            signal: AbortSignal.timeout(15000)
          });
          if (!res.ok) continue;
          const ct  = res.headers.get('content-type') || '';
          if (!ct.includes('audio') && !ct.includes('mpeg') && !ct.includes('ogg') && !ct.includes('octet-stream')) continue;
          const buf = Buffer.from(await res.arrayBuffer());
          const isAudio = buf.length > 1000 && (
            (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) ||
            (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0)
          );
          if (isAudio) { audioBuf = buf; break; }
        } catch (_) {}
      }

      if (!audioBuf) return sock.sendMessage(jid, { text: `❌ TTS failed. Please try again.` });
      await sock.sendMessage(jid, { audio: audioBuf, mimetype: 'audio/mpeg', ptt: true });
    }
  }
};

module.exports = converterCommands;
