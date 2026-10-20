const { cmd } = require('../redx');
const axios = require('axios');
const FormData = require('form-data');

const BASE = 'https://api.omegatech.app';
const BRAND = 'Powered by Progress Tech';
const CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';
const NEWSLETTER_JID = '120363431455356251@newsletter';
const OWNER = 'Progress Tech';

const coderSessions = new Map();

function ctx() {
  return {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: NEWSLETTER_JID,
      serverMessageId: 142,
      newsletterName: 'PROGRESS TECH'
    }
  };
}

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

async function uploadCatbox(buffer, filename = 'file.jpg') {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', buffer, { filename });
  const { data } = await axios.post('https://catbox.moe/user/api.php', form, {
    headers: form.getHeaders(),
    timeout: 60000
  });
  if (typeof data === 'string' && data.startsWith('http')) return data.trim();
  throw new Error('Catbox upload failed');
}

function getQuotedMedia(m, mek) {
  if (m.quoted && (m.quoted.mtype === 'imageMessage' || m.quoted.message?.imageMessage || m.quoted.mtype === 'videoMessage' || m.quoted.mtype === 'documentMessage' || m.quoted.mtype === 'audioMessage' || m.quoted.mtype === 'stickerMessage')) {
    return m.quoted;
  }
  const msg = mek.message || {};
  if (msg.imageMessage || msg.videoMessage || msg.documentMessage || msg.audioMessage || msg.stickerMessage) return m;
  return null;
}

function mediaName(quoted, mek) {
  const msg = (quoted && quoted.message) || mek.message || {};
  if (msg.documentMessage?.fileName) return msg.documentMessage.fileName;
  if (msg.videoMessage) return 'video.mp4';
  if (msg.audioMessage) return 'audio.mp3';
  if (msg.stickerMessage) return 'sticker.webp';
  return 'file.jpg';
}

cmd({
  pattern: "userdrive",
  alias: ["udrive", "usersdrive", "udupload"],
  react: "☁️",
  desc: "Upload a file to UsersDrive via Omegatech",
  category: "tools",
  filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix }) => {
  try {
    const pre = prefix || '.';
    let fileUrl = (q || '').trim();
    let filename = 'ProgressTech';
    if (fileUrl.startsWith('http')) {
      const parts = fileUrl.split(/\s+/);
      fileUrl = parts[0];
      if (parts[1]) filename = parts.slice(1).join('_');
    } else if (fileUrl) {
      filename = fileUrl.replace(/\s+/g, '_') || filename;
      fileUrl = '';
    }

    const media = getQuotedMedia(m, mek);
    if (!fileUrl && media) {
      await reply('Uploading media...');
      const buf = await media.download();
      if (!buf) throw new Error('Could not download the replied media.');
      filename = mediaName(media, mek).replace(/\.[^.]+$/, '') || filename;
      fileUrl = await uploadCatbox(Buffer.from(buf), mediaName(media, mek));
    }

    if (!fileUrl || !fileUrl.startsWith('http')) {
      return reply(`*UsersDrive Upload*\n\nReply to a file/image with ${pre}userdrive\nOr: ${pre}userdrive https://files.catbox.moe/xxxx.jpg Name\n\n_${BRAND}_\nOwner: ${OWNER}\n${CHANNEL_LINK}`);
    }

    await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
    const res = await apiGet(`/api/tools/userdrive?action=upload&filename=${encodeURIComponent(filename)}&fileBase64=${encodeURIComponent(fileUrl)}`);
    const d = res.data || res;
    const text =
      `*UsersDrive Upload*\n\n` +
      `Name: ${d.name || filename}\n` +
      `Code: ${d.file_code || 'N/A'}\n` +
      `Size: ${d.size || 'N/A'}\n` +
      `Status: ${d.file_status || 'OK'}\n\n` +
      `Page: ${d.page_url || ''}\n` +
      `Download: ${d.download_page || ''}\n\n` +
      `_${BRAND}_\nOwner: ${OWNER}\n${CHANNEL_LINK}`;
    await conn.sendMessage(from, { text, contextInfo: ctx() }, { quoted: mek });
  } catch (e) {
    reply(`UsersDrive failed: ${e.message}`);
  }
});

cmd({
  pattern: "agenttts",
  alias: ["chatterbox", "freeaitts", "agentvoice"],
  react: "🎙️",
  desc: "Omegatech Agents text-to-speech (chatterbox)",
  category: "ai",
  filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix }) => {
  try {
    const pre = prefix || '.';
    if (!q) return reply(`*Agents TTS*\n\nUsage: ${pre}agenttts a cow in the city\nVoice: chatterbox\n\n_${BRAND}_`);
    let voice = 'chatterbox';
    let prompt = q.trim();
    const vm = prompt.match(/--voice\s+(\S+)/i);
    if (vm) { voice = vm[1]; prompt = prompt.replace(vm[0], '').trim(); }
    await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
    await reply(`Generating speech...\nVoice: ${voice}`);
    const res = await apiGet(`/api/ai/Agents?action=tts&prompt=${encodeURIComponent(prompt)}&model=qwen7b&slug=freeai&auto_approve=true&voice=${encodeURIComponent(voice)}`, 120000);
    const d = res.data || res;
    const audio = d.audio || d.url;
    if (!audio) throw new Error('No audio URL returned');
    await conn.sendMessage(from, {
      audio: { url: audio },
      mimetype: 'audio/wav',
      ptt: false,
      fileName: 'agenttts.wav',
      contextInfo: ctx()
    }, { quoted: mek });
    if (d.share_url) {
      await reply(`Share: ${d.share_url}\n\n_${BRAND}_\nOwner: ${OWNER}\n${CHANNEL_LINK}`);
    }
  } catch (e) {
    reply(`Agents TTS failed: ${e.message}`);
  }
});

cmd({
  pattern: "railway",
  alias: ["rwbox", "railcreate", "rwcreate"],
  react: "🚂",
  desc: "Create a Railway trial preview box",
  category: "tools",
  filename: __filename
}, async (conn, mek, m, { from, reply }) => {
  try {
    await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
    await reply('Creating Railway trial box...');
    const res = await apiGet('/api/tools/railway?action=create', 90000);
    const d = res.data || res;
    const text =
      `*Railway Trial Box*\n\n` +
      `Status: ${d.status || d.state || 'starting'}\n` +
      `Preview: ${d.preview_url || d.access?.preview_url || 'N/A'}\n` +
      `Claim: ${d.claim_url || d.access?.claim_url || 'N/A'}\n` +
      `Expires: ${d.build_expires_at || d.access?.build_expires_at || 'N/A'}\n\n` +
      `${d.note || 'Open the claim URL in a browser to keep the box.'}\n\n` +
      `_${BRAND}_\nOwner: ${OWNER}\n${CHANNEL_LINK}`;
    await conn.sendMessage(from, { text, contextInfo: ctx() }, { quoted: mek });
  } catch (e) {
    reply(`Railway create failed: ${e.message}`);
  }
});

cmd({
  pattern: "coder",
  alias: ["agentscoder", "qwencoder", "codesession"],
  react: "💻",
  desc: "Omegatech Agents coder sandbox session",
  category: "ai",
  filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix, sender }) => {
  try {
    const pre = prefix || '.';
    if (!q) {
      return reply(`*Agents Coder*\n\nStart: ${pre}coder make a landing page\nContinue: ${pre}coder add a dark theme\nNew session: ${pre}coder reset\n\n_${BRAND}_`);
    }
    const key = String(sender || from);
    const low = q.trim().toLowerCase();
    if (low === 'reset' || low === 'clear') {
      coderSessions.delete(key);
      return reply('Coder session cleared.');
    }

    let sessionId = coderSessions.get(key);
    if (!sessionId) {
      await reply('Starting coder session...');
      const started = await apiGet(`/api/ai/Agents?action=coder_session&message=${encodeURIComponent(q)}`, 90000);
      const d = started.data || started;
      sessionId = d.session_id || d.session?.session_id;
      if (!sessionId) throw new Error('No session_id returned');
      coderSessions.set(key, sessionId);
    }

    await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
    const res = await apiGet(`/api/ai/Agents?action=coder_message&session_id=${encodeURIComponent(sessionId)}&message=${encodeURIComponent(q)}&auto_approve=true`, 120000);
    const d = res.data || res;
    const answer = d.reply || d.message || d.output || d.result || d.hint || JSON.stringify(d).slice(0, 1500);
    await conn.sendMessage(from, {
      text: `*Agents Coder*\nSession: ${sessionId.slice(0, 8)}\n\n${answer}\n\n_${BRAND}_\nOwner: ${OWNER}\n${CHANNEL_LINK}`,
      contextInfo: ctx()
    }, { quoted: mek });
  } catch (e) {
    reply(`Agents coder failed: ${e.message}`);
  }
});

cmd({
  pattern: "senzia",
  alias: ["senzimg", "wanimg", "senziat2i"],
  react: "🎨",
  desc: "Senzia text-to-image (os-wan2.6)",
  category: "image",
  filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix }) => {
  try {
    const pre = prefix || '.';
    if (!q) return reply(`*Senzia Image*\n\nUsage: ${pre}senzia a cow in the city\nModel: os-wan2.6-image\n\n_${BRAND}_`);
    const banned = /\b(undress|nsfw|nude|naked|porn|xxx|sex)\b/i;
    if (banned.test(q)) return reply('That prompt is not allowed.');
    await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
    await reply(`Generating image...\nPrompt: ${q}`);
    const res = await apiGet(`/api/ai/senzia?action=generate&prompt=${encodeURIComponent(q)}&scene=t2i&model=os-wan2.6-image&resolution=480P`, 120000);
    const d = res.data || res;
    const imageUrl = d.resultUrl || d.url || d.image || d.thumbnailUrl;
    if (!imageUrl) throw new Error('No image URL returned');
    const caption = `*Senzia Image*\nPrompt: ${q}\nStatus: ${d.status || 'done'}\n\n_${BRAND}_\nOwner: ${OWNER}\n${CHANNEL_LINK}`;
    await conn.sendMessage(from, { image: { url: imageUrl }, caption, contextInfo: ctx() }, { quoted: mek });
  } catch (e) {
    reply(`Senzia failed: ${e.message}`);
  }
});
