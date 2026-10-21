const { cmd, commands } = require('../redx');
const moment = require('moment-timezone');
const axios = require('axios');
const config = require('../config');
const { fakevCard } = require('../lib/fakevCard');

const bootTime = Date.now();
const CHANNEL_LINK = config.CHANNEL_LINK || 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';
const CHANNEL_JID = config.CHANNEL_JID || '120363431455356251@newsletter';
const OWNER = config.OWNER_NAME || 'Progress Tech';
const PREFIX = () => config.PREFIX || '.';

const SECTIONS = [
  { key: 'ai', title: 'AI & Chat', icon: '01', match: ['ai', 'progresstech ai', 'progresstech-ai'] },
  { key: 'image', title: 'Image Studio', icon: '02', match: ['image', 'sticker'] },
  { key: 'video', title: 'Video Studio', icon: '03', match: ['video'] },
  { key: 'music', title: 'Music', icon: '04', match: ['music', 'song'] },
  { key: 'download', title: 'Downloaders', icon: '05', match: ['download', 'downloader'] },
  { key: 'search', title: 'Search', icon: '06', match: ['search'] },
  { key: 'fun', title: 'Fun & Games', icon: '07', match: ['fun', 'games'] },
  { key: 'group', title: 'Group Admin', icon: '08', match: ['group', 'admin'] },
  { key: 'tools', title: 'Tools', icon: '09', match: ['tools', 'settings', 'general', 'utility'] },
  { key: 'sports', title: 'Sports', icon: '10', match: ['sports', 'sport'] },
  { key: 'system', title: 'Bot System', icon: '11', match: ['system', 'main'] },
  { key: 'owner', title: 'Owner', icon: '12', match: ['owner'] }
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
  const s = sec % 60;
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
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

function hubCaption(pushName, total) {
  const pre = PREFIX();
  const time = moment().tz('Africa/Lagos').format('HH:mm');
  const date = moment().tz('Africa/Lagos').format('ddd D MMM YYYY');
  const { grouped } = groupedCommands();
  const cats = SECTIONS.filter((s) => grouped[s.key]?.length)
    .map((s) => `  ${s.icon}  ${s.title.padEnd(14)} ${String(grouped[s.key].length).padStart(3)} cmds`)
    .join('\n');

  return (
    `┏━━━━━━━━━━━━━━━━━━━━━━┓\n` +
    `   MONA LISA  ·  MINI V2\n` +
    `   crafted by ${OWNER}\n` +
    `┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
    `┌─ session\n` +
    `│  user     ${pushName}\n` +
    `│  prefix   ${pre}\n` +
    `│  commands ${total}\n` +
    `│  uptime   ${uptime()}\n` +
    `│  ${date}  ${time}\n` +
    `└──────────────\n\n` +
    `┌─ categories\n${cats}\n└──────────────\n\n` +
    `Open a category:\n` +
    `${pre}menu ai     ${pre}menu tools\n` +
    `${pre}menu image  ${pre}menu download\n` +
    `${pre}menu all    full list\n\n` +
    `Quick start\n` +
    `${pre}chatbot on   auto replies here\n` +
    `${pre}llama        build an app ZIP\n` +
    `${pre}alive        bot status\n\n` +
    `${CHANNEL_LINK}`
  );
}

function categoryCaption(key) {
  const pre = PREFIX();
  const { grouped, total } = groupedCommands();
  const section = SECTIONS.find((s) => s.key === key || s.title.toLowerCase() === key || s.match.includes(key));
  if (!section || !grouped[section.key]?.length) {
    const names = SECTIONS.filter((s) => grouped[s.key]?.length).map((s) => `${pre}menu ${s.key}`).join('\n');
    return `Unknown category "${key}".\n\nAvailable:\n${names}\n\n${pre}menu all`;
  }
  const list = grouped[section.key];
  const cols = list.map((p, i) => {
    const n = String(i + 1).padStart(2, '0');
    return ` ${n}  ${pre}${p}`;
  }).join('\n');
  return (
    `┏━━━━━━━━━━━━━━━━━━━━━━┓\n` +
    `   ${section.title.toUpperCase()}\n` +
    `   ${list.length} commands  ·  ${total} total\n` +
    `┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
    `${cols}\n\n` +
    `${pre}menu     hub\n` +
    `${CHANNEL_LINK}`
  );
}

function allCaption() {
  const pre = PREFIX();
  const { grouped, total } = groupedCommands();
  const blocks = SECTIONS.filter((s) => grouped[s.key]?.length).map((s) => {
    const cmds = grouped[s.key].map((p) => `${pre}${p}`).join('  ·  ');
    return `▸ ${s.title}\n${cmds}`;
  });
  return (
    `MONA LISA  ·  ${total} commands\n` +
    `${OWNER}\n\n` +
    blocks.join('\n\n') +
    `\n\n${CHANNEL_LINK}`
  );
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

async function prepareThumb(conn, imageUrl) {
  try {
    const buf = await downloadImage(imageUrl);
    if (!buf) return null;
    const { prepareWAMessageMedia } = require('@whiskeysockets/baileys');
    const media = await prepareWAMessageMedia(
      { image: buf },
      { upload: conn.waUploadToServer }
    );
    return media.imageMessage || null;
  } catch (_) {
    return null;
  }
}

async function sendInteractiveHub(conn, from, mek, m, pushName, total, imageUrl) {
  const pre = PREFIX();
  const { grouped } = groupedCommands();
  const thumb = await prepareThumb(conn, imageUrl);
  const rows = SECTIONS.filter((s) => grouped[s.key]?.length).map((s) => ({
    id: `${pre}menu ${s.key}`,
    title: s.title.slice(0, 24),
    description: `${grouped[s.key].length} commands`
  }));
  if (!rows.length) return false;

  const buttons = [
    {
      name: 'single_select',
      buttonParamsJson: JSON.stringify({
        title: 'Open a category',
        sections: [{ title: 'MONA LISA MENU', highlight_label: 'V2', rows }]
      })
    },
    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Chatbot ON', id: `${pre}chatbot on` }) },
    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Bot status', id: `${pre}alive` }) },
    { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: 'Progress Tech Channel', url: CHANNEL_LINK }) }
  ];

  const body =
    `Hello ${pushName}.\n` +
    `${total} live commands  ·  prefix ${pre}  ·  up ${uptime()}\n\n` +
    `Pick a category below, or type ${pre}menu ai`;

  try {
    await conn.relayMessage(from, {
      interactiveMessage: {
        header: {
          title: 'MONA LISA MINI V2',
          hasMediaAttachment: !!thumb,
          ...(thumb ? { imageMessage: thumb } : {})
        },
        body: { text: body },
        footer: { text: `Powered by ${OWNER}` },
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
    return true;
  } catch (e) {
    console.error('interactive menu', e.message);
    return false;
  }
}

async function sendMenuMessage(conn, from, caption, sender, imageUrl) {
  const buf = await downloadImage(imageUrl);
  if (buf) {
    try {
      await conn.sendMessage(from, {
        image: buf,
        caption,
        contextInfo: ctxInfo(sender)
      }, { quoted: fakevCard });
      return true;
    } catch (_) {}
  }
  await conn.sendMessage(from, {
    text: caption,
    contextInfo: ctxInfo(sender)
  }, { quoted: fakevCard });
  return true;
}

cmd({
  pattern: 'menu',
  alias: ['commandlist', 'allmenu', 'help', 'listmenu'],
  desc: 'MONA LISA command hub',
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
    const { grouped, total } = groupedCommands();
    const chatKey = m.chat || from;
    const viewIndex = menuViewCount.get(chatKey) || 0;
    const imageUrl = MENU_IMAGES[viewIndex % MENU_IMAGES.length];
    menuViewCount.set(chatKey, viewIndex + 1);

    if (arg === 'all' || arg === 'full' || arg === 'list') {
      const text = allCaption();
      if (text.length > 3500) {
        const parts = [];
        let buf = '';
        for (const line of text.split('\n')) {
          if ((buf + '\n' + line).length > 3400) {
            parts.push(buf);
            buf = line;
          } else buf += (buf ? '\n' : '') + line;
        }
        if (buf) parts.push(buf);
        for (const part of parts) await reply(part);
        return;
      }
      return reply(text);
    }

    if (arg) {
      const key = arg.replace(/^\.+/, '');
      const caption = categoryCaption(key);
      try {
        await sendMenuMessage(conn, from, caption, m.sender, imageUrl);
      } catch (_) {
        await reply(caption);
      }
      return;
    }

    const sentInteractive = await sendInteractiveHub(conn, from, mek, m, pushName, total, null);
    if (sentInteractive) return;

    const caption = hubCaption(pushName, total);
    try {
      await sendMenuMessage(conn, from, caption, m.sender, imageUrl);
    } catch (_) {
      await reply(caption);
    }
  } catch (err) {
    console.error('Menu error:', err);
    const fallback = hubCaption(m.pushName || 'Guest', groupedCommands().total);
    try {
      await reply(fallback);
    } catch (_) {
      await reply('Menu is ready. Type .menu ai or .menu all');
    }
  }
});
