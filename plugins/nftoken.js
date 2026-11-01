const { cmd } = require('../redx');
const axios = require('axios');

cmd({
  pattern: 'nftoken',
  alias: ['tokenprice', 'coingecko', 'cryptoprice'],
  react: '🪙',
  desc: 'Look up a crypto token price',
  category: 'tools',
  filename: __filename
}, async (conn, mek, m, { q, reply }) => {
  try {
    const query = String(q || '').trim() || 'bitcoin';
    const { data } = await axios.get('https://api.coingecko.com/api/v3/search', {
      params: { query },
      timeout: 15000
    });
    const coin = data?.coins?.[0];
    if (!coin?.id) return reply(`No token found for "${query}". Try bitcoin, ethereum, solana.`);
    const { data: market } = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
      params: { ids: coin.id, vs_currencies: 'usd', include_24hr_change: 'true' },
      timeout: 15000
    });
    const usd = market?.[coin.id]?.usd;
    const change = market?.[coin.id]?.usd_24h_change;
    if (usd == null) return reply(`Found ${coin.name} but no USD price.`);
    const ch = change == null ? '' : ` (${change >= 0 ? '+' : ''}${change.toFixed(2)}% 24h)`;
    reply(`*${coin.name} (${String(coin.symbol || '').toUpperCase()})*\nUSD: $${usd}${ch}`);
  } catch (e) {
    reply(`Token lookup failed: ${e.message}`);
  }
});
