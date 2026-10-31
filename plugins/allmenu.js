const { cmd, commands } = require('../redx');
const moment = require('moment-timezone');
const axios = require('axios');
const os = require('os');
const config = require('../config');
const { fakevCard } = require('../lib/fakevCard');
const { pick } = require('../lib/responses');

const bootTime = Date.now();
const CHANNEL_LINK = config.CHANNEL_LINK || 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';
const CHANNEL_JID = config.CHANNEL_JID || '120363431455356251@newsletter';
const HOST = 'https://progresstech.ing.ng';
const VERSION = '2.1.0';
const PREFIX = () => config.PREFIX || '.';

const SECTIONS = [
  { key: 'ai', title: 'AI & INTELLIGENCE', match: ['ai', 'progresstech ai', 'progresstech-ai'] },
  { key: 'tools-pt', title: 'PROGRESS TECH TOOLS', match: ['progresstech tools'] },
  { key: 'image', title: 'IMAGE STUDIO', match: ['sticker', 'image', 'maker'] },
  { key: 'video', title: 'VIDEO STUDIO', match: ['video'] },
  { key: 'music', title: 'MUSIC STUDIO', match: ['music', 'song'] },
  { key: 'download', title: 'DOWNLOAD TOOLS', match: ['download', 'downloader'] },
  { key: 'search', title: 'SEARCH & INFO', match: ['search', 'news'] },
  { key: 'fun', title: 'FUN & GAMES', match: ['fun', 'games'] },
  { key: 'economy', title: 'ECONOMY', match: ['economy'] },
  { key: 'group', title: 'GROUP MANAGER', match: ['group', 'admin'] },
  { key: 'tools', title: 'UTILITIES', match: ['tools', 'settings', 'general', 'utility', 'misc'] },
  { key: 'sports', title: 'SPORTS HALL', match: ['sports', 'sport'] },
  { key: 'system', title: 'BOT TOOLS', match: ['system', 'main'] },
  { key: 'owner', title: 'OWNER ONLY', match: ['owner'] }
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
let cachedLocalImage = null;

function uptime() {
  const sec = Math.floor((Date.now() - bootTime) / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function ramBar() {
  const total = os.totalmem();
  const used = total - os.freemem();
  const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const filled = Math.round(pct / 10);
  return `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}] ${pct}%`;
}

function smallCaps(s) {
  const map = {
    a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ғ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
    j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
    s: 's', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ'
  };
  return String(s || '').split('').map((ch) => map[ch.toLowerCase()] || ch).join('');
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

function hallBox(title, lines) {
  const body = lines.map((l) => `│ ${l}`).join('\n');
  return `╭━━〔 ${title} 〕\n${body}\n╰━━━━━━━━━━━━━━━━━━`;
}

function crownBox(pushName, total) {
  const pre = PREFIX();
  const mode = smallCaps(String(config.MODE || 'public').toLowerCase());
  return (
    `┏❒ 👑 ✦ 𝐌𝐎𝐍𝐀 𝐋𝐈𝐒𝐀 V2🤭 ✦ 👑 ❒\n` +
    `   ${pick(TAGLINES)}\n` +
    `┃ *Usᴇʀ*: ${pushName}\n` +
    `┃ *Mᴏᴅᴇ*: ${mode}\n` +
    `┃ *Hᴏsᴛ*: ${HOST}\n` +
    `┃ *Pʀᴇғɪx*: [ ${pre} ]\n` +
    `┃ *Cᴏᴍᴍᴀɴᴅs*: ${total}\n` +
    `┃ *Vᴇʀsɪᴏɴ*: ${VERSION}\n` +
    `┃ *Rᴀᴍ*: ${ramBar()}\n` +
    `┃ \n` +
    `┗❒`
  );
}

function statusBox(pushName, total) {
  const pre = PREFIX();
  const time = moment().tz('Africa/Lagos').format('HH:mm:ss');
  const date = moment().tz('Africa/Lagos').format('dddd, Do MMMM YYYY');
  return hallBox('⚜️ STATUS', [
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
  return hallBox('📡 STAY CONNECTED', [
    `📢 ${CHANNEL_LINK}`,
    `🥰 Follow for updates & new features`
  ]);
}

function findSection(key) {
  const k = String(key || '').toLowerCase().trim();
  return SECTIONS.find((s) => s.key === k || s.title.toLowerCase().includes(k) || s.match.includes(k));
}

function buildMenu(pushName, onlyKey) {
  const pre = PREFIX();
  const { grouped, total } = groupedCommands();
  const sections = onlyKey
    ? SECTIONS.filter((s) => s === findSection(onlyKey))
    : SECTIONS;
  const boxes = sections
    .filter((s) => grouped[s.key]?.length)
    .map((s) => hallBox(s.title, grouped[s.key].map((p) => `◈ ${pre}${p}`)));

  if (onlyKey && !boxes.length) {
    const names = SECTIONS.filter((s) => grouped[s.key]?.length).map((s) => `${pre}menu ${s.key}`).join('\n');
    return `Unknown hall "${onlyKey}".\n\nOpen a hall:\n${names}\n\n${pre}menu`;
  }

  return [
    crownBox(pushName, total),
    statusBox(pushName, total),
    boxes.join('\n\n'),
    channelBox(),
    '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈',
    `🥰 *MONA LISA V2* 🤭 · Powered by ${config.OWNER_NAME}`
  ].filter(Boolean).join('\n\n');
}

async function downloadImage(imageUrl) {
  if (!imageUrl) return null;
  try {
    const res = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
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

async function localBrandImage() {
  if (cachedLocalImage) return cachedLocalImage;
  try {
    const Jimp = require('jimp');
    const img = new Jimp(720, 720, 0x140c06ff);
    const gold = 0xc9a227ff;
    img.scan(0, 0, 720, 720, function (x, y, idx) {
      if (x < 18 || y < 18 || x >= 702 || y >= 702) {
        this.bitmap.data[idx] = (gold >> 24) & 255;
        this.bitmap.data[idx + 1] = (gold >> 16) & 255;
        this.bitmap.data[idx + 2] = (gold >> 8) & 255;
        this.bitmap.data[idx + 3] = 255;
      }
    });
    const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    const font2 = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    img.print(font, 0, 270, { text: 'MONA LISA', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, 720);
    img.print(font2, 0, 360, { text: 'V2  ·  MINI', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, 720);
    img.print(font2, 0, 430, { text: 'PROGRESS TECH', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, 720);
    cachedLocalImage = await img.quality(85).getBufferAsync(Jimp.MIME_JPEG);
    return cachedLocalImage;
  } catch (_) {
    return null;
  }
}

async function getMenuImage(imageUrl) {
  const urls = [imageUrl, config.IMAGE_PATH].filter(Boolean);
  for (const url of urls) {
    const buf = await downloadImage(url);
    if (buf) return buf;
  }
  return localBrandImage();
}

async function sendOneMenu(conn, from, caption, sender, imageUrl) {
  const buf = await getMenuImage(imageUrl);
  const info = ctxInfo(sender);

  if (buf) {
    try {
      await conn.sendMessage(from, {
        image: buf,
        caption,
        contextInfo: info
      }, { quoted: fakevCard });
      return;
    } catch (e) {
      console.error('menu image send', e.message);
    }
  }

  await conn.sendMessage(from, {
    text: caption,
    contextInfo: {
      ...info,
      ...(buf ? {
        externalAdReply: {
          title: '🥰 MONA LISA V2 🤭',
          body: 'Official channel · Progress Tech',
          thumbnail: buf,
          mediaType: 1,
          sourceUrl: CHANNEL_LINK,
          renderLargerThumbnail: true
        }
      } : {})
    }
  }, { quoted: fakevCard });
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

    const onlyKey = (arg && arg !== 'all' && arg !== 'full' && arg !== 'list')
      ? arg.replace(/^\.+/, '')
      : null;
    const caption = buildMenu(pushName, onlyKey);

    try {
      await sendOneMenu(conn, from, caption, m.sender, imageUrl);
    } catch (_) {
      await reply(caption);
    }
  } catch (err) {
    console.error('Menu error:', err);
    try {
      await reply(buildMenu(m.pushName || 'Guest', null));
    } catch (_) {
      await reply(`Menu is ready. Type .menu ai\n${CHANNEL_LINK}`);
    }
  }
});
