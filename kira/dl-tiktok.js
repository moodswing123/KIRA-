const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "tiktok",
    alias: ["ttdl", "tt", "tiktokdl"],
    desc: "Download TikTok video without watermark",
    category: "downloader",
    react: "📤",
    filename: __filename
},
async (conn, mek, m, { from, args, q, reply }) => {
    try {
        if (!q) return reply("Please provide a TikTok video link.");
        if (!q.includes("tiktok.com")) return reply("Invalid TikTok link.");

        reply("Downloading video, please wait...");

        const apiUrl = `https://delirius-apiofc.vercel.app/download/tiktok?url=${q}`;
        const { data } = await axios.get(apiUrl);

        if (!data.status || !data.data) return reply("Failed to fetch TikTok video.");

        const { title, like, comment, share, author, meta } = data.data;
        const videoUrl = meta.media.find(v => v.type === "video").org;

        const caption = `🎡 *ᴄʀᴀᴢʏ ᴛɪᴛᴏᴋ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ* 🎡\n\n` +
                        `👤 *ᴜsᴇʀ:* ${author.nickname} (@${author.username})\n` +
                        `📖 *ᴛɪᴛʟᴇ:* ${title}\n` +
                        `👍 *ʟɪᴋᴇs:* ${like}\n💬 *ᴄᴏᴍᴍᴇɴᴛs:* ${comment}\n🔁 *sʜᴀʀᴇ:* ${share}`;

        await conn.sendMessage(from, {
            video: { url: videoUrl },
            caption: caption,
            contextInfo: { mentionedJid: [m.sender] }
        }, { quoted: mek });

    } catch (e) {
        console.error("Error in TikTok downloader command:", e);
        reply(`An error occurred: ${e.message}`);
    }
});
