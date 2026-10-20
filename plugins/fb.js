const { cmd } = require('../redx');
const axios = require('axios');

cmd({
  pattern: "fb",
  react: "☺️",
  alias: ["facebook", "fbdl"],
  category: "download",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("*YOU WANT TO DOWNLOAD A FACEBOOK VIDEO 🤔 THEN COPY THE LINK OF THAT FACEBOOK VIDEO 🤗*\n*THEN WRITE LIKE THIS ☺️*\n\n*FB ❮FACEBOOK VIDEO LINK❯*\n\n*WHEN YOU WRITE LIKE THIS 😇 YOUR FACEBOOK VIDEO WILL BE DOWNLOADED 😃 AND SENT HERE 😍♥️*");

    let videoUrl = null;
    let duration = '';
    let creator = 'Progress Tech';

    try {
      const apiUrl = `https://movanest.xyz/v2/fbdown?url=${encodeURIComponent(q)}`;
      const res = await axios.get(apiUrl, { timeout: 30000 });
      const data = res.data;
      if (data.status === true && Array.isArray(data.results) && data.results.length) {
        const result = data.results[0];
        videoUrl = result.hdQualityLink || result.normalQualityLink;
        duration = result.duration || '';
        creator = data.creator || creator;
      }
    } catch (_) {}

    if (!videoUrl) {
      try {
        const { data } = await axios.get(
          `https://api.omegatech.app/api/download/Facebook?action=download&url=${encodeURIComponent(q)}&quality=hd`,
          { timeout: 45000, headers: { Accept: 'application/json' } }
        );
        const d = data.data || data;
        videoUrl = d.hd || d.sd || d.url || d.video || d.downloadUrl || d.media;
        duration = d.duration || duration;
      } catch (_) {}
    }

    if (!videoUrl) {
      return reply("Facebook video not found. Send a public video link.");
    }

    const caption = `*FB VIDEO*\nTime: ${duration || 'N/A'}\nBy: ${creator}\nPowered by Progress Tech`;

    await conn.sendMessage(
      from,
      {
        video: { url: videoUrl },
        mimetype: "video/mp4",
        caption: caption
      },
      { quoted: mek }
    );

  } catch (err) {
    console.log(err);
    reply("❌ An error occurred");
  }
});