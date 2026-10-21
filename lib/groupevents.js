const axios = require('axios');
const moment = require('moment-timezone');
const config = require('../config');
const { getUserConfigFromMongoDB } = require('./database');

const TZ = 'Africa/Lagos';
const BRAND = 'PROGRESS TECH';
const CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';

function flagOn(source, ...keys) {
  return keys.some((k) => String((source && source[k]) || config[k] || '').toLowerCase() === 'true');
}

async function liveFlags(conn) {
  try {
    const number = String(conn.user?.id || '').split(':')[0].replace(/[^0-9]/g, '');
    if (!number) return config;
    const userConfig = await getUserConfigFromMongoDB(number);
    return userConfig && typeof userConfig === 'object' ? { ...config, ...userConfig } : config;
  } catch (_) {
    return config;
  }
}

function greeting() {
  const h = moment().tz(TZ).hour();
  if (h >= 21 || h < 5) return { emoji: '🌃', text: 'Good Night' };
  if (h < 12) return { emoji: '🌅', text: 'Good Morning' };
  if (h < 17) return { emoji: '☀️', text: 'Good Afternoon' };
  return { emoji: '🌆', text: 'Good Evening' };
}

function stamp() {
  const now = moment().tz(TZ);
  return {
    date: now.format('ddd, MMMM Do, YYYY'),
    time: now.format('hh:mm A')
  };
}

function userId(participant) {
  if (!participant) return '';
  if (typeof participant === 'string') return participant;
  return participant.id || participant.jid || participant.lid || participant.phoneNumber || '';
}

function mentionTag(jid) {
  const n = String(jid || '').split('@')[0].split(':')[0];
  return n || 'user';
}

function sameJid(a, b) {
  const na = String(a || '').split('@')[0].split(':')[0];
  const nb = String(b || '').split('@')[0].split(':')[0];
  return na && nb && na === nb;
}

function isBot(conn, jid) {
  const ids = [
    conn.user?.id,
    conn.user?.lid,
    conn.user?.id && `${String(conn.user.id).split(':')[0]}@s.whatsapp.net`
  ].filter(Boolean);
  return ids.some((id) => sameJid(id, jid));
}

function cleanDesc(desc) {
  const text = String(desc || '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return 'No description';
  return text.length > 180 ? text.slice(0, 177) + '...' : text;
}

async function fetchProfilePic(conn, jid) {
  const ids = [];
  const add = (x) => {
    if (x && !ids.includes(x)) ids.push(x);
  };
  add(jid);
  const user = String(jid || '').split('@')[0].split(':')[0];
  if (user) {
    add(`${user}@s.whatsapp.net`);
    add(`${user}@lid`);
  }
  for (const id of ids) {
    for (const type of ['image', 'preview']) {
      try {
        const url = await conn.profilePictureUrl(id, type);
        if (!url || typeof url !== 'string') continue;
        const res = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 20000,
          maxRedirects: 5,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const buf = Buffer.from(res.data || []);
        if (buf.length > 800) return buf;
      } catch (_) {}
    }
  }
  return null;
}

function welcomeCaption(groupName, members, about, jid) {
  const g = greeting();
  const { date, time } = stamp();
  const tag = mentionTag(jid);
  return (
    `🌟 Welcome to ${groupName}\n` +
    `┌─⊷ 🌟 *WELCOME* 🌟\n` +
    `│ ${g.emoji} *${g.text}*\n` +
    `│\n` +
    `│ 👤 *USER:* @${tag}\n` +
    `│ 🏷️ *GROUP:* ${groupName}\n` +
    `│ 👥 *MEMBERS:* ${members}\n` +
    `│ 📅 *DATE:* ${date}\n` +
    `│ ⏰ *TIME:* ${time}\n` +
    `│ 📜 *ABOUT:* ${about}\n` +
    `\n> © Powered by ${BRAND}\n© Powered by ${BRAND}\n${CHANNEL_LINK}`
  );
}

function goodbyeCaption(groupName, members, about, jid) {
  const g = greeting();
  const { date, time } = stamp();
  const tag = mentionTag(jid);
  return (
    `🌟 ${groupName}\n` +
    `┌─⊷ 💔 *GOODBYE* 💔\n` +
    `│ ${g.emoji} *${g.text}*\n` +
    `│\n` +
    `│ 👤 *USER:* @${tag}\n` +
    `│ 🏷️ *GROUP:* ${groupName}\n` +
    `│ 😭 WE JUST LOST ONE SOUL 😭😭\n` +
    `│ 👥 *WE ARE NOW:* ${members}\n` +
    `│ 📅 *DATE:* ${date}\n` +
    `│ ⏰ *TIME:* ${time}\n` +
    `│ 📜 *ABOUT:* ${about}\n` +
    `\n> © Powered by ${BRAND}\n© Powered by ${BRAND}\n${CHANNEL_LINK}`
  );
}

async function sendWithPhoto(conn, groupId, jid, caption) {
  const mentions = [jid].filter(Boolean);
  const pic = await fetchProfilePic(conn, jid);
  if (pic) {
    await conn.sendMessage(groupId, {
      image: pic,
      caption,
      mentions
    });
    return;
  }
  await conn.sendMessage(groupId, { text: caption, mentions });
}

async function GroupEvents(conn, update) {
  try {
    const { id, participants, action } = update || {};
    if (!id || !participants || !participants.length) return;
    if (!id.endsWith('@g.us')) return;

    const flags = await liveFlags(conn);
    const welcomeOn = flagOn(flags, 'WELCOME', 'GROUP_WELCOME', 'WELCOME_ENABLE');
    const goodbyeOn = flagOn(flags, 'GOODBYE', 'GROUP_GOODBYE', 'GOODBYE_ENABLE');
    if (action === 'add' && !welcomeOn) return;
    if (action === 'remove' && !goodbyeOn) return;
    if (action !== 'add' && action !== 'remove') return;

    let metadata;
    try {
      metadata = await conn.groupMetadata(id);
    } catch (_) {
      return;
    }

    const groupName = metadata.subject || 'this group';
    const about = cleanDesc(metadata.desc);
    const memberCount = Array.isArray(metadata.participants) ? metadata.participants.length : 0;

    for (const participant of participants) {
      const jid = userId(participant);
      if (!jid) continue;
      if (isBot(conn, jid)) continue;

      try {
        if (action === 'add') {
          await sendWithPhoto(conn, id, jid, welcomeCaption(groupName, memberCount, about, jid));
        } else if (action === 'remove') {
          await sendWithPhoto(conn, id, jid, goodbyeCaption(groupName, memberCount, about, jid));
        }
      } catch (err) {
        console.error('[GroupEvents] send failed:', err.message);
        try {
          const caption = action === 'add'
            ? welcomeCaption(groupName, memberCount, about, jid)
            : goodbyeCaption(groupName, memberCount, about, jid);
          await conn.sendMessage(id, { text: caption, mentions: [jid] });
        } catch (_) {}
      }
    }
  } catch (error) {
    console.error('[GroupEvents] Error:', error.message);
  }
}

module.exports = GroupEvents;
