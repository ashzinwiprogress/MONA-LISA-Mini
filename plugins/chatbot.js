const { cmd } = require('../redx');
const axios = require('axios');
const FormData = require('form-data');

const OCR_API = 'https://api.omegatech.app/api/tools/Ocr';
const BRAND = 'Powered by Progress Tech';
const CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';
const BASE = 'https://api.omegatech.app';

global.claudeSessions = global.claudeSessions || {};
global.autoChatbot = global.autoChatbot || {};
global.chatbotBusy = global.chatbotBusy || {};
global.chatbotMemory = global.chatbotMemory || {};
global.chatbotSkipPrimary = global.chatbotSkipPrimary || false;
global.chatbotProviderSid = global.chatbotProviderSid || {};

const LIMIT_RE = /free usage limit|upgrade to vip|vip to continue|quota exceeded|rate.?limit|insufficient credit|credits? (are )?over/i;

function pickText(res) {
  if (!res) return '';
  if (typeof res === 'string') return res;
  return (
    res.data?.reply ||
    res.data?.response ||
    res.data?.answer ||
    res.data?.result ||
    res.data?.text ||
    res.reply ||
    res.response ||
    res.answer ||
    res.result ||
    res.text ||
    ''
  );
}

function isBlocked(text, res) {
  const blob = `${text || ''} ${JSON.stringify(res || {})}`;
  return LIMIT_RE.test(blob);
}

function remember(from, user, assistant) {
  const list = global.chatbotMemory[from] || [];
  list.push({ role: 'user', content: String(user || '').slice(0, 1200) });
  list.push({ role: 'assistant', content: String(assistant || '').slice(0, 1200) });
  global.chatbotMemory[from] = list.slice(-20);
}

function withMemory(from, message) {
  const hist = global.chatbotMemory[from] || [];
  if (!hist.length) return message;
  const lines = hist.slice(-12).map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`);
  return `You are MONA LISA, a helpful chatbot by Progress Tech. Continue the conversation naturally. Help with schoolwork, coding, and everyday questions. Remember prior context.\n\n${lines.join('\n')}\nUser: ${message}`;
}

async function getJson(url, timeout = 45000) {
  const { data } = await axios.get(url, {
    timeout,
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    maxRedirects: 5
  });
  return data;
}

const PROVIDERS = [
  {
    name: 'Chatbot',
    skip: () => global.chatbotSkipPrimary,
    call: async (message, sid, needSearch) => {
      const params = { action: 'chat', message, needSearch: String(!!needSearch) };
      if (sid) params.sessionId = sid;
      const { data } = await axios.get(`${BASE}/api/ai/Chatbot`, { params, timeout: 45000 });
      return { text: pickText(data), sessionId: data.sessionId || data.data?.sessionId, raw: data };
    }
  },
  {
    name: 'Secret',
    call: async (message, sid) => {
      let url = `${BASE}/api/ai/Secret?action=chat&message=${encodeURIComponent(message)}`;
      if (sid) url += `&sessionId=${encodeURIComponent(sid)}`;
      const data = await getJson(url);
      return { text: pickText(data), sessionId: data.sessionId || data.data?.sessionId, raw: data };
    }
  },
  {
    name: 'Gemini2',
    call: async (message, sid) => {
      let url = `${BASE}/api/ai/Gemini2?action=chat&message=${encodeURIComponent(message)}`;
      if (sid) url += `&sessionId=${encodeURIComponent(sid)}`;
      const data = await getJson(url);
      return { text: pickText(data), sessionId: data.data?.sessionId || data.sessionId, raw: data };
    }
  },
  {
    name: 'Deepseek2',
    call: async (message, sid) => {
      let url = `${BASE}/api/ai/Deepseek2?action=chat&message=${encodeURIComponent(message)}&model=v4`;
      if (sid) url += `&sessionId=${encodeURIComponent(sid)}`;
      const data = await getJson(url);
      return { text: pickText(data), sessionId: data.sessionId || data.data?.sessionId, raw: data };
    }
  },
  {
    name: 'GPT4mini',
    call: async (message) => {
      const data = await getJson(`${BASE}/api/ai/Gpt-4-mini?message=${encodeURIComponent(message)}`);
      return { text: pickText(data) || data.answer, sessionId: '', raw: data };
    }
  },
  {
    name: 'Hotbot',
    call: async (message, sid) => {
      const params = { action: 'chat', prompt: message, message, model: 'gpt-4o-mini' };
      if (sid) params.sessionId = sid;
      const { data } = await axios.get(`${BASE}/api/ai/hotbot`, { params, timeout: 60000 });
      return { text: pickText(data), sessionId: data.data?.sessionId || data.sessionId, raw: data };
    }
  }
];

async function answerChat(conn, mek, from, message, needSearch) {
  const prompt = withMemory(from, message);
  const errors = [];

  for (const provider of PROVIDERS) {
    if (provider.skip && provider.skip()) continue;
    const sidMap = global.chatbotProviderSid[from] || {};
    const sid = sidMap[provider.name] || (provider.name === 'Chatbot' ? global.claudeSessions[from] : '');
    try {
      const res = await provider.call(prompt, sid, needSearch);
      const text = String(res.text || '').trim();
      if (!text) {
        errors.push(`${provider.name}: empty`);
        continue;
      }
      if (isBlocked(text, res.raw)) {
        if (provider.name === 'Chatbot') global.chatbotSkipPrimary = true;
        errors.push(`${provider.name}: limit`);
        continue;
      }
      if (res.sessionId) {
        global.chatbotProviderSid[from] = global.chatbotProviderSid[from] || {};
        global.chatbotProviderSid[from][provider.name] = res.sessionId;
        if (provider.name === 'Chatbot') global.claudeSessions[from] = res.sessionId;
      }
      remember(from, message, text);
      await conn.sendMessage(from, {
        text: `${text}\n\n_${BRAND}_`
      }, { quoted: mek });
      return text;
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'error';
      if (LIMIT_RE.test(String(msg))) {
        if (provider.name === 'Chatbot') global.chatbotSkipPrimary = true;
      }
      errors.push(`${provider.name}: ${msg}`);
    }
  }

  throw new Error(`All chatbot providers failed (${errors.slice(0, 4).join(' | ')})`);
}

async function uploadCatbox(buffer, fileName = 'homework.jpg') {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', buffer, { filename: fileName });
  const { data } = await axios.post('https://catbox.moe/user/api.php', form, {
    headers: form.getHeaders(),
    timeout: 45000
  });
  if (typeof data === 'string' && data.trim().startsWith('http')) return data.trim();
  throw new Error('Image upload failed');
}

async function ocrImage(imageUrl) {
  const { data } = await axios.get(OCR_API, {
    params: { action: 'extract', imageUrl },
    timeout: 45000
  });
  const result = data?.data || data;
  const text = result?.text || result?.extracted || result?.result || result?.data || '';
  return typeof text === 'string' ? text.trim() : JSON.stringify(text);
}

function hasImage(mek, m) {
  if (mek.message?.imageMessage) return { source: 'direct' };
  if (m.quoted && (m.quoted.mtype === 'imageMessage' || m.quoted.imageMessage || m.quoted.message?.imageMessage)) {
    return { source: 'quoted' };
  }
  return null;
}

async function downloadImage(conn, mek, m, info) {
  if (info.source === 'quoted' && m.quoted?.download) return m.quoted.download();
  if (m.download) return m.download();
  const img = mek.message?.imageMessage;
  if (img) return conn.downloadMediaMessage({ message: { imageMessage: img } });
  return null;
}

function quotedLlamaZip(m) {
  const stanzaId = m.quoted?.key?.id || m.quoted?.stanzaId;
  if (stanzaId && global.llamaZipIds && global.llamaZipIds[stanzaId]) return true;
  const doc = m.quoted?.documentMessage || m.quoted?.message?.documentMessage;
  const name = (doc && doc.fileName) || '';
  const mime = (doc && doc.mimetype) || '';
  if (/\.zip$/i.test(name) || /zip/i.test(mime)) {
    return /llama|mona-lisa-app|LLAMACODER/i.test(name + (m.quoted?.text || ''));
  }
  return false;
}

cmd({
  pattern: 'chatbot',
  alias: ['aichat', 'progresschat', 'autochat'],
  react: '🧠',
  desc: 'Auto chatbot for this chat — prefix optional when ON',
  category: 'ai',
  filename: __filename
}, async (conn, mek, m, { from, q, reply, isGroup, isAdmins, isOwner }) => {
  try {
    const low = (q || '').toLowerCase().trim();

    if (!q) {
      const on = !!global.autoChatbot[from];
      return reply(
        `*Progress Chatbot*\nAuto: ${on ? 'ON' : 'OFF'} in this ${isGroup ? 'group' : 'chat'}\n\n` +
        `.chatbot on — reply to every plain message here\n` +
        `.chatbot off — stop auto replies\n` +
        `.chatbot <question> — one-shot chat\n` +
        `.chatbot search <query> — with web search\n` +
        `.chatbot reset — new session\n\n` +
        `When ON, send a photo of homework and I will read and solve it.\n\n_${BRAND}_\n${CHANNEL_LINK}`
      );
    }

    if (low === 'on' || low === 'enable' || low === 'start') {
      if (isGroup && !isAdmins && !isOwner) {
        return reply('Only a group admin can turn auto chatbot on.');
      }
      global.autoChatbot[from] = true;
      return reply(
        `Auto chatbot is ON in this ${isGroup ? 'group' : 'private chat'} only.\n` +
        `Send any message (no prefix) and I will reply.\n` +
        `Send or reply with an assignment photo and I will read the question and answer it.\n` +
        `Use .chatbot off to stop.`
      );
    }

    if (low === 'off' || low === 'disable' || low === 'stop') {
      if (isGroup && !isAdmins && !isOwner) {
        return reply('Only a group admin can turn auto chatbot off.');
      }
      global.autoChatbot[from] = false;
      return reply(`Auto chatbot is OFF in this ${isGroup ? 'group' : 'private chat'}.`);
    }

    if (low === 'reset' || low === 'clear') {
      delete global.claudeSessions[from];
      delete global.chatbotMemory[from];
      delete global.chatbotProviderSid[from];
      return reply('Session cleared. New chat will start fresh.');
    }

    if (low === 'history' || low === 'session') {
      const sid = global.claudeSessions[from] || 'None';
      return reply(`Session: ${sid}\nAuto: ${global.autoChatbot[from] ? 'ON' : 'OFF'}\nMemory turns: ${(global.chatbotMemory[from] || []).length}`);
    }

    let needSearch = false;
    let message = q;
    if (q.includes('--search')) {
      const mm = q.match(/--search\s+(true|false)/i);
      if (mm) {
        needSearch = mm[1].toLowerCase() === 'true';
        message = q.replace(/--search\s+(true|false)/i, '').trim();
      } else {
        needSearch = true;
        message = q.replace(/--search/g, '').trim();
      }
    }
    if (low.startsWith('search ')) {
      needSearch = true;
      message = q.replace(/^search\s+/i, '');
    }

    const img = hasImage(mek, m);
    if (img) {
      try {
        const buf = await downloadImage(conn, mek, m, img);
        if (buf) {
          const url = await uploadCatbox(Buffer.from(buf), `chatbot_${Date.now()}.jpg`);
          const extracted = await ocrImage(url);
          message = `${message || 'Please solve this.'}\n\nImage text:\n${extracted || '(no text extracted)'}`;
        }
      } catch (err) {
        message = `${message || 'Please help with this image.'}\n(Could not read image: ${err.message})`;
      }
    }

    if (!message) return reply('Give a message: .chatbot hello');

    await conn.sendMessage(from, { react: { text: '💭', key: mek.key } });
    await conn.sendPresenceUpdate('composing', from);
    await answerChat(conn, mek, from, message, needSearch);
  } catch (e) {
    console.error('Claude error', e.response?.data || e.message);
    reply(`Chatbot failed: ${e.response?.data?.message || e.message}`);
  }
});

cmd({
  pattern: 'chatbot-auto',
  on: 'body',
  dontAddCommandList: true,
  filename: __filename
}, async (conn, mek, m, { from, body, isCmd, fromMe, isGroup, sender, reply }) => {
  try {
    if (!global.autoChatbot[from]) return;
    if (isCmd || fromMe) return;
    if (quotedLlamaZip(m)) return;
    if (global.chatbotBusy[from]) return;

    const text = String(body || '').trim();
    const img = hasImage(mek, m);
    if (!text && !img) return;
    if (/^[-.\/!][a-z]/i.test(text)) return;

    global.chatbotBusy[from] = true;
    try {
      await conn.sendPresenceUpdate('composing', from);
      let message = text;
      if (isGroup && sender) {
        const name = mek.pushName || 'User';
        message = message
          ? `User ${name} in the group said: ${message}`
          : `User ${name} in the group sent an image.`;
      }

      if (img) {
        try {
          const buf = await downloadImage(conn, mek, m, img);
          if (buf) {
            await reply('Reading the image...');
            const url = await uploadCatbox(Buffer.from(buf), `homework_${Date.now()}.jpg`);
            const extracted = await ocrImage(url);
            message +=
              `\n\nThe user uploaded a paper/image. Extracted text:\n${extracted || '(no readable text)'}\n` +
              `If this is homework or an assignment, solve it step by step. Remember our conversation.`;
          }
        } catch (err) {
          message += `\n(Could not read the image: ${err.message})`;
        }
      }

      if (!message) return;
      await answerChat(conn, mek, from, message, false);
    } finally {
      global.chatbotBusy[from] = false;
    }
  } catch (e) {
    global.chatbotBusy[from] = false;
    console.error('auto chatbot', e.response?.data || e.message);
    try {
      await conn.sendMessage(from, {
        text: `Chatbot failed: ${e.response?.data?.message || e.message}`
      }, { quoted: mek });
    } catch (_) {}
  }
});
