const { cmd } = require('../redx');
const axios = require('axios');

const API = 'https://api.omegatech.app/api/tools/Temp-number';
const OWNER_NAME = 'Progress Tech';
const OWNER_PHONE = '237698830792';
const OWNER_WA = `https://wa.me/${OWNER_PHONE}`;
const CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';
const BRAND = 'Powered by Progress Tech';

const PLATFORMS = [
  'WhatsApp',
  'Google / Gmail',
  'Facebook',
  'Instagram',
  'TikTok',
  'Telegram',
  'X / Twitter',
  'BIGO LIVE',
  'PayPal',
  'Huawei',
  'Viber',
  'Snapchat'
];

const numberCache = new Map();
const waitLocks = new Set();

function looksLikeOtpDigits(d) {
  if (!d || d.length < 4 || d.length > 10) return false;
  if (/^0+$/.test(d)) return false;
  if (/^20\d{2}$/.test(d)) return false;
  return true;
}

function extractCode(text) {
  if (!text) return null;
  const s = String(text);

  const wa = s.match(/(?:whatsapp|kode|codigo|код)[^\d]{0,48}(\d{3})-(\d{3})\b/i)
    || (/(?:whatsapp|kode|codigo|код)/i.test(s) ? s.match(/\b(\d{3})-(\d{3})\b/) : null);
  if (wa) return wa[1] + wa[2];

  const google = s.match(/\bG-(\d{4,8})\b/i);
  if (google) return google[1];

  const leadingLabel = s.match(/(?:code|otp|pin|verify|verification|пароль|код|验证码|驗證碼|kode|codigo)[^\d]{0,24}(\d{4,10})/i);
  if (leadingLabel && looksLikeOtpDigits(leadingLabel[1])) return leadingLabel[1];

  const trailingLabel = s.match(/\b(\d{4,10})\b[^\n]{0,40}(?:code|otp|pin|verify|verification|код)/i);
  if (trailingLabel && looksLikeOtpDigits(trailingLabel[1])) return trailingLabel[1];

  const glued = s.match(/OTP\s*[:#-]?\s*(\d{4,8})/i);
  if (glued) return glued[1];

  const lead = s.match(/^(\d{4,8})\b/);
  if (lead && looksLikeOtpDigits(lead[1])) return lead[1];

  const codes = [...s.matchAll(/\b(\d{4,8})\b/g)]
    .map((x) => x[1])
    .filter((c) => looksLikeOtpDigits(c));
  return codes.length ? codes[codes.length - 1] : null;
}

function digits(n) {
  return String(n || '').replace(/[^\d]/g, '');
}

function displayNumber(n) {
  const d = digits(n);
  return d ? `+${d}` : String(n || '');
}

function countryKey(name) {
  return String(name || 'Unknown').trim();
}

function countrySlug(name) {
  return countryKey(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';
}

async function fetchAPI(action, limit = 80) {
  const { data } = await axios.get(API, {
    params: { action, limit },
    timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }
  });
  return data?.data || data?.result || data;
}

function normalizeNumbers(raw) {
  const list = raw?.numbers || raw?.result || raw?.data || (Array.isArray(raw) ? raw : []);
  const out = [];
  const seen = new Set();
  for (const n of Array.isArray(list) ? list : []) {
    const num = digits(n.number || n.phone);
    if (!num || seen.has(num)) continue;
    seen.add(num);
    out.push({
      id: n.id || num,
      number: num,
      country: countryKey(n.country || 'Unknown'),
      flag: n.flag || '',
      countryCode: String(n.countryCode || '').replace(/\D/g, '')
    });
  }
  return out;
}

function groupCountries(numbers) {
  const map = new Map();
  for (const n of numbers) {
    const key = n.country;
    if (!map.has(key)) map.set(key, { name: key, flag: n.flag || '', code: n.countryCode || '', numbers: [] });
    map.get(key).numbers.push(n);
  }
  return [...map.values()].filter((c) => c.numbers.length > 0).sort((a, b) => b.numbers.length - a.numbers.length);
}

function matchOtp(otp, target) {
  const num = digits(otp.number || otp.phone);
  const tgt = digits(target);
  if (!num || !tgt) return false;
  if (num === tgt) return true;
  const longer = num.length >= tgt.length ? num : tgt;
  const shorter = num.length >= tgt.length ? tgt : num;
  return shorter.length >= 8 && longer.endsWith(shorter);
}

function otpFromItem(item) {
  const raw = String(item?.otp || '').trim();
  const rawDigits = raw.replace(/\D/g, '');
  if (raw && !/no otp|link/i.test(raw) && looksLikeOtpDigits(rawDigits)) return rawDigits;
  const fromMsg = extractCode(item?.message || item?.text || '');
  return fromMsg ? String(fromMsg).replace(/\D/g, '') : '';
}

async function sendButtons(conn, from, body, buttons, footer) {
  await conn.relayMessage(from, {
    interactiveMessage: {
      header: { title: 'Free Virtual Number', hasMediaAttachment: false },
      body: { text: body },
      footer: { text: footer || `${BRAND} | Issues: ${OWNER_NAME} +${OWNER_PHONE}` },
      nativeFlowMessage: { buttons }
    }
  }, {
    additionalNodes: [{
      tag: 'biz',
      attrs: {},
      content: [{
        tag: 'interactive',
        attrs: { type: 'native_flow', v: '1' },
        content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
      }]
    }]
  });
}

function startButtons(prefix) {
  return [
    {
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({ display_text: 'Get Free Virtual Number', id: `${prefix}tempnumber start` })
    },
    {
      name: 'cta_url',
      buttonParamsJson: JSON.stringify({ display_text: `Contact ${OWNER_NAME}`, url: OWNER_WA })
    },
    {
      name: 'cta_url',
      buttonParamsJson: JSON.stringify({ display_text: 'Channel', url: CHANNEL_LINK })
    }
  ];
}

async function loadFresh(sender) {
  const d = await fetchAPI('numbers', 80);
  const numbers = normalizeNumbers(d).slice(0, 200);
  const countries = groupCountries(numbers);
  const pack = { numbers, countries, total: d.total || numbers.length, ts: Date.now() };
  numberCache.set(sender, pack);
  return pack;
}

async function getPack(sender) {
  const cached = numberCache.get(sender);
  if (cached && Date.now() - cached.ts < 180000 && cached.countries.length) return cached;
  return loadFresh(sender);
}

async function watchOtp(conn, from, mek, reply, target, timeoutSec) {
  const key = `${from}:${digits(target)}`;
  if (waitLocks.has(key)) return reply(`Already waiting for OTP on ${displayNumber(target)}.`);
  waitLocks.add(key);
  const intervalSec = 8;
  try {
    await reply(
      `*Waiting for SMS OTP*\n\nNumber: ${displayNumber(target)}\nPoll: every ${intervalSec}s\nTimeout: ${timeoutSec}s\n\nSign in now. I will reveal the code as soon as it hits this number.`
    );
    const startData = await fetchAPI('otps', 100);
    const startOtps = startData?.otps || [];
    const seen = new Set(startOtps.map((o) => `${o.number}|${o.time}|${o.message || o.otp || ''}`.slice(0, 140)));
    let elapsed = 0;
    let found = null;
    while (elapsed < timeoutSec) {
      await new Promise((r) => setTimeout(r, intervalSec * 1000));
      elapsed += intervalSec;
      try {
        const curData = await fetchAPI('otps', 100);
        const curOtps = curData?.otps || [];
        const fresh = curOtps.filter((o) => {
          const stamp = `${o.number}|${o.time}|${o.message || o.otp || ''}`.slice(0, 140);
          if (seen.has(stamp)) return false;
          return matchOtp(o, target);
        });
        if (fresh.length) {
          found = fresh[0];
          break;
        }
        if (elapsed % 24 === 0) {
          await conn.sendMessage(from, { text: `Still waiting ${displayNumber(target)}... ${elapsed}s / ${timeoutSec}s` }, { quoted: mek });
        }
      } catch (e) {
        console.log('wait poll err', e.message);
      }
    }
    if (found) {
      const code = otpFromItem(found);
      let msg = `*OTP RECEIVED*\n\n`;
      msg += `Number: ${found.number || displayNumber(target)} ${found.flag || ''}\n`;
      msg += `Country: ${found.country || ''}\n`;
      msg += `From: ${found.sender || 'SMS'}\n`;
      msg += `Time: ${found.time || 'now'}\n`;
      if (found.message) msg += `Message: ${String(found.message).slice(0, 400)}\n`;
      if (code) msg += `\n*CODE: ${code}*\n`;
      msg += `\nWaited: ${elapsed}s\nAny issues: ${OWNER_NAME} +${OWNER_PHONE}`;
      await conn.sendMessage(from, { text: msg }, { quoted: mek });
      if (code) await conn.sendMessage(from, { text: `*${code}*` }, { quoted: mek });
    } else {
      await reply(
        `Timeout on ${displayNumber(target)}. No new OTP in ${timeoutSec}s.\nTap Check OTP or contact ${OWNER_NAME} +${OWNER_PHONE}`
      );
    }
  } finally {
    waitLocks.delete(key);
  }
}

cmd({
  pattern: 'tempnumber',
  alias: ['tnumber', 'tempnum', 'temp-number', 'otpnumber', 'fakenumber', 'smsotp', 'tempn'],
  react: '📱',
  desc: 'Free virtual numbers with live OTP by country buttons',
  category: 'tools',
  filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix }) => {
  try {
    const pre = prefix || '.';
    const sender = m.sender;
    const raw = String(q || '').trim();
    const args = raw ? raw.split(/\s+/) : [];
    const action = (args[0] || '').toLowerCase();

    if (!action || action === 'menu' || action === 'help') {
      const body =
        `*FREE VIRTUAL NUMBER*\n\n` +
        `Tap the button to get a live number, pick a country that is online, choose a number, then sign in.\n` +
        `The bot reveals the SMS OTP as soon as it arrives on that number.\n\n` +
        `Any issues contact ${OWNER_NAME} +${OWNER_PHONE}`;
      try {
        await sendButtons(conn, from, body, startButtons(pre));
      } catch (_) {
        await reply(`${body}\n\nType: ${pre}tempnumber start`);
      }
      return;
    }

    if (action === 'start' || action === 'get' || action === 'countries') {
      await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
      const pack = await loadFresh(sender);
      if (!pack.countries.length) {
        return reply(`No live numbers right now. Contact ${OWNER_NAME} +${OWNER_PHONE}`);
      }
      const rows = pack.countries.slice(0, 20).map((c) => ({
        id: `${pre}tempnumber country ${countrySlug(c.name)}`,
        title: `${c.flag || ''} ${c.name}`.trim().slice(0, 24),
        description: `${c.numbers.length} live number(s) • +${c.code || ''}`.slice(0, 70)
      }));
      const body =
        `*Available countries*\n${pack.countries.length} online • ${pack.numbers.length} live numbers\n\n` +
        `Only countries with working numbers are listed. Tap one.`;
      const buttons = [
        {
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: 'Choose Country',
            sections: [{ title: 'Live countries', highlight_label: 'LIVE', rows }]
          })
        },
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: 'Refresh list', id: `${pre}tempnumber start` })
        },
        {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({ display_text: `Contact ${OWNER_NAME}`, url: OWNER_WA })
        }
      ];
      try {
        await sendButtons(conn, from, body, buttons);
      } catch (_) {
        const lines = pack.countries.map((c, i) => `${i + 1}. ${c.flag} ${c.name} (${c.numbers.length})`).join('\n');
        await reply(`${body}\n\n${lines}\n\nType: ${pre}tempnumber country <name>`);
      }
      return;
    }

    if (action === 'country') {
      const slug = args.slice(1).join(' ').toLowerCase();
      if (!slug) return reply('Pick a country from the list.');
      const pack = await getPack(sender);
      const country = pack.countries.find((c) => countrySlug(c.name) === slug || c.name.toLowerCase() === slug);
      if (!country || !country.numbers.length) {
        return reply(`That country is not available right now. Tap Get Free Virtual Number again.`);
      }
      const nums = country.numbers.slice(0, 20);
      const rows = nums.map((n) => ({
        id: `${pre}tempnumber use ${n.number}`,
        title: displayNumber(n.number).slice(0, 24),
        description: `${country.flag} ${country.name} • tap to use`.slice(0, 70)
      }));
      const body =
        `*${country.flag} ${country.name}*\n${nums.length} live number(s)\n\n` +
        `Tap a number. Then sign in on a platform. OTP will appear here automatically.`;
      const buttons = [
        {
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: 'Choose Number',
            sections: [{ title: `${country.name} numbers`, highlight_label: 'SMS', rows }]
          })
        },
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: 'Back to countries', id: `${pre}tempnumber start` })
        }
      ];
      try {
        await sendButtons(conn, from, body, buttons);
      } catch (_) {
        const lines = nums.map((n, i) => `${i + 1}. ${displayNumber(n.number)}`).join('\n');
        await reply(`${body}\n\n${lines}\n\nType: ${pre}tempnumber use +NUMBER`);
      }
      return;
    }

    if (action === 'use' || action === 'pick' || action === 'select') {
      const target = digits(args[1] || '');
      if (!target) return reply('Pick a number from the list.');
      const pack = await getPack(sender);
      const found = pack.numbers.find((n) => n.number === target) || { number: target, country: '', flag: '' };
      const platformLines = PLATFORMS.map((p, i) => `${i + 1}. ${p}`).join('\n');
      const body =
        `*Number ready*\n${found.flag || ''} ${displayNumber(found.number)}\n${found.country || ''}\n\n` +
        `Go sign in on one of these platforms using that number:\n${platformLines}\n\n` +
        `I am listening for the SMS OTP on this number now.\n` +
        `Any issues contact ${OWNER_NAME} +${OWNER_PHONE}`;
      const buttons = [
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: 'Check OTP now', id: `${pre}tempnumber check ${found.number}` })
        },
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: 'Wait 3 min', id: `${pre}tempnumber wait ${found.number} 180` })
        },
        {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({ display_text: `Contact ${OWNER_NAME}`, url: OWNER_WA })
        }
      ];
      try {
        await sendButtons(conn, from, body, buttons);
      } catch (_) {
        await reply(body);
      }
      await watchOtp(conn, from, mek, reply, found.number, 180);
      return;
    }

    if (action === 'wait' || action === 'listen' || action === 'watch') {
      const target = digits(args[1] || '');
      if (!target) return reply(`Usage: ${pre}tempnumber wait +79246787770`);
      const timeoutSec = Math.min(Math.max(parseInt(args[2], 10) || 180, 30), 300);
      await watchOtp(conn, from, mek, reply, target, timeoutSec);
      return;
    }

    if (action === 'check' || action === 'otp' || action.startsWith('+') || /^\d{7,15}$/.test(action)) {
      const targetNumber = action === 'check' || action === 'otp' ? args[1] : action;
      if (!targetNumber) return reply(`Usage: ${pre}tempnumber check +79246787770`);
      const onlyCode = action === 'otp';
      await conn.sendMessage(from, { react: { text: '🔍', key: mek.key } });
      const d = await fetchAPI('otps', 100);
      const allOtps = d?.otps || [];
      const filtered = allOtps.filter((o) => matchOtp(o, targetNumber));
      if (!filtered.length) {
        return reply(`No OTP yet for ${displayNumber(targetNumber)}.\nKeep the number, request the code again, or tap Wait.`);
      }
      if (onlyCode) {
        const codes = filtered.map((o) => ({ ...o, code: otpFromItem(o) })).filter((o) => o.code);
        if (!codes.length) return reply(`Found ${filtered.length} SMS but no code.\n${filtered[0].message || ''}`);
        let msg = `*CODES for ${displayNumber(targetNumber)}*\n\n`;
        codes.slice(0, 10).forEach((o, i) => { msg += `${i + 1}. ${o.code} - ${o.time} - ${o.sender || ''}\n`; });
        await conn.sendMessage(from, { text: msg }, { quoted: mek });
        await conn.sendMessage(from, { text: `*${codes[0].code}*` }, { quoted: mek });
        return;
      }
      let msg = `*OTPs for ${displayNumber(targetNumber)}* (${filtered.length})\n\n`;
      filtered.slice(0, 8).forEach((o, i) => {
        const code = otpFromItem(o);
        msg += `${i + 1}. ${o.number} ${o.flag || ''}\nFrom: ${o.sender || 'SMS'}\nTime: ${o.time}\n${o.message ? `Msg: ${String(o.message).slice(0, 180)}\n` : ''}${code ? `CODE: ${code}\n` : ''}\n`;
      });
      msg += `\nAny issues: ${OWNER_NAME} +${OWNER_PHONE}`;
      await conn.sendMessage(from, { text: msg }, { quoted: mek });
      const latest = otpFromItem(filtered[0]);
      if (latest) await conn.sendMessage(from, { text: `*${latest}*` }, { quoted: mek });
      return;
    }

    if (action === 'numbers' || action === 'otps' || action === 'raw') {
      if (action === 'raw') {
        const a = args[1] || 'numbers';
        const l = parseInt(args[2], 10) || 2;
        const { data } = await axios.get(API, { params: { action: a, limit: l }, timeout: 30000 });
        await conn.sendMessage(from, { text: `RAW ${a}:\n${JSON.stringify(data, null, 2).slice(0, 3500)}` }, { quoted: mek });
        return;
      }
      if (action === 'otps') {
        const d = await fetchAPI('otps', parseInt(args[1], 10) || 8);
        const otps = d?.otps || [];
        if (!otps.length) return reply('No recent OTPs.');
        let msg = `*Recent OTPs* (${otps.length})\n\n`;
        otps.forEach((o, i) => {
          const code = otpFromItem(o);
          msg += `${i + 1}. ${o.number} ${o.flag || ''}\nFrom: ${o.sender || ''}\n${code ? `CODE: ${code}\n` : ''}\n`;
        });
        await conn.sendMessage(from, { text: msg }, { quoted: mek });
        return;
      }
      return reply(`Use the buttons: ${pre}tempnumber`);
    }

    return reply(`Tap *Get Free Virtual Number* or type ${pre}tempnumber`);
  } catch (e) {
    console.error('TempNumber error', e.response?.data || e.message);
    reply(`${e.response?.data?.message || e.message}\nAny issues contact ${OWNER_NAME} +${OWNER_PHONE}`);
  }
});
