const BASE_URL = 'https://www.tiksnap.es';
const SEARCH_ENDPOINT = `${BASE_URL}/api/search`;

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: `${BASE_URL}/en/tiktok-hd-downloader`,
  Origin: BASE_URL,
  Accept: 'application/json, text/plain, */*'
};

function absUrl(u) {
  if (!u) return '';
  const s = String(u);
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('/')) return `${BASE_URL}${s}`;
  return s;
}

async function scrapeTikSnap(url) {
  if (!url || typeof url !== 'string') throw new Error('A valid TikTok URL must be supplied.');
  const res = await fetch(SEARCH_ENDPOINT, {
    method: 'POST',
    headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url.trim() }),
    signal: AbortSignal.timeout(45000)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || data?.message || `TikSnap returned status ${res.status}`);
  }

  const info = data.videoInfo || {};
  const signed = data.signed || {};
  const downloadOptions = info.downloadOptions || [];
  const videoOpt = downloadOptions.find((opt) => opt.type === 'video');
  const audioOpt = downloadOptions.find((opt) => opt.type === 'audio');
  const baseFilename = `TikSnap-${info.author?.uniqueId || 'video'}-${info.id || Date.now()}`;

  const images = [];
  if (Array.isArray(info.images)) {
    info.images.forEach((imgUrl, idx) => {
      const signedImg = signed.imageDownloads?.[idx] || signed.images?.[idx];
      const targetUrl = signedImg ? absUrl(signedImg) : absUrl(imgUrl);
      if (targetUrl) images.push({ url: targetUrl, filename: `${baseFilename}-img${idx + 1}.jpg` });
    });
  }

  return {
    success: true,
    id: info.id || '',
    type: info.type || 'video',
    author: {
      uniqueId: info.author?.uniqueId || '',
      nickname: info.author?.nickname || '',
      avatar: info.author?.avatar || ''
    },
    description: info.description || '',
    cover: absUrl(info.cover || signed.cover || ''),
    duration: info.duration || 0,
    stats: {
      plays: info.stats?.playCount || 0,
      likes: info.stats?.diggCount || 0,
      comments: info.stats?.commentCount || 0,
      shares: info.stats?.shareCount || 0
    },
    downloads: {
      originalHd: signed.original ? { url: absUrl(signed.original), filename: `${baseFilename}-HD.mp4` } : null,
      videoNoWm: videoOpt ? { url: absUrl(videoOpt.signedUrl || videoOpt.url), filename: `${baseFilename}.mp4` } : null,
      audio: audioOpt ? { url: absUrl(audioOpt.signedUrl || audioOpt.url), filename: `${baseFilename}.mp3` } : null,
      images
    }
  };
}

module.exports = { scrapeTikSnap, DEFAULT_HEADERS, BASE_URL };
