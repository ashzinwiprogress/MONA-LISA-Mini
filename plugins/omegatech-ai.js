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
        if (!q) return reply(`*Txt2Video (~10s with sound)*\n\nUsage: .omegavideo a cow in the city\nRatio: .omegavideo a cow in the city --16:9\n\nPowered by Progress Tech`);

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

        await sendVideoBuffer(conn, from, mek, videoUrl, `*Txt2Video (~10s, sound)*\nPrompt: ${prompt}\nRatio: ${ratio}\n\n*${BRAND}*\n${CHANNEL_LINK}`);
    } catch (e) {
        console.error('[omegavideo]', e.message);
        reply(`*❌ Omegatech Txt2Video failed*\n${e.message}`);
    }
});

// Wan-fast: ~10s image-to-video (reply image) or text-to-video (prompt only).
cmd({
    pattern: "wan",
    alias: ["wanfast", "wan-video", "omegawan"],
    react: "🎬",
    desc: "Wan 2.2 fast ~10s video (text or reply image)",
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

        if (!taskResume && !prompt && !getQuotedImage(m)) {
            return reply(`*Wan-Fast (~10s)*\n\nText to video:\n.wan a cow walking in the city\n\nImage to video: reply to an image\n.wan animate this --9:16\n\nResume: .wan --task <taskId>\n\nPowered by Progress Tech`);
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        let taskId = taskResume;
        if (!taskId) {
            const quoted = getQuotedImage(m);
            let imageUrl = null;
            if (quoted) {
                await reply('Uploading image for Wan-Fast...');
                const buf = await quoted.download();
                if (!buf) throw new Error('Could not download the replied image.');
                imageUrl = await uploadToCatbox(buf, 'wan.jpg');
            }

            const motion = prompt || (imageUrl ? 'animate this image naturally' : '');
            if (!motion) return reply('Give a prompt, or reply to an image.');
            await reply(`Rendering Wan-Fast (~10s)...\nPrompt: ${motion}\nRatio: ${ratio}\nMode: ${imageUrl ? 'image-to-video' : 'text-to-video'}`);

            let path = `/api/ai/Wan-fast?action=submit&prompt=${encodeURIComponent(motion)}&aspectRatio=${encodeURIComponent(ratio)}`;
            if (imageUrl) path += `&image=${encodeURIComponent(imageUrl)}`;
            const gen = await apiGet(path, 120000);
            const gd = gen.data || gen;
            taskId = gd.taskId || gd.task_id || gd.id || gen.taskId;
            const direct = gd.videoUrl || gd.url;
            if (direct) {
                return sendVideoBuffer(conn, from, mek, direct, `*Wan-Fast (~10s)*\nPrompt: ${motion}\nRatio: ${ratio}\n\n*${BRAND}*\n${CHANNEL_LINK}`);
            }
            if (!taskId) throw new Error('No taskId returned: ' + JSON.stringify(gen).slice(0, 300));
        }

        let videoUrl = null;
        for (let i = 0; i < 40; i++) {
            const st = await apiGet(`/api/ai/Wan-fast?action=status&aspectRatio=${encodeURIComponent(ratio)}&taskId=${encodeURIComponent(taskId)}`, 60000);
            const sd = st.data || st;
            videoUrl = sd.videoUrl || sd.url;
            const status = (sd.status || '').toLowerCase();
            if (videoUrl || status === 'success' || status === 'succeeded' || status === 'completed' || status === 'done') {
                if (videoUrl) break;
            }
            if (status === 'failed' || status === 'error') throw new Error(sd.message || 'Generation failed');
            await sleep(5000);
        }
        if (!videoUrl) throw new Error('Timed out waiting for Wan-Fast video.');

        await sendVideoBuffer(conn, from, mek, videoUrl, `*Wan-Fast (~10s)*\nPrompt: ${prompt || '[resumed task]'}\nRatio: ${ratio}\nTask: ${taskId}\n\n*${BRAND}*\n${CHANNEL_LINK}`);
    } catch (e) {
        console.error('[wan]', e.message);
        reply(`Wan-Fast failed: ${e.message}`);
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

        await sendImageBuffer(conn, from, mek, imageUrl, `*Nano-Banana*\nPrompt: ${q}\nJob: ${d.jobId || 'ok'}\n\n*${BRAND}*\n${CHANNEL_LINK}`);
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

        await sendImageBuffer(conn, from, mek, outUrl, `*Nano-Banana Edit*\nPrompt: ${q}\nModel: ${d.model || 'nano-banana-lite'}\n\nPowered by Progress Tech\n${CHANNEL_LINK}`);
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
            await reply(`Composing Sonu3 / Mureka...\nPrompt: ${prompt}\nWait ~90s...\n\nPowered by Progress Tech`);
            const gen = await apiGet(`/api/ai/sonu3?action=generate&prompt=${encodeURIComponent(prompt)}`, 120000);
            const gd = gen.data || gen;
            taskId = gen.taskId || gd.taskId || gd.task_id || gd.id;
            const direct = gd.audioUrl || gd.url || gd.music || gen.audioUrl;
            if (direct) {
                return conn.sendMessage(from, { audio: { url: direct }, mimetype: 'audio/mpeg', caption: `*Sonu3*\nPrompt: ${prompt}\n\nPowered by Progress Tech` }, { quoted: mek });
            }
            if (!taskId) throw new Error('No taskId returned: ' + JSON.stringify(gen).slice(0, 300));
            await reply(`Task started: ${taskId}\nPolling result...`);
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
            caption: `*Sonu3 Music*\nPrompt: ${prompt || '[resumed task]'}\nTask: ${taskId}\n\nPowered by Progress Tech\n${CHANNEL_LINK}`,
        }, { quoted: mek });
    } catch (e) {
        console.error('[sonu3]', e.message);
        reply(`Sonu3 failed: ${e.message}`);
    }
});

function pickAudioUrl(obj) {
    if (!obj) return null;
    const d = obj.data || obj;
    let cand = d.audioUrl || d.audio_url || d.url || d.audio || d.music || d.song || d.streamUrl || d.downloadUrl;
    if (!cand && Array.isArray(d.songs) && d.songs.length) cand = d.songs[0].audioUrl || d.songs[0].url || d.songs[0];
    if (!cand && Array.isArray(d.tracks) && d.tracks.length) cand = d.tracks[0].audioUrl || d.tracks[0].url || d.tracks[0].musicFile;
    if (typeof cand === 'string' && cand.startsWith('http')) return cand;
    return null;
}

cmd({
    pattern: "remusic",
    alias: ["remu", "aimusic", "remusicai"],
    react: "🎵",
    desc: "Remusic V5 song generation",
    category: "music",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix }) => {
    try {
        const pre = prefix || '.';
        if (!q) return reply(`*Remusic V5*\n\n${pre}remusic sad song\n${pre}remusic sad song --vocal Duet --model v5\nResume: ${pre}remusic --task <taskId>\n\nPowered by Progress Tech`);

        let prompt = q;
        let taskResume = null;
        let vocal = 'Duet';
        let model = 'v5';
        const tm = prompt.match(/--task\s+(\S+)/i);
        if (tm) { taskResume = tm[1]; prompt = prompt.replace(tm[0], '').trim(); }
        const vm = prompt.match(/--vocal\s+(\S+)/i);
        if (vm) { vocal = vm[1]; prompt = prompt.replace(vm[0], '').trim(); }
        const mm = prompt.match(/--model\s+(\S+)/i);
        if (mm) { model = mm[1]; prompt = prompt.replace(mm[0], '').trim(); }
        if (!prompt && !taskResume) return reply('Give a song prompt.');

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });
        let taskId = taskResume;
        if (!taskId) {
            await reply(`Creating Remusic task...\nPrompt: ${prompt}\nVocal: ${vocal}\nModel: ${model}`);
            const gen = await apiGet(`/api/ai/Remusic-ai?action=generate_async&prompt=${encodeURIComponent(prompt)}&vocal=${encodeURIComponent(vocal)}&model=${encodeURIComponent(model)}&private=true`, 90000);
            const gd = gen.data || gen;
            taskId = gd.taskId || gd.task_id || gen.taskId;
            const direct = pickAudioUrl(gen);
            if (direct) {
                return conn.sendMessage(from, { audio: { url: direct }, mimetype: 'audio/mpeg', caption: `*Remusic*\nPrompt: ${prompt}\n\nPowered by Progress Tech` }, { quoted: mek });
            }
            if (!taskId) throw new Error('No taskId returned: ' + JSON.stringify(gen).slice(0, 300));
            await reply(`Task: ${taskId}\nPolling status...`);
        }

        let audioUrl = null;
        for (let i = 0; i < 40; i++) {
            const st = await apiGet(`/api/ai/Remusic-ai?action=status&taskId=${encodeURIComponent(taskId)}`, 60000);
            audioUrl = pickAudioUrl(st);
            const status = String((st.data || st).status || '').toLowerCase();
            if (audioUrl) break;
            if (status === 'failed' || status === 'error') throw new Error((st.data || st).message || 'Generation failed');
            await sleep(7000);
        }
        if (!audioUrl) throw new Error('Timed out waiting for Remusic. Try .remusic --task ' + taskId);
        await conn.sendMessage(from, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            caption: `*Remusic V5*\nPrompt: ${prompt || '[resumed]'}\nTask: ${taskId}\n\nPowered by Progress Tech\n${CHANNEL_LINK}`
        }, { quoted: mek });
    } catch (e) {
        console.error('[remusic]', e.message);
        reply(`Remusic failed: ${e.message}`);
    }
});

cmd({
    pattern: "remcover",
    alias: ["remusiccover", "aicover", "songcover"],
    react: "🎤",
    desc: "Remusic AI cover of a song URL or replied audio",
    category: "music",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix }) => {
    try {
        const pre = prefix || '.';
        let raw = q || '';
        let model = 'prince';
        let taskResume = null;
        const tm = raw.match(/--task\s+(\S+)/i);
        if (tm) { taskResume = tm[1]; raw = raw.replace(tm[0], '').trim(); }
        const mm = raw.match(/--model\s+(\S+)/i);
        if (mm) { model = mm[1]; raw = raw.replace(mm[0], '').trim(); }
        else if (raw && !raw.startsWith('http') && !m.quoted) model = raw.trim() || model;

        let songUrl = (raw.match(/https?:\/\/\S+/i) || [])[0] || '';
        if (!taskResume && !songUrl && m.quoted) {
            const quoted = m.quoted;
            const isAudio = quoted.mtype === 'audioMessage' || quoted.message?.audioMessage || quoted.mtype === 'videoMessage' || quoted.message?.videoMessage;
            if (!isAudio) return reply(`*Remusic Cover*\n\nReply to audio with ${pre}remcover prince\nOr: ${pre}remcover https://...mp3 --model prince`);
            await reply('Uploading audio...');
            const buf = await quoted.download();
            if (!buf) throw new Error('Could not download replied audio.');
            songUrl = await uploadToCatbox(Buffer.from(buf), 'cover.mp3');
        }
        if (!taskResume && !songUrl) {
            return reply(`*Remusic Cover*\n\nReply to a song with ${pre}remcover\nOr: ${pre}remcover <audio-url> --model prince\n\nPowered by Progress Tech`);
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });
        let taskId = taskResume;
        if (!taskId) {
            await reply(`Creating cover...\nModel: ${model}`);
            const gen = await apiGet(`/api/ai/Remusic-cover?action=cover_async&songUrl=${encodeURIComponent(songUrl)}&model=${encodeURIComponent(model)}&outputFormat=mp3&pitchChange=no-change&modelType=1`, 90000);
            const gd = gen.data || gen;
            taskId = gd.taskId || gd.task_id || gen.taskId;
            const direct = pickAudioUrl(gen);
            if (direct) {
                return conn.sendMessage(from, { audio: { url: direct }, mimetype: 'audio/mpeg', caption: `*Remusic Cover*\nModel: ${model}\n\nPowered by Progress Tech` }, { quoted: mek });
            }
            if (!taskId) throw new Error('No taskId returned: ' + JSON.stringify(gen).slice(0, 300));
            await reply(`Task: ${taskId}\nPolling cover...`);
        }

        let audioUrl = null;
        for (let i = 0; i < 40; i++) {
            const st = await apiGet(`/api/ai/Remusic-cover?action=status&taskId=${encodeURIComponent(taskId)}`, 60000);
            audioUrl = pickAudioUrl(st);
            const status = String((st.data || st).status || '').toLowerCase();
            if (audioUrl) break;
            if (status === 'failed' || status === 'error') throw new Error((st.data || st).message || 'Cover failed');
            await sleep(7000);
        }
        if (!audioUrl) throw new Error('Timed out waiting for cover. Try .remcover --task ' + taskId);
        await conn.sendMessage(from, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            caption: `*Remusic Cover*\nModel: ${model}\nTask: ${taskId}\n\nPowered by Progress Tech\n${CHANNEL_LINK}`
        }, { quoted: mek });
    } catch (e) {
        console.error('[remcover]', e.message);
        reply(`Remusic cover failed: ${e.message}`);
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
