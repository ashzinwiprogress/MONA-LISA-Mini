const { cmd } = require('../redx');
const axios = require('axios');
const config = require('../config');

const BASE = 'https://api.omegatech.app';
const BRAND = 'Powered by Progress Tech';
const CHANNEL_LINK = config.CHANNEL_LINK || 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';
const MAX_COUNT = 1000;
const BATCH = 5;

function parseReactArgs(q) {
  const raw = String(q || '').trim();
  const urlMatch = raw.match(/https?:\/\/whatsapp\.com\/channel\/[^\s]+/i);
  if (!urlMatch) return null;
  const url = urlMatch[0].replace(/[),.;]+$/, '');
  const rest = raw.replace(urlMatch[0], ' ').replace(/\s+/g, ' ').trim();
  const tokens = rest ? rest.split(' ') : [];
  let count = 1;
  const emojiParts = [];
  for (const t of tokens) {
    if (/^\d{1,4}$/.test(t)) {
      count = Math.max(1, Math.min(MAX_COUNT, parseInt(t, 10)));
    } else if (t) {
      emojiParts.push(t);
    }
  }
  const emojis = emojiParts.length ? emojiParts : ['❤️'];
  return { url, emojis, count };
}

async function vipReact(url, emoji) {
  const { data } = await axios.get(`${BASE}/api/Fun/Rch`, {
    timeout: 45000,
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    params: { action: 'react', url, emoji }
  });
  if (data && data.success === false) {
    throw new Error(data.error || data.message || 'VIP react failed');
  }
  return data.data || data;
}

async function rch2React(url, emojis) {
  const { data } = await axios.get(`${BASE}/api/Fun/rch2`, {
    timeout: 60000,
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    params: { action: 'react', url, emojis: Array.isArray(emojis) ? emojis.join('') : emojis }
  });
  if (data && data.success === false) {
    throw new Error(data.error || data.message || 'rch2 failed');
  }
  return data.data || data;
}

async function localReact(conn, url, emoji) {
  if (typeof conn.newsletterReactMessage !== 'function') return false;
  const m = String(url).match(/whatsapp\.com\/channel\/([0-9A-Za-z]+)\/([0-9A-Za-z_-]+)/i);
  if (!m) return false;
  const jid = `${m[1]}@newsletter`;
  await conn.newsletterReactMessage(jid, String(m[2]), emoji);
  return true;
}

async function runBatch(jobs, size) {
  const out = [];
  for (let i = 0; i < jobs.length; i += size) {
    const slice = jobs.slice(i, i + size);
    const settled = await Promise.allSettled(slice.map((fn) => fn()));
    out.push(...settled);
  }
  return out;
}

cmd({
  pattern: 'rch',
  alias: ['vipreact', 'react', 'rch2', 'funreact', 'chreact', 'reactch'],
  react: '❤️',
  desc: 'Send VIP reactions to a WhatsApp channel post (max 1000)',
  category: 'fun',
  filename: __filename
}, async (conn, mek, m, { q, reply, prefix, from }) => {
  const pre = prefix || '.';
  try {
    const parsed = parseReactArgs(q);
    if (!parsed) {
      return reply(
        `*VIP Channel React*\n\n` +
        `${pre}rch https://whatsapp.com/channel/ID/POST\n` +
        `${pre}rch https://whatsapp.com/channel/ID/POST 🥳\n` +
        `${pre}rch https://whatsapp.com/channel/ID/POST ❤️🔥 25\n` +
        `${pre}rch https://whatsapp.com/channel/ID/POST 1000\n\n` +
        `Emojis are custom. Count max ${MAX_COUNT}.\n\n_${BRAND}_\n${CHANNEL_LINK}`
      );
    }

    const { url, emojis, count } = parsed;
    await conn.sendPresenceUpdate('composing', from).catch(() => {});

    if (count > 1) {
      await reply(`Queuing ${count} VIP reaction(s) with ${emojis.join(' ')}...\nThis can take a moment.`);
    }

    try {
      await localReact(conn, url, emojis[0]);
    } catch (_) {}

    const jobs = [];
    for (let i = 0; i < count; i++) {
      const emoji = emojis[i % emojis.length];
      jobs.push(() => vipReact(url, emoji));
    }

    const settled = await runBatch(jobs, BATCH);
    let ok = settled.filter((s) => s.status === 'fulfilled').length;
    let fail = settled.filter((s) => s.status === 'rejected').length;
    let last = settled.find((s) => s.status === 'fulfilled')?.value || null;

    if (!ok) {
      try {
        last = await rch2React(url, emojis);
        ok = last?.result?.totalReacts || 1;
        fail = 0;
      } catch (e2) {
        throw new Error(e2.response?.data?.error || e2.response?.data?.message || e2.message);
      }
    }

    const d = last || {};
    const result = d.result || {};
    reply(
      `*VIP Channel React*\n\n` +
      `Target: ${d.target || d.url || url}\n` +
      `Emoji: ${d.emojis || emojis.join(' ')}\n` +
      `Queued: ${ok}/${count}\n` +
      `Failed: ${fail}\n` +
      `Status: ${d.message || result.status || 'sent'}\n` +
      `Task: ${d.task_id || 'n/a'}\n` +
      `Time: ${d.time || 'n/a'}\n` +
      `VIP: ${d.vip_package || 'n/a'}\n` +
      `Usage: ${d.usage_today || 0}/${d.limit || 'n/a'}\n` +
      `Points: ${d.points_remaining || result.points || 'n/a'}\n\n_${BRAND}_`
    );
  } catch (e) {
    reply(`Channel react failed: ${e.response?.data?.error || e.response?.data?.message || e.message}`);
  }
});
