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
    throw new Error(data.message || data.error || 'Request failed');
  }
  return data;
}

cmd({
  pattern: 'stickersearch',
  alias: ['stksearch', 'findsticker', 'stickerly', 'packsearch'],
  react: '🧩',
  desc: 'Search sticker packs and send sample stickers',
  category: 'sticker',
  filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix }) => {
  try {
    const pre = prefix || '.';
    if (!q) {
      return reply(
        `*Sticker Search*\n\nUsage: ${pre}stickersearch Alone\nSends matching packs and sample stickers.\n\n_${BRAND}_\n${CHANNEL_LINK}`
      );
    }
    await conn.sendPresenceUpdate('composing', from);
    const res = await apiGet(`/api/tools/Sticker?action=search&keyword=${encodeURIComponent(q)}&needRelation=true`);
    const packs = res.data?.result?.stickerPacks || res.data?.stickerPacks || res.result?.stickerPacks || [];
    if (!packs.length) return reply(`No sticker packs for "${q}".`);

    const list = packs.slice(0, 8).map((p, i) => {
      const n = p.name || 'Pack';
      const files = (p.resourceFiles || []).length;
      const anim = p.isAnimated || p.animated ? 'animated' : 'static';
      const url = p.shareUrl || '';
      return `${i + 1}. ${n}\n   ${files} stickers • ${anim}\n   ${url}`.trim();
    }).join('\n\n');

    await conn.sendMessage(from, {
      text: `*Sticker packs for "${q}"*\n${packs.length} found\n\n${list}\n\n_${BRAND}_\n${CHANNEL_LINK}`
    }, { quoted: mek });

    const first = packs[0];
    const prefixUrl = first.resourceUrlPrefix || '';
    const files = first.resourceFiles || [];
    if (!prefixUrl || !files.length) return;

    const samples = files.slice(0, 5);
    for (const file of samples) {
      const url = prefixUrl + file;
      try {
        const img = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000, maxRedirects: 5 });
        const buf = Buffer.from(img.data);
        const isWebp = /\.webp$/i.test(file) || (img.headers['content-type'] || '').includes('webp');
        if (isWebp) {
          await conn.sendMessage(from, { sticker: buf }, { quoted: mek });
        } else {
          await conn.sendMessage(from, { image: buf, caption: first.name || q }, { quoted: mek });
        }
      } catch (err) {
        console.error('sticker sample', err.message);
      }
    }
  } catch (e) {
    reply(`Sticker search failed: ${e.response?.data?.message || e.message}`);
  }
});
