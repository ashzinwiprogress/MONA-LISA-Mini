const BASE_URL = 'https://tiktokdownloaderr.id';
const ENDPOINT = `${BASE_URL}/api/downloader.php`;

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Origin: BASE_URL,
  Referer: `${BASE_URL}/id`,
  Accept: 'application/json, text/plain, */*'
};

async function resolveTikTokUrl(rawUrl) {
  try {
    const head = await fetch(rawUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': DEFAULT_HEADERS['User-Agent'] },
      signal: AbortSignal.timeout(15000)
    });
    return head.url || rawUrl;
  } catch {
    return rawUrl;
  }
}

async function scrapeTikTokId(url) {
  if (!url || typeof url !== 'string') throw new Error('A valid TikTok URL must be supplied.');
  const targetUrl = await resolveTikTokUrl(url.trim());
  const payload = new URLSearchParams({ url: targetUrl });
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      ...DEFAULT_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    },
    body: payload.toString(),
    signal: AbortSignal.timeout(45000)
  });
  if (!res.ok) throw new Error(`tiktokdownloaderr returned HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to extract TikTok media streams.');
  return {
    success: true,
    title: data.title || '',
    author: data.author || '',
    duration: data.duration || 0,
    cover: data.cover || '',
    musicTitle: data.music_title || '',
    downloads: {
      noWatermark: data.video_nowm ? { url: data.video_nowm, filename: data.filename_nowm || 'tiktok.mp4' } : null,
      watermark: data.video_wm ? { url: data.video_wm, filename: data.filename_wm || 'tiktok-wm.mp4' } : null,
      audio: data.audio ? { url: data.audio, filename: data.filename_audio || 'tiktok.mp3' } : null
    }
  };
}

module.exports = { scrapeTikTokId, resolveTikTokUrl, DEFAULT_HEADERS };
