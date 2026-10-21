const { cmd } = require('../redx');
const axios = require('axios');

const API = 'https://api.omegatech.app/api/tools/tempgmail';
const BRAND = 'Powered by Progress Tech';
const CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';

global.tempGmail = global.tempGmail || {};

async function callApi(params) {
  const { data } = await axios.get(API, { params, timeout: 45000 });
  if (data && data.success === false) {
    throw new Error(data.message || data.error || 'Request failed');
  }
  return data;
}

function extractOTP(text) {
  if (!text) return null;
  const patterns = [
    /\b\d{6}\b/,
    /code[:\s-]*(\d{4,8})/i,
    /OTP[:\s-]*(\d{4,8})/i,
    /verification[:\s-]*(\d{4,8})/i,
    /\b\d{4,8}\b/
  ];
  for (const p of patterns) {
    const m = String(text).match(p);
    if (m) return (m[1] || m[0]).replace(/\D/g, '').slice(0, 8);
  }
  return null;
}

cmd({
  pattern: 'tempgmail',
  alias: ['tgmail', 'gmailtmp', 'gmailtemp'],
  react: '📧',
  desc: 'Create a temporary Gmail-style address via Omegatech tempgmail',
  category: 'tools',
  filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix }) => {
  try {
    const pre = prefix || '.';
    const args = (q || '').trim().split(/\s+/).filter(Boolean);
    const act = (args[0] || 'create').toLowerCase();
    const p1 = args[1] || global.tempGmail[from]?.email || '';

    if (!q || ['help', 'menu'].includes(act)) {
      const cur = global.tempGmail[from]?.email || 'none';
      return reply(
        `*Temp Gmail*\nCurrent: ${cur}\n\n` +
        `${pre}tempgmail create\n` +
        `${pre}tempgmail inbox\n` +
        `${pre}tempgmail otp\n` +
        `${pre}tempgmail wait\n\n_${BRAND}_\n${CHANNEL_LINK}`
      );
    }

    if (['create', 'new', 'gen', 'make'].includes(act)) {
      await conn.sendMessage(from, { react: { text: '📧', key: mek.key } });
      const data = await callApi({ action: 'create', dot: '.', plus: '+', wait: 'true' });
      const d = data.data || data;
      const email = d.email || d.address;
      if (!email) throw new Error('No email returned: ' + JSON.stringify(data).slice(0, 400));
      global.tempGmail[from] = { email, createdAt: Date.now() };
      return reply(
        `*Temp Gmail created*\n\nAddress: ${email}\n\n` +
        `Inbox: ${pre}tempgmail inbox\nOTP: ${pre}tempgmail otp\n\n_${BRAND}_`
      );
    }

    if (['inbox', 'messages', 'list', 'check', 'otp', 'wait'].includes(act)) {
      const email = p1 || global.tempGmail[from]?.email;
      if (!email) return reply(`Create one first: ${pre}tempgmail create`);
      await conn.sendPresenceUpdate('composing', from);

      let inboxData = null;
      const tries = [
        { action: 'inbox', email },
        { action: 'messages', email },
        { action: 'inbox', address: email },
        { action: 'list', email },
        { action: 'wait', email, wait: 'true' }
      ];
      let lastErr = '';
      for (const par of tries) {
        try {
          const res = await callApi(par);
          if (res && (res.data || res.result || Array.isArray(res) || res.success)) {
            inboxData = res;
            break;
          }
        } catch (err) {
          lastErr = err.message;
        }
      }
      if (!inboxData) {
        return reply(`Inbox not available yet for ${email}${lastErr ? `\n${lastErr}` : ''}\nTry again after mail arrives.`);
      }

      const d = inboxData.data || inboxData.result || inboxData;
      let messages = [];
      if (Array.isArray(d)) messages = d;
      else messages = d.messages || d.mails || d.inbox || d.data || [];
      if (!Array.isArray(messages)) messages = [];

      if (!messages.length) {
        const extra = typeof d === 'object' ? JSON.stringify(d).slice(0, 800) : '';
        return reply(`Inbox empty for ${email}${extra && extra !== '{}' ? `\n\n${extra}` : ''}`);
      }

      if (act === 'otp') {
        for (const mail of messages) {
          const code = extractOTP(JSON.stringify(mail));
          if (code) {
            return reply(`*OTP found*\nCode: ${code}\nFrom: ${mail.from || mail.sender || ''}\nSubject: ${mail.subject || ''}`);
          }
        }
        return reply(`No OTP in ${messages.length} mail(s) for ${email}.`);
      }

      let out = `*Inbox — ${email}*\n${messages.length} mail(s)\n\n`;
      messages.slice(0, 8).forEach((mail, i) => {
        out += `${i + 1}. ${mail.subject || '(no subject)'}\n`;
        out += `From: ${mail.from || mail.sender || 'Unknown'}\n`;
        const preview = (mail.body || mail.text || mail.preview || '').toString().slice(0, 120);
        if (preview) out += `${preview}\n`;
        const code = extractOTP(JSON.stringify(mail));
        if (code) out += `OTP: ${code}\n`;
        out += '\n';
      });
      return reply(out + `_${BRAND}_`);
    }

    return reply(`Unknown action. Use ${pre}tempgmail create | inbox | otp`);
  } catch (e) {
    reply(`Temp Gmail failed: ${e.response?.data?.message || e.message}`);
  }
});
