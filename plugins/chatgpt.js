const { cmd } = require('../redx');
const axios = require('axios');

const BASE = 'https://eliteprotech-apis.zone.id/ai/chatgpt';
const OMEGA = 'https://api.omegatech.app/api/ai/Gpt-4-mini';

cmd({
  pattern: "chatgpt",
  alias: ["gpt","gpt5","elitegpt"],
  react: "🤖",
  desc: "ChatGPT with Omegatech GPT-4-mini fallback",
  category: "ai",
  filename: __filename
}, async (conn, mek, m, { q, reply }) => {
  if(!q) return reply('Use: .chatgpt Hi how are you');

  try{
    await conn.sendMessage(m.chat, { react: { text: "💬", key: mek.key } });

    try {
      const url = `${BASE}?prompt=${encodeURIComponent(q)}`;
      const { data } = await axios.get(url, { timeout: 40000 });
      const answer = data.text || data.result || data.response || '';
      if (data.success && answer) {
        return reply(`*GPT*\n\n${answer}`);
      }
    } catch (_) {}

    const { data } = await axios.get(`${OMEGA}?message=${encodeURIComponent(q)}`, { timeout: 60000 });
    const answer = data.answer || data.data?.answer || data.text || data.message;
    if (!answer) throw new Error('No response from GPT');
    await reply(`*GPT-4 mini*\n\n${answer}\n\n_Powered by Progress Tech_`);
  }catch(e){
    reply(`GPT failed: ${e.message}`);
  }
});