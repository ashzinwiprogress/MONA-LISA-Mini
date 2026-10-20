const { cmd } = require('../redx');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const NEWSLETTER_JID = '120363431455356251@newsletter';
const BRAND = 'Powered by Progress Tech';
const CACHE_FILE = path.join(__dirname, '../data/couple_cache.json');

function getCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE)); } catch { return null; }
}
function saveCache(male, female) {
  const dir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify({ male, female, time: Date.now() }));
}

async function pickUrl(urls) {
  for (const url of urls) {
    try {
      const { data } = await axios.get(url, { timeout: 15000, headers: { Accept: 'application/json' } });
      const found = data?.url || data?.male || data?.images?.[0]?.url || data?.results?.[0]?.url;
      if (found && String(found).startsWith('http')) return found;
    } catch (_) {}
  }
  return null;
}

cmd({
  pattern: "coupledp",
  alias: ["couple", "couplepfp", "cdp"],
  react: "💑",
  desc: "Send a matching couple DP pair",
  category: "fun",
  filename: __filename
}, async (conn, mek, m, { from, reply }) => {
  try {
    const ctx = {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: NEWSLETTER_JID,
        serverMessageId: 142,
        newsletterName: 'PROGRESS TECH'
      }
    };

    await conn.sendMessage(from, { react: { text: "💑", key: mek.key } });

    let male = await pickUrl([
      'https://api.waifu.pics/sfw/neko',
      'https://api.waifu.im/search?included_tags=waifu&is_nsfw=false',
      'https://nekos.best/api/v2/neko'
    ]);
    let female = await pickUrl([
      'https://api.waifu.pics/sfw/waifu',
      'https://api.waifu.im/search?included_tags=waifu&is_nsfw=false',
      'https://nekos.best/api/v2/waifu'
    ]);

    if (!male || !female) {
      const cache = getCache();
      if (cache?.male && cache?.female) {
        male = cache.male;
        female = cache.female;
      }
    }

    if (!male || !female) return reply('Couple DP APIs are busy. Try again in a moment.');

    saveCache(male, female);

    await conn.sendMessage(from, {
      image: { url: male },
      caption: `Male DP\n_${BRAND}_`,
      contextInfo: ctx
    }, { quoted: mek });
    await conn.sendMessage(from, {
      image: { url: female },
      caption: `Female DP\n_${BRAND}_`,
      contextInfo: ctx
    }, { quoted: mek });
  } catch (e) {
    reply(`Couple DP failed: ${e.message}`);
  }
});
