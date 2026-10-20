const { cmd } = require('../redx');
const axios = require('axios');
const fs = require('fs');

const NEWSLETTER_JID = '120363431455356251@newsletter';
const CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';
const BRAND = '🔹 Powered by Progress Tech • 🥷TECH TOY🧑‍💻™ ✓';
const API = 'https://api.omegatech.app/api/ai/Txt2video';

function getThumb() {
    try {
        for (const p of ['./media/menu1.png','./media/menu2.png']) {
            if (fs.existsSync(p)) return fs.readFileSync(p);
        }
        return null;
    } catch { return null; }
}

cmd({
  pattern: "txt2video",
  alias: ["t2v", "text2video"],
  react: "🎬",
  desc: "Generate AI videos from text prompts with voiceover and aspect ratios",
  category: "progresstech ai",
  use: ".txt2video a cat dancing in space |.txt2video 16:9 a city at sunset with voiceover",
  filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix }) => {
  try {
    let rawQ = q || "";
    const inter = mek.message?.interactiveResponseMessage;
    if (inter?.nativeFlowResponseMessage?.paramsJson) {
        try {
            const p = JSON.parse(inter.nativeFlowResponseMessage.paramsJson);
            if (p.id) rawQ = p.id.replace(prefix,"").trim();
        } catch {}
    }
    if (mek.message?.listResponseMessage?.singleSelectReply?.selectedRowId) {
        rawQ = mek.message.listResponseMessage.singleSelectReply.selectedRowId.replace(prefix,"").trim();
    }
    if (rawQ.startsWith(prefix)) rawQ = rawQ.replace(new RegExp(`^${prefix}[a-z0-9-]+\\s*`, 'i'), '').trim();

    const ctx = {
        forwardingScore: 999, isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: NEWSLETTER_JID,
            serverMessageId: 1,
            newsletterName: '🥷TECH TOY🧑‍💻™ ✓'
        }
    };

    if (!rawQ || rawQ.toLowerCase() === 'help' || rawQ.toLowerCase() === 'menu') {
        let thumb = null;
        try {
            const { prepareWAMessageMedia } = require('@whiskeysockets/baileys');
            const tb = getThumb();
            if (tb) {
                const media = await prepareWAMessageMedia({ image: tb }, { upload: conn.waUploadToServer });
                thumb = media.imageMessage;
            }
        } catch {}

        const menu = `┏━━〔 🎬 Txt2Video AI 〕━━┓
┃ Generate AI videos from text
┃ Supports aspect ratios + voiceover
┃ Auto-rotates device ID on limit
┃
┃ *Usage:*
┃ ${prefix}txt2video a cat astronaut dancing in space
┃ ${prefix}txt2video 16:9 a futuristic city sunset cinematic
┃ ${prefix}txt2video 9:16 Mona Lisa afro girl singing, with voiceover
┃ ${prefix}txt2video 1:1 omah lay concert crowd
┃
┃ *Aspect Ratios:*
┃ 16:9 - YouTube / Landscape
┃ 9:16 - TikTok / Reels / Portrait
┃ 1:1 - Square
┃
┃ *Voiceover:* add word "voiceover" or "with voice"
┗━━━━━━━━━━━━━━┛
`;

        const buttons = [
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🎬 16:9 Landscape", id: `${prefix}txt2video 16:9 a cinematic futuristic city at sunset, drones flying` }) },
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "📱 9:16 Portrait", id: `${prefix}txt2video 9:16 Mona Lisa afro girl dancing, omah lay vibe, with voiceover` }) },
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🎙️ With Voiceover", id: `${prefix}txt2video a motivational speech about success with AI voiceover` }) },
            { name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: "📢 TECH TOY Channel", url: CHANNEL_LINK }) }
        ];

        return await conn.relayMessage(from, {
            interactiveMessage: {
                header: { title: "🎬 Txt2Video • T2V API", hasMediaAttachment:!!thumb,...(thumb? { imageMessage: thumb } : {}) },
                body: { text: menu },
                footer: { text: BRAND },
                nativeFlowMessage: { buttons }
            },
            contextInfo: ctx
        }, {});
    }

    await conn.sendMessage(from, { react: { text: "🎬", key: mek.key } });

    let prompt = rawQ;
    let aspectRatio = "auto";
    let sound = true;

    const arMatch = rawQ.match(/(16:9|9:16|1:1|4:3|21:9|auto)/i);
    if (arMatch) {
        aspectRatio = arMatch[1];
        prompt = rawQ.replace(arMatch[0], '').trim();
    }
    if (/no\s*sound|silent/i.test(rawQ)) {
        sound = false;
        prompt = prompt.replace(/no\s*sound|silent/ig, '').trim();
    }
    if (!prompt) prompt = rawQ.replace(arMatch ? arMatch[0] : '', '').trim() || rawQ;

    reply(`Generating ~10s video with ${sound ? 'sound' : 'no sound'}...\nPrompt: ${prompt.slice(0,120)}\nRatio: ${aspectRatio}\n\nPowered by Progress Tech`);

    let videoUrl = null;
    try {
        const { data } = await axios.get(API, {
            params: { action: 'generate', prompt, ratio: aspectRatio, sound: String(sound) },
            timeout: 180000,
            headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }
        });
        if (data && data.success === false) throw new Error(data.message || data.error || 'Txt2video failed');
        const d = data.data || data;
        videoUrl = d.videoUrl || d.url || d.video || data.videoUrl;
    } catch (e) {
        console.log('Txt2video GET failed', e.response?.data || e.message);
        throw e;
    }

    if (!videoUrl) throw new Error('No video URL returned from Txt2video');

    await conn.sendMessage(from, {
        video: { url: videoUrl },
        caption: `*Txt2Video (~10s, sound)*\nPrompt: ${prompt}\nRatio: ${aspectRatio}\n\nPowered by Progress Tech\n${CHANNEL_LINK}`,
        contextInfo: ctx
    }, { quoted: mek });

    await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

  } catch (e) {
    console.error('Txt2Video Error:', e.response?.data || e.message);
    reply(`*❌ Txt2Video Failed*\n${e.response?.data?.message || e.message}\n\nTry simpler: ${e.response?.data? '' : ''}\n${'.txt2video a cat dancing in space'}`);
  }
});