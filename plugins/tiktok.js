const { cmd } = require('../redx');
const axios = require('axios');
const { sendInteractive, quick, select } = require('../lib/buttons');
const { scrapeTikSnap } = require('../lib/tiksnap');
const { scrapeTikTokId } = require('../lib/tiktokid');
const { AllMediaDL } = require('../lib/allmediadl');

const BRAND = 'Powered by Progress Tech';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const cache = new Map();

function extractUrl(text) {
  const m = String(text || '').replace(/&amp;/g, '&').match(/https?:\/\/[^\s<>"'`]+/i);
  return m ? m[0].replace(/[.,;!?)]+$/, '') : '';
}

function fmt(n) {
  const v = Number(n) || 0;
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
}

function keyOf(sender) {
  return String(sender || 'unknown');
}

async function fetchBuffer(url, referer) {
  const { data } = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 180000,
    maxRedirects: 5,
    maxContentLength: 80 * 1024 * 1024,
    headers: { 'User-Agent': UA, Referer: referer || 'https://www.tiktok.com/', Accept: '*/*' }
  });
  return Buffer.from(data);
}

async function sendByUrl(conn, from, mek, url, type, caption, fileName) {
  try {
    if (type === 'video') {
      await conn.sendMessage(from, { video: { url }, mimetype: 'video/mp4', caption }, { quoted: mek });
      return true;
    }
    if (type === 'audio') {
      await conn.sendMessage(from, { audio: { url }, mimetype: 'audio/mpeg', ptt: false, fileName: fileName || 'tiktok.mp3' }, { quoted: mek });
      return true;
    }
    if (type === 'file') {
      await conn.sendMessage(from, { document: { url }, mimetype: 'video/mp4', fileName: fileName || 'tiktok.mp4', caption }, { quoted: mek });
      return true;
    }
    await conn.sendMessage(from, { image: { url }, caption }, { quoted: mek });
    return true;
  } catch (_) {
    const buf = await fetchBuffer(url);
    if (type === 'video') {
      await conn.sendMessage(from, { video: buf, mimetype: 'video/mp4', caption }, { quoted: mek });
      return true;
    }
    if (type === 'audio') {
      await conn.sendMessage(from, { audio: buf, mimetype: 'audio/mpeg', ptt: false, fileName: fileName || 'tiktok.mp3' }, { quoted: mek });
      return true;
    }
    if (type === 'file') {
      await conn.sendMessage(from, { document: buf, mimetype: 'video/mp4', fileName: fileName || 'tiktok.mp4', caption }, { quoted: mek });
      return true;
    }
    await conn.sendMessage(from, { image: buf, caption }, { quoted: mek });
    return true;
  }
}

async function resolveTikTok(url) {
  const errors = [];
  try {
    const info = await scrapeTikSnap(url);
    const videos = [];
    if (info.downloads.originalHd?.url) videos.push({ id: 'hd', label: 'HD Video', url: info.downloads.originalHd.url, filename: info.downloads.originalHd.filename });
    if (info.downloads.videoNoWm?.url) videos.push({ id: 'nowm', label: 'No Watermark', url: info.downloads.videoNoWm.url, filename: info.downloads.videoNoWm.filename });
    const audio = info.downloads.audio?.url ? { url: info.downloads.audio.url, filename: info.downloads.audio.filename } : null;
    const images = (info.downloads.images || []).filter((x) => x.url);
    if (videos.length || audio || images.length) {
      return {
        title: info.description || 'TikTok',
        author: info.author?.nickname || info.author?.uniqueId || 'TikTok',
        cover: info.cover,
        duration: info.duration || 0,
        stats: info.stats || {},
        videos,
        audio,
        images,
        source: 'TikSnap'
      };
    }
  } catch (e) {
    errors.push(e.message);
  }

  try {
    const info = await scrapeTikTokId(url);
    const videos = [];
    if (info.downloads.noWatermark?.url) videos.push({ id: 'nowm', label: 'No Watermark', url: info.downloads.noWatermark.url, filename: info.downloads.noWatermark.filename });
    if (info.downloads.watermark?.url) videos.push({ id: 'wm', label: 'Watermark', url: info.downloads.watermark.url, filename: info.downloads.watermark.filename });
    const audio = info.downloads.audio?.url ? { url: info.downloads.audio.url, filename: info.downloads.audio.filename } : null;
    if (videos.length || audio) {
      return {
        title: info.title || 'TikTok',
        author: info.author || 'TikTok',
        cover: info.cover,
        duration: info.duration || 0,
        stats: {},
        videos,
        audio,
        images: [],
        source: 'TikTokID'
      };
    }
  } catch (e) {
    errors.push(e.message);
  }

  try {
    const client = new AllMediaDL({ timeoutMs: 40000 });
    const info = await client.scrape(url, { format: 'video' });
    if (info?.downloadUrl) {
      return {
        title: info.title || 'TikTok',
        author: info.uploader || 'TikTok',
        cover: info.thumbnailUrl,
        duration: info.durationSeconds || 0,
        stats: {},
        videos: [{ id: 'hd', label: 'HD Video', url: info.downloadUrl, filename: info.filename || 'tiktok.mp4' }],
        audio: null,
        images: [],
        source: 'AllMediaDL'
      };
    }
  } catch (e) {
    errors.push(e.message);
  }

  throw new Error(errors[0] || 'Could not download that TikTok. Use a public link.');
}

function statsText(item) {
  const s = item.stats || {};
  const lines = [
    `*${item.title || 'TikTok'}*`,
    `Author: ${item.author || 'Unknown'}`,
    item.duration ? `Duration: ${item.duration}s` : '',
    `Views: ${fmt(s.plays)}`,
    `Likes: ${fmt(s.likes)}`,
    `Comments: ${fmt(s.comments)}`,
    s.shares ? `Shares: ${fmt(s.shares)}` : '',
    `Source: ${item.source || 'TikTok'}`
  ].filter(Boolean);
  return lines.join('\n');
}

cmd({
  pattern: 'tiktok',
  alias: ['tt', 'tiktokdl', 'ttdl', 'tiksnap'],
  react: '🎵',
  desc: 'Download TikTok video, audio, or slideshow',
  category: 'download',
  use: '.tiktok <url>',
  filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix, sender }) => {
  try {
    const pre = prefix || '.';
    const quotedText = m.quoted?.text || '';
    const raw = String(q || quotedText || '').trim();
    const first = raw.split(/\s+/)[0]?.toLowerCase() || '';
    const rest = raw.split(/\s+/).slice(1).join(' ');

    if (first === 'get' || first === 'video' || first === 'file' || first === 'audio' || first === 'photo') {
      const pack = cache.get(keyOf(sender));
      if (!pack) return reply(`No TikTok loaded. Send ${pre}tiktok <url> first.`);
      const mode = first === 'get' ? (rest.split(/\s+/)[0] || 'video') : first;
      const idx = parseInt(first === 'get' ? rest.split(/\s+/)[1] : rest, 10);
      await reply(mode === 'audio' ? 'Downloading audio...' : mode === 'photo' ? 'Sending photo...' : 'Downloading video...');
      const caption = `${statsText(pack)}\n\n${BRAND}`;
      if (mode === 'audio') {
        if (!pack.audio?.url) return reply('No audio stream for that TikTok.');
        await sendByUrl(conn, from, mek, pack.audio.url, 'audio', caption, pack.audio.filename);
        return reply('Audio sent.');
      }
      if (mode === 'photo') {
        const img = pack.images[idx] || pack.images[0];
        if (!img?.url) return reply('No slideshow images for that TikTok.');
        await sendByUrl(conn, from, mek, img.url, 'image', caption);
        return reply('Photo sent.');
      }
      const video = pack.videos[Number.isFinite(idx) ? idx : 0] || pack.videos[0];
      if (!video?.url) return reply('No video stream for that TikTok.');
      const type = mode === 'file' ? 'file' : 'video';
      try {
        await sendByUrl(conn, from, mek, video.url, type, caption, video.filename);
      } catch (e) {
        if (type === 'video') {
          await sendByUrl(conn, from, mek, video.url, 'file', caption, video.filename);
        } else {
          throw e;
        }
      }
      return reply(type === 'file' ? 'File sent.' : 'Video sent.');
    }

    const url = extractUrl(raw);
    if (!url) {
      return reply(`*TikTok Downloader*\n\nSend a public TikTok link.\nExample: ${pre}tiktok https://www.tiktok.com/@user/video/123\n\n${BRAND}`);
    }

    await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
    await reply('Fetching TikTok...');
    const item = await resolveTikTok(url);
    cache.set(keyOf(sender), item);

    const body = `${statsText(item)}\n\nTap a button to download.`;
    const rows = item.videos.slice(0, 10).map((v, i) => ({
      id: `${pre}tiktok video ${i}`,
      title: v.label.slice(0, 24),
      description: 'Send as video'
    }));
    if (item.audio?.url) {
      rows.push({ id: `${pre}tiktok audio`, title: 'Audio MP3', description: 'Send sound only' });
    }
    item.images.slice(0, 8).forEach((img, i) => {
      rows.push({ id: `${pre}tiktok photo ${i}`, title: `Slide ${i + 1}`, description: 'Send image' });
    });
    const buttons = [];
    if (rows.length) buttons.push(select('Download', 'TikTok', rows, 'HD'));
    if (item.videos[0]) {
      buttons.push(quick('Send Video', `${pre}tiktok video 0`));
      buttons.push(quick('Send File', `${pre}tiktok file 0`));
    } else if (item.audio?.url) {
      buttons.push(quick('Send Audio', `${pre}tiktok audio`));
    }

    try {
      await sendInteractive(conn, from, {
        title: 'TikTok',
        body,
        footer: BRAND,
        buttons
      });
    } catch (_) {
      await reply(`${body}\n\n${pre}tiktok video 0\n${pre}tiktok file 0`);
    }
  } catch (e) {
    console.error('[tiktok]', e.message);
    reply(`TikTok error: ${e.message}`);
  }
});
