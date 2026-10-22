const { cmd } = require('../redx');
const {
  MAX_COUNT,
  BATCH,
  parseReactArgs,
  sendVipReaction,
  rch2React,
  sendSuccess,
  runBatch
} = require('../lib/vipreact');

cmd({
  pattern: 'rch',
  alias: ['vipreact', 'react', 'rch2', 'funreact', 'chreact', 'reactch'],
  react: '😁',
  desc: 'Send VIP reactions to a WhatsApp channel post',
  category: 'fun',
  filename: __filename
}, async (conn, mek, m, { q, reply, prefix, from }) => {
  const pre = prefix || '.';
  try {
    const parsed = parseReactArgs(q);
    if (!parsed) {
      return reply(
        `😁 *VIP Reaction Bot*\n\nSend VIP reactions to WhatsApp channel posts.\n\n📝 *Usage:*\n${pre}rch <channel_url> <emoji>\n${pre}rch <channel_url> <emoji> <count>\n\n📌 *Examples:*\n${pre}rch https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05/230 😁\n${pre}rch https://whatsapp.com/channel/xxx/123 😂 25\n\nCount max ${MAX_COUNT}.\n\n⚡ *Powered by PROGRESS TECH VIP*`
      );
    }

    const { url, emojis, count } = parsed;
    await conn.sendPresenceUpdate('composing', from).catch(() => {});
    await reply(`🔄 Sending VIP reaction...\n\n🔗 ${url}\n${emojis.join(' ')}\n📦 ${count} queued\n⏱️ This may take 10-15 seconds...`);

    const firstEmoji = emojis[0];
    let last = null;
    try {
      last = await sendVipReaction(url, firstEmoji);
    } catch (e1) {
      last = await rch2React(url, emojis);
    }

    let ok = 1;
    let fail = 0;
    if (count > 1) {
      const jobs = [];
      for (let i = 1; i < count; i++) {
        const emoji = emojis[i % emojis.length];
        jobs.push(() => sendVipReaction(url, emoji));
      }
      const settled = await runBatch(jobs, BATCH);
      ok += settled.filter((s) => s.status === 'fulfilled').length;
      fail += settled.filter((s) => s.status === 'rejected').length;
      const more = settled.find((s) => s.status === 'fulfilled');
      if (more) last = more.value;
    }

    await sendSuccess(conn, from, mek, last || {}, url, firstEmoji, {
      ok,
      fail,
      count,
      emojis: emojis.join(' '),
      tagged: [m.sender]
    });
  } catch (e) {
    console.error('VIP Reaction Error:', e.message);
    reply(`❌ Failed to send VIP reaction.\n\nError: ${e.response?.data?.error || e.response?.data?.message || e.message}`);
  }
});
