const { cmd } = require('../redx');
const axios = require('axios');
const { sendInteractive, quick, select } = require('../lib/buttons');

const BASE = 'https://api.omegatech.app/api/movie/MovieBox-pro';
const BRAND = 'Powered by Progress Tech • MovieBox';
const movieCache = new Map();

async function apiGet(params, timeout = 45000) {
  const { data } = await axios.get(BASE, {
    params,
    timeout,
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }
  });
  if (!data || data.success === false) {
    throw new Error(data?.message || data?.error || 'MovieBox request failed');
  }
  return data;
}

function cacheKey(sender) {
  return String(sender || 'unknown');
}

function getCache(sender) {
  return movieCache.get(cacheKey(sender)) || {};
}

function setCache(sender, patch) {
  const key = cacheKey(sender);
  const next = { ...getCache(sender), ...patch, timestamp: Date.now() };
  movieCache.set(key, next);
  return next;
}

function isSeriesItem(item) {
  if (!item) return false;
  if (item.subjectType === 2) return true;
  if (/series|tv/i.test(String(item.subjectType || item.type || ''))) return true;
  if (Array.isArray(item.seasons) && item.seasons.length) return true;
  return false;
}

function statsLine(movieData) {
  const rating = movieData.rating || movieData.imdbRatingValue || 'N/A';
  const views = movieData.viewCount || movieData.views || movieData.hot || 'N/A';
  const likes = movieData.likeCount || movieData.likes || 'N/A';
  const comments = movieData.commentCount || movieData.comments || 'N/A';
  const year = movieData.releaseDate ? String(movieData.releaseDate).split('-')[0] : (movieData.year || '');
  return [
    `*${movieData.title || 'Untitled'}*`,
    year ? `Year: ${year}` : '',
    `Rating: ${rating}`,
    `Views: ${views}`,
    `Likes: ${likes}`,
    `Comments: ${comments}`
  ].filter(Boolean).join('\n');
}

async function fetchDetail(item) {
  const data = await apiGet({
    action: 'detail',
    keyword: '',
    subjectId: item.subjectId || item.id,
    detailPath: item.detailPath || item.path || ''
  });
  const movieData = data.data || data;
  movieData.subjectId = movieData.subjectId || item.subjectId || item.id;
  movieData.detailPath = movieData.detailPath || item.detailPath || item.path || '';
  movieData.title = movieData.title || item.title;
  movieData.cover = movieData.cover || movieData.poster || item.cover || item.poster;
  return movieData;
}

async function fetchStream(movieData, season = 0, episode = 0) {
  const data = await apiGet({
    action: 'download',
    subjectId: movieData.subjectId || movieData.id,
    detailPath: movieData.detailPath || movieData.path || '',
    se: season,
    ep: episode
  }, 90000);
  return data.data || data;
}

function qualityRows(qualities, pre) {
  return (qualities || []).slice(0, 10).map((x) => {
    const label = String(x.quality || x.label || 'HD');
    return {
      id: `${pre}movie quality ${label}`,
      title: label.slice(0, 24),
      description: String(x.format || 'MP4').slice(0, 70)
    };
  });
}

async function sendMenu(conn, from, title, body, buttons) {
  try {
    await sendInteractive(conn, from, { title, body, footer: BRAND, buttons });
  } catch (_) {
    await conn.sendMessage(from, { text: `${body}\n\n${BRAND}` });
  }
}

async function sendMovieMedia(conn, from, mek, movieData, selected, seasonNum, episodeNum, mode, reply) {
  const streamUrl = selected.streamUrl || selected.downloadUrl || selected.url;
  if (!streamUrl) throw new Error('No download URL for that quality');
  const isSeries = seasonNum && episodeNum;
  const safeTitle = String(movieData.title || 'Movie').replace(/[\\/:*?"<>|]/g, '_');
  const fileName = isSeries
    ? `${safeTitle} - S${seasonNum}E${episodeNum} [${selected.quality}].mp4`
    : `${safeTitle} [${selected.quality}].mp4`;
  const caption =
    `${statsLine(movieData)}\n` +
    (isSeries ? `Season ${seasonNum} • Episode ${episodeNum}\n` : '') +
    `Quality: ${selected.quality}\n` +
    `Format: ${selected.format || 'MP4'}\n` +
    `${BRAND}`;

  await reply(`Downloading ${isSeries ? `S${seasonNum}E${episodeNum}` : 'movie'} in ${selected.quality} as ${mode}...`);
  try {
    if (mode === 'video') {
      await conn.sendMessage(from, { video: { url: streamUrl }, mimetype: 'video/mp4', caption }, { quoted: mek });
    } else {
      await conn.sendMessage(from, { document: { url: streamUrl }, mimetype: 'video/mp4', fileName, caption }, { quoted: mek });
    }
  } catch (_) {
    await conn.sendMessage(from, { document: { url: streamUrl }, mimetype: 'video/mp4', fileName, caption }, { quoted: mek });
  }
  await reply(mode === 'file' ? 'File sent. Save it from the chat.' : 'Video sent.');
}

async function showQualities(conn, from, movieData, qualities, pre, seasonNum, episodeNum) {
  const head = seasonNum && episodeNum
    ? `${statsLine(movieData)}\nSeason ${seasonNum} • Episode ${episodeNum}\n\nPick a quality, then Video or File.`
    : `${statsLine(movieData)}\n\nPick a quality, then Video or File.`;
  const qRows = qualityRows(qualities, pre);
  const first = String(qualities[0]?.quality || qualities[0]?.label || '720p');
  const buttons = [
    select('Quality', 'Available', qRows, 'HD'),
    quick('Send Video', `${pre}movie send video`),
    quick('Send File', `${pre}movie send file`)
  ];
  await sendMenu(conn, from, movieData.title || 'Movie', head, buttons);
  return first;
}

cmd({
  pattern: 'movie',
  alias: ['akwam', 'moviebox', 'film', 'series', 'episode'],
  react: '🎬',
  desc: 'Search and download movies/series with buttons',
  category: 'download',
  filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix, sender, args }) => {
  try {
    const pre = prefix || '.';
    const input = String(q || '').trim();
    const action = String(args[0] || '').toLowerCase();

    if (!input) {
      return reply(
        `*MovieBox Downloader*\n\n` +
        `Type a title. I will list matches as buttons.\n\n` +
        `Example:\n${pre}movie Spiderman brand new day\n${pre}series Breaking Bad\n\n${BRAND}`
      );
    }

    if (action === 'pick') {
      const idx = parseInt(args[1], 10);
      const cached = getCache(sender);
      const results = cached.results || [];
      if (!idx || idx < 1 || idx > results.length) return reply('Pick a title from the last search menu.');
      const item = results[idx - 1];
      await reply(`Loading ${item.title}...`);
      const movieData = await fetchDetail(item);
      setCache(sender, { selected: movieData, season: 0, episode: 0, qualities: [], stream: null });

      const seasons = movieData.seasons || [];
      if (seasons.length || isSeriesItem(movieData) || isSeriesItem(item)) {
        const list = seasons.length ? seasons : [{ se: 1, maxEp: movieData.episodeCount || 12 }];
        const rows = list.slice(0, 30).map((s) => ({
          id: `${pre}movie season ${s.se}`,
          title: `Season ${s.se}`.slice(0, 24),
          description: `${s.maxEp || s.episodeCount || '?'} episodes`
        }));
        await sendMenu(conn, from, movieData.title || 'Series', `${statsLine(movieData)}\n\nThis is a series. Tap a season.`, [
          select('Seasons', 'Pick season', rows, 'TV'),
          quick('Back', `${pre}movie ${cached.query || ''}`.trim())
        ]);
        return;
      }

      await reply('Fetching download streams...');
      const stream = await fetchStream(movieData, 0, 0);
      const qualities = stream.qualities || stream.data?.qualities || [];
      if (!qualities.length) return reply('No download qualities were returned for that title.');
      setCache(sender, { selected: movieData, stream, qualities, season: 0, episode: 0, quality: qualities[0] });
      await showQualities(conn, from, movieData, qualities, pre, 0, 0);
      return;
    }

    if (action === 'season' || action === 'se') {
      const seasonNum = parseInt(args[1], 10);
      const cached = getCache(sender);
      const movieData = cached.selected;
      if (!movieData) return reply('Search and pick a series first.');
      if (!seasonNum) return reply('Pick a season from the menu.');
      const seasons = movieData.seasons || [];
      const season = seasons.find((s) => Number(s.se) === seasonNum) || seasons[seasonNum - 1] || {};
      const maxEp = season.maxEp || season.episodeCount || 12;
      setCache(sender, { season: seasonNum, episode: 0 });
      const rows = [];
      for (let ep = 1; ep <= Math.min(maxEp, 30); ep++) {
        rows.push({
          id: `${pre}movie episode ${ep}`,
          title: `Episode ${ep}`.slice(0, 24),
          description: `S${seasonNum}E${ep}`
        });
      }
      await sendMenu(conn, from, movieData.title || 'Series', `${statsLine(movieData)}\nSeason ${seasonNum} • ${maxEp} episodes\n\nTap an episode.`, [
        select('Episodes', `Season ${seasonNum}`, rows, 'EP'),
        quick('Back', `${pre}movie pick 1`)
      ]);
      return;
    }

    if (action === 'episode' || action === 'ep') {
      const episodeNum = parseInt(args[1], 10);
      const cached = getCache(sender);
      const movieData = cached.selected;
      const seasonNum = cached.season || 1;
      if (!movieData) return reply('Search and pick a series first.');
      if (!episodeNum) return reply('Pick an episode from the menu.');
      await reply(`Fetching S${seasonNum}E${episodeNum}...`);
      const stream = await fetchStream(movieData, seasonNum, episodeNum);
      const qualities = stream.qualities || stream.data?.qualities || [];
      if (!qualities.length) return reply('No download qualities were returned for that episode.');
      setCache(sender, { episode: episodeNum, stream, qualities, quality: qualities[0] });
      await showQualities(conn, from, movieData, qualities, pre, seasonNum, episodeNum);
      return;
    }

    if (action === 'quality' || action === 'q') {
      const wanted = args.slice(1).join(' ');
      const cached = getCache(sender);
      const movieData = cached.selected;
      const qualities = cached.qualities || [];
      if (!movieData || !qualities.length) return reply('Pick a title first, then a quality.');
      const selected = qualities.find((x) => String(x.quality || x.label) === wanted)
        || qualities.find((x) => String(x.quality || '').toLowerCase().includes(String(wanted).toLowerCase()))
        || qualities[parseInt(wanted, 10) - 1];
      if (!selected) return reply(`Quality ${wanted} is not available.`);
      setCache(sender, { quality: selected });
      await sendMenu(conn, from, movieData.title || 'Movie', `${statsLine(movieData)}\nQuality: ${selected.quality || selected.label}\n\nSend as video or as a file.`, [
        quick('Send Video', `${pre}movie send video`),
        quick('Send File', `${pre}movie send file`)
      ]);
      return;
    }

    if (action === 'send') {
      const mode = String(args[1] || 'video').toLowerCase() === 'file' ? 'file' : 'video';
      const cached = getCache(sender);
      const movieData = cached.selected;
      const selected = cached.quality || (cached.qualities || [])[0];
      if (!movieData || !selected) return reply('Pick a title and quality first.');
      await sendMovieMedia(conn, from, mek, movieData, selected, cached.season || 0, cached.episode || 0, mode, reply);
      return;
    }

    await reply(`Searching MovieBox for: ${input}`);
    const raw = await apiGet({ action: 'search', keyword: input });
    const results = raw.data?.results || raw.data || raw.results || [];
    const list = Array.isArray(results) ? results : (results.list || results.items || []);
    if (!list.length) return reply(`No MovieBox results for "${input}".`);
    setCache(sender, { query: input, results: list, selected: null, qualities: [], stream: null, season: 0, episode: 0 });

    const rows = list.slice(0, 20).map((item, i) => {
      const year = item.releaseDate ? String(item.releaseDate).split('-')[0] : (item.year || '');
      const kind = isSeriesItem(item) ? 'Series' : 'Movie';
      const rating = item.imdbRatingValue || item.rating || 'N/A';
      return {
        id: `${pre}movie pick ${i + 1}`,
        title: String(item.title || `Result ${i + 1}`).slice(0, 24),
        description: `${kind}${year ? ` ${year}` : ''} • ${rating}`.slice(0, 70)
      };
    });
    const body =
      `*Results for "${input}"*\n` +
      `${list.length} match(es). Tap a title to download.\n` +
      `Movies send as video or file. Series open season then episode.`;
    await sendMenu(conn, from, 'MovieBox', body, [
      select('Titles', 'Matches', rows, 'NEW'),
      quick('Search again', `${pre}movie`)
    ]);
  } catch (e) {
    console.error('[movie]', e.message);
    reply(`MovieBox error: ${e.message}`);
  }
});
