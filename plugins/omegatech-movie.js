const { cmd } = require('../redx');
const axios = require('axios');

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

function listResults(results) {
    return results.slice(0, 10).map((item, i) => {
        const year = item.releaseDate ? String(item.releaseDate).split('-')[0] : (item.year || 'N/A');
        const kind = item.subjectType === 2 || /series/i.test(item.subjectType || '') ? 'Series' : 'Movie';
        const rating = item.imdbRatingValue || item.rating || 'N/A';
        return `${i + 1}. ${item.title} (${year})\n   ${kind}  Rating: ${rating}`;
    }).join('\n\n');
}

async function fetchDetail(item) {
    const data = await apiGet({
        action: 'detail',
        keyword: '',
        subjectId: item.subjectId || item.id,
        detailPath: item.detailPath || item.path || ''
    });
    return data.data || data;
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

async function sendMovieFile(conn, from, mek, movieData, selected, seasonNum, episodeNum, reply) {
    const streamUrl = selected.streamUrl || selected.downloadUrl || selected.url;
    if (!streamUrl) throw new Error('No download URL for that quality');

    const isSeries = seasonNum && episodeNum;
    const safeTitle = String(movieData.title || 'Movie').replace(/[\\/:*?"<>|]/g, '_');
    const fileName = isSeries
        ? `${safeTitle} - S${seasonNum} E${episodeNum} [${selected.quality}].mp4`
        : `${safeTitle} [${selected.quality}].mp4`;
    const caption =
        `*${movieData.title}*\n` +
        (isSeries ? `Season ${seasonNum} • Episode ${episodeNum}\n` : '') +
        `Rating: ${movieData.rating || movieData.imdbRatingValue || 'N/A'}\n` +
        `Quality: ${selected.quality}\n` +
        `Format: ${selected.format || 'MP4'}\n` +
        `${BRAND}`;

    await reply(`Downloading ${isSeries ? `S${seasonNum}E${episodeNum}` : 'movie'} in ${selected.quality}...`);
    await conn.sendMessage(from, {
        document: { url: streamUrl },
        mimetype: 'video/mp4',
        fileName,
        caption
    }, { quoted: mek });
}

cmd({
    pattern: "movie",
    alias: ["akwam", "moviebox", "film"],
    react: "🎬",
    desc: "Search and download movies/series from MovieBox",
    category: "download",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix, sender }) => {
    try {
        const prefixStr = prefix || '.';
        if (!q) {
            return reply(
                `*MovieBox Downloader*\n\n` +
                `Search and download movies/series.\n\n` +
                `Usage:\n` +
                `${prefixStr}movie <query>\n` +
                `${prefixStr}movie <query> <number>\n` +
                `${prefixStr}movie --se 1 --ep 1 --q 1080p\n\n` +
                `Examples:\n` +
                `${prefixStr}movie Inception\n` +
                `${prefixStr}movie Inception 1\n\n` +
                `${BRAND}`
            );
        }

        const key = cacheKey(sender);
        const cached = movieCache.get(key);

        const qualityFlag = q.match(/--q(?:uality)?\s+(\S+)/i);
        const seFlag = q.match(/--se(?:ason)?\s+(\d+)/i);
        const epFlag = q.match(/--ep(?:isode)?\s+(\d+)/i);
        const selectFlag = q.match(/--select\s+(\d+)/i);

        if (cached && (qualityFlag || (seFlag && epFlag) || selectFlag || /^\d+$/.test(q.trim()) || /\s\d+$/.test(q.trim()))) {
            let movieData = cached.selected || null;
            let results = cached.results || [];

            if (!movieData) {
                let idx = null;
                if (selectFlag) idx = parseInt(selectFlag[1], 10);
                else {
                    const numTail = q.trim().match(/(\d+)\s*$/);
                    if (numTail) idx = parseInt(numTail[1], 10);
                }
                if (idx == null || idx < 1 || idx > results.length) {
                    return reply('Pick a result number from the last search first.');
                }
                const item = results[idx - 1];
                await reply(`Loading details for ${item.title}...`);
                movieData = await fetchDetail(item);
                movieData.subjectId = movieData.subjectId || item.subjectId || item.id;
                movieData.detailPath = movieData.detailPath || item.detailPath || item.path || '';
                movieData.title = movieData.title || item.title;
                cached.selected = movieData;
                movieCache.set(key, cached);

                const seasons = movieData.seasons || [];
                if (seasons.length && !seFlag) {
                    const seasonList = seasons.slice(0, 20).map(s => `Season ${s.se} (${s.maxEp || s.episodeCount || '?'} eps)`).join('\n');
                    return reply(
                        `*${movieData.title}* — series\n\n${seasonList}\n\n` +
                        `Next: ${prefixStr}movie --se 1 --ep 1\nThen add --q 720p after qualities appear.\n\n${BRAND}`
                    );
                }
                if (!seasons.length && !qualityFlag) {
                    const stream = await fetchStream(movieData, 0, 0);
                    const qualities = stream.qualities || stream.data?.qualities || [];
                    cached.stream = stream;
                    cached.qualities = qualities;
                    movieCache.set(key, cached);
                    if (!qualities.length) return reply('No download qualities were returned for that title.');
                    const qList = qualities.map((x, i) => `${i + 1}. ${x.quality || x.label || 'unknown'}`).join('\n');
                    return reply(
                        `*${movieData.title}*\n\nQualities:\n${qList}\n\n` +
                        `Download: ${prefixStr}movie --q ${qualities[0].quality || '720p'}\n\n${BRAND}`
                    );
                }
            }

            const seasonNum = seFlag ? parseInt(seFlag[1], 10) : (cached.season || 0);
            const episodeNum = epFlag ? parseInt(epFlag[1], 10) : (cached.episode || 0);
            if (seFlag || epFlag) {
                cached.season = seasonNum;
                cached.episode = episodeNum;
                const seasons = movieData.seasons || [];
                if (seFlag && !epFlag && seasons.length) {
                    const season = seasons.find(s => Number(s.se) === seasonNum) || seasons[seasonNum - 1];
                    const maxEp = season?.maxEp || season?.episodeCount || 12;
                    movieCache.set(key, cached);
                    return reply(
                        `*${movieData.title}* Season ${seasonNum}\n` +
                        `Episodes: 1–${maxEp}\n\n` +
                        `Next: ${prefixStr}movie --se ${seasonNum} --ep 1\n\n${BRAND}`
                    );
                }
                await reply(`Fetching streams for S${seasonNum}E${episodeNum}...`);
                const stream = await fetchStream(movieData, seasonNum, episodeNum);
                const qualities = stream.qualities || stream.data?.qualities || [];
                cached.stream = stream;
                cached.qualities = qualities;
                movieCache.set(key, cached);
                if (!qualityFlag) {
                    if (!qualities.length) return reply('No download qualities were returned for that episode.');
                    const qList = qualities.map((x, i) => `${i + 1}. ${x.quality || x.label || 'unknown'}`).join('\n');
                    return reply(
                        `*${movieData.title}* S${seasonNum}E${episodeNum}\n\nQualities:\n${qList}\n\n` +
                        `Download: ${prefixStr}movie --q ${qualities[0].quality || '720p'}\n\n${BRAND}`
                    );
                }
            }

            if (qualityFlag) {
                const wanted = qualityFlag[1];
                const qualities = cached.qualities || [];
                const selected = qualities.find(x => String(x.quality || x.label) === wanted)
                    || qualities.find(x => String(x.quality || '').toLowerCase().includes(wanted.toLowerCase()))
                    || qualities[parseInt(wanted, 10) - 1];
                if (!selected) return reply(`Quality ${wanted} is not available.`);
                return sendMovieFile(conn, from, mek, movieData, selected, cached.season || 0, cached.episode || 0, reply);
            }

            return;
        }

        await reply(`Searching MovieBox for: ${q}`);
        const raw = await apiGet({ action: 'search', keyword: q });
        const results = raw.data?.results || raw.data || raw.results || [];
        const list = Array.isArray(results) ? results : (results.list || results.items || []);
        if (!list.length) return reply(`No MovieBox results for "${q}".`);

        movieCache.set(key, { query: q, results: list, timestamp: Date.now() });
        const poster = list[0]?.cover || list[0]?.poster || list[0]?.image;
        const caption =
            `*MovieBox results for "${q}"*\n\n` +
            `${listResults(list)}\n\n` +
            `Select: ${prefixStr}movie ${q} 1\n\n${BRAND}`;
        if (poster) {
            try {
                await conn.sendMessage(from, { image: { url: poster }, caption }, { quoted: mek });
                return;
            } catch (_) {}
        }
        return reply(caption);
    } catch (e) {
        console.error('[movie]', e.message);
        reply(`MovieBox error: ${e.message}`);
    }
});
