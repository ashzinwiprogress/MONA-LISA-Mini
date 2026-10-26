const { cmd } = require('../redx');
const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function extractUrl(text) {
  const m = String(text || '').match(/https?:\/\/[^\s<>"'`]+/i);
  return m ? m[0].replace(/[.,;!?)]+$/, '') : null;
}

function pickUrl(...vals) {
  for (const v of vals) {
    if (typeof v === 'string' && /^https?:\/\//i.test(v)) return v;
  }
  return null;
}

async function sendVideo(conn, from, mek, videoUrl, caption) {
  try {
    await conn.sendMessage(from, { video: { url: videoUrl }, mimetype: 'video/mp4', caption }, { quoted: mek });
    return true;
  } catch (_) {
    const res = await axios.get(videoUrl, {
      responseType: 'arraybuffer',
      timeout: 180000,
      maxRedirects: 5,
      headers: { 'User-Agent': UA, Accept: '*/*' }
    });
    await conn.sendMessage(from, { video: Buffer.from(res.data), mimetype: 'video/mp4', caption }, { quoted: mek });
    return true;
  }
}

cmd({
  pattern: 'fb',
  react: '☺️',
  alias: ['facebook', 'fbdl', 'fbvideo'],
  desc: 'Download Facebook videos from a public link',
  category: 'download',
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    const url = extractUrl(q || m.quoted?.text || '');
    if (!url) {
      return reply('Send a public Facebook video link.\nExample: .fb https://www.facebook.com/watch/?v=123');
    }

    await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

    let videoUrl = null;
    let duration = '';
    let title = 'Facebook Video';

    const tries = [
      async () => {
        const { data } = await axios.get(`https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(url)}`, {
          timeout: 45000,
          headers: { 'User-Agent': UA, Accept: 'application/json' }
        });
        const d = data?.data || data;
        const list = d?.downloads || [];
        const hd = list.find((x) => /hd|720|1080/i.test(x.quality || '')) || list[0];
        videoUrl = pickUrl(hd?.url, d?.hd, d?.sd, d?.url);
        duration = d?.duration || duration;
        title = d?.title || title;
      },
      async () => {
        const { data } = await axios.get(`https://movanest.xyz/v2/fbdown?url=${encodeURIComponent(url)}`, { timeout: 30000 });
        if (data?.status && Array.isArray(data.results) && data.results[0]) {
          const result = data.results[0];
          videoUrl = pickUrl(result.hdQualityLink, result.normalQualityLink);
          duration = result.duration || duration;
        }
      },
      async () => {
        const { data } = await axios.get(
          `https://api.omegatech.app/api/download/Facebook?action=download&url=${encodeURIComponent(url)}&quality=hd`,
          { timeout: 45000, headers: { Accept: 'application/json', 'User-Agent': UA } }
        );
        const d = data.data || data;
        videoUrl = pickUrl(d.hd, d.sd, d.url, d.video, d.downloadUrl, d.media);
        duration = d.duration || duration;
        title = d.title || title;
      },
      async () => {
        const { data } = await axios.get(
          `https://api.omegatech.app/api/download/youtube?action=download&url=${encodeURIComponent(url)}`,
          { timeout: 60000, headers: { Accept: 'application/json', 'User-Agent': UA } }
        );
        const d = data.data || data;
        videoUrl = pickUrl(d.url, d.hd, d.sd, d.video);
        title = d.title || title;
      }
    ];

    for (const fn of tries) {
      if (videoUrl) break;
      try { await fn(); } catch (_) {}
    }

    if (!videoUrl) return reply('Facebook video not found. Use a public video/reel link.');

    const caption = `*${title}*\nTime: ${duration || 'N/A'}\nPowered by Progress Tech`;
    await sendVideo(conn, from, mek, videoUrl, caption);
    await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
  } catch (err) {
    console.log(err);
    reply('Facebook download failed. Send a public video link and try again.');
  }
});
