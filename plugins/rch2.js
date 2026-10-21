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
  pattern: 'rch2',
  alias: ['funreact', 'chreact', 'reactch'],
  react: '❤️',
  desc: 'React to a WhatsApp channel post via Omegatech rch2',
  category: 'fun',
  filename: __filename
}, async (conn, mek, m, { q, reply, prefix }) => {
  try {
    const pre = prefix || '.';
    if (!q || !q.includes('whatsapp.com/channel/')) {
      return reply(
        `*Channel React (rch2)*\n\n` +
        `${pre}rch2 https://whatsapp.com/channel/ID/POST\n` +
        `${pre}rch2 https://whatsapp.com/channel/ID/POST 🥳\n\n_${BRAND}_\n${CHANNEL_LINK}`
      );
    }
    const urlMatch = q.match(/https?:\/\/whatsapp\.com\/channel\/[^\s]+/i);
    if (!urlMatch) return reply('Need a full channel post URL.');
    const url = urlMatch[0];
    const emojis = q.replace(url, '').trim() || '❤️';
    await conn.sendPresenceUpdate('composing', mek.key.remoteJid);
    const res = await apiGet(`/api/Fun/rch2?action=react&url=${encodeURIComponent(url)}&emojis=${encodeURIComponent(emojis)}`);
    const d = res.data || res;
    const result = d.result || {};
    if (result.status !== true && res.success !== true) {
      throw new Error(JSON.stringify(d).slice(0, 400));
    }
    reply(
      `*Channel react sent*\n` +
      `URL: ${d.url || url}\n` +
      `Emojis: ${(d.emojis || [emojis]).join(' ')}\n` +
      `Account: ${result.account || 'n/a'}\n` +
      `Reacts: ${result.totalReacts || 1}\n` +
      `Points: ${result.points || 'n/a'}\n\n_${BRAND}_`
    );
  } catch (e) {
    reply(`rch2 failed: ${e.response?.data?.message || e.message}`);
  }
});
