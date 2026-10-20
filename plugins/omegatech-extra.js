const { cmd } = require('../redx');
const axios = require('axios');

const BASE = 'https://api.omegatech.app';
const BRAND = 'Powered by Progress Tech';
const CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';

async function apiGet(pathAndQuery, timeout = 45000) {
  const { data } = await axios.get(`${BASE}${pathAndQuery}`, {
    timeout,
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    maxRedirects: 5
  });
  if (data && data.success === false) {
    throw new Error(data.message || data.error || 'Omegatech request failed');
  }
  return data;
}

const spotifyCache = new Map();
const seriesCache = new Map();

cmd({
  pattern: "shazamsearch",
  alias: ["songsearch", "findtrack"],
  react: "🎧",
  desc: "Search songs on Shazam by title",
  category: "music",
  filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix }) => {
  try {
    const pre = prefix || '.';
    if (!q) return reply(`*Shazam Search*\n\nUsage: ${pre}shazamsearch Alone\nReply to audio with ${pre}shazam to identify a clip.`);
    await reply(`Searching Shazam for: ${q}`);
    const res = await apiGet(`/api/Fun/Shazam?action=search&query=${encodeURIComponent(q)}`);
    const results = res.data?.results || res.results || [];
    if (!results.length) return reply(`No Shazam results for "${q}".`);
    const list = results.slice(0, 8).map((s, i) => {
      return `${i + 1}. ${s.title} — ${s.artist}\n   ${s.album || ''} ${s.duration_formatted || ''}\n   ${s.apple_music_url || ''}`.trim();
    }).join('\n\n');
    const first = results[0];
    const caption = `*Shazam results for "${q}"*\n\n${list}\n\n${BRAND}\n${CHANNEL_LINK}`;
    if (first?.cover) {
      try {
        await conn.sendMessage(from, { image: { url: first.cover }, caption }, { quoted: mek });
        if (first.preview_url) {
          await conn.sendMessage(from, {
            audio: { url: first.preview_url },
            mimetype: 'audio/mpeg',
            ptt: false,
            fileName: `${first.title}.m4a`
          }, { quoted: mek });
        }
        return;
      } catch (_) {}
    }
    return reply(caption);
  } catch (e) {
    reply(`Shazam search failed: ${e.message}`);
  }
});

cmd({
  pattern: "spotify",
  alias: ["spot", "spsearch"],
  react: "🎵",
  desc: "Search Spotify tracks and send a preview",
  category: "music",
  filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix, sender }) => {
  try {
    const pre = prefix || '.';
    if (!q) return reply(`*Spotify Search*\n\nUsage:\n${pre}spotify Alone\n${pre}spotify Alone 1`);
    const key = String(sender || from);
    const pick = q.trim().match(/^(.*)\s+(\d+)$/);
    let query = q.trim();
    let index = null;
    if (pick) {
      query = pick[1].trim();
      index = parseInt(pick[2], 10);
    }

    let cached = spotifyCache.get(key);
    if (index && cached && cached.tracks.length) {
      const track = cached.tracks[index - 1];
      if (!track) return reply(`Track #${index} not found. Search again.`);
      const caption = `*${track.title}*\n${track.artist}\nAlbum: ${track.album || 'N/A'}\nDuration: ${track.duration || 'N/A'}\n${track.url || ''}\n\n${BRAND}`;
      if (track.thumb) {
        try { await conn.sendMessage(from, { image: { url: track.thumb }, caption }, { quoted: mek }); }
        catch (_) { await reply(caption); }
      } else {
        await reply(caption);
      }
      if (track.previewUrl) {
        await conn.sendMessage(from, {
          audio: { url: track.previewUrl },
          mimetype: 'audio/mpeg',
          ptt: false,
          fileName: `${track.title}.mp3`
        }, { quoted: mek });
      }
      return;
    }

    await reply(`Searching Spotify for: ${query}`);
    const res = await apiGet(`/api/Search/Spotify?query=${encodeURIComponent(query)}&type=tracks&preview=true`);
    const tracks = res.tracks || res.data?.tracks || [];
    if (!tracks.length) return reply(`No Spotify tracks for "${query}".`);
    spotifyCache.set(key, { tracks, query, timestamp: Date.now() });
    const list = tracks.slice(0, 8).map((t, i) => `${i + 1}. ${t.title} — ${t.artist}\n   ${t.album || ''} • ${t.duration || ''}`).join('\n\n');
    return reply(`*Spotify results for "${query}"*\n\n${list}\n\nPreview: ${pre}spotify ${query} 1\n\n${BRAND}`);
  } catch (e) {
    reply(`Spotify failed: ${e.message}`);
  }
});

cmd({
  pattern: "seriesloaded",
  alias: ["series", "seriez", "slhome"],
  react: "📺",
  desc: "Browse or search Seriesloaded / Seriezloaded titles",
  category: "download",
  filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix, sender }) => {
  try {
    const pre = prefix || '.';
    const key = String(sender || from);
    const arg = (q || '').trim();

    if (arg && /^\d+$/.test(arg)) {
      const cached = seriesCache.get(key);
      if (!cached || !cached.posts.length) return reply('No Seriesloaded list yet. Use .series first.');
      const post = cached.posts[parseInt(arg, 10) - 1];
      if (!post) return reply('That number is not in the last list.');
      const excerpt = String(post.excerpt || '').replace(/<[^>]+>/g, '').slice(0, 280);
      return reply(
        `*${post.title}*\n\n${excerpt}\n\nLink: ${post.link || 'N/A'}\nDate: ${post.date || 'N/A'}\n\n${BRAND}`
      );
    }

    await reply(arg ? `Searching Seriesloaded for: ${arg}` : 'Loading Seriesloaded home...');
    const path = arg
      ? `/api/movie/Seriesloaded?action=search&keyword=${encodeURIComponent(arg)}`
      : '/api/movie/Seriesloaded?action=home';
    let res;
    try {
      res = await apiGet(path);
    } catch (e) {
      if (arg) throw e;
      res = await apiGet('/api/movie/Seriesloaded?action=home&page=1');
    }
    const posts = res.data?.posts || res.posts || res.data?.results || [];
    if (!posts.length) return reply(arg ? `No Seriesloaded results for "${arg}".` : 'Seriesloaded returned no posts.');
    seriesCache.set(key, { posts, timestamp: Date.now() });
    const list = posts.slice(0, 10).map((p, i) => {
      const date = p.date ? String(p.date).split('T')[0] : '';
      return `${i + 1}. ${p.title}${date ? ` (${date})` : ''}`;
    }).join('\n');
    return reply(
      `*Seriesloaded${arg ? ` — ${arg}` : ' Home'}*\n\n${list}\n\nDetails: ${pre}series 1\n\n${BRAND}`
    );
  } catch (e) {
    reply(`Seriesloaded failed: ${e.message}`);
  }
});

cmd({
  pattern: "ttuser",
  alias: ["tiktokuser", "ttsearch", "tiktoksearch"],
  react: "🎵",
  desc: "Look up a TikTok user profile",
  category: "search",
  filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix }) => {
  try {
    const pre = prefix || '.';
    if (!q) return reply(`*TikTok User Search*\n\nUsage: ${pre}ttuser username`);
    const username = q.replace(/^@/, '').trim();
    await reply(`Looking up @${username}...`);
    const res = await apiGet(`/api/Search/Tiktok-Search?action=user&username=${encodeURIComponent(username)}`);
    const d = res.data || res;
    const stats = d.stats || {};
    const caption =
      `*TikTok @${d.uniqueId || username}*\n` +
      `Name: ${d.nickname || 'N/A'}\n` +
      `Verified: ${d.verified ? 'Yes' : 'No'}\n` +
      `Followers: ${stats.followers ?? 'N/A'}\n` +
      `Following: ${stats.following ?? 'N/A'}\n` +
      `Hearts: ${stats.hearts ?? 'N/A'}\n` +
      `Videos: ${stats.videos ?? 'N/A'}\n` +
      `${d.signature ? `Bio: ${String(d.signature).slice(0, 160)}\n` : ''}` +
      `${d.profile || ''}\n\n${BRAND}`;
    if (d.avatar) {
      try {
        await conn.sendMessage(from, { image: { url: d.avatar }, caption }, { quoted: mek });
        return;
      } catch (_) {}
    }
    return reply(caption);
  } catch (e) {
    reply(`TikTok search failed: ${e.message}`);
  }
});

cmd({
  pattern: "gptmini",
  alias: ["gpt4", "gpt4mini"],
  react: "🤖",
  desc: "Chat with Omegatech GPT-4-mini",
  category: "ai",
  filename: __filename
}, async (conn, mek, m, { q, reply }) => {
  try {
    if (!q) return reply('Usage: .gptmini your question');
    const res = await apiGet(`/api/ai/Gpt-4-mini?message=${encodeURIComponent(q)}`, 60000);
    const answer = res.answer || res.data?.answer || res.text || res.message || res.data?.text;
    if (!answer) throw new Error('Empty GPT-4-mini response');
    reply(`*GPT-4 mini*\n\n${answer}\n\n_${BRAND}_`);
  } catch (e) {
    reply(`GPT-4 mini failed: ${e.message}`);
  }
});

cmd({
  pattern: "sportmatch",
  alias: ["fixtures", "sportmatches"],
  react: "⚽",
  desc: "Football matches via Omegatech Sport API",
  category: "sports",
  filename: __filename
}, async (conn, mek, m, { q, reply }) => {
  try {
    await reply('Fetching matches...');
    const res = await apiGet('/api/Sport/Sport?action=matches', 45000);
    let matches = res.data?.matches || res.matches || [];
    if (!Array.isArray(matches) || !matches.length) return reply('No matches returned.');
    const filter = (q || '').trim().toLowerCase();
    if (filter) {
      const filtered = matches.filter((mm) => JSON.stringify(mm).toLowerCase().includes(filter));
      if (filtered.length) matches = filtered;
    }
    const lines = matches.slice(0, 15).map((mm) => {
      const home = mm.home?.name || 'Home';
      const away = mm.away?.name || 'Away';
      const score = mm.score || `${mm.home?.score || '-'} - ${mm.away?.score || '-'}`;
      const live = mm.isLive ? 'LIVE' : (mm.isEnded ? 'FT' : (mm.isUpcoming ? 'UPCOMING' : mm.status || ''));
      return `${live} ${home} ${score} ${away}\n   ${mm.league || ''} ${mm.matchRound || ''}`.trim();
    });
    reply(`*Football Matches${filter ? ` — ${q}` : ''}*\n\n${lines.join('\n\n')}\n\n${BRAND}`);
  } catch (e) {
    reply(`Sports matches failed: ${e.message}`);
  }
});
