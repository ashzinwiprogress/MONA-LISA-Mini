const { cmd } = require('../redx');
const axios = require('axios');

const BASE = 'https://api.omegatech.app';
const BRAND = 'Powered by Progress Tech';
const CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';

global.secretSessions = global.secretSessions || {};
global.gemini2Sessions = global.gemini2Sessions || {};
global.deepseek2Sessions = global.deepseek2Sessions || {};

async function apiGet(pathAndQuery, timeout = 60000) {
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

function pickText(res) {
  return (
    res?.data?.reply ||
    res?.data?.response ||
    res?.reply ||
    res?.response ||
    res?.data?.text ||
    res?.text ||
    ''
  );
}

cmd({
  pattern: 'secret',
  alias: ['godsai', 'fable', 'claude5'],
  react: '🤫',
  desc: 'Omegatech Secret AI (Claude Fable 5) with session memory',
  category: 'ai',
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) {
      return reply(
        `*Secret AI*\nClaude Fable 5 via Omegatech\n\n` +
        `.secret your question\n.secret reset\n\n_${BRAND}_\n${CHANNEL_LINK}`
      );
    }
    const low = q.toLowerCase().trim();
    if (low === 'reset' || low === 'clear') {
      delete global.secretSessions[from];
      return reply('Secret session cleared.');
    }
    await conn.sendPresenceUpdate('composing', from);
    const sid = global.secretSessions[from] || '';
    let path = `/api/ai/Secret?action=chat&message=${encodeURIComponent(q)}`;
    if (sid) path += `&sessionId=${encodeURIComponent(sid)}`;
    const res = await apiGet(path);
    const newSid = res.sessionId || res.data?.sessionId;
    if (newSid) global.secretSessions[from] = newSid;
    const text = pickText(res);
    if (!text) throw new Error('Empty Secret reply');
    const model = res.data?.model || 'claude-fable-5';
    reply(`*Secret (${model})*\n\n${text}\n\n_${BRAND}_`);
  } catch (e) {
    reply(`Secret failed: ${e.response?.data?.message || e.message}`);
  }
});

cmd({
  pattern: 'gemini2',
  alias: ['g2', 'geminiweb', 'gem2'],
  react: '✨',
  desc: 'Omegatech Gemini2 chat with session memory',
  category: 'ai',
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) {
      return reply(
        `*Gemini2*\n\n.gemini2 your question\n.gemini2 reset\n\n_${BRAND}_\n${CHANNEL_LINK}`
      );
    }
    const low = q.toLowerCase().trim();
    if (low === 'reset' || low === 'clear') {
      delete global.gemini2Sessions[from];
      return reply('Gemini2 session cleared.');
    }
    await conn.sendPresenceUpdate('composing', from);
    const sid = global.gemini2Sessions[from] || '';
    let path = `/api/ai/Gemini2?action=chat&message=${encodeURIComponent(q)}`;
    if (sid) path += `&sessionId=${encodeURIComponent(sid)}`;
    const res = await apiGet(path);
    const newSid = res.data?.sessionId || res.sessionId;
    if (newSid) global.gemini2Sessions[from] = newSid;
    const text = pickText(res);
    if (!text) throw new Error('Empty Gemini2 reply');
    reply(`*Gemini2*\n\n${text}\n\n_${BRAND}_`);
  } catch (e) {
    reply(`Gemini2 failed: ${e.response?.data?.message || e.message}`);
  }
});

cmd({
  pattern: 'deepseek2',
  alias: ['ds2', 'dsv4', 'seek2'],
  react: '🧠',
  desc: 'Omegatech Deepseek2 (v4 flash) with session memory',
  category: 'ai',
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) {
      return reply(
        `*Deepseek2*\nModel: deepseek-v4-flash\n\n.deepseek2 your question\n.deepseek2 reset\n.deepseek2 v3 your question\n\n_${BRAND}_\n${CHANNEL_LINK}`
      );
    }
    const low = q.toLowerCase().trim();
    if (low === 'reset' || low === 'clear') {
      delete global.deepseek2Sessions[from];
      return reply('Deepseek2 session cleared.');
    }
    let model = 'v4';
    let message = q;
    const mm = q.match(/^(v3|v4|r1)\s+(.+)/i);
    if (mm) {
      model = mm[1].toLowerCase();
      message = mm[2];
    }
    await conn.sendPresenceUpdate('composing', from);
    const sid = global.deepseek2Sessions[from] || '';
    let path = `/api/ai/Deepseek2?action=chat&message=${encodeURIComponent(message)}&model=${encodeURIComponent(model)}`;
    if (sid) path += `&sessionId=${encodeURIComponent(sid)}`;
    const res = await apiGet(path);
    const newSid = res.sessionId || res.data?.sessionId;
    if (newSid) global.deepseek2Sessions[from] = newSid;
    const text = pickText(res);
    if (!text) throw new Error('Empty Deepseek2 reply');
    const used = res.model || model;
    reply(`*Deepseek2 (${used})*\n\n${text}\n\n_${BRAND}_`);
  } catch (e) {
    reply(`Deepseek2 failed: ${e.response?.data?.message || e.message}`);
  }
});
