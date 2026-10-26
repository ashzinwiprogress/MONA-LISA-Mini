const { cmd } = require('../redx');
const axios = require('axios');

const API = 'https://api.omegatech.app/api/ai/wrmgpt';
const BRAND = 'Powered by Progress Tech';
const CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';
const DEFAULT_MODE = 'tool-explainer';
const CHUNK = 3500;

const sessions = new Map();

async function wrmChat({ prompt, mode, chatId }) {
  const params = {
    action: 'chat',
    prompt,
    mode: mode || DEFAULT_MODE
  };
  if (chatId) params.chatId = chatId;
  const { data } = await axios.get(API, {
    params,
    timeout: 90000,
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }
  });
  if (data && data.success === false) {
    throw new Error(data.error || data.message || 'wrmgpt failed');
  }
  return data?.data || data;
}

async function sendChunks(conn, from, mek, text) {
  const s = String(text || '').trim();
  if (!s) return;
  for (let i = 0; i < s.length; i += CHUNK) {
    await conn.sendMessage(from, { text: s.slice(i, i + CHUNK) }, { quoted: mek });
  }
}

function menuText(pre, sess) {
  return (
    `*WORMGPT* (educational)\n` +
    `Omegatech /api/ai/wrmgpt • mode: ${sess.mode}\n` +
    `Session: ${sess.chatId ? sess.chatId.slice(0, 22) : 'new'}\n\n` +
    `*Usage*\n` +
    `${pre}wormgpt <prompt>\n` +
    `${pre}wormgpt mode tool-explainer\n` +
    `${pre}wormgpt reset\n\n` +
    `Follow-up messages reuse the same chatId.\n${BRAND}\n${CHANNEL_LINK}`
  );
}

cmd({
  pattern: 'wormgpt',
  alias: ['wrmgpt', 'warmgpt', 'wrm', 'worm', 'toolgpt'],
  react: '🪱',
  desc: 'Educational WormGPT chat via Omegatech wrmgpt (tool-explainer, session)',
  category: 'ai',
  use: '.wormgpt explain prepared statements',
  filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix }) => {
  try {
    const pre = prefix || '.';
    const key = m.sender;
    const sess = sessions.get(key) || { chatId: '', mode: DEFAULT_MODE };
    const raw = String(q || '').trim();
    const low = raw.toLowerCase();

    if (!raw || low === 'help' || low === 'menu') {
      return reply(menuText(pre, sess));
    }

    if (low === 'reset' || low === 'clear' || low === 'new') {
      sessions.delete(key);
      return reply(`WormGPT session cleared. Next message starts a new chat.\nMode: ${DEFAULT_MODE}`);
    }

    if (low.startsWith('mode ')) {
      const mode = raw.slice(5).trim() || DEFAULT_MODE;
      sessions.set(key, { ...sess, mode });
      return reply(`WormGPT mode set to *${mode}*`);
    }

    await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
    await conn.sendPresenceUpdate('composing', from).catch(() => {});

    const data = await wrmChat({
      prompt: raw,
      mode: sess.mode,
      chatId: sess.chatId
    });

    const text = data?.text || data?.reply || data?.message || data?.answer || '';
    const chatId = data?.chatId || data?.next?.chatId || sess.chatId;
    const mode = data?.mode || sess.mode;
    const model = data?.model || data?.brand || 'WormGPT';

    sessions.set(key, { chatId, mode });

    if (!text) {
      return reply('No reply from WormGPT. Try again or .wormgpt reset');
    }

    const head = `*${model}* • ${mode}\n\n`;
    const foot = `\n\n_${BRAND}_`;
    await sendChunks(conn, from, mek, head + text + foot);
  } catch (e) {
    console.error('WormGPT error', e.response?.data || e.message);
    reply(`WormGPT failed: ${e.response?.data?.error || e.response?.data?.message || e.message}`);
  }
});
