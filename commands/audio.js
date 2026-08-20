'use strict';
// commands/audio.js — Audio effects via ffmpeg
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { spawn } = require('child_process');
const { getMessageContext, commandErrorMessage } = require('../lib/helpers');

function tmpFile(ext) {
  return path.join(os.tmpdir(), `kiramd_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
}

function getCtx(message) {
  return getMessageContext(message);
}

function ffmpegRun(inputPath, outputPath, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-y', '-i', inputPath, ...extraArgs, outputPath]);
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${stderr.slice(-300)}`)));
    proc.on('error', () => reject(new Error('ffmpeg not installed. Ask your host to install: sudo apt install ffmpeg')));
  });
}

function audioEffect(cmdName, label, emoji, ffmpegFilters) {
  return {
    category: 'audio', desc: `Apply ${label} effect to audio (reply to voice/audio)`,
    usage: `.${cmdName}`, aliases: [], permissions: 'all',
    examples: [`.${cmdName} (reply to audio)`],
    exec: async (args, sock, jid, isGroup, sender, message) => {
      const ctx    = getCtx(message);
      const quoted = ctx?.quotedMessage;
      const audioMsg = quoted?.audioMessage || quoted?.videoMessage;

      if (!audioMsg) {
        return sock.sendMessage(jid, { text: `${emoji} *${label}*\n\nReply to an audio or voice note with *.${cmdName}* to apply the effect.` });
      }

      await sock.sendMessage(jid, { text: `${emoji} Applying *${label}* effect...` });

      const inFile  = tmpFile('.ogg');
      const outFile = tmpFile('.mp3');

      try {
        const fakeMsg = {
          key: {
            remoteJid: ctx.remoteJid || jid,
            id: ctx.stanzaId,
            participant: ctx.participant,
            fromMe: false
          },
          message: quoted
        };
        const buffer = await downloadMediaMessage(fakeMsg, 'buffer', { reuploadRequest: sock.updateMediaMessage });
        fs.writeFileSync(inFile, buffer);

        await ffmpegRun(inFile, outFile, ['-af', ffmpegFilters.join(',')]);

        const outBuf = fs.readFileSync(outFile);
        await sock.sendMessage(jid, {
          audio:    outBuf,
          mimetype: 'audio/mpeg',
          ptt:      true
        });
      } catch (err) {
        await sock.sendMessage(jid, { text: commandErrorMessage(label, err, { jid }) });
      } finally {
        for (const f of [inFile, outFile]) try { fs.unlinkSync(f); } catch {}
      }
    }
  };
}

const audioCommands = {
  bass:     audioEffect('bass',     'Bass Boost', '🎵', ['equalizer=f=80:t=o:w=200:g=15', 'equalizer=f=140:t=o:w=200:g=10']),
  deep:     audioEffect('deep',     'Deep Voice', '🎤', ['asetrate=44100*0.75', 'aresample=44100', 'atempo=1.33']),
  fast:     audioEffect('fast',     'Speed Up',   '⏩', ['atempo=1.5']),
  slow:     audioEffect('slow',     'Slow Down',  '⏪', ['atempo=0.7']),
  reverse:  audioEffect('reverse',  'Reverse',    '🔄', ['areverse']),
  robot:    audioEffect('robot',    'Robot Voice','🤖', ['afftfilt=real=\'hypot(re,im)*sin(0)\':imag=\'hypot(re,im)*cos(0)\':win_size=512:overlap=0.75']),
  chipmunk: audioEffect('chipmunk', 'Chipmunk',   '🐿️', ['asetrate=44100*1.7', 'aresample=44100', 'atempo=0.6']),
  smooth:   audioEffect('smooth',   'Smooth',     '🎶', ['lowpass=f=2500', 'equalizer=f=1000:t=o:w=500:g=3'])
};

module.exports = audioCommands;
