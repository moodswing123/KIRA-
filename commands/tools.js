'use strict';
// commands/tools.js — Sticker & image tools for Kira MD
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const axios = require('axios');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { spawn } = require('child_process');
const { getMessageContext, commandErrorMessage, getMessageType } = require('../lib/helpers');
const db = require('../lib/database');

const WATERMARK = '\n\n_Powered by Victory Tech™_';

function tmpFile(ext) {
  return path.join(os.tmpdir(), `kiramd_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
}

function getCtx(message) {
  return getMessageContext(message);
}

async function dlQuoted(sock, jid, message, quotedMsg) {
  const ctx = getCtx(message);
  const key = ctx?.quotedKey || {
    remoteJid: ctx?.remoteJid || jid,
    id: ctx?.stanzaId || message?.key?.id || '',
    participant: ctx?.participant || message?.key?.participant,
    fromMe: false
  };
  if (!key.id) throw new Error('The quoted media message has no message ID');
  return downloadMediaMessage({ key, message: quotedMsg }, 'buffer', {
    reuploadRequest: sock.updateMediaMessage
  });
}

function ffmpegRun(inputPath, outputPath, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-y', '-i', inputPath, ...extraArgs, outputPath]);
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${stderr.slice(-300)}`)));
    proc.on('error', () => reject(new Error('ffmpeg not installed. Run: sudo apt install ffmpeg')));
  });
}

async function uploadToCatbox(buffer, filename, mimetype) {
  const fd = new FormData();
  fd.append('reqtype', 'fileupload');
  fd.append('fileToUpload', new Blob([buffer], { type: mimetype }), filename);
  const res = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST', body: fd, signal: AbortSignal.timeout(60000)
  });
  const text = (await res.text()).trim();
  if (!res.ok || !/^https?:\/\//i.test(text)) throw new Error(`Catbox upload failed: ${text.slice(0, 160)}`);
  return text;
}

async function uploadToPublicUrl(buffer, filename, mimetype) {
  try {
    return await uploadToCatbox(buffer, filename, mimetype);
  } catch (catboxErr) {
    const fd = new FormData();
    fd.append('file', new Blob([buffer], { type: mimetype }), filename);
    const res = await fetch('https://0x0.st', {
      method: 'POST', body: fd, signal: AbortSignal.timeout(60000)
    });
    const text = (await res.text()).trim();
    if (!res.ok || !/^https?:\/\//i.test(text)) {
      throw new Error(`Public upload failed. Catbox: ${catboxErr.message}; fallback: ${text.slice(0, 120)}`);
    }
    return text;
  }
}

// Vyro AI image operations
function vyroAiRequest(imageBuffer, operation) {
  return new Promise((resolve, reject) => {
    const boundary = `----FormBoundary${Date.now().toString(16)}`;
    const mvPart = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="model_version"\r\n\r\n1\r\n`
    );
    const imgHeader = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="image.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`
    );
    const closing   = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body      = Buffer.concat([mvPart, imgHeader, imageBuffer, closing]);

    const https = require('https');
    const options = {
      hostname: 'inferenceengine.vyro.ai',
      path:     `/${operation}`,
      method:   'POST',
      headers:  { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length, 'User-Agent': 'okhttp/4.9.3' }
    };

    const req = https.request(options, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`Vyro API returned ${res.statusCode}`));
        resolve(Buffer.concat(chunks));
      });
    });
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Vyro API timed out')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const toolCommands = {
  enhance: {
    category: 'sticker', desc: 'Enhance image quality using AI (reply to image)',
    usage: '.enhance', aliases: ['hd', 'sharpen'], permissions: 'all',
    examples: ['.enhance (reply to an image)'],
    exec: async (args, sock, jid, isGroup, sender, message) => {
      const ctx    = getCtx(message);
      const quoted = ctx?.quotedMessage;
      const imgMsg = quoted?.imageMessage || message.message?.imageMessage;

      if (!imgMsg) {
        return sock.sendMessage(jid, { text: `✨ *Enhance Image*\n\nReply to an *image* with *.enhance* to improve its quality.` });
      }

      await sock.sendMessage(jid, { text: `✨ *Enhancing image quality...*\n\n⏳ Please wait...` });

      try {
        let buf;
        if (quoted?.imageMessage) {
          buf = await dlQuoted(sock, jid, message, quoted);
        } else {
          buf = await downloadMediaMessage(message, 'buffer', { reuploadRequest: sock.updateMediaMessage });
        }

        const enhanced = await vyroAiRequest(buf, 'enhance');
        await sock.sendMessage(jid, {
          image:   enhanced,
          caption: `✨ *Enhanced Image*${WATERMARK}`
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('enhancement', err, { jid }) });
      }
    }
  },

  recolor: {
    category: 'sticker', desc: 'Colorize a black & white photo using AI (reply to image)',
    usage: '.recolor', aliases: ['colorize', 'colourize'], permissions: 'all',
    examples: ['.recolor (reply to a black & white image)'],
    exec: async (args, sock, jid, isGroup, sender, message) => {
      const ctx    = getCtx(message);
      const quoted = ctx?.quotedMessage;
      const imgMsg = quoted?.imageMessage || message.message?.imageMessage;

      if (!imgMsg) return sock.sendMessage(jid, { text: `🎨 Reply to a *black & white image* with *.recolor* to colorize it.` });
      await sock.sendMessage(jid, { text: `🎨 *Colorizing image...*\n\n⏳ Please wait...` });

      try {
        let buf;
        if (quoted?.imageMessage) buf = await dlQuoted(sock, jid, message, quoted);
        else buf = await downloadMediaMessage(message, 'buffer', { reuploadRequest: sock.updateMediaMessage });

        const recolored = await vyroAiRequest(buf, 'recolor');
        await sock.sendMessage(jid, {
          image:   recolored,
          caption: `🎨 *Colorized Image*${WATERMARK}`
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('recolor', err, { jid }) });
      }
    }
  },

  dehaze: {
    category: 'sticker', desc: 'Remove haze/fog from image using AI (reply to image)',
    usage: '.dehaze', aliases: ['defog', 'clearimage'], permissions: 'all',
    examples: ['.dehaze (reply to a hazy image)'],
    exec: async (args, sock, jid, isGroup, sender, message) => {
      const ctx    = getCtx(message);
      const quoted = ctx?.quotedMessage;
      const imgMsg = quoted?.imageMessage || message.message?.imageMessage;

      if (!imgMsg) return sock.sendMessage(jid, { text: `🌤️ Reply to a *hazy image* with *.dehaze* to clear it up.` });
      await sock.sendMessage(jid, { text: `🌤️ *Removing haze from image...*` });

      try {
        let buf;
        if (quoted?.imageMessage) buf = await dlQuoted(sock, jid, message, quoted);
        else buf = await downloadMediaMessage(message, 'buffer', { reuploadRequest: sock.updateMediaMessage });

        const dehazed = await vyroAiRequest(buf, 'dehaze');
        await sock.sendMessage(jid, {
          image:   dehazed,
          caption: `🌤️ *Dehazed Image*${WATERMARK}`
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('dehaze', err, { jid }) });
      }
    }
  },

  removebg: {
    category: 'sticker', desc: 'Remove background from image using AI (reply to image)',
    usage: '.removebg', aliases: ['rmbg', 'nobg', 'cutout'], permissions: 'all',
    examples: ['.removebg (reply to an image)'],
    exec: async (args, sock, jid, isGroup, sender, message) => {
      const ctx    = getCtx(message);
      const quoted = ctx?.quotedMessage;
      const imgMsg = quoted?.imageMessage || message.message?.imageMessage;

      if (!imgMsg) return sock.sendMessage(jid, { text: `✂️ Reply to an *image* with *.removebg* to remove its background.` });
      await sock.sendMessage(jid, { text: `✂️ *Removing background...*\n\n⏳ Please wait...` });

      try {
        let buf;
        if (quoted?.imageMessage) buf = await dlQuoted(sock, jid, message, quoted);
        else buf = await downloadMediaMessage(message, 'buffer', { reuploadRequest: sock.updateMediaMessage });

        // Use remove.bg free API or fallback to catbox + remove.bg web
        const catUrl = await uploadToCatbox(buf, 'image.jpg', 'image/jpeg');
        const { data: result } = await axios.post(
          'https://api.remove.bg/v1.0/removebg',
          { image_url: catUrl, size: 'auto' },
          {
            headers: { 'X-Api-Key': process.env.REMOVE_BG_API_KEY || 'DEMO' },
            responseType: 'arraybuffer', timeout: 30000
          }
        );
        await sock.sendMessage(jid, {
          image:   Buffer.from(result),
          caption: `✂️ *Background Removed*${WATERMARK}`,
          mimetype: 'image/png'
        });
      } catch (err) {
        // Fallback: try PhotoRoom API (free tier)
        try {
          let buf2;
          const ctx2    = getCtx(message);
          const quoted2 = ctx2?.quotedMessage;
          if (quoted2?.imageMessage) buf2 = await dlQuoted(sock, jid, message, quoted2);
          else buf2 = await downloadMediaMessage(message, 'buffer', { reuploadRequest: sock.updateMediaMessage });

          const formData = new FormData();
          formData.append('image_file', new Blob([buf2], { type: 'image/jpeg' }), 'image.jpg');
          const resp = await fetch('https://sdk.photoroom.com/v1/segment', {
            method: 'POST', body: formData,
            headers: { 'x-api-key': process.env.PHOTOROOM_API_KEY || '' },
            signal: AbortSignal.timeout(30000)
          });
          if (!resp.ok) throw new Error('PhotoRoom failed');
          const result = Buffer.from(await resp.arrayBuffer());
          await sock.sendMessage(jid, {
            image:   result,
            caption: `✂️ *Background Removed*${WATERMARK}`,
            mimetype: 'image/png'
          });
        } catch (fallbackErr) {
          await sock.sendMessage(jid, {
            text: commandErrorMessage('remove background', fallbackErr || err, { jid })
          });
        }
      }
    }
  },

  font: {
    category: 'utility', desc: 'Set the font style used by all bot replies',
    usage: '.font <style|list|off>', aliases: ['fancy', 'fancytext', 'fontgen'], permissions: 'all',
    examples: ['.font bold', '.font sansbold', '.font list', '.font off'],
    exec: async (args, sock, jid) => {
      const fontStyles = require('../lib/font');
      const requested = args.join('').trim().toLowerCase();
      const current = db.getSetting('botFont', 'plain');

      if (!requested || requested === 'list' || requested === 'help') {
        return sock.sendMessage(jid, {
          text:
            `🔤 *BOT REPLY FONT*\n\n` +
            `Current: *${current}*\n\n` +
            `${fontStyles.describeStyles()}\n\n` +
            `Use *.font <style>* to change all future bot replies.\n` +
            `Use *.font off* to return to normal text.`
        });
      }

      const style = fontStyles.normalizeStyle(requested);
      if (!style) {
        return sock.sendMessage(jid, {
          text: `❌ Unknown font style: *${requested}*\n\nUse *.font list* to view the available styles.`
        });
      }

      db.setSetting('botFont', style);
      await sock.sendMessage(jid, {
        text: `✅ Bot reply font changed to *${style}*.\n\nAll future text replies and captions will use this style.`
      });
    }
  },

  qr: {
    category: 'utility', desc: 'Generate a QR code from any text or URL',
    usage: '.qr <text or url>', aliases: ['qrcode', 'makeqr'], permissions: 'all',
    examples: ['.qr https://wa.me/2347038253086', '.qr Hello World'],
    exec: async (args, sock, jid) => {
      const text = args.join(' ').trim();
      if (!text) return sock.sendMessage(jid, { text: '❌ Usage: .qr <text or url>' });
      await sock.sendMessage(jid, { text: `📱 Generating QR code...` });
      try {
        const url  = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(text)}`;
        const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
        await sock.sendMessage(jid, {
          image:   Buffer.from(resp.data),
          caption: `📱 *QR Code*\n\n_"${text.slice(0, 80)}"_`
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('QR generation', err, { jid }) });
      }
    }
  },

  tourl: {
    category: 'utility', desc: 'Upload replied media and return a public URL',
    usage: '.tourl', aliases: ['upload', 'getlink'], permissions: 'all',
    examples: ['.tourl (reply to image, video, audio, or document)'],
    exec: async (args, sock, jid, isGroup, sender, message) => {
      const ctx = getCtx(message);
      const quoted = ctx?.quotedMessage;
      const mediaType = ctx?.mediaType || getMessageType(quoted);
      const media = quoted && mediaType && /^(image|video|audio|document)Message$/.test(mediaType);
      if (!media) return sock.sendMessage(jid, { text: '🔗 Reply to an image, video, audio, or document with *.tourl*.' });
      await sock.sendMessage(jid, { text: '📤 Downloading and uploading your media...' });
      try {
        const buf = await dlQuoted(sock, jid, message, quoted);
        if (!Buffer.isBuffer(buf) || !buf.length) throw new Error('WhatsApp returned an empty media file');
        const payload = quoted[mediaType] || {};
        const mimetype = payload.mimetype || ({
          imageMessage: 'image/jpeg', videoMessage: 'video/mp4',
          audioMessage: 'audio/mpeg', documentMessage: 'application/octet-stream'
        }[mediaType] || 'application/octet-stream');
        const rawName = payload.fileName || payload.file_name || '';
        const ext = rawName.includes('.') ? rawName.slice(rawName.lastIndexOf('.')) :
          ({ imageMessage: '.jpg', videoMessage: '.mp4', audioMessage: '.mp3', documentMessage: '.bin' }[mediaType] || '.bin');
        const safeName = `kira_${Date.now()}${ext.replace(/[^.a-z0-9]/gi, '')}`;
        const url = await uploadToPublicUrl(buf, safeName, mimetype);
        await sock.sendMessage(jid, {
          text: `🔗 *Upload Complete!*\n\n${url}\n\n_File type:_ ${mimetype}\n_Size:_ ${buf.length} bytes\n\n_Click the link to access your file._`
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('media upload', err, { jid }) });
      }
    }
  },

  screenshot: {
    category: 'utility', desc: 'Take a screenshot of any website',
    usage: '.screenshot <url>', aliases: ['ss', 'snap', 'webshot'], permissions: 'all',
    examples: ['.screenshot https://google.com', '.screenshot https://github.com'],
    exec: async (args, sock, jid) => {
      const url = args[0];
      if (!url || !url.match(/^https?:\/\//)) {
        return sock.sendMessage(jid, { text: '❌ Usage: .screenshot <url>\n\nExample: .screenshot https://google.com' });
      }
      await sock.sendMessage(jid, { text: `📸 Taking screenshot of ${url}...` });
      try {
        const apiUrl = `https://api.screenshotmachine.com?key=a1b2c3d4&url=${encodeURIComponent(url)}&dimension=1366x768&format=jpg`;
        const resp   = await axios.get(
          `https://api.microlink.io/screenshot?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`,
          { timeout: 20000 }
        );
        const imgUrl = resp.data?.data?.screenshot?.url;
        if (!imgUrl) throw new Error('Screenshot service unavailable');
        const imgResp = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 20000 });
        await sock.sendMessage(jid, {
          image:   Buffer.from(imgResp.data),
          caption: `📸 *Screenshot of:*\n${url}`
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage('screenshot', err, { jid }) });
      }
    }
  }
};

module.exports = toolCommands;
