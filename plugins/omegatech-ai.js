// ═══════════════════════════════════════════════════════════════════════════
//   🧠 OMEGATECH AI SUITE — MONA LISA
//   Text-to-video, Wan-fast, Nano-Banana image, Nano-Banana edit,
//   Mureka/Sonu3 music, and X (Twitter) download.
//   Powered by Progress Tech
// ═══════════════════════════════════════════════════════════════════════════

const { cmd } = require('../redx');
const axios = require('axios');
const FormData = require('form-data');

const BASE = 'https://api.omegatech.app';
const BRAND = '🔹 Powered by Omegatech';
const CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function apiGet(pathAndQuery, timeout = 120000) {
    const { data } = await axios.get(`${BASE}${pathAndQuery}`, {
        timeout,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        maxRedirects: 5,
    });
    if (data && data.success === false) {
        throw new Error(data.message || data.error || 'Omegatech request failed');
    }
    return data;
}

async function sendVideoBuffer(conn, from, mek, url, caption) {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 180000, maxRedirects: 5 });
    await conn.sendMessage(from, {
        video: Buffer.from(res.data),
        mimetype: 'video/mp4',
        caption,
    }, { quoted: mek });
}

async function sendImageBuffer(conn, from, mek, url, caption) {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000, maxRedirects: 5 });
    await conn.sendMessage(from, {
        image: Buffer.from(res.data),
        caption,
    }, { quoted: mek });
}

async function uploadToCatbox(buffer, filename = 'image.jpg') {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', buffer, { filename });
    const { data } = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: form.getHeaders(),
        timeout: 60000,
    });
    if (typeof data === 'string' && data.startsWith('http')) return data.trim();
    throw new Error('Image upload failed (catbox): ' + String(data).slice(0, 120));
}

function getQuotedImage(m) {
    if (!m.quoted) return null;
    if (m.quoted.mtype === 'imageMessage' || m.quoted.message?.imageMessage) return m.quoted;
    return null;
}

// ── Text-to-Video (with sound, ~10s) ──
cmd({
    pattern: "omegavideo",
    alias: ["ot2v", "t2video", "omegat2v"],
    react: "🎬",
    desc: "Omegatech Txt2video — text to video with sound (10s)",
    category: "video",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply(`*🎬 Omegatech Txt2Video*\n\nUsage: .omegavideo a cow in the city\nOptional ratio: .omegavideo a cow in the city --16:9\n\n_Generates a ~10s video with sound._`);

        let prompt = q;
        let ratio = 'auto';
        const rm = prompt.match(/(?:--)?(16:9|9:16|1:1|auto)\b/i);
        if (rm) { ratio = rm[1]; prompt = prompt.replace(rm[0], '').trim(); }
        if (!prompt) return reply('❌ Give me a prompt.');

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });
        await reply(`*🎬 Generating video with sound...*\n*Prompt:* ${prompt}\n*Ratio:* ${ratio}\n\n_Wait ~30-60s..._`);

        const res = await apiGet(`/api/ai/Txt2video?action=generate&prompt=${encodeURIComponent(prompt)}&ratio=${encodeURIComponent(ratio)}&sound=true`, 180000);
        const d = res.data || res;
        const videoUrl = d.videoUrl || d.url || d.video;
        if (!videoUrl) throw new Error('No video URL returned: ' + JSON.stringify(res).slice(0, 300));

        await sendVideoBuffer(conn, from, mek, videoUrl, `*✅ Omegatech Video*\n*Prompt:* ${prompt}\n*Ratio:* ${ratio}\n\n*${BRAND}*\n${CHANNEL_LINK}`);
    } catch (e) {
        console.error('[omegavideo]', e.message);
        reply(`*❌ Omegatech Txt2Video failed*\n${e.message}`);
    }
});

// ── Wan-fast (image-to-video, ~10s) ──
// The Omegatech Wan-fast endpoint only exposes `submit` + `status`, and
// `submit` requires an image — it is an image-to-video model, not text-only.
cmd({
    pattern: "wan",
    alias: ["wanfast", "wan-video", "omegawan"],
    react: "🎬",
    desc: "Omegatech Wan 2.2 fast image-to-video (reply to an image)",
    category: "video",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        let taskResume = null;
        let prompt = q || '';
        const tm = prompt.match(/--task\s+(\S+)/i);
        if (tm) { taskResume = tm[1]; prompt = prompt.replace(tm[0], '').trim(); }

        let ratio = '16:9';
        const rm = prompt.match(/(?:--)?(16:9|9:16|1:1)\b/i);
        if (rm) { ratio = rm[1]; prompt = prompt.replace(rm[0], '').trim(); }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        let taskId = taskResume;
        if (!taskId) {
            const quoted = getQuotedImage(m);
            if (!quoted) {
                return reply(`*🎬 Omegatech Wan-Fast (image → video)*\n\nReply to an image with:\n.wan <motion prompt>\n\nOptional ratio: .wan a cow walking --9:16\nResume a task: .wan --task <taskId>`);
            }

            await reply('*📤 Uploading your image...*');
            const buf = await quoted.download();
            if (!buf) throw new Error('Could not download the replied image.');
            const imageUrl = await uploadToCatbox(buf, 'wan.jpg');

            await reply(`*🎬 Rendering Wan-Fast...*\n*Prompt:* ${prompt || 'animate this image'}\n*Ratio:* ${ratio}\n\n_Wait ~1-2 min..._`);
            const gen = await apiGet(`/api/ai/Wan-fast?action=submit&image=${encodeURIComponent(imageUrl)}&prompt=${encodeURIComponent(prompt || 'animate this image naturally')}&aspectRatio=${encodeURIComponent(ratio)}`, 120000);
            const gd = gen.data || gen;
            taskId = gd.taskId || gd.task_id || gd.id || gen.taskId;
            const direct = gd.videoUrl || gd.url;
            if (direct) {
                return sendVideoBuffer(conn, from, mek, direct, `*✅ Wan-Fast Video*\n*Prompt:* ${prompt}\n*Ratio:* ${ratio}\n\n*${BRAND}*\n${CHANNEL_LINK}`);
            }
            if (!taskId) throw new Error('No taskId returned: ' + JSON.stringify(gen).slice(0, 300));
        }

        // Poll status
        let videoUrl = null;
        for (let i = 0; i < 40; i++) {
            const st = await apiGet(`/api/ai/Wan-fast?action=status&aspectRatio=${encodeURIComponent(ratio)}&taskId=${encodeURIComponent(taskId)}`, 60000);
            const sd = st.data || st;
            videoUrl = sd.videoUrl || sd.url;
            const status = (sd.status || '').toLowerCase();
            if (videoUrl) break;
            if (status === 'failed' || status === 'error') throw new Error(sd.message || 'Generation failed');
            await sleep(5000);
        }
        if (!videoUrl) throw new Error('Timed out waiting for Wan-Fast video.');

        await sendVideoBuffer(conn, from, mek, videoUrl, `*✅ Wan-Fast Video*\n*Prompt:* ${prompt || '[resumed task]'}\n*Ratio:* ${ratio}\n*Task:* ${taskId}\n\n*${BRAND}*\n${CHANNEL_LINK}`);
    } catch (e) {
        console.error('[wan]', e.message);
        reply(`*❌ Wan-Fast failed*\n${e.message}`);
    }
});

// ── Nano-Banana image generation ──
cmd({
    pattern: "omeganano",
    alias: ["nano2", "gonano", "omegananobanana"],
    react: "🍌",
    desc: "Omegatech NotGPT Nano-Banana image generation",
    category: "image",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply('*🍌 Omegatech Nano-Banana*\n\nUsage: .omeganano a cyberpunk cat in neo-tokyo');
        await conn.sendMessage(from, { react: { text: "🎨", key: mek.key } });
        await reply(`*🎨 Generating image...*\n*Prompt:* ${q}\n\n_Wait ~20-40s..._`);

        const res = await apiGet(`/api/ai/notgept-Nano-banana?action=generate&prompt=${encodeURIComponent(q)}`, 120000);
        const d = res.data || res;
        const imageUrl = d.image || d.url || d.imageUrl;
        if (!imageUrl) throw new Error('No image URL returned: ' + JSON.stringify(res).slice(0, 300));

        await sendImageBuffer(conn, from, mek, imageUrl, `*✅ Nano-Banana*\n*Prompt:* ${q}\n\n*${BRAND}*\n${CHANNEL_LINK}`);
    } catch (e) {
        console.error('[omeganano]', e.message);
        reply(`*❌ Nano-Banana failed*\n${e.message}`);
    }
});

// ── Nano-Banana extra (edit a replied image) ──
cmd({
    pattern: "nanoedit",
    alias: ["nanoextra", "omegananoedit"],
    react: "🖌️",
    desc: "Omegatech Nano-Banana-extra image edit (reply an image)",
    category: "image",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        const quoted = getQuotedImage(m);
        if (!quoted) return reply('*🖌️ Nano-Banana Edit*\n\nReply to an image with:\n.nanoedit <what to change>');
        if (!q) return reply('❌ Tell me what to change, e.g. .nanoedit make it a zombie');

        await conn.sendMessage(from, { react: { text: "🎨", key: mek.key } });
        await reply('*📤 Uploading your image...*');

        const buf = await quoted.download();
        if (!buf) throw new Error('Could not download the replied image.');
        const imageUrl = await uploadToCatbox(buf, 'nanobana.jpg');

        await reply(`*🖌️ Editing...*\n*Prompt:* ${q}\n\n_Wait ~30-60s..._`);
        const res = await apiGet(`/api/ai/Nanobana-extra?action=edit&image=${encodeURIComponent(imageUrl)}&prompt=${encodeURIComponent(q)}`, 180000);
        const d = res.data || res;
        const outUrl = d.image || d.url || d.imageUrl;
        if (!outUrl) throw new Error('No image URL returned: ' + JSON.stringify(res).slice(0, 300));

        await sendImageBuffer(conn, from, mek, outUrl, `*✅ Nano-Banana Edit*\n*Prompt:* ${q}\n\n*${BRAND}*\n${CHANNEL_LINK}`);
    } catch (e) {
        console.error('[nanoedit]', e.message);
        reply(`*❌ Nano-Banana Edit failed*\n${e.message}`);
    }
});

// ── Sonu3 / Mureka music generation ──
cmd({
    pattern: "sonu3",
    alias: ["mureka", "omegamusic"],
    react: "🎵",
    desc: "Omegatech Sonu3 (Mureka) music generation",
    category: "music",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        let taskResume = null;
        let prompt = q || '';
        const tm = prompt.match(/--task\s+(\S+)/i);
        if (tm) { taskResume = tm[1]; prompt = prompt.replace(tm[0], '').trim(); }
        if (!prompt && !taskResume) return reply('*🎵 Omegatech Sonu3*\n\nUsage: .sonu3 a sad acoustic song\nResume: .sonu3 --task <taskId>');

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        let taskId = taskResume;
        if (!taskId) {
            await reply(`*🎵 Composing...*\n*Prompt:* ${prompt}\n\n_Wait ~90s..._`);
            const gen = await apiGet(`/api/ai/sonu3?action=generate&prompt=${encodeURIComponent(prompt)}`, 120000);
            const gd = gen.data || gen;
            taskId = (gd && (gd.taskId || gd.task_id || gd.id)) || (gen.taskId);
            const direct = gd && (gd.audioUrl || gd.url || gd.music);
            if (direct) {
                return conn.sendMessage(from, { audio: { url: direct }, mimetype: 'audio/mpeg', caption: `*✅ Sonu3*\n*Prompt:* ${prompt}\n\n*${BRAND}*` }, { quoted: mek });
            }
            if (!taskId) throw new Error('No taskId returned: ' + JSON.stringify(gen).slice(0, 300));
        }

        let audioUrl = null;
        for (let i = 0; i < 40; i++) {
            const st = await apiGet(`/api/ai/sonu3?action=result&taskId=${encodeURIComponent(taskId)}`, 60000);
            const sd = st.data || st;
            let cand = sd.audioUrl || sd.url || sd.audio || sd.music || sd.song;
            if (!cand && Array.isArray(sd.songs) && sd.songs.length) cand = sd.songs[0].audioUrl || sd.songs[0].url || sd.songs[0];
            if (!cand && Array.isArray(sd.data) && sd.data.length) cand = sd.data[0].audioUrl || sd.data[0].url || sd.data[0];
            if (typeof cand === 'string' && cand.startsWith('http')) { audioUrl = cand; break; }
            const status = (sd.status || '').toLowerCase();
            if (status === 'failed' || status === 'error') throw new Error(sd.message || 'Generation failed');
            await sleep(7000);
        }
        if (!audioUrl) throw new Error('Timed out waiting for the song.');

        await conn.sendMessage(from, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            caption: `*✅ Sonu3 Music*\n*Prompt:* ${prompt || '[resumed task]'}\n*Task:* ${taskId}\n\n*${BRAND}*\n${CHANNEL_LINK}`,
        }, { quoted: mek });
    } catch (e) {
        console.error('[sonu3]', e.message);
        reply(`*❌ Sonu3 failed*\n${e.message}`);
    }
});

// ── X (Twitter) download ──
cmd({
    pattern: "xdl",
    alias: ["xdown", "twitterdl", "xvideo"],
    react: "🐦",
    desc: "Download video/media from X (Twitter)",
    category: "download",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q || !/x\.com|twitter\.com/i.test(q)) {
            return reply('*🐦 X Downloader*\n\nUsage: .xdl https://x.com/user/status/123456');
        }
        const url = q.match(/https?:\/\/\S+/i)[0];
        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });
        await reply('*⏳ Fetching from X...*');

        const res = await apiGet(`/api/download/X?action=download&url=${encodeURIComponent(url)}`, 90000);
        const d = res.data || res;

        // Try hard to find a playable/downloadable media URL.
        let mediaUrl = null;
        let thumbUrl = null;
        if (Array.isArray(d.media)) {
            for (const item of d.media) {
                if (!thumbUrl && item.thumbnail_url) thumbUrl = item.thumbnail_url;
                if (!mediaUrl) {
                    mediaUrl = item.best_url || item.url || item.download_url || null;
                    if (!mediaUrl && Array.isArray(item.variants)) {
                        const withUrl = item.variants.filter(v => v && v.url);
                        if (withUrl.length) mediaUrl = withUrl[withUrl.length - 1].url;
                    }
                    if (!mediaUrl && Array.isArray(item.playlist) && item.playlist.length) {
                        const playable = item.playlist.find(p => p && (p.url || p.src));
                        if (playable) mediaUrl = playable.url || playable.src;
                    }
                }
                if (mediaUrl) break;
            }
        }
        mediaUrl = mediaUrl || d.video || d.videoUrl || d.hd || d.sd || d.download_url || null;

        if (!mediaUrl) {
            if (thumbUrl) {
                const text = d.text ? `\n\n📝 ${String(d.text).slice(0, 200)}` : '';
                return sendImageBuffer(conn, from, mek, thumbUrl, `*⚠️ X post has no downloadable media URL right now*\nShowing the preview instead.${text}\n\n*${BRAND}*\n${CHANNEL_LINK}`);
            }
            throw new Error('No downloadable media found for that post.');
        }

        const isVideo = /\.mp4|video/i.test(mediaUrl) || (d.media_type || '').toLowerCase() === 'video';
        const cap = `*✅ X Download*\n${d.text ? '📝 ' + String(d.text).slice(0, 150) + '\n' : ''}\n*${BRAND}*\n${CHANNEL_LINK}`;

        if (isVideo) {
            await sendVideoBuffer(conn, from, mek, mediaUrl, cap);
        } else {
            await sendImageBuffer(conn, from, mek, mediaUrl, cap);
        }
    } catch (e) {
        console.error('[xdl]', e.message);
        reply(`*❌ X Download failed*\n${e.message}`);
    }
});
