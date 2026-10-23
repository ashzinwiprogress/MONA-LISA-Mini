const axios = require('axios');
const FormData = require('form-data');
const { fakevCard } = require('./fakevCard');
const config = require('../config');

const CHANNEL_LINK = config.CHANNEL_LINK || 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';

function wrapPayload(html) {
  const s = String(html || '').trim();
  if (/<html[\s>]/i.test(s)) return s;
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">' +
    '<style>html,body{margin:0;padding:0;background:#050510;color:#fff}</style>' +
    '</head><body>' + s + '</body></html>'
  );
}

function slug(title) {
  return String(title || 'game').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'game';
}

async function uploadHtml(html, name) {
  const buf = Buffer.from(wrapPayload(html), 'utf8');
  try {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', buf, { filename: `${name}.html`, contentType: 'text/html' });
    const { data } = await axios.post('https://catbox.moe/user/api.php', form, {
      headers: form.getHeaders(),
      timeout: 30000
    });
    if (typeof data === 'string' && /^https?:\/\//i.test(data.trim())) return data.trim();
  } catch (_) {}
  try {
    const form = new FormData();
    form.append('file', buf, { filename: `${name}.html`, contentType: 'text/html' });
    const { data } = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
      headers: form.getHeaders(),
      timeout: 30000
    });
    const url = data?.data?.url;
    if (url) return String(url).replace('tmpfiles.org/', 'tmpfiles.org/dl/');
  } catch (_) {}
  return null;
}

async function sendHtmlGame(conn, chatId, html, title) {
  const label = title || 'MONA LISA GAME';
  const name = slug(label);
  const page = wrapPayload(html);
  const url = await uploadHtml(page, name);
  const caption = url
    ? `*${label}*\n\nTap to play:\n${url}\n\nOpens in your browser on every WhatsApp.\n${CHANNEL_LINK}`
    : `*${label}*\n\nOpen the HTML file below to play.\n${CHANNEL_LINK}`;

  await conn.sendMessage(chatId, { text: caption }, { quoted: fakevCard });
  await conn.sendMessage(chatId, {
    document: Buffer.from(page, 'utf8'),
    mimetype: 'text/html',
    fileName: `${name}.html`,
    caption: `Open ${label}`
  });
}

module.exports = { sendHtmlGame, wrapPayload, uploadHtml };
