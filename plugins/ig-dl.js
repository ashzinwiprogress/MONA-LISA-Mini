const axios = require("axios");
const { cmd } = require('../redx');
const { fakevCard } = require('../lib/fakevCard');

cmd({
    pattern: "igdl",
    alias: ["instagram", "insta", "ig"],
    react: "⬇️",
    desc: "Download Instagram videos/reels",
    category: "downloader",
    use: ".igdl <Instagram URL>",
    filename: __filename
}, async (conn, mek, m, { from, reply, args, q }) => {
    try {
        const raw = String(q || m.quoted?.text || '');
        const found = raw.replace(/&amp;/g, '&').match(/https?:\/\/[^\s<>"'`]+/i);
        const url = found ? found[0].replace(/[.,;!?)]+$/, '') : raw.trim();
        if (!url || !url.includes("instagram.com")) {
            return reply("❌ Please provide/reply to an Instagram link");
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

        const caption = `*_ɪɴsᴛᴀɢʀᴀᴍ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ_*\nPowered by Progress Tech`;
        const endpoints = [
            `https://api-aswin-sparky.koyeb.app/api/downloader/igdl?url=${encodeURIComponent(url)}`,
            `https://rest-lily.vercel.app/api/downloader/igdl?url=${encodeURIComponent(url)}`,
            `https://jawad-tech.vercel.app/downloader?url=${encodeURIComponent(url)}`,
            `https://bk9.fun/download/instagram?url=${encodeURIComponent(url)}`,
            `https://api.omegatech.app/api/download/youtube?action=download&url=${encodeURIComponent(url)}`
        ];

        let items = [];
        for (const apiUrl of endpoints) {
            try {
                const response = await axios.get(apiUrl, { timeout: 45000, headers: { Accept: 'application/json' } });
                const data = response.data;
                if (Array.isArray(data?.data) && data.data.length) {
                    items = data.data.map((x) => ({ url: x.url || x, type: x.type || (/\.mp4/i.test(x.url || x) ? 'video' : 'image') }));
                } else if (Array.isArray(data?.result) && data.result.length) {
                    items = data.result.map((x) => {
                        const u = typeof x === 'string' ? x : (x.url || x.link);
                        return { url: u, type: /\.mp4|video/i.test(u) ? 'video' : 'image' };
                    });
                } else if (data?.BK9?.[0]?.url) {
                    items = data.BK9.map((x) => ({ url: x.url, type: 'video' }));
                } else if (data?.data?.url) {
                    items = [{ url: data.data.url, type: /mp3|audio/i.test(data.data.type || '') ? 'audio' : 'video' }];
                }
                if (items.length) break;
            } catch (_) {}
        }

        if (!items.length) {
            await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
            return reply('Failed to fetch media. Invalid link or private content.');
        }

        for (const item of items.slice(0, 6)) {
            const kind = item.type === 'video' ? 'video' : (item.type === 'audio' ? 'audio' : 'image');
            await conn.sendMessage(from, {
                [kind]: { url: item.url },
                caption
            }, { quoted: fakevCard });
        }

        // Success reaction
        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });

    } catch (error) {
        console.error('IGDL Error:', error);
        await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
        reply("❌ Download failed. Try again later.");
    }
});

cmd({
  pattern: "igdl4",
  alias: ["instagram4", "insta4", "ig4", "igvideo4"],
  react: '📶',
  desc: "Download videos from Instagram (Alternative API)",
  category: "download",
  use: ".igdl2 <Instagram URL>",
  filename: __filename
}, async (conn, mek, m, { from, reply, args }) => {
  try {
    const igUrl = args[0];
    if (!igUrl || !igUrl.includes("instagram.com")) {
      return reply('Please provide a valid Instagram URL. Example: `.igdl2 https://instagram.com/...`');
    }

    await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

    const apiUrl = `https://bk9.fun/download/instagram?url=${encodeURIComponent(igUrl)}`;
    const response = await axios.get(apiUrl);

    if (!response.data?.status || !response.data?.BK9?.[0]?.url) {
      await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
      return reply('❌ Unable to fetch the video. Try .igdl2 for primary download.');
    }

    const videoUrl = response.data.BK9[0].url;
    await conn.sendMessage(from, { react: { text: '📶', key: m.key } });

    const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
    if (!videoResponse.data) {
      await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
      return reply('❌ Failed to download the video. Please try again later.');
    }

    const videoBuffer = Buffer.from(videoResponse.data, 'binary');

    await conn.sendMessage(from, {
      video: videoBuffer,
      caption: `*_ɪɴsᴛᴀɢʀᴀᴍ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ_*

‎‎╔ஜ۩▒█ *🥰𝑴𝑶𝑵𝑨 𝑳𝑰𝑺𝑨🤭* █▒۩ஜ╗
‎*|* 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 *PROGRESS TECH* 
‎*╰━━━━━━━━━━━━━━━━━━⊷*`
    }, { quoted: fakevCard });

    await conn.sendMessage(from, { react: { text: '✅', key: m.key } });
  } catch (error) {
    console.error('Error downloading video:', error);
    await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
    reply('❌ API 2 failed. Try .igdl for primary download.');
  }
});

cmd({
  pattern: "igdl2",
  alias: ["instagram2", "ig2", "instadl2"],
  react: '📥',
  desc: "Download videos from Instagram (API v5)",
  category: "download",
  use: ".igdl5 <Instagram video URL>",
  filename: __filename
}, async (conn, mek, m, { from, reply, args }) => {
  try {
    const igUrl = args[0];
    if (!igUrl || !igUrl.includes("instagram.com")) {
      return reply('❌ Please provide a valid Instagram video URL.\n\nExample:\n.igdl5 https://instagram.com/reel/...');
    }

    await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

    const apiUrl = `https://jawad-tech.vercel.app/downloader?url=${encodeURIComponent(igUrl)}`;
    const response = await axios.get(apiUrl);

    const data = response.data;

    if (!data.status || !data.result || !Array.isArray(data.result)) {
      return reply('❌ Unable to fetch the video. Please check the URL and try again.');
    }

    const videoUrl = data.result[0];
    if (!videoUrl) return reply("❌ No video found in the response.");

    const metadata = data.metadata || {};
    const author = metadata.author || "Unknown";
    const caption = metadata.caption ? metadata.caption.slice(0, 300) + "..." : "No caption provided.";
    const likes = metadata.like || 0;
    const comments = metadata.comment || 0;

    await reply('ᴜᴘʟᴏᴀᴅɪɴɢ ʏᴏᴜʀ ᴠɪᴅᴇᴏ ᴡᴀɪᴛ...');

    await conn.sendMessage(from, {
      video: { url: videoUrl },
      caption: `📥 *Instagram Reel Downloader*\n👤 *Author:* ${author}\n💬 *Caption:* ${caption}\n❤️ *Likes:* ${likes} | 💭 *Comments:* ${comments}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ Progress Tech`
    }, { quoted: fakevCard });

    await conn.sendMessage(from, { react: { text: '✅', key: m.key } });
  } catch (error) {
    console.error('IGDL5 Error:', error);
    reply('❌ Failed to download the Instagram video. Please try again later.');
    await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
  }
});
cmd({
    pattern: "ig3",
    alias: ["insta3", "instagram3"],
    desc: "Download Instagram video",
    category: "downloader",
    react: "⤵️",
    filename: __filename
},
async (conn, mek, m, { from, args, q, reply }) => {
    try {
        if (!q) return reply("Please provide an Instagram video link.");
        if (!q.includes("instagram.com")) return reply("Invalid Instagram link.");
        
        reply("Downloading video, please wait...");
        
        const apiUrl = `https://rest-lily.vercel.app/api/downloader/igdl?url=${q}`;
        const { data } = await axios.get(apiUrl);
        
        if (!data.status || !data.data || !data.data[0]) return reply("Failed to fetch Instagram video.");
        
        const { url } = data.data[0];
        
        const caption = 
`*_ɪɴsᴛᴀɢʀᴀᴍ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ_*

‎╔ஜ۩▒█ *🥰𝑴𝑶𝑵𝑨 𝑳𝑰𝑺𝑨🤭* █▒۩ஜ╗
‎*|* 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 *PROGRESS TECH* 
‎*╰━━━━━━━━━━━━━━━━━━⊷*`;
        
        await conn.sendMessage(from, {
            video: { url: url },
            caption: caption,
            contextInfo: { mentionedJid: [m.sender] }
        }, { quoted: fakevCard });
        
    } catch (e) {
        console.error("Error in Instagram downloader command:", e);
        reply(`An error occurred: ${e.message}`);
    }
});
