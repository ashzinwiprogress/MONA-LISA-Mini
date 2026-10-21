const { cmd, commands } = require('../redx');
const moment = require('moment-timezone');
const axios = require('axios');
const config = require('../config');
const { fakevCard } = require('../lib/fakevCard');
const { pick } = require('../lib/responses');

const bootTime = Date.now();
const CHANNEL_LINK = config.CHANNEL_LINK || 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';
const CHANNEL_JID = config.CHANNEL_JID || '120363431455356251@newsletter';
const PREFIX = () => config.PREFIX || '.';
const IMAGE_CAPTION_LIMIT = 1024;
const TEXT_LIMIT = 3400;

const SECTIONS = [
  { key: 'ai', title: '🧠 AI & INTELLIGENCE', match: ['ai', 'progresstech ai', 'progresstech-ai'] },
  { key: 'image', title: '🎨 IMAGE STUDIO', match: ['sticker', 'image'] },
  { key: 'video', title: '🎬 VIDEO STUDIO', match: ['video'] },
  { key: 'music', title: '🎵 MUSIC STUDIO', match: ['music', 'song'] },
  { key: 'download', title: '📥 DOWNLOAD TOOLS', match: ['download', 'downloader'] },
  { key: 'search', title: '🌐 SEARCH & INFO', match: ['search'] },
  { key: 'fun', title: '😄 FUN & GAMES', match: ['fun', 'games'] },
  { key: 'group', title: '👥 GROUP MANAGER', match: ['group', 'admin'] },
  { key: 'tools', title: '🛠️ UTILITIES', match: ['tools', 'settings', 'general', 'utility'] },
  { key: 'sports', title: '🏆 SPORTS HALL', match: ['sports', 'sport'] },
  { key: 'system', title: '🤖 BOT TOOLS', match: ['system', 'main'] },
  { key: 'owner', title: '🔐 OWNER ONLY', match: ['owner'] }
];

const TAGLINES = [
  '"Behind every smile, a command waiting to be painted."',
  '"Elegance is the only beauty that never fades."',
  '"A masterpiece never explains itself — it performs."',
  '"Mystery is my favorite command prefix."',
  '"Painted once. Remembered forever."'
];

const MENU_IMAGES = [
  'https://files.catbox.moe/w4ttld.jpg',
  'https://files.catbox.moe/96vvsr.jpg',
  'https://files.catbox.moe/1dp0f5.jpg',
  'https://files.catbox.moe/jdnmqf.jpg'
];
const menuViewCount = new Map();

function uptime() {
  const sec = Math.floor((Date.now() - bootTime) / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d) return `${d}d ${h}h ${m}m`;
  return `${h}h ${m}m`;
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
      newsletterName: '🥰 MONA LISA V2 🤭',
      serverMessageId: 2
    }
  };
}

function block(title, lines) {
  const head = `╭━━〔 ${title} 〕`;
  const body = lines.map((l) => `│ ${l}`).join('\n');
  return `${head}\n${body}\n╰━━━━━━━━━━━━━━━━━━`;
}

function banner() {
  return (
    `_👑 ✦ 𝐌𝐎𝐍𝐀 𝐋𝐈𝐒𝐀 V2🤭 ✦ 👑_\n` +
    `   ᴍɪɴɪ ʙᴏᴛ • ʟᴇɢᴇɴᴅᴀʀʏ ᴇᴅɪᴛɪᴏɴ\n` +
    `   ${pick(TAGLINES)}`
  );
}

function statusBox(pushName, total) {
  const pre = PREFIX();
  const time = moment().tz('Africa/Lagos').format('HH:mm:ss');
  const date = moment().tz('Africa/Lagos').format('dddd, Do MMMM YYYY');
  return block('⚜️ STATUS', [
    `👤 User     : ${pushName}`,
    `👑 Owner    : ${config.OWNER_NAME}`,
    `⚡ Prefix    : ${pre}`,
    `📜 Commands  : ${total}`,
    `⏱️ Uptime    : ${uptime()}`,
    `🕰️ Time      : ${time}`,
    `📅 Date      : ${date}`
  ]);
}

function channelBox() {
  return block('📡 STAY CONNECTED', [
    `📢 ${CHANNEL_LINK}`,
    `🥰 Follow for updates & new features`
  ]);
}

function footerLine() {
  return (
    `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n` +
    `🥰 *𝐌𝐎𝐍𝐀 𝐋𝐈𝐒𝐀 V2* 🤭 · Powered by ${config.OWNER_NAME}`
  );
}

function findSection(key) {
  const k = String(key || '').toLowerCase().trim();
  return SECTIONS.find((s) => s.key === k || s.title.toLowerCase().includes(k) || s.match.includes(k));
}

function categoryCaption(key, pushName) {
  const pre = PREFIX();
  const { grouped, total } = groupedCommands();
  const section = findSection(key);
  if (!section || !grouped[section.key]?.length) {
    const names = SECTIONS.filter((s) => grouped[s.key]?.length).map((s) => `${pre}menu ${s.key}`).join('\n');
    return `Unknown hall "${key}".\n\nOpen a hall:\n${names}\n\n${pre}menu`;
  }
  return [
    banner(),
    '',
    statusBox(pushName, total),
    '',
    block(section.title, grouped[section.key].map((p) => `◈ ${pre}${p}`)),
    '',
    channelBox(),
    '',
    footerLine()
  ].join('\n').trim();
}

function menuChunks(pushName) {
  const pre = PREFIX();
  const { grouped, total } = groupedCommands();
  const header = [banner(), '', statusBox(pushName, total)].join('\n');
  const boxes = SECTIONS.filter((s) => grouped[s.key]?.length)
    .map((s) => block(s.title, grouped[s.key].map((p) => `◈ ${pre}${p}`)));
  const tail = [channelBox(), '', footerLine()].join('\n');

  const chunks = [];
  let buf = header;
  for (const box of boxes) {
    const next = buf + '\n\n' + box;
    const limit = chunks.length === 0 ? IMAGE_CAPTION_LIMIT : TEXT_LIMIT;
    if (next.length > limit) {
      chunks.push(buf);
      buf = box;
    } else {
      buf = next;
    }
  }
  if ((buf + '\n\n' + tail).length > (chunks.length === 0 ? IMAGE_CAPTION_LIMIT : TEXT_LIMIT)) {
    chunks.push(buf);
    chunks.push(tail);
  } else {
    chunks.push(buf + '\n\n' + tail);
  }
  return chunks;
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

async function sendFollowButton(conn, from, sender) {
  const buttons = [
    {
      name: 'cta_url',
      buttonParamsJson: JSON.stringify({
        display_text: '📢 Follow Channel',
        url: CHANNEL_LINK,
        merchant_url: CHANNEL_LINK
      })
    }
  ];
  try {
    await conn.relayMessage(from, {
      interactiveMessage: {
        header: { title: '🥰 MONA LISA V2 🤭', hasMediaAttachment: false },
        body: { text: 'Tap below to follow the official Progress Tech channel.' },
        footer: { text: `Powered by ${config.OWNER_NAME}` },
        nativeFlowMessage: { buttons },
        contextInfo: ctxInfo(sender)
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
    return true;
  } catch (e) {
    console.error('follow button', e.message);
    return false;
  }
}

async function sendMenuChunks(conn, from, chunks, sender, imageUrl) {
  let usedImage = false;
  for (const part of chunks) {
    if (!usedImage) {
      const buf = await downloadImage(imageUrl);
      if (buf) {
        try {
          await conn.sendMessage(from, {
            image: buf,
            caption: part.slice(0, IMAGE_CAPTION_LIMIT),
            contextInfo: ctxInfo(sender)
          }, { quoted: fakevCard });
          usedImage = true;
          if (part.length > IMAGE_CAPTION_LIMIT) {
            await conn.sendMessage(from, {
              text: part.slice(IMAGE_CAPTION_LIMIT),
              contextInfo: ctxInfo(sender)
            }, { quoted: fakevCard });
          }
          continue;
        } catch (_) {}
      }
    }
    await conn.sendMessage(from, {
      text: part,
      contextInfo: ctxInfo(sender)
    }, { quoted: fakevCard });
  }
  await sendFollowButton(conn, from, sender);
}

cmd({
  pattern: 'menu',
  alias: ['commandlist', 'allmenu', 'help', 'listmenu'],
  desc: 'Display the full MONA LISA command menu',
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

    const chunks = (arg && arg !== 'all' && arg !== 'full' && arg !== 'list')
      ? [categoryCaption(arg.replace(/^\.+/, ''), pushName)]
      : menuChunks(pushName);

    try {
      await sendMenuChunks(conn, from, chunks, m.sender, imageUrl);
    } catch (_) {
      for (const part of chunks) await reply(part);
      await reply(`📢 Follow: ${CHANNEL_LINK}`);
    }
  } catch (err) {
    console.error('Menu error:', err);
    try {
      const chunks = menuChunks(m.pushName || 'Guest');
      for (const part of chunks) await reply(part);
      await reply(`📢 Follow: ${CHANNEL_LINK}`);
    } catch (_) {
      await reply(`Menu is ready. Type .menu ai\n${CHANNEL_LINK}`);
    }
  }
});
