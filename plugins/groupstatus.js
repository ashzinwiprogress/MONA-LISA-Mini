const { cmd } = require("../redx");
const config = require("../config");

function ownerStatusJids(conn, sender) {
    const extra = [];
    const userId = conn?.user?.id;
    if (userId) extra.push(userId.includes(':') ? userId.split(':')[0] + '@s.whatsapp.net' : userId);
    if (conn?.user?.lid) extra.push(conn.user.lid);
    if (sender) extra.push(sender);
    const owners = (config.OWNER_NUMBER || []).map(n => `${String(n).replace(/[^0-9]/g, '')}@s.whatsapp.net`);
    return [...new Set([...owners, ...extra].filter(Boolean))];
}

function quotedType(quoted) {
    if (!quoted) return '';
    return quoted.mtype || (quoted.imageMessage && 'imageMessage')
        || (quoted.videoMessage && 'videoMessage')
        || (quoted.audioMessage && 'audioMessage')
        || (quoted.stickerMessage && 'stickerMessage')
        || '';
}

cmd({
    pattern: "groupstatus",
    alias: ["gstatus", "poststatus", "statuspost"],
    desc: "Post text or media to WhatsApp Status",
    category: "group",
    react: "📡",
    filename: __filename
},
async (conn, mek, m, { body, reply, pushname, sender, isOwner, isCreator }) => {
    try {
        if (!isOwner && !isCreator) {
            return reply("Only the bot owner can post to this account's WhatsApp Status.");
        }

        const caption = body.split(" ").slice(1).join(" ").trim();
        const statusJidList = ownerStatusJids(conn, sender);
        const statusOpts = { statusJidList, backgroundColor: '#111111', font: 0 };

        if (!m.quoted && caption) {
            const text =
`╭━━〔 MONA LISA 〕━━⬣
┃ User : ${pushname}
┃ Time : ${new Date().toLocaleString()}
┃
┃ Message:
┃ ${caption}
╰━━━━━━━━━━━━━━━━⬣`;
            await conn.sendMessage("status@broadcast", { text }, statusOpts);
            return reply("Text status posted. Check WhatsApp Status on the linked phone.");
        }

        if (!m.quoted) {
            return reply("Reply to an image, video, audio, or sticker.\n\nExample:\n.groupstatus Hello World");
        }

        const quoted = m.quoted;
        const type = quotedType(quoted);
        const media = await quoted.download();
        if (!media) return reply("Could not download the replied media.");

        if (type === "imageMessage" || quoted.imageMessage) {
            await conn.sendMessage("status@broadcast", {
                image: media,
                caption:
`*MONA LISA*

Posted By: ${pushname}
${new Date().toLocaleString()}

${caption || "No Caption"}`
            }, statusOpts);
            return reply("Image status posted. Check WhatsApp Status on the linked phone.");
        }

        if (type === "videoMessage" || quoted.videoMessage) {
            await conn.sendMessage("status@broadcast", {
                video: media,
                caption:
`*MONA LISA*

Posted By: ${pushname}
${new Date().toLocaleString()}

${caption || "No Caption"}`
            }, statusOpts);
            return reply("Video status posted. Check WhatsApp Status on the linked phone.");
        }

        if (type === "audioMessage" || quoted.audioMessage) {
            await conn.sendMessage("status@broadcast", {
                audio: media,
                mimetype: "audio/mp4",
                ptt: true
            }, { ...statusOpts, backgroundColor: '#000000' });
            return reply("Audio status posted. Check WhatsApp Status on the linked phone.");
        }

        if (type === "stickerMessage" || quoted.stickerMessage) {
            await conn.sendMessage("status@broadcast", { sticker: media }, statusOpts);
            return reply("Sticker status posted. Check WhatsApp Status on the linked phone.");
        }

        return reply("Unsupported media type. Reply to an image, video, audio, or sticker.");
    } catch (err) {
        console.log("GROUPSTATUS ERROR:", err);
        return reply(`STATUS ERROR\n\n${err.message}`);
    }
});
