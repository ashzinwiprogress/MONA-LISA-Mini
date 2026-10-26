const { cmd } = require('../redx');
const yts = require('yt-search');
const axios = require('axios');
const { fakevCard } = require('../lib/fakevCard');

async function resolveYt(query) {
  if (/youtube\.com|youtu\.be/i.test(query)) {
    const url = query.match(/https?:\/\/\S+/i)[0];
    return { url, title: 'YouTube', thumbnail: '' };
  }
  const search = await yts(query);
  if (!search.videos || !search.videos.length) throw new Error('No result found');
  return search.videos[0];
}

async function getMp3(url) {
  const tries = [
    async () => {
      const { data } = await axios.get(`https://arslan-apis-v2.vercel.app/download/ytmp3?url=${encodeURIComponent(url)}`, { timeout: 60000 });
      if (data?.status && data?.result?.download?.url) {
        return {
          url: data.result.download.url,
          title: data.result.metadata?.title,
          quality: data.result.download.quality || '128kbps'
        };
      }
      return null;
    },
    async () => {
      const { data } = await axios.get(`https://api.omegatech.app/api/download/youtube?action=download&url=${encodeURIComponent(url)}`, { timeout: 60000 });
      const d = data?.data || data;
      if (d?.url) return { url: d.url, title: d.title, quality: d.quality || 'audio' };
      return null;
    },
    async () => {
      const { data } = await axios.get(`https://arslan-apis-v2.vercel.app/download/ytmp4?url=${encodeURIComponent(url)}`, { timeout: 60000 });
      if (data?.status && data?.result?.download?.url) {
        return {
          url: data.result.download.url,
          title: data.result.metadata?.title,
          quality: data.result.download.quality || '128kbps'
        };
      }
      return null;
    }
  ];
  for (const fn of tries) {
    try {
      const got = await fn();
      if (got?.url) return got;
    } catch (_) {}
  }
  throw new Error('Audio not generated');
}

cmd({
  pattern: 'song',
  alias: ['mp3', 'gana', 'music', 'audio'],
  react: '🎵',
  desc: 'YouTube search & MP3 play',
  category: 'download',
  use: '.song ',
  filename: __filename
}, async (conn, mek, m, { from, args, reply, q }) => {
  try {
    const query = (args && args.length ? args.join(' ') : q || '').trim();
    if (!query) return reply('Provide a song name or YouTube link.');

    await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });
    const video = await resolveYt(query);
    const got = await getMp3(video.url);
    const title = got.title || video.title || 'song';

    await conn.sendMessage(from, {
      audio: { url: got.url },
      mimetype: 'audio/mpeg',
      ptt: false,
      fileName: `${title}.mp3`,
      caption: `*${title}*\nQuality: ${got.quality || '128kbps'}\n\n> MONA LISA`,
      contextInfo: {
        externalAdReply: {
          title: String(title).substring(0, 40),
          body: 'Progress Tech Beats',
          thumbnailUrl: video.thumbnail,
          sourceUrl: video.url,
          mediaType: 1,
          renderLargerThumbnail: true
        }
      }
    }, { quoted: fakevCard });

    await conn.sendMessage(from, { react: { text: '✅', key: m.key } });
  } catch (err) {
    console.error('PLAY ERROR:', err);
    reply(err.message || 'Error found, please try later');
    await conn.sendMessage(from, { react: { text: '❌', key: m.key } }).catch(() => {});
  }
});

cmd({
  pattern: 'video1',
  alias: ['ytv1'],
  desc: 'Download YouTube Video',
  category: 'downloader',
  react: '🪄',
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply('Provide a YouTube link or search query.\nExample: .video Pasoori');
    let url;
    if (/youtube\.com|youtu\.be/i.test(q)) {
      url = q.match(/https?:\/\/\S+/i)[0];
    } else {
      const search = await yts(q);
      if (!search?.videos?.length) return reply('No results found.');
      url = search.videos[0].url;
    }
    let videoUrl = null;
    try {
      const { data } = await axios.get(`https://api.omegatech.app/api/download/youtube?action=download&url=${encodeURIComponent(url)}`, { timeout: 60000 });
      videoUrl = data?.data?.url || null;
    } catch (_) {}
    if (!videoUrl) {
      const res = await axios.get('https://gtech-api-xtp1.onrender.com/api/video/yt?apikey=APIKEY&url=' + encodeURIComponent(url), { timeout: 60000 });
      const media = res.data?.result?.media || {};
      const hd = media.video_url_hd;
      const sd = media.video_url_sd;
      videoUrl = (hd && !/No /i.test(hd) ? hd : null) || (sd && !/No /i.test(sd) ? sd : null);
    }
    if (!videoUrl) return reply('No downloadable video found.');
    await conn.sendMessage(from, {
      video: { url: videoUrl },
      caption: '*Progress Tech*'
    }, { quoted: fakevCard });
  } catch (e) {
    reply('Error while fetching video.');
    console.log(e);
  }
});
