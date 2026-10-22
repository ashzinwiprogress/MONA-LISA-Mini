const { cmd } = require('../redx');
const axios = require('axios');
const config = require('../config');

const BASE = 'https://api.omegatech.app';
const CHANNEL_URL_RE = /whatsapp\.com\/channel\/([0-9A-Za-z]+)(?:\/([0-9A-Za-z_-]+))?/;
const MAX_COUNT = 1000;

function parseArgs(q) {
  const raw = String(q || '').trim();
  const match = raw.match(CHANNEL_URL_RE);
  if (!match) return null;
  const channelId = match[1];
  const postId = match[2];
  const urlMatch = raw.match(/https?:\/\/whatsapp\.com\/channel\/[^\s]+/i);
  const url = urlMatch ? urlMatch[0].replace(/[),.;]+$/, '') : `https://whatsapp.com/channel/${channelId}/${postId || ''}`;
  const rest = raw.replace(urlMatch ? urlMatch[0] : '', ' ').replace(/\s+/g, ' ').trim();
  const tokens = rest ? rest.split(' ') : [];
  let count = 1;
  const emojiParts = [];
  for (const t of tokens) {
    if (/^\d{1,4}$/.test(t)) count = Math.max(1, Math.min(MAX_COUNT, parseInt(t, 10)));
    else if (t) emojiParts.push(t);
  }
  return {
    url,
    channelId,
    postId,
    channelJid: `${channelId}@newsletter`,
    emojis: emojiParts.length ? emojiParts : ['❤️'],
    count
  };
}

async function vipReact(url, emoji) {
  const { data } = await axios.get(`${BASE}/api/Fun/Rch`, {
    timeout: 45000,
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    params: { action: 'react', url, emoji }
  });
  if (data && data.success === false) throw new Error(data.error || data.message || 'VIP react failed');
  return data.data || data;
}

cmd({
  pattern: 'wareact',
  alias: ['wreact'],
  react: '❤️',
  desc: 'React to a WhatsApp channel post',
  category: 'tools',
  filename: __filename
}, async (conn, mek, m, { q, reply, from }) => {
  const parsed = parseArgs(q);
  if (!parsed) {
    return reply('Use: .wareact https://whatsapp.com/channel/CHANNEL_ID/POST_ID 😍 10');
  }
  if (!parsed.postId) {
    return reply('Post ID missing.\nUse the full link: https://whatsapp.com/channel/CHANNEL_ID/POST_ID');
  }

  try {
    await conn.sendPresenceUpdate('composing', from).catch(() => {});
    let local = 0;
    if (typeof conn.newsletterReactMessage === 'function') {
      for (const emoji of parsed.emojis) {
        try {
          await conn.newsletterReactMessage(parsed.channelJid, String(parsed.postId), emoji);
          local++;
        } catch (e) {
          console.error('[wareact] local react', e.message);
        }
      }
    }

    const jobs = [];
    for (let i = 0; i < parsed.count; i++) {
      const emoji = parsed.emojis[i % parsed.emojis.length];
      jobs.push(vipReact(parsed.url, emoji));
    }
    const settled = await Promise.allSettled(jobs);
    const ok = settled.filter((s) => s.status === 'fulfilled').length;
    const fail = settled.filter((s) => s.status === 'rejected').length;
    if (!ok && !local) {
      const err = settled.find((s) => s.status === 'rejected');
      throw new Error(err?.reason?.message || 'The reaction could not be delivered.');
    }
    reply(
      `*Channel react sent*\n` +
      `${parsed.channelJid}/${parsed.postId}\n` +
      `Emoji: ${parsed.emojis.join(' ')}\n` +
      `VIP queued: ${ok}/${parsed.count}\n` +
      `Local: ${local}\n` +
      (fail ? `Failed: ${fail}\n` : '')
    );
  } catch (err) {
    reply(`Failed: ${err.message}`);
  }
});
