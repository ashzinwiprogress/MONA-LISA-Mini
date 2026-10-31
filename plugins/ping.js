const { cmd } = require('../redx');

cmd({
  pattern: 'ping',
  alias: ['speed', 'pong'],
  desc: 'Measure bot response speed',
  category: 'main',
  react: '⚡',
  filename: __filename
}, async (conn, mek, m, { from, reply }) => {
  try {
    const start = Date.now();
    const sent = await conn.sendMessage(from, { text: '*Pinging...*' }, { quoted: mek });
    const ping = Date.now() - start;
    await conn.sendMessage(from, {
      text: `*PONG*\nLatency: ${ping}ms\nUptime: ${Math.floor(process.uptime())}s`,
      edit: sent.key
    });
  } catch (e) {
    console.error('Ping Error:', e);
    reply(`Ping failed: ${e.message}`);
  }
});
