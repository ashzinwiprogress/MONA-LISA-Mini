// ═══════════════════════════════════════════════════════════════════════════
//   🥰 MONA LISA 🤭 — SYSTEM MODULE
//   Channel follow, channel auto-react, and status auto-handling.
//   Powered by Progress Tech
//
//   This file is intentionally written in plain, readable JavaScript.
//   It replaces a previous version of this file that shipped obfuscated
//   and unreadable (control-flow flattened, anti-debugging loops). That
//   version has been removed for the safety of anyone running this bot —
//   see README.md for details. Everything below does exactly what it
//   says and nothing else.
// ═══════════════════════════════════════════════════════════════════════════

const config = require('../config');
const { delay } = require('@whiskeysockets/baileys');

const CHANNEL_IDS = config.CHANNEL_IDS || [config.CHANNEL_JID || '120363431455356251@newsletter'];
const REACT_EMOJIS = config.REACT_EMOJIS && config.REACT_EMOJIS.length
    ? config.REACT_EMOJIS
    : ['🤍', '🥰', '💜', '💙', '💚', '👑', '✨', '🔥'];

/**
 * Follow the bot's official MONA LISA channel(s) on connection.
 * Safe no-op if the connected library version doesn't support it,
 * or if AUTO_FOLLOW_CHANNEL is disabled.
 */
async function redxminibot(conn) {
    if (config.AUTO_FOLLOW_CHANNEL !== 'true') return false;
    console.log('[System] Following official channel(s)...');
    const jids = [...new Set((CHANNEL_IDS || []).concat(config.CHANNEL_JID || []).filter(Boolean))];
    for (const jid of jids) {
        try {
            if (typeof conn.newsletterFollow === 'function') {
                await conn.newsletterFollow(jid);
                console.log(`[System] Followed channel: ${jid}`);
            } else if (typeof conn.subscribeNewsletter === 'function') {
                await conn.subscribeNewsletter(jid);
                console.log(`[System] Subscribed to channel: ${jid}`);
            } else {
                console.log(`[System] Channel follow API not available on this Baileys build`);
            }
        } catch (err) {
            console.log(`[System] Could not follow channel ${jid}: ${err.message}`);
        }
        await delay(500);
    }
    return true;
}

function extractInviteCode(link) {
    const raw = String(link || '').trim();
    if (!raw) return '';
    const m = raw.match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9_-]+)/i);
    if (m) return m[1];
    if (/^[A-Za-z0-9_-]{10,}$/.test(raw)) return raw;
    return '';
}

async function autoJoinOfficialGroup(conn) {
    if (String(config.AUTO_JOIN_GROUP || 'true') !== 'true') return false;
    const code = extractInviteCode(config.GROUP_LINK);
    if (!code) return false;
    console.log(`[System] Joining official group (${code})...`);
    try {
        if (typeof conn.groupAcceptInvite !== 'function') {
            console.log('[System] groupAcceptInvite is not available on this Baileys build');
            return false;
        }
        await conn.groupAcceptInvite(code);
        console.log(`[System] Joined official group: ${code}`);
        return true;
    } catch (err) {
        const msg = String(err?.message || err);
        if (/already|conflict|not-authorized|forbidden/i.test(msg)) {
            console.log(`[System] Group join skipped: ${msg}`);
            return false;
        }
        console.log(`[System] Could not join official group: ${msg}`);
        return false;
    }
}

/**
 * React to an incoming message that came from a followed channel post,
 * using a random emoji from REACT_EMOJIS. Controlled by AUTO_CHANNEL_REACT.
 */
async function autoReactChannel(conn, mek) {
    try {
        if (config.AUTO_CHANNEL_REACT !== 'true') return false;

        const key = mek.key;
        if (!key || !CHANNEL_IDS.includes(key.remoteJid)) return false;

        const serverId = key.server_id || key.serverId || key.id;
        if (!serverId) return false;

        const emoji = REACT_EMOJIS[Math.floor(Math.random() * REACT_EMOJIS.length)];

        await conn.newsletterReactMessage(key.remoteJid, serverId.toString(), emoji);
        console.log(`[System] ✅ Reacted ${emoji} to channel post: ${serverId}`);
        return true;
    } catch (err) {
        console.log(`[System] ⚠️ Channel react error: ${err.message}`);
        return false;
    }
}

/**
 * Auto-view and/or auto-react to WhatsApp status updates from contacts,
 * based on AUTO_STATUS_SEEN / AUTO_STATUS_REACT / AUTO_STATUS_REPLY.
 */
async function autoHandleStatus(conn, mek) {
    try {
        const key = mek.key;
        if (!key || key.remoteJid !== 'status@broadcast') return false;

        if (config.AUTO_STATUS_SEEN === 'true') {
            try {
                await conn.readMessages([key]);
                console.log('[System] ✅ Viewed status');
            } catch (err) {
                console.log(`[System] ⚠️ Status view error: ${err.message}`);
            }
        }

        if (config.AUTO_STATUS_REACT === 'true') {
            try {
                const emoji = REACT_EMOJIS[Math.floor(Math.random() * REACT_EMOJIS.length)];
                const botJid = conn.user?.id ? conn.user.id.split(':')[0] + '@s.whatsapp.net' : undefined;
                await conn.sendMessage(
                    key.remoteJid,
                    { react: { text: emoji, key } },
                    { statusJidList: [key.participant, botJid].filter(Boolean) }
                );
                console.log(`[System] ✅ Reacted ${emoji} to status`);
            } catch (err) {
                console.log(`[System] ⚠️ Status react error: ${err.message}`);
            }
        }

        if (config.AUTO_STATUS_REPLY === 'true') {
            try {
                const target = key.participant;
                const message = config.AUTO_STATUS_MSG || '❤️ Nice status!';
                if (target) {
                    await conn.sendMessage(target, { text: message }, { quoted: mek });
                    console.log('[System] ✅ Replied to status');
                }
            } catch (err) {
                console.log(`[System] ⚠️ Status reply error: ${err.message}`);
            }
        }

        return true;
    } catch (err) {
        console.log(`[System] ⚠️ autoHandleStatus error: ${err.message}`);
        return false;
    }
}

/**
 * React to a specific channel post by server id, with a specific emoji.
 * Used by the owner-only /react admin route in main.js.
 */
async function reactToChannelPost(conn, channelJid, serverId, emoji = '❤️') {
    try {
        await conn.newsletterReactMessage(channelJid, serverId.toString(), emoji);
        console.log(`[System] ✅ Reacted ${emoji} to post ${serverId} on ${channelJid}`);
        return true;
    } catch (err) {
        console.log(`[System] ⚠️ reactToChannelPost error: ${err.message}`);
        return false;
    }
}

module.exports = {
    redxminibot,
    autoJoinOfficialGroup,
    autoReactChannel,
    autoHandleStatus,
    reactToChannelPost,
    CHANNEL_IDS,
    REACT_EMOJIS,
};
