// ═══════════════════════════════════════════════════════════════════════════
//   📥 YOUTUBE DOWNLOADER (MP3/MP4) — MONA LISA
//   Powered by Omegatech · adapted to the redx plugin system
//
//   Commands:
//     .yt <url>            - choose video or audio
//     .ytmp4 <url>         - download video (then pick quality)
//     .ytmp3 <url>         - download audio (then pick quality)
//   Also accepts: .ytmp4 <url> --quality <n>
// ═══════════════════════════════════════════════════════════════════════════

const { cmd } = require('../redx');
const axios = require('axios');
const yts = require('yt-search');

const API = 'https://api.omegatech.app/api/download/ytultra?action=download';
const BRAND = '🔹 Powered by Omegatech • YouTube';
const CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';

// per-chat cache of the fetched YouTube data (in-memory; resets on restart)
const ytCache = new Map();

function isYouTube(url) {
    return /youtube\.com|youtu\.be/i.test(String(url || ''));
}

function extractVideoId(url) {
    const s = String(url || '');
    const m = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{6,20})/);
    if (m) return m[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    return null;
}

async function getVideoMeta(url) {
    const id = extractVideoId(url);
    if (id) {
        try {
            const info = await yts({ videoId: id });
            if (info && info.title) return info;
        } catch (_) {}
    }
    try {
        const search = await yts(String(url));
        if (search && Array.isArray(search.videos) && search.videos.length) return search.videos[0];
    } catch (_) {}
    return null;
}

// Fallback used when the Omegatech ytultra endpoint is unavailable. It reuses
// public APIs already relied on elsewhere in this project so YouTube
// downloads keep working instead of failing outright.
async function getFallbackData(url) {
    const meta = await getVideoMeta(url);
    const title = (meta && meta.title) || 'YouTube media';
    const thumbnail = (meta && meta.thumbnail) || '';

    const [audioRes, videoRes, altVideoRes] = await Promise.allSettled([
        axios.get(`https://arslan-apis-v2.vercel.app/download/ytmp3?url=${encodeURIComponent(url)}`, { timeout: 60000 }),
        axios.get(`https://gtech-api-xtp1.onrender.com/api/video/yt?apikey=APIKEY&url=${encodeURIComponent(url)}`, { timeout: 60000 }),
        axios.get(`https://arslan-apis-v2.vercel.app/download/ytmp4?url=${encodeURIComponent(url)}`, { timeout: 60000 }),
    ]);

    const mp3 = [];
    const mp4 = [];

    if (audioRes.status === 'fulfilled') {
        const dl = audioRes.value?.data?.result?.download;
        if (dl && dl.url) {
            mp3.push({ quality: dl.quality || '128kbps', format: 'mp3', url: dl.url, filename: `${title}.mp3` });
        }
    }

    if (videoRes.status === 'fulfilled') {
        const media = videoRes.value?.data?.result?.media;
        if (media) {
            const hd = media.video_url_hd || media.video_url || media.url || media.hd;
            const sd = media.video_url_sd || media.sd;
            if (hd && !/No HD|No video/i.test(hd)) {
                mp4.push({ quality: 'HD', format: 'mp4', url: hd, filename: `${title}.mp4` });
            }
            if (sd && !/No /i.test(sd)) {
                mp4.push({ quality: 'SD', format: 'mp4', url: sd, filename: `${title}.mp4` });
            }
        }
    }

    if (!mp4.length && altVideoRes.status === 'fulfilled') {
        const dl = altVideoRes.value?.data?.result?.download;
        if (dl && dl.url) {
            mp4.push({ quality: dl.quality || '360p', format: 'mp4', url: dl.url, filename: `${title}.mp4` });
        }
    }

    if (!mp3.length && !mp4.length) {
        throw new Error('The download service is temporarily unavailable. Please try again later.');
    }

    return { title, thumbnail, mp4, mp3 };
}

async function getYTData(url) {
    try {
        const { data } = await axios.get(`${API}&url=${encodeURIComponent(url)}`, {
            timeout: 60000,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        });
        if (!data || data.success === false || !data.data) {
            throw new Error(data?.message || data?.error || 'Failed to fetch YouTube data');
        }
        const d = data.data;
        if (!Array.isArray(d.mp4) && !Array.isArray(d.mp3)) {
            throw new Error('Unexpected YouTube response');
        }
        return d;
    } catch (e) {
        console.error('[ytdl] Omegatech failed, using fallback:', e.message);
        return getFallbackData(url);
    }
}

function mediaListOf(data, type) {
    return (type === 'video' ? (data.mp4 || []) : (data.mp3 || []));
}

function typeMenu(data, url, prefix) {
    return `📥 *${String(data.title || 'YouTube').slice(0, 60)}*\n`
        + `━━━━━━━━━━━━━━━━━━━━━\n\n`
        + `🎬 Video: ${(data.mp4 || []).length} qualities\n`
        + `🎵 Audio: ${(data.mp3 || []).length} qualities\n\n`
        + `📌 *Choose:*\n`
        + `  ${prefix}ytmp4 ${url}\n`
        + `  ${prefix}ytmp3 ${url}`;
}

function qualityMenu(data, type, url, prefix) {
    const list = mediaListOf(data, type);
    const cmdName = type === 'video' ? 'ytmp4' : 'ytmp3';
    let msg = `📥 *${String(data.title || 'YouTube').slice(0, 60)}*\n`
        + `━━━━━━━━━━━━━━━━━━━━━\n\n`
        + `*Available ${type === 'video' ? 'Video' : 'Audio'} Qualities:*\n`;
    list.forEach((q, i) => { msg += `${i + 1}. ${q.quality} (${q.format})\n`; });
    msg += `\n💡 Reply with: ${prefix}${cmdName} ${url} --quality <number>`;
    return msg;
}

async function downloadAndSend(conn, from, data, type, index, mek, reply) {
    const mediaList = mediaListOf(data, type);
    const selected = mediaList[index];
    if (!selected) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        return reply(`❌ Invalid quality number. Choose 1-${mediaList.length}.`);
    }

    await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
    await reply(`⬇️ Downloading ${type} in ${selected.quality}...`);

    const base = `*${String(data.title || 'YouTube').slice(0, 60)}*\n*Quality:* ${selected.quality}\n*Bytes:* ${selected.format ? String(selected.format).toUpperCase() : ''}\n\n*${BRAND}*\n${CHANNEL_LINK}`;

    if (type === 'video') {
        await conn.sendMessage(from, {
            video: { url: selected.url },
            mimetype: 'video/mp4',
            fileName: selected.filename || 'video.mp4',
            caption: base,
        }, { quoted: mek });
    } else {
        await conn.sendMessage(from, {
            audio: { url: selected.url },
            mimetype: 'audio/mpeg',
            ptt: false,
            fileName: selected.filename || 'audio.mp3',
            caption: base,
        }, { quoted: mek });
    }

    await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
}

cmd({
    pattern: "ytmp4",
    alias: ["ytv", "ytvideo"],
    react: "🎬",
    desc: "Download a YouTube video (MP4) with quality selection",
    category: "download",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix }) => {
    return handleYT(conn, mek, m, { from, q, reply, prefix }, 'video');
});

cmd({
    pattern: "ytmp3",
    alias: ["yta", "ytaudio"],
    react: "🎵",
    desc: "Download YouTube audio (MP3) with quality selection",
    category: "download",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix }) => {
    return handleYT(conn, mek, m, { from, q, reply, prefix }, 'audio');
});

cmd({
    pattern: "ytdl",
    alias: ["yt", "youtube", "youtubedl", "ytultra"],
    react: "📥",
    desc: "YouTube downloader — choose video or audio",
    category: "download",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix }) => {
    return handleYT(conn, mek, m, { from, q, reply, prefix }, 'auto');
});

async function handleYT(conn, mek, m, { from, q, reply, prefix }, mode) {
    try {
        const prefixStr = prefix || '.';
        if (!q) {
            return reply(`📥 *YouTube Downloader*\n\n`
                + `📝 *Usage:*\n`
                + `${prefixStr}ytdl <url>   - choose type\n`
                + `${prefixStr}ytmp4 <url>  - download video\n`
                + `${prefixStr}ytmp3 <url>  - download audio\n\n`
                + `📌 *Example:*\n${prefixStr}ytmp4 https://youtu.be/xxxxx\n\n`
                + `⚡ ${BRAND}`);
        }

        // quality selection: "<url> --quality <n>"
        const qualityMatch = q.match(/^(https?:\/\/\S+)\s*--quality\s+(\d+)/i);
        if (qualityMatch) {
            const url = qualityMatch[1];
            const index = parseInt(qualityMatch[2], 10) - 1;
            const cached = ytCache.get(m.chat);
            const data = (cached && cached.url === url) ? cached.data : await getYTData(url);
            return downloadAndSend(conn, from, data, mode === 'audio' ? 'audio' : 'video', index, mek, reply);
        }

        let url = null;
        const urlMatch = q.match(/https?:\/\/\S+/i);
        if (urlMatch && /youtube\.com|youtu\.be/i.test(urlMatch[0])) {
            url = urlMatch[0];
        } else {
            await conn.sendMessage(from, { react: { text: '🔍', key: mek.key } });
            await reply(`Searching YouTube for: ${q}`);
            try {
                const { data } = await axios.get(
                    `https://api.omegatech.app/api/download/ytultra?action=search&query=${encodeURIComponent(q)}`,
                    { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } }
                );
                const results = data?.data?.results || data?.results || [];
                if (results.length && (results[0].url || results[0].link || results[0].videoId)) {
                    url = results[0].url || results[0].link || `https://youtu.be/${results[0].videoId}`;
                }
            } catch (_) {}
            if (!url) {
                const search = await yts(String(q));
                if (search && Array.isArray(search.videos) && search.videos.length) url = search.videos[0].url;
            }
            if (!url) return reply('No YouTube results for that query.');
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        await reply('⏳ Fetching YouTube data...');
        const data = await getYTData(url);
        ytCache.set(m.chat, { data, url, timestamp: Date.now() });

        if (mode === 'auto') {
            return reply(typeMenu(data, url, prefixStr));
        }
        return reply(qualityMenu(data, mode, url, prefixStr));
    } catch (e) {
        console.error('[ytdl]', e.message);
        reply(`❌ YouTube error: ${e.message}`);
    }
}
