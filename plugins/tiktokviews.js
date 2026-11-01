const { cmd } = require('../redx');
const axios = require('axios');

cmd({
  pattern: 'tiktokviews',
  alias: ['ttviews', 'ttstats'],
  react: '📊',
  desc: 'Show public TikTok video stats from a link',
  category: 'download',
  filename: __filename
}, async (conn, mek, m, { q, reply }) => {
  try {
    const url = String(q || m.quoted?.text || '').match(/https?:\/\/[^\s]+/i)?.[0];
    if (!url) return reply('Send a TikTok link.\nExample: .tiktokviews https://www.tiktok.com/@user/video/123');
    const { data } = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, {
      timeout: 25000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const d = data?.data || data;
    if (!d) return reply('Could not read that TikTok. Check the link is public.');
    const title = d.title || d.desc || 'TikTok';
    const author = d.author?.nickname || d.author?.unique_id || d.author || 'unknown';
    const views = d.play_count ?? d.playCount ?? d.views ?? 0;
    const likes = d.digg_count ?? d.diggCount ?? d.likes ?? 0;
    const comments = d.comment_count ?? d.commentCount ?? 0;
    const shares = d.share_count ?? d.shareCount ?? 0;
    reply(`*${title}*\nAuthor: ${author}\nViews: ${views}\nLikes: ${likes}\nComments: ${comments}\nShares: ${shares}`);
  } catch (e) {
    reply(`TikTok stats failed: ${e.message}`);
  }
});
