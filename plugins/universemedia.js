const { cmd } = require('../redx');
const axios = require('axios');

const CLOUDINARY_IMAGE = 'https://res.cloudinary.com/di2a9lenz/image/upload/v1786909227/omegatech_ai_media/upload-1786909226872.jpg';
const NEWSLETTER_JID = '120363431455356251@newsletter';
const CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';
const BRAND = 'Powered by Progress Tech';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

let dlCache = {};

const AXIOS_JSON = {
  timeout: 45000,
  headers: { 'User-Agent': UA, Accept: 'application/json' },
  maxRedirects: 5,
  validateStatus: (s) => s >= 200 && s < 400
};

async function getJson(url, timeout = 45000) {
  const { data } = await axios.get(url, { ...AXIOS_JSON, timeout });
  return data;
}

function emptyResult(source) {
  return { title: '', author: '', source: source || 'Unknown', thumbnail: '', videos: [], audios: [], photos: [] };
}

function absUrl(u, base) {
  if (typeof u !== 'string') return '';
  const s = u.trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (base && s.startsWith('/')) return `${String(base).replace(/\/$/, '')}${s}`;
  return s;
}

function isHttp(u) {
  return typeof u === 'string' && /^https?:\/\//i.test(u) && u.length < 12000;
}

function looksVideo(u) {
  return isHttp(u) && /(\.mp4|\.mov|\.webm|\.m3u8|videoplayback|tiktokcdn|fbcdn|googlevideo|cdninstagram|snapchat|twimg)|\bvideo\b/i.test(u);
}

function looksAudio(u) {
  return isHttp(u) && /(\.mp3|\.m4a|\.aac)(\?|$)/i.test(u);
}

function looksImage(u) {
  return isHttp(u) && /(\.jpg|\.jpeg|\.png|\.webp)(\?|$)/i.test(u);
}

function pushUnique(list, item) {
  if (!item || !item.url || !isHttp(item.url)) return;
  if (list.some((x) => x.url === item.url)) return;
  list.push(item);
}

function detectSource(url) {
  const u = String(url || '').toLowerCase();
  if (/tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com/.test(u)) return 'TikTok';
  if (/facebook\.com|fb\.watch|fb\.com/.test(u)) return 'Facebook';
  if (/(?:twitter\.com|x\.com)\//.test(u)) return 'Twitter';
  if (/instagram\.com|instagr\.am/.test(u)) return 'Instagram';
  if (/snapchat\.com|snap\.com/.test(u)) return 'Snapchat';
  if (/youtube\.com|youtu\.be/.test(u)) return 'YouTube';
  if (/bilibili\./.test(u)) return 'Bilibili';
  return 'Media';
}

function extractUrl(text) {
  const m = String(text || '').replace(/&amp;/g, '&').match(/https?:\/\/[^\s<>"'`]+/i);
  return m ? m[0].replace(/[.,;!?)]+$/, '') : null;
}

async function prepareImage(conn, url) {
  try {
    const { prepareWAMessageMedia } = require('@whiskeysockets/baileys');
    const resp = await axios.get(url || CLOUDINARY_IMAGE, { responseType: 'arraybuffer', timeout: 20000, headers: { 'User-Agent': UA } });
    const media = await prepareWAMessageMedia({ image: Buffer.from(resp.data) }, { upload: conn.waUploadToServer });
    return media.imageMessage;
  } catch {
    return null;
  }
}

async function sendInteractiveMedia(conn, chatId, result, sender, prefix) {
  try {
    dlCache[sender] = { result, timestamp: Date.now() };
    const source = result.source || 'Unknown';
    const title = result.title || 'Untitled';
    const author = result.author || 'Unknown';
    const thumbnail = result.thumbnail || result.thumb || CLOUDINARY_IMAGE;
    const duration = result.duration || 'N/A';
    const imageMessage = await prepareImage(conn, thumbnail);
    const videos = result.videos || [];
    const audios = result.audios || [];
    const photos = result.photos || [];
    const buttons = [];

    if (videos.length > 0) {
      const videoRows = videos.slice(0, 10).map((v, idx) => ({
        id: `${prefix}dl video ${idx}`,
        title: `Video ${v.quality || idx + 1}`.slice(0, 24),
        description: `Quality: ${v.quality || 'HD'}`
      }));
      buttons.push({
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: 'Video',
          sections: [{ title: `Select Video (${videos.length})`, highlight_label: 'HD', rows: videoRows }]
        })
      });
    }
    if (audios.length > 0) {
      const audioRows = audios.slice(0, 10).map((a, idx) => ({
        id: `${prefix}dl audio ${idx}`,
        title: `Audio ${idx + 1}`,
        description: `Format: ${a.format || a.quality || 'mp3'}`
      }));
      buttons.push({
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: 'Audio',
          sections: [{ title: `Select Audio (${audios.length})`, highlight_label: 'MP3', rows: audioRows }]
        })
      });
    }
    if (photos.length > 0) {
      const photoRows = photos.slice(0, 10).map((p, idx) => ({
        id: `${prefix}dl photo ${idx}`,
        title: `Photo ${idx + 1}`,
        description: 'HD Quality'
      }));
      buttons.push({
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: 'Photos',
          sections: [{ title: `Select Photo (${photos.length})`, highlight_label: 'IMG', rows: photoRows }]
        })
      });
    }
    if ((videos.length > 0 && audios.length > 0) || (videos.length > 0 && photos.length > 0) || (audios.length > 0 && photos.length > 0)) {
      buttons.push({
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: 'Download All',
          sections: [{ title: 'All Media', highlight_label: 'ALL', rows: [{ id: `${prefix}dl all`, title: 'Download All', description: 'Get all media files' }] }]
        })
      });
    }
    buttons.push({
      name: 'cta_url',
      buttonParamsJson: JSON.stringify({ display_text: 'Follow TECH TOY', url: CHANNEL_LINK })
    });

    let bodyText = `*Media Found*\n━━━━━━━━━━━━━━━━━━━━━\n`;
    bodyText += `*Title:* ${title}\n`;
    bodyText += `*Author:* ${author}\n`;
    bodyText += `*Source:* ${source}\n`;
    bodyText += `*Duration:* ${duration}\n`;
    bodyText += `━━━━━━━━━━━━━━━━━━━━━\n`;
    bodyText += `*Available:*\n`;
    if (videos.length > 0) bodyText += ` ${videos.length} video(s)\n`;
    if (audios.length > 0) bodyText += ` ${audios.length} audio(s)\n`;
    if (photos.length > 0) bodyText += ` ${photos.length} photo(s)\n`;
    bodyText += `\nSelect an option below, or wait — best file is sending now.`;

    await conn.relayMessage(chatId, {
      interactiveMessage: {
        header: { title: `${source}`, hasMediaAttachment: !!imageMessage, ...(imageMessage ? { imageMessage } : {}) },
        body: { text: bodyText },
        footer: { text: `${BRAND} • TECH TOY` },
        nativeFlowMessage: { buttons }
      }
    }, {
      additionalNodes: [{ tag: 'biz', attrs: {}, content: [{ tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }] }] }]
    });
    return true;
  } catch (e) {
    console.error('Interactive media error:', e.message);
    return false;
  }
}

function refererFor(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('tikwm') || host.includes('tiktok')) return 'https://www.tikwm.com/';
    if (host.includes('facebook') || host.includes('fbcdn')) return 'https://www.facebook.com/';
    if (host.includes('instagram') || host.includes('cdninstagram')) return 'https://www.instagram.com/';
    if (host.includes('twitter') || host.includes('twimg') || host === 'x.com') return 'https://x.com/';
    if (host.includes('youtube') || host.includes('googlevideo')) return 'https://www.youtube.com/';
    return `https://${host}/`;
  } catch {
    return 'https://www.google.com/';
  }
}

async function fetchBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 180000,
    maxRedirects: 5,
    maxContentLength: 80 * 1024 * 1024,
    headers: {
      'User-Agent': UA,
      Referer: refererFor(url),
      Accept: '*/*'
    }
  });
  return Buffer.from(res.data);
}

async function sendMediaFile(conn, chatId, url, type, title, author, source) {
  try {
    const caption = `*${title || 'Download'}*\n*${author || ''}*\n*${source || ''}*\n*${BRAND}*\n${CHANNEL_LINK}`;
    const contextInfo = {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: NEWSLETTER_JID,
        serverMessageId: 142,
        newsletterName: 'TECH TOY'
      }
    };
    try {
      if (type === 'video') {
        await conn.sendMessage(chatId, { video: { url }, mimetype: 'video/mp4', caption, contextInfo });
      } else if (type === 'audio') {
        await conn.sendMessage(chatId, { audio: { url }, mimetype: 'audio/mpeg', ptt: false, fileName: `${title || 'audio'}.mp3`, contextInfo });
      } else {
        await conn.sendMessage(chatId, { image: { url }, caption, contextInfo });
      }
      return true;
    } catch (_) {
      const buf = await fetchBuffer(url);
      if (type === 'video') {
        await conn.sendMessage(chatId, { video: buf, mimetype: 'video/mp4', caption, contextInfo });
      } else if (type === 'audio') {
        await conn.sendMessage(chatId, { audio: buf, mimetype: 'audio/mpeg', ptt: false, fileName: `${title || 'audio'}.mp3`, contextInfo });
      } else {
        await conn.sendMessage(chatId, { image: buf, caption, contextInfo });
      }
      return true;
    }
  } catch (e) {
    console.error('sendMediaFile', e.message);
    return false;
  }
}

function fromTikwm(data, source) {
  const d = data?.data || data;
  if (!d || (data?.code !== 0 && data?.code !== undefined && !d.play && !d.hdplay)) return null;
  const base = 'https://www.tikwm.com';
  const r = emptyResult(source || 'TikTok');
  r.title = d.title || d.desc || r.title;
  r.author = d.author?.nickname || d.author?.unique_id || d.author || '';
  r.thumbnail = absUrl(d.cover || d.origin_cover || d.ai_dynamic_cover || '', base);
  r.duration = d.duration ? `${d.duration}s` : '';
  const hd = absUrl(d.hdplay || d.play, base);
  const sd = absUrl(d.play, base);
  pushUnique(r.videos, { url: hd, quality: d.hdplay ? 'HD' : 'SD' });
  if (sd && hd && sd !== hd) pushUnique(r.videos, { url: sd, quality: 'SD' });
  pushUnique(r.videos, { url: absUrl(d.wmplay, base), quality: 'Watermark' });
  pushUnique(r.audios, { url: absUrl(d.music, base), format: 'mp3' });
  if (!r.videos.length && !r.audios.length) return null;
  return r;
}

function fromSiputzxFb(data, source) {
  const d = data?.data || data;
  if (!d) return null;
  const r = emptyResult(source || 'Facebook');
  r.title = d.title || 'Facebook Video';
  r.thumbnail = d.thumbnail || '';
  r.duration = d.duration || '';
  const list = d.downloads || d.media || [];
  if (Array.isArray(list)) {
    for (const item of list) {
      const url = item.url || item.link;
      const type = String(item.type || '').toLowerCase();
      if (type === 'audio' || looksAudio(url)) pushUnique(r.audios, { url, format: 'mp3', quality: item.quality });
      else if (type === 'image' || looksImage(url)) pushUnique(r.photos, { url });
      else pushUnique(r.videos, { url, quality: item.quality || 'HD' });
    }
  }
  pushUnique(r.videos, { url: d.hd || d.sd || d.url || d.video, quality: d.hd ? 'HD' : 'SD' });
  if (!r.videos.length && !r.audios.length && !r.photos.length) return null;
  return r;
}

function fromOmegaX(data) {
  const d = data?.data || data;
  if (!d) return null;
  const r = emptyResult('Twitter');
  r.title = String(d.text || 'X post').slice(0, 80);
  r.author = d.user?.name || d.author || '';
  if (Array.isArray(d.media)) {
    for (const item of d.media) {
      r.thumbnail = r.thumbnail || item.thumbnail_url || '';
      let mediaUrl = item.best_url || item.url || item.download_url || null;
      if (!mediaUrl && Array.isArray(item.variants)) {
        const withUrl = item.variants.filter((v) => v && v.url);
        if (withUrl.length) mediaUrl = withUrl[withUrl.length - 1].url;
      }
      if (!mediaUrl && Array.isArray(item.playlist)) {
        const playable = item.playlist.find((p) => p && (p.url || p.src));
        if (playable) mediaUrl = playable.url || playable.src;
      }
      const kind = String(item.type || d.media_type || '').toLowerCase();
      if (kind === 'photo' || looksImage(mediaUrl)) pushUnique(r.photos, { url: mediaUrl });
      else if (kind === 'video' || looksVideo(mediaUrl)) pushUnique(r.videos, { url: mediaUrl, quality: 'HD' });
      else if (mediaUrl) pushUnique(r.photos, { url: mediaUrl });
    }
  }
  pushUnique(r.videos, { url: d.video || d.videoUrl || d.hd || d.sd || d.download_url, quality: 'HD' });
  if (!r.videos.length && !r.photos.length) return null;
  return r;
}

function fromOmegaYt(data, source) {
  const d = data?.data || data;
  if (!d || (!d.url && !d.mp4 && !d.mp3 && !d.videos)) return null;
  const r = emptyResult(source || 'YouTube');
  r.title = d.title || r.title;
  r.thumbnail = d.thumbnail || d.thumb || '';
  r.author = d.author || d.channel || '';
  if (Array.isArray(d.mp4)) d.mp4.forEach((x) => pushUnique(r.videos, { url: x.url, quality: x.quality || 'MP4' }));
  if (Array.isArray(d.mp3)) d.mp3.forEach((x) => pushUnique(r.audios, { url: x.url, format: x.format || 'mp3', quality: x.quality }));
  if (Array.isArray(d.videos)) d.videos.forEach((x) => pushUnique(r.videos, { url: x.url || x, quality: x.quality || 'HD' }));
  if (Array.isArray(d.audios)) d.audios.forEach((x) => pushUnique(r.audios, { url: x.url || x, format: 'mp3' }));
  if (Array.isArray(d.photos)) d.photos.forEach((x) => pushUnique(r.photos, { url: x.url || x }));
  const type = String(d.type || '').toLowerCase();
  if (d.url) {
    if (type === 'mp3' || looksAudio(d.url)) pushUnique(r.audios, { url: d.url, format: 'mp3' });
    else if (type === 'image' || looksImage(d.url)) pushUnique(r.photos, { url: d.url });
    else pushUnique(r.videos, { url: d.url, quality: d.quality || 'HD' });
  }
  if (!r.videos.length && !r.audios.length && !r.photos.length) return null;
  return r;
}

function fromArslanYt(data, want) {
  const dl = data?.result?.download;
  const meta = data?.result?.metadata || {};
  if (!dl?.url) return null;
  const r = emptyResult('YouTube');
  r.title = meta.title || 'YouTube';
  r.thumbnail = meta.thumbnail || '';
  if (want === 'audio' || /mp3|audio/i.test(meta.type || dl.quality || '')) {
    pushUnique(r.audios, { url: dl.url, format: 'mp3', quality: dl.quality });
  } else {
    pushUnique(r.videos, { url: dl.url, quality: dl.quality || meta.quality || 'MP4' });
  }
  return r;
}

function fromIgList(data) {
  const list = data?.data || data?.result || data?.BK9 || [];
  const arr = Array.isArray(list) ? list : [];
  if (!arr.length) return null;
  const r = emptyResult('Instagram');
  r.title = data?.metadata?.caption ? String(data.metadata.caption).slice(0, 80) : 'Instagram';
  r.author = data?.metadata?.author || '';
  for (const item of arr) {
    const url = typeof item === 'string' ? item : (item.url || item.link);
    const type = String(item.type || '').toLowerCase();
    if (type === 'image' || looksImage(url)) pushUnique(r.photos, { url });
    else pushUnique(r.videos, { url, quality: 'HD' });
  }
  if (!r.videos.length && !r.photos.length) return null;
  return r;
}

function fromAllDownloader(data) {
  const d = data?.data || data;
  if (!d) return null;
  const r = emptyResult(d.source || 'Media');
  r.title = d.title || '';
  r.author = d.author || '';
  r.thumbnail = d.thumbnail || d.thumb || '';
  r.duration = d.duration || '';
  (d.videos || []).forEach((v) => pushUnique(r.videos, { url: v.url || v, quality: v.quality || 'HD' }));
  (d.audios || []).forEach((a) => pushUnique(r.audios, { url: a.url || a, format: a.format || 'mp3' }));
  (d.photos || []).forEach((p) => pushUnique(r.photos, { url: p.url || p }));
  if (!r.videos.length && !r.audios.length && !r.photos.length) return null;
  return r;
}

function mergeResults(base, extra) {
  if (!extra) return base;
  base.title = base.title || extra.title;
  base.author = base.author || extra.author;
  base.thumbnail = base.thumbnail || extra.thumbnail;
  base.duration = base.duration || extra.duration;
  base.source = base.source && base.source !== 'Unknown' ? base.source : extra.source;
  (extra.videos || []).forEach((v) => pushUnique(base.videos, v));
  (extra.audios || []).forEach((a) => pushUnique(base.audios, a));
  (extra.photos || []).forEach((p) => pushUnique(base.photos, p));
  return base;
}

async function tryOne(fn) {
  try {
    return await fn();
  } catch (e) {
    return null;
  }
}

async function fetchMedia(url) {
  const source = detectSource(url);
  const result = emptyResult(source);
  const enc = encodeURIComponent(url);

  const tasks = [];

  if (source === 'TikTok') {
    tasks.push(() => getJson(`https://tikwm.com/api/?url=${enc}&hd=1`).then(fromTikwm));
    tasks.push(() => getJson(`https://www.tikwm.com/api/?url=${enc}&hd=1`).then(fromTikwm));
  }
  if (source === 'Facebook') {
    tasks.push(() => getJson(`https://api.siputzx.my.id/api/d/facebook?url=${enc}`).then((d) => fromSiputzxFb(d, 'Facebook')));
    tasks.push(async () => {
      const data = await getJson(`https://movanest.xyz/v2/fbdown?url=${enc}`, 30000);
      if (data?.status && Array.isArray(data.results) && data.results[0]) {
        const item = data.results[0];
        const r = emptyResult('Facebook');
        r.duration = item.duration || '';
        pushUnique(r.videos, { url: item.hdQualityLink, quality: 'HD' });
        pushUnique(r.videos, { url: item.normalQualityLink, quality: 'SD' });
        return r.videos.length ? r : null;
      }
      return null;
    });
    tasks.push(async () => {
      const data = await getJson(`https://api.omegatech.app/api/download/Facebook?action=download&url=${enc}&quality=hd`);
      const d = data?.data || data;
      const r = emptyResult('Facebook');
      r.title = d.title || 'Facebook Video';
      pushUnique(r.videos, { url: d.hd, quality: 'HD' });
      pushUnique(r.videos, { url: d.sd, quality: 'SD' });
      pushUnique(r.videos, { url: d.url || d.video || d.downloadUrl || d.media, quality: 'HD' });
      return r.videos.length ? r : null;
    });
  }
  if (source === 'Twitter') {
    tasks.push(() => getJson(`https://api.omegatech.app/api/download/X?action=download&url=${enc}`, 90000).then(fromOmegaX));
  }
  if (source === 'Instagram') {
    tasks.push(() => getJson(`https://api-aswin-sparky.koyeb.app/api/downloader/igdl?url=${enc}`).then(fromIgList));
    tasks.push(() => getJson(`https://rest-lily.vercel.app/api/downloader/igdl?url=${enc}`).then(fromIgList));
    tasks.push(() => getJson(`https://jawad-tech.vercel.app/downloader?url=${enc}`).then(fromIgList));
    tasks.push(() => getJson(`https://bk9.fun/download/instagram?url=${enc}`).then(fromIgList));
  }
  if (source === 'YouTube') {
    tasks.push(() => getJson(`https://api.omegatech.app/api/download/youtube?action=download&url=${enc}`, 60000).then((d) => fromOmegaYt(d, 'YouTube')));
    tasks.push(() => getJson(`https://arslan-apis-v2.vercel.app/download/ytmp4?url=${enc}`, 60000).then((d) => fromArslanYt(d, 'video')));
    tasks.push(() => getJson(`https://arslan-apis-v2.vercel.app/download/ytmp3?url=${enc}`, 60000).then((d) => fromArslanYt(d, 'audio')));
    tasks.push(async () => {
      const data = await getJson(`https://gtech-api-xtp1.onrender.com/api/video/yt?apikey=APIKEY&url=${enc}`, 60000);
      const media = data?.result?.media;
      if (!media) return null;
      const r = emptyResult('YouTube');
      r.title = media.title || 'YouTube';
      r.thumbnail = media.thumbnail || '';
      const hd = media.video_url_hd || media.video_url || media.url || media.hd;
      const sd = media.video_url_sd || media.sd;
      if (hd && !/No HD|No video/i.test(hd)) pushUnique(r.videos, { url: hd, quality: 'HD' });
      if (sd && !/No /i.test(sd)) pushUnique(r.videos, { url: sd, quality: 'SD' });
      return r.videos.length ? r : null;
    });
  }

  tasks.push(() => getJson(`https://api.omegatech.app/api/download/All-downloader-v2?action=download&url=${enc}`, 60000).then(fromAllDownloader));
  tasks.push(() => getJson(`https://api.omegatech.app/api/download/youtube?action=download&url=${enc}`, 60000).then((d) => fromOmegaYt(d, source)));
  tasks.push(() => getJson(`https://tikwm.com/api/?url=${enc}&hd=1`).then((d) => fromTikwm(d, source)));
  tasks.push(() => getJson(`https://api.siputzx.my.id/api/d/facebook?url=${enc}`).then((d) => fromSiputzxFb(d, source)));
  tasks.push(() => getJson(`https://api.omegatech.app/api/download/X?action=download&url=${enc}`, 90000).then(fromOmegaX));

  for (const task of tasks) {
    const got = await tryOne(task);
    if (got) mergeResults(result, got);
    if (result.videos.length || result.audios.length || result.photos.length) {
      if (source === 'TikTok' || source === 'Facebook' || source === 'Twitter' || source === 'YouTube' || source === 'Instagram') break;
      if (result.videos.length) break;
    }
  }

  if (!result.videos.length && !result.audios.length && !result.photos.length) {
    throw new Error('No downloadable media found. Use a public link and try again.');
  }
  result.source = result.source || source;
  return result;
}

cmd({
  pattern: 'dl',
  alias: ['download', 'downloader', 'tt', 'tw', 'sn', 'bl', 'bilibili', 'tiktok', 'twitter', 'snapchat', 'media', 'getvideo'],
  react: '📥',
  desc: 'Download videos, audios, and images from TikTok, Facebook, Twitter, YouTube, Snapchat, Instagram and more',
  category: 'downloader',
  use: '.dl <url>',
  filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix }) => {
  try {
    const quotedText = m.quoted?.text || '';
    const input = (q || quotedText || '').trim();
    const pre = prefix || '.';

    if (!input) {
      return reply(
        `*UNIVERSAL MEDIA DOWNLOADER*\n\n` +
        `Send a public video/audio link.\n\n` +
        `*Usage:* ${pre}dl <url>\nAlso: ${pre}tiktok ${pre}fb ${pre}twitter ${pre}snapchat ${pre}song\n\n` +
        `*Supported:* TikTok, Facebook, Twitter/X, YouTube, Snapchat, Instagram, Bilibili, music links.\n\n` +
        `${BRAND}\n${CHANNEL_LINK}`
      );
    }

    const parts = input.split(/\s+/);
    const subCommand = (parts[0] || '').toLowerCase();
    const cacheData = dlCache[m.sender];

    if (subCommand === 'video' && parts[1] !== undefined) {
      const idx = parseInt(parts[1], 10);
      if (!cacheData?.result) return reply('No media found. Send a link first.');
      const videos = cacheData.result.videos || [];
      if (idx >= videos.length || idx < 0) return reply('Invalid video selection.');
      const ok = await sendMediaFile(conn, from, videos[idx].url, 'video', cacheData.result.title, cacheData.result.author, cacheData.result.source);
      if (!ok) return reply('Failed to send that video. Try another quality.');
      return;
    }
    if (subCommand === 'audio' && parts[1] !== undefined) {
      const idx = parseInt(parts[1], 10);
      if (!cacheData?.result) return reply('No media found. Send a link first.');
      const audios = cacheData.result.audios || [];
      if (idx >= audios.length || idx < 0) return reply('Invalid audio selection.');
      const ok = await sendMediaFile(conn, from, audios[idx].url, 'audio', cacheData.result.title, cacheData.result.author, cacheData.result.source);
      if (!ok) return reply('Failed to send that audio.');
      return;
    }
    if (subCommand === 'photo' && parts[1] !== undefined) {
      const idx = parseInt(parts[1], 10);
      if (!cacheData?.result) return reply('No media found. Send a link first.');
      const photos = cacheData.result.photos || [];
      if (idx >= photos.length || idx < 0) return reply('Invalid photo selection.');
      const photoUrl = photos[idx].url || photos[idx];
      const ok = await sendMediaFile(conn, from, photoUrl, 'photo', cacheData.result.title, cacheData.result.author, cacheData.result.source);
      if (!ok) return reply('Failed to send that photo.');
      return;
    }
    if (subCommand === 'all') {
      if (!cacheData?.result) return reply('No media found. Send a link first.');
      const result = cacheData.result;
      let sent = 0;
      for (const v of (result.videos || [])) if (await sendMediaFile(conn, from, v.url, 'video', result.title, result.author, result.source)) sent++;
      for (const a of (result.audios || [])) if (await sendMediaFile(conn, from, a.url, 'audio', result.title, result.author, result.source)) sent++;
      for (const p of (result.photos || [])) if (await sendMediaFile(conn, from, p.url || p, 'photo', result.title, result.author, result.source)) sent++;
      if (sent === 0) return reply('Failed to send any media.');
      return reply(`Sent ${sent} media file(s).`);
    }

    const url = extractUrl(input);
    if (!url) return reply('Invalid URL. Send a full https link from TikTok, Facebook, Twitter, YouTube, Snapchat or Instagram.');

    await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
    await reply(`Fetching media from ${detectSource(url)}...`);

    const result = await fetchMedia(url);
    dlCache[m.sender] = { result, timestamp: Date.now() };

    const bestVideo = result.videos[0];
    const bestAudio = result.audios[0];
    const firstPhoto = result.photos[0];

    if (bestVideo) {
      const ok = await sendMediaFile(conn, from, bestVideo.url, 'video', result.title, result.author, result.source);
      if (!ok && bestAudio) await sendMediaFile(conn, from, bestAudio.url, 'audio', result.title, result.author, result.source);
      if (!ok && !bestAudio) throw new Error('Could not send the video file.');
    } else if (bestAudio) {
      const ok = await sendMediaFile(conn, from, bestAudio.url, 'audio', result.title, result.author, result.source);
      if (!ok) throw new Error('Could not send the audio file.');
    } else if (firstPhoto) {
      for (const p of result.photos.slice(0, 6)) {
        await sendMediaFile(conn, from, p.url || p, 'photo', result.title, result.author, result.source);
      }
    }

    if ((result.videos.length + result.audios.length + result.photos.length) > 1) {
      await sendInteractiveMedia(conn, from, result, m.sender, pre);
    }

    await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
  } catch (e) {
    console.error('Download error:', e);
    await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
    reply(`Download failed: ${e.message || 'Unknown error'}\nUse a public link and try again.`);
  }
});
