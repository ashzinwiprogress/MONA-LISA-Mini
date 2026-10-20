const { cmd } = require('../redx');
const axios = require('axios');

const OMEGA = 'https://api.omegatech.app/api/ai/Asyntai';
const FALLBACK = 'https://eliteprotech-apis.zone.id/ai/asyntai';
const BRAND = 'Powered by Progress Tech';
const CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';
const sessions = new Map();

cmd({
  pattern: "asyntai",
  alias: ["asyn", "askai", "asynt"],
  react: "🤖",
  desc: "Chat with Asyntai via Omegatech",
  category: "ai",
  filename: __filename
}, async (conn, mek, m, { q, reply, sender }) => {
  if (!q) return reply('Use: .asyntai Hi how are you?\nClear: .clearai');

  try {
    const prev = sessions.get(sender) || '';
    let answer = '';
    let sessionId = prev;

    try {
      const params = { action: 'chat', message: q };
      if (prev) params.sessionId = prev;
      const { data } = await axios.get(OMEGA, { params, timeout: 40000 });
      if (data && data.success !== false) {
        answer = data.reply || data.response || data.result || data.message || '';
        sessionId = data.sessionId || data.session_id || prev;
      }
    } catch (_) {}

    if (!answer) {
      const url = `${FALLBACK}?prompt=${encodeURIComponent(q)}${prev ? `&session_id=${prev}` : ''}`;
      const { data } = await axios.get(url, { timeout: 20000 });
      if (!data?.success) throw new Error(JSON.stringify(data).slice(0, 400));
      answer = data.response || data.result || data.reply || '';
      sessionId = data.session_id || data.sessionId || prev;
    }

    if (!answer) throw new Error('Empty Asyntai reply');
    if (sessionId) sessions.set(sender, sessionId);
    await reply(`*Asyntai*\n\n${answer}\n\n_${BRAND}_\n${CHANNEL_LINK}`);
  } catch (e) {
    reply(`Asyntai failed: ${e.message}`);
  }
});

cmd({
  pattern: "clearai",
  react: "🗑️",
  desc: "Clear Asyntai session",
  category: "ai",
  filename: __filename
}, async (conn, mek, m, { sender, reply }) => {
  sessions.delete(sender);
  reply('Asyntai session cleared.');
});
