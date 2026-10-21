const { cmd, commands } = require('../redx');
const moment = require('moment-timezone');
const axios = require('axios');
const os = require('os');
const config = require('../config');
const { fakevCard } = require('../lib/fakevCard');

const bootTime = Date.now();
const CHANNEL_LINK = config.CHANNEL_LINK || 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';
const CHANNEL_JID = config.CHANNEL_JID || '120363431455356251@newsletter';
const OWNER = config.OWNER_NAME || 'Progress Tech';
const HOST = 'https://progress-tech-taupe.vercel.app/';
const VERSION = '2.0.0';
const PREFIX = () => config.PREFIX || '.';

const SECTIONS = [
  { key: 'ai', title: 'AI MENU', match: ['ai', 'progresstech ai', 'progresstech-ai'] },
  { key: 'image', title: 'IMAGE MENU', match: ['image', 'sticker'] },
  { key: 'video', title: 'VIDEO MENU', match: ['video'] },
  { key: 'music', title: 'AUDIO MENU', match: ['music', 'song'] },
  { key: 'download', title: 'DOWNLOAD MENU', match: ['download', 'downloader'] },
  { key: 'search', title: 'SEARCH MENU', match: ['search'] },
  { key: 'fun', title: 'GAMES MENU', match: ['fun', 'games'] },
  { key: 'group', title: 'GROUP MENU', match: ['group', 'admin'] },
  { key: 'tools', title: 'TOOLS MENU', match: ['tools', 'settings', 'general', 'utility'] },
  { key: 'sports', title: 'SPORTS MENU', match: ['sports', 'sport'] },
  { key: 'system', title: 'BOTSTATUS MENU', match: ['system', 'main'] },
  { key: 'owner', title: 'OWNER MENU', match: ['owner'] }
];

const MENU_IMAGES = [
  'https://files.catbox.moe/w4ttld.jpg',
  'https://files.catbox.moe/96vvsr.jpg',
  'https://files.catbox.moe/1dp0f5.jpg',
  'https://files.catbox.moe/jdnmqf.jpg'
];
const menuViewCount = new Map();
const CAPTION_LIMIT = 3400;

function uptime() {
  const sec = Math.floor((Date.now() - bootTime) / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function ramBar() {
  const total = os.totalmem();
  const used = total - os.freemem();
  const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const filled = Math.round(pct / 10);
  return `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}] ${pct}%`;
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/[_-]+/g, ' ').trim();
}

function sectionFor(category) {
  const c = norm(category);
  return SECTIONS.find((s) => s.match.some((m) => c === m || c.includes(m))) || SECTIONS.find((s) => s.key === 'system');
}

function groupedCommands() {
  const grouped = {};
  let total = 0;
  for (const c of commands) {
    if (!c.pattern || c.dontAddCommandList) continue;
    total++;
    const section = sectionFor(c.category);
    if (!grouped[section.key]) grouped[section.key] = [];
    if (!grouped[section.key].includes(c.pattern)) grouped[section.key].push(c.pattern);
  }
  for (const k of Object.keys(grouped)) grouped[k].sort();
  return { grouped, total };
}

function ctxInfo(sender) {
  return {
    forwardingScore: 999,
    isForwarded: true,
    mentionedJid: sender ? [sender] : [],
    forwardedNewsletterMessageInfo: {
      newsletterJid: CHANNEL_JID,
      newsletterName: 'MONA LISA V2',
      serverMessageId: 2
    }
  };
}

function royalHeader(pushName, total) {
  const pre = PREFIX();
  const mode = String(config.MODE || 'public').toLowerCase();
  return (
    `┏❒ ✦ 𝐌𝐎𝐍𝐀 𝐋𝐈𝐒𝐀 V2 ✦\n` +
    `   ʀᴏʏᴀʟ ᴄᴏᴜʀᴛ • ʟᴇɢᴇɴᴅᴀʀʏ ᴇᴅɪᴛɪᴏɴ❒\n` +
    `┃ User: ${pushName || 'Guest'}\n` +
    `┃ Mode: ${mode}\n` +
    `┃ Host: ${HOST}\n` +
    `┃ Prefix: [ ${pre} ]\n` +
    `┃ Commands: ${total}\n` +
    `┃ Version: ${VERSION}\n` +
    `┃ Uptime: ${uptime()}\n` +
    `┃ Ram: ${ramBar()}\n` +
    `┃ Crown: ${OWNER}\n` +
    `┗❒`
  );
}

function categoryBox(title, list) {
  const rows = list.map((p) => `┃⌬ ${p}`).join('\n');
  return `┏➽⟡  *${title}*  ⟡\n${rows}\n┗━⟡`;
}

function findSection(key) {
  const k = String(key || '').toLowerCase().trim();
  return SECTIONS.find((s) => s.key === k || s.title.toLowerCase() === k || s.match.includes(k));
}

function categoryCaption(key) {
  const pre = PREFIX();
  const { grouped, total } = groupedCommands();
  const section = findSection(key);
  if (!section || !grouped[section.key]?.length) {
    const names = SECTIONS.filter((s) => grouped[s.key]?.length).map((s) => `${pre}menu ${s.key}`).join('\n');
    return `Unknown hall "${key}".\n\nOpen a hall:\n${names}\n\n${pre}menu`;
  }
  return (
    royalHeader('Guest', total) +
    `\n\n` +
    categoryBox(section.title, grouped[section.key]) +
    `\n\n${pre}menu     full court\n${CHANNEL_LINK}`
  );
}

function menuParts(pushName) {
  const { grouped, total } = groupedCommands();
  const header = royalHeader(pushName, total);
  const boxes = SECTIONS.filter((s) => grouped[s.key]?.length)
    .map((s) => categoryBox(s.title, grouped[s.key]));
  const footer = `┗❒  ${OWNER}\n${CHANNEL_LINK}`;
  const parts = [];
  let buf = header;
  for (const box of boxes) {
    if ((buf + '\n\n' + box).length > CAPTION_LIMIT) {
      parts.push(buf);
      buf = box;
    } else {
      buf += '\n\n' + box;
    }
  }
  if ((buf + '\n\n' + footer).length > CAPTION_LIMIT) {
    parts.push(buf);
    parts.push(footer);
  } else {
    parts.push(buf + '\n\n' + footer);
  }
  return parts;
}

async function downloadImage(imageUrl) {
  if (!imageUrl) return null;
  try {
    const res = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 8000,
      maxRedirects: 3,
      headers: { 'User-Agent': 'Mozilla/5.0' },
      validateStatus: (s) => s >= 200 && s < 300
    });
    const buf = Buffer.from(res.data || []);
    return buf.length > 200 ? buf : null;
  } catch (_) {
    return null;
  }
}

async function sendMenuParts(conn, from, parts, sender, imageUrl) {
  let usedImage = false;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!usedImage) {
      const buf = await downloadImage(imageUrl);
      if (buf) {
        try {
          await conn.sendMessage(from, {
            image: buf,
            caption: part,
            contextInfo: ctxInfo(sender)
          }, { quoted: fakevCard });
          usedImage = true;
          continue;
        } catch (_) {}
      }
    }
    await conn.sendMessage(from, {
      text: part,
      contextInfo: ctxInfo(sender)
    }, { quoted: fakevCard });
  }
}

cmd({
  pattern: 'menu',
  alias: ['commandlist', 'allmenu', 'help', 'listmenu'],
  desc: 'MONA LISA royal command court',
  category: 'system',
  filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix }) => {
  try {
    const pre = prefix || PREFIX();
    let rawQ = q || '';
    const inter = mek.message?.interactiveResponseMessage;
    if (inter?.nativeFlowResponseMessage?.paramsJson) {
      try {
        const p = JSON.parse(inter.nativeFlowResponseMessage.paramsJson);
        if (p.id) rawQ = String(p.id).replace(new RegExp('^\\' + (pre || '.') + 'menu\\s*', 'i'), '').trim();
      } catch (_) {}
    }
    if (mek.message?.listResponseMessage?.singleSelectReply?.selectedRowId) {
      rawQ = String(mek.message.listResponseMessage.singleSelectReply.selectedRowId)
        .replace(new RegExp('^\\' + (pre || '.') + 'menu\\s*', 'i'), '')
        .trim();
    }
    const arg = String(rawQ || '').trim().toLowerCase();
    const pushName = m.pushName || 'Guest';
    const chatKey = m.chat || from;
    const viewIndex = menuViewCount.get(chatKey) || 0;
    const imageUrl = MENU_IMAGES[viewIndex % MENU_IMAGES.length];
    menuViewCount.set(chatKey, viewIndex + 1);

    if (arg && arg !== 'all' && arg !== 'full' && arg !== 'list') {
      const caption = categoryCaption(arg.replace(/^\.+/, ''));
      try {
        await sendMenuParts(conn, from, [caption], m.sender, imageUrl);
      } catch (_) {
        await reply(caption);
      }
      return;
    }

    const parts = menuParts(pushName);
    try {
      await sendMenuParts(conn, from, parts, m.sender, imageUrl);
    } catch (_) {
      for (const part of parts) await reply(part);
    }
  } catch (err) {
    console.error('Menu error:', err);
    try {
      const parts = menuParts(m.pushName || 'Guest');
      for (const part of parts) await reply(part);
    } catch (_) {
      await reply('Menu is ready. Type .menu ai');
    }
  }
});
