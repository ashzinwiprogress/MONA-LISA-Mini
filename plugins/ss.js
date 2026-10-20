const { cmd } = require('../redx');
const axios = require('axios');

async function fetchImage(url, timeout = 45000) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout,
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*,application/json' },
    maxRedirects: 5,
    validateStatus: (s) => s >= 200 && s < 400
  });
  const ctype = String(res.headers['content-type'] || '');
  if (ctype.includes('json')) {
    const parsed = JSON.parse(Buffer.from(res.data).toString('utf8'));
    const shot = parsed.screenshot || parsed.url || parsed.image || parsed.data?.screenshot || parsed.data?.url;
    if (!shot) throw new Error('JSON screenshot API returned no image');
    return fetchImage(shot, timeout);
  }
  if (Buffer.from(res.data).length < 800) throw new Error('Screenshot too small');
  return Buffer.from(res.data);
}

cmd({
  pattern: "screenshot",
  alias: ["ss", "webshot", "sitepic"],
  react: "🖥️",
  category: "tools",
  desc: "Take a desktop screenshot of a website",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) {
      return reply(
        "*WEBSITE SCREENSHOT*\n\n" +
        "Usage: .screenshot <website URL>\n\n" +
        "Example:\n.screenshot https://google.com"
      );
    }

    let target = q.trim();
    if (!/^https?:\/\//i.test(target)) target = 'https://' + target;

    await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

    const tries = [
      `https://image.thum.io/get/width/1280/crop/900/noanimate/${target}`,
      `https://mini.s-shot.ru/1280x720/PNG/1280/${encodeURIComponent(target)}`,
      `https://api.microlink.io/?url=${encodeURIComponent(target)}&screenshot=true&meta=false&embed=screenshot.url`
    ];

    let buffer = null;
    let lastErr = null;
    for (const api of tries) {
      try {
        buffer = await fetchImage(api);
        if (buffer) break;
      } catch (e) {
        lastErr = e;
      }
    }

    if (!buffer) throw lastErr || new Error('All screenshot providers failed');

    await conn.sendMessage(from, {
      image: buffer,
      caption: `Screenshot of: ${target}\nPowered by Progress Tech`
    }, { quoted: mek });
  } catch (err) {
    console.error("SCREENSHOT COMMAND ERROR:", err.message);
    reply("Screenshot failed. Check the URL and try again.");
  }
});
