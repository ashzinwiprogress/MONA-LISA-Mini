const { cmd } = require('../redx');
const {
  BATCH,
  parseReactArgs,
  sendVipReaction,
  sendSuccess,
  runBatch
} = require('../lib/vipreact');

cmd({
  pattern: 'wareact',
  alias: ['wreact'],
  react: '❤️',
  desc: 'React to a WhatsApp channel post',
  category: 'tools',
  filename: __filename
}, async (conn, mek, m, { q, reply, from }) => {
  const parsed = parseReactArgs(q);
  if (!parsed) {
    return reply('Use: .wareact https://whatsapp.com/channel/CHANNEL_ID/POST_ID 😍 10');
  }
  if (!parsed.postId) {
    return reply('Post ID missing.\nUse the full link: https://whatsapp.com/channel/CHANNEL_ID/POST_ID');
  }

  try {
    await conn.sendPresenceUpdate('composing', from).catch(() => {});
    await reply(`🔄 Sending VIP reaction...\n\n🔗 ${parsed.url}\n${parsed.emojis.join(' ')}\n📦 ${parsed.count} queued\n⏱️ This may take 10-15 seconds...`);

    let local = 0;
    if (typeof conn.newsletterReactMessage === 'function') {
      for (const emoji of parsed.emojis) {
        try {
          await conn.newsletterReactMessage(parsed.channelJid, String(parsed.postId), emoji);
          local++;
        } catch (e) {
          console.error('[wareact] local react', e.message);
        }
      }
    }

    const jobs = [];
    for (let i = 0; i < parsed.count; i++) {
      const emoji = parsed.emojis[i % parsed.emojis.length];
      jobs.push(() => sendVipReaction(parsed.url, emoji));
    }
    const settled = await runBatch(jobs, BATCH);
    const ok = settled.filter((s) => s.status === 'fulfilled').length;
    const fail = settled.filter((s) => s.status === 'rejected').length;
    if (!ok && !local) {
      const err = settled.find((s) => s.status === 'rejected');
      throw new Error(err?.reason?.message || 'The reaction could not be delivered.');
    }
    const last = (settled.find((s) => s.status === 'fulfilled') || {}).value || {};
    await sendSuccess(conn, from, mek, last, parsed.url, parsed.emojis[0], {
      ok,
      fail,
      count: parsed.count,
      local,
      emojis: parsed.emojis.join(' '),
      tagged: [m.sender]
    });
  } catch (err) {
    reply(`❌ Failed to send VIP reaction.\n\nError: ${err.message}`);
  }
});
