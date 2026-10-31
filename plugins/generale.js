const { cmd, commands } = require('../redx');
const config = require('../config');
const os = require('os');

// =================================================================
// 🏓 COMMANDE PING (Style Speedtest)
// =================================================================
cmd({
    pattern: "uptime",
    alias: ["runtime", "botstat"],
    desc: "Show bot uptime, latency and RAM",
    category: "system",
    react: "👑"
},
async(conn, mek, m, { from, reply }) => {
    try {
        const start = Date.now();
        const msg = await conn.sendMessage(from, { text: '*Checking...*' }, { quoted: mek });
        const latency = Date.now() - start;
        const totalMem = (os.totalmem() / 1024 / 1024).toFixed(0);
        const usedMem = ((os.totalmem() - os.freemem()) / 1024 / 1024).toFixed(0);
        const sec = Math.floor(process.uptime());
        const h = Math.floor(sec / 3600);
        const min = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        const pingMsg =
`*MONA LISA STATUS*

Uptime: ${h}h ${min}m ${s}s
Latency: ${latency}ms
RAM: ${usedMem}MB / ${totalMem}MB`;
        await conn.sendMessage(from, { text: pingMsg, edit: msg.key });
    } catch (e) {
        reply("Error: " + e.message);
    }
});


// =================================================================
// 👑 COMMANDE OWNER (Carte de visite)
// =================================================================
cmd({
    pattern: "owner",
    desc: "Contact the creator",
    category: "system",
    react: "👑"
},
async(conn, mek, m, { from }) => {
    const ownerNumber = String(Array.isArray(config.OWNER_NUMBER) ? config.OWNER_NUMBER[0] : config.OWNER_NUMBER || '').replace(/[^0-9]/g, '') || '237682432296';
    const ownerName = config.OWNER_NAME || 'Progress Tech';
    const vcard = 'BEGIN:VCARD\n' +
                  'VERSION:3.0\n' +
                  `FN:${ownerName}\n` +
                  'ORG:MONA LISA;\n' +
                  `TEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}\n` +
                  'END:VCARD';

    await conn.sendMessage(from, {
        contacts: {
            displayName: ownerName,
            contacts: [{ vcard }]
        }
    }, { quoted: mek });
});
