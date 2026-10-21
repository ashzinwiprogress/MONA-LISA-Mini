const { cmd } = require('../redx');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

const BASE = 'https://api.omegatech.app';
const BRAND = 'Powered by Progress Tech';
const CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';

const biliCache = new Map();

async function apiGet(pathAndQuery, timeout = 60000) {
  const { data } = await axios.get(`${BASE}${pathAndQuery}`, {
    timeout,
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    maxRedirects: 5
  });
  if (data && data.success === false) {
    throw new Error(data.message || data.error || 'Request failed');
  }
  return data;
}

function parseSizeMb(size) {
  const s = String(size || '');
  const m = s.match(/([\d.]+)\s*(MB|GB|KB)/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const u = m[2].toUpperCase();
  if (u === 'GB') return n * 1024;
  if (u === 'KB') return n / 1024;
  return n;
}

function pickVideo(media, want) {
  const list = Array.isArray(media) ? media.filter((x) => x && x.url) : [];
  if (!list.length) return null;
  if (want) {
    const q = String(want).toLowerCase();
    const hit = list.find((x) => String(x.quality || '').toLowerCase() === q)
      || list.find((x) => String(x.quality || '').toLowerCase().includes(q));
    if (hit) return hit;
  }
  const sorted = [...list].sort((a, b) => parseSizeMb(a.size) - parseSizeMb(b.size));
  return sorted[0];
}

function pickAudio(audio) {
  const list = Array.isArray(audio) ? audio.filter((x) => x && x.url) : [];
  if (!list.length) return null;
  return [...list].sort((a, b) => parseSizeMb(a.size) - parseSizeMb(b.size))[0];
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, { timeout: 180000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

async function downloadFile(url, dest) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 180000,
    maxRedirects: 5,
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.bilibili.tv/' }
  });
  fs.writeFileSync(dest, Buffer.from(res.data));
}

cmd({
  pattern: 'bilidl',
  alias: ['bilivideo', 'bili2'],
  react: '📺',
  desc: 'Download Bilibili videos via Omegatech bilidl',
  category: 'downloader',
  filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix, sender }) => {
  try {
    const pre = prefix || '.';
    if (!q) {
      return reply(
        `*Bilibili Download*\n\n` +
        `${pre}bilidl https://www.bilibili.tv/en/video/2005655709\n` +
        `${pre}bilidl 240p\n` +
        `${pre}bilidl https://www.bilibili.tv/en/video/2005655709 360p\n\n` +
        `_${BRAND}_\n${CHANNEL_LINK}`
      );
    }

    const key = String(sender || from);
    const qualityOnly = q.trim().match(/^(240p|360p|480p|720p|1080p)$/i);
    let url = '';
    let quality = '';
    const cached = biliCache.get(key);

    if (qualityOnly && cached) {
      quality = qualityOnly[1];
    } else {
      const urlMatch = q.match(/https?:\/\/[^\s]+/i);
      url = urlMatch ? urlMatch[0] : '';
      const qm = q.match(/\b(240p|360p|480p|720p|1080p)\b/i);
      if (qm) quality = qm[1];
    }

    let data = cached;
    if (url) {
      await reply('Fetching Bilibili media...');
      data = await apiGet(`/api/download/bilidl?url=${encodeURIComponent(url)}`);
      biliCache.set(key, data);
    }
    if (!data) return reply(`No cached result. Send a Bilibili URL first.\n${pre}bilidl <url>`);

    const title = data.title || 'Bilibili video';
    const media = data.media || [];
    const audio = data.audio || [];
    if (!media.length && !data.direct) throw new Error('No media URLs returned');

    if (!quality && url) {
      const lines = media.map((v, i) => `${i + 1}. ${v.quality || 'video'} — ${v.size || '?'}`).join('\n');
      const audioLine = audio.length ? `\nAudio tracks: ${audio.map((a) => a.size).join(', ')}` : '';
      const caption =
        `*${title}*\nViews: ${data.views || 'N/A'} | Likes: ${data.likes || 'N/A'}\n\n` +
        `*Qualities*\n${lines}${audioLine}\n\n` +
        `Downloading smallest quality now. Or pick one:\n${pre}bilidl 360p\n\n_${BRAND}_`;
      if (data.thumbnail) {
        await conn.sendMessage(from, { image: { url: data.thumbnail }, caption }, { quoted: mek }).catch(() => reply(caption));
      } else {
        await reply(caption);
      }
    }

    const video = pickVideo(media, quality) || (data.direct ? { url: data.direct, quality: quality || 'direct', size: '?' } : null);
    if (!video) throw new Error('No matching quality');
    const audioTrack = pickAudio(audio);

    const stamp = Date.now();
    const dir = path.join('/tmp/opencode', `bili_${stamp}`);
    fs.mkdirSync(dir, { recursive: true });
    const vPath = path.join(dir, 'video.m4s');
    const aPath = path.join(dir, 'audio.m4s');
    const outPath = path.join(dir, 'out.mp4');

    await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
    await reply(`Downloading ${video.quality || ''} (${video.size || '?'})...`);
    await downloadFile(video.url, vPath);
    if (audioTrack) await downloadFile(audioTrack.url, aPath);

    if (audioTrack && fs.existsSync(aPath)) {
      try {
        await runFfmpeg(['-y', '-i', vPath, '-i', aPath, '-c', 'copy', '-shortest', outPath]);
      } catch (_) {
        await runFfmpeg(['-y', '-i', vPath, '-i', aPath, '-c:v', 'copy', '-c:a', 'aac', '-shortest', outPath]);
      }
    } else {
      try {
        await runFfmpeg(['-y', '-i', vPath, '-c', 'copy', outPath]);
      } catch (_) {
        await runFfmpeg(['-y', '-i', vPath, '-c:v', 'libx264', '-preset', 'veryfast', outPath]);
      }
    }

    if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 1000) {
      throw new Error('Muxed video was empty');
    }

    const buf = fs.readFileSync(outPath);
    const caption = `*${title}*\nQuality: ${video.quality || 'n/a'}\nSize: ${(buf.length / (1024 * 1024)).toFixed(1)} MB\n\n_${BRAND}_\n${CHANNEL_LINK}`;
    if (buf.length > 95 * 1024 * 1024) {
      await conn.sendMessage(from, {
        document: buf,
        mimetype: 'video/mp4',
        fileName: `${title.replace(/[^\w.-]+/g, '_').slice(0, 40)}.mp4`,
        caption
      }, { quoted: mek });
    } else {
      await conn.sendMessage(from, { video: buf, mimetype: 'video/mp4', caption }, { quoted: mek });
    }
  } catch (e) {
    reply(`Bilibili download failed: ${e.response?.data?.message || e.message}`);
  }
});
