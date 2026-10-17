// ═══════════════════════════════════════════════════════════════════════════
//   ❤️ CHANNEL REACT — react to a WhatsApp channel post
//   Powered by Progress Tech
//
//   Usage: .wareact https://whatsapp.com/channel/<CHANNEL_ID>/<POST_ID> 😍 ❤️
// ═══════════════════════════════════════════════════════════════════════════

const { cmd } = require('../redx');

const CHANNEL_URL_RE = /whatsapp\.com\/channel\/([0-9A-Za-z]+)(?:\/([0-9A-Za-z_-]+))?/;

cmd({
    pattern: "wareact",
    alias: ["wreact"],
    react: "❤️",
    desc: "React to a WhatsApp channel post",
    category: "tools",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q || !q.includes('whatsapp.com/channel/')) {
        return reply('Use: .wareact https://whatsapp.com/channel/CHANNEL_ID/POST_ID 😍 ❤️');
    }

    const match = q.match(CHANNEL_URL_RE);
    if (!match || !match[1]) {
        return reply('❌ Could not read a channel ID from that link.\nUse format: https://whatsapp.com/channel/CHANNEL_ID/POST_ID');
    }

    const channelId = match[1];
    const postId = match[2];
    const channelJid = channelId.includes('@') ? channelId : `${channelId}@newsletter`;

    const args = q.trim().split(/\s+/);
    const emojis = args.slice(1).filter(a => !a.includes('whatsapp.com')).join('').trim() || '❤️';

    if (!postId) {
        return reply('❌ Post ID missing.\nUse the full link: https://whatsapp.com/channel/CHANNEL_ID/POST_ID');
    }

    if (typeof conn.newsletterReactMessage !== 'function') {
        return reply('❌ This bot build does not support channel reactions.');
    }

    try {
        let sent = 0;
        for (const emoji of [...emojis]) {
            try {
                await conn.newsletterReactMessage(channelJid, String(postId), emoji);
                sent++;
            } catch (e) {
                console.error('[wareact] react error:', e.message);
            }
        }

        if (!sent) return reply('❌ The reaction could not be delivered. Check the channel ID and post ID.');
        reply(`✅ Reacted with ${emojis} on:\n${channelJid}/${postId}`);
    } catch (err) {
        reply(`❌ Failed: ${err.message}`);
    }
});
