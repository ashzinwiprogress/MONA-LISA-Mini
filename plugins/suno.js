const { cmd } = require('../redx');
const axios = require('axios');

const CLOUDINARY_IMAGE = 'https://res.cloudinary.com/di2a9lenz/image/upload/v1786909227/omegatech_ai_media/upload-1786909226872.jpg';

const MUSIC_STYLES = [
    'Pop', 'Rock', 'Hip-Hop', 'R&B', 'EDM', 'Jazz', 'Classical', 'Country',
    'Metal', 'Reggae', 'Blues', 'Folk', 'Soul', 'Funk', 'Disco', 'House',
    'Techno', 'Trance', 'Drum & Bass', 'Dubstep', 'Lo-fi', 'Acoustic'
];

const activeGenerations = new Set();

async function generateMusicOld(prompt) {
    if (!prompt) throw "Prompt is required";
    const start = await axios.get(`https://api.omegatech.app/api/ai/sonu3?action=generate&prompt=${encodeURIComponent(prompt)}`, { timeout: 120000 });
    const body = start.data || {};
    const d0 = body.data || body;
    let audio = d0.url || d0.audio_url || d0.audioUrl || body.audioUrl;
    let taskId = body.taskId || d0.taskId;
    if (!audio && taskId) {
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 7000));
            const { data: st } = await axios.get(`https://api.omegatech.app/api/ai/sonu3?action=result&taskId=${encodeURIComponent(taskId)}`, { timeout: 60000 });
            const sd = st.data || st;
            audio = sd.audioUrl || sd.audio_url || sd.url || sd.audio;
            if (Array.isArray(sd.songs) && sd.songs[0]) audio = audio || sd.songs[0].audioUrl || sd.songs[0].url;
            if (audio) break;
            const status = String(sd.status || st.status || '').toLowerCase();
            if (status === 'failed' || status === 'error') throw sd.message || 'Sonu3 failed';
        }
    }
    if (!audio) throw "No music generated";
    return {
        title: d0.title || prompt.slice(0, 20),
        audio_url: audio,
        image_url: d0.thumbnail || d0.image_url || CLOUDINARY_IMAGE,
        lyrics: d0.lyrics || 'No lyrics available.',
        tags: d0.tags || 'N/A',
        duration: d0.duration || 0,
    };
}

async function generateMusicNew(prompt, title, musicStyle = 'Pop') {
    if (!prompt) throw "Prompt is required";
    const url = `https://api.omegatech.app/api/ai/sonu-pro?action=generate&prompt=${encodeURIComponent(prompt)}&title=${encodeURIComponent(title || prompt)}&isInstrumental=false&musicStyle=${encodeURIComponent(musicStyle)}`;
    const { data } = await axios.get(url, { timeout: 120000 });
    if (!data?.success) throw "No music generated";
    return data;
}

async function sendSafeMusicCard(conn, chatId, track, prompt, style, quoted) {
    try {
        const title = track.title || prompt;
        const cover = track.coverImage || track.image_url || track.thumbnail || CLOUDINARY_IMAGE;
        const lyrics = (track.lyrics || '').slice(0,1000);
        const duration = track.duration || 'N/A';
        
        let caption = `*🎵 ${title}*\n\n`;
        caption += `*🎼 Style:* ${style}\n`;
        caption += `*⏱️ Duration:* ${duration}s\n`;
        caption += `*📝 Prompt:* ${prompt.slice(0,100)}${prompt.length>100?'...':''}\n`;
        if(lyrics && lyrics !== 'No lyrics available.') {
            caption += `\n*🎤 Lyrics:*\n${lyrics.slice(0,800)}${lyrics.length>800?'...':''}\n`;
        }
        caption += `\n*⚡ Powered by Progress Tech*`;
        caption += `\n📢 https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05`;

        await conn.sendMessage(chatId, {
            image: { url: cover },
            caption: caption,
            contextInfo: {
                externalAdReply: {
                    title: title,
                    body: `Style: ${style} • ${duration}s`,
                    thumbnailUrl: cover,
                    sourceUrl: "https://wa.me/237682432296",
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted });
    } catch(e) {
        console.log("Card error:", e.message);
    }
}

cmd({
  pattern: "suno",
  alias: ["sonu", "sunoai"],
  react: "🎵",
  desc: "Generate AI music from text prompt",
  category: "ai",
  use: ".suno <prompt>",
  filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix }) => {
  let musicStyle = 'Pop';
  let isQuick = false;
  let prompt = q || '';

  try {
    if (!q) {
      return reply(`*🎵 SUNO MUSIC GENERATOR 👑*\n\n*Generate AI music from text prompts.*\n\n*Usage:*\n*👑 ${prefix}suno <prompt> 👑*\n\n*Examples:*\n*👑 ${prefix}suno Sad song about lost love 👑*\n*👑 ${prefix}suno Energetic EDM beat 👑*\n\n*Available Styles:* ${MUSIC_STYLES.join(', ')}\n\n*Quick:* ${prefix}suno love song --quick\n*With Style:* ${prefix}suno love song --style Pop\n\n*Powered by Omegatech AI*`);
    }

    const hasQuick = q.toLowerCase().includes('--quick');
    const styleMatch = q.match(/--style\s+([^\s]+)/i);

    if (hasQuick) {
      isQuick = true;
      prompt = q.replace(/--quick/i, '').trim();
    } else if (styleMatch) {
      musicStyle = styleMatch[1];
      prompt = q.replace(/--style\s+[^\s]+/i, '').trim();
    } else {
      // Show style list
      let listText = `*🎵 SUNO MUSIC GENERATOR 👑*\n\n*📝 Prompt:* ${q.substring(0, 100)}\n\n*🎼 Select Style by typing:*\n*👑 ${prefix}suno ${q} --style Pop 👑*\n\n*Available Styles:*\n`;
      MUSIC_STYLES.forEach(s => { listText += `• ${s}\n`; });
      listText += `\n*Quick Generate:*\n*👑 ${prefix}suno ${q} --quick 👑*`;
      return reply(listText);
    }

    const genKey = `${m.sender}_${prompt}_${isQuick? 'quick' : musicStyle}`;
    if (activeGenerations.has(genKey)) {
      return reply(`*⏳ A song is already being generated. Please wait...*`);
    }
    activeGenerations.add(genKey);

    await conn.sendMessage(from, { react: { text: "🎵", key: mek.key } });
    reply(`*⏳ Generating: ${prompt} [${musicStyle}]... please wait ~60 sec*`);

    if (isQuick) {
      const track = await generateMusicOld(prompt);
      await sendSafeMusicCard(conn, from, track, prompt, 'Default', mek);

      const audioRes = await axios.get(track.audio_url, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 120000
      });
      await conn.sendMessage(from, {
        audio: Buffer.from(audioRes.data),
        mimetype: 'audio/mpeg',
        ptt: false,
        fileName: `${track.title}.mp3`,
      }, { quoted: mek });

    } else {
      const result = await generateMusicNew(prompt, prompt, musicStyle);
      const track = result.data.tracks[0];
      await sendSafeMusicCard(conn, from, track, prompt, musicStyle, mek);

      const audioRes = await axios.get(track.musicFile, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 120000
      });
      await conn.sendMessage(from, {
        audio: Buffer.from(audioRes.data),
        mimetype: 'audio/mpeg',
        ptt: false,
        fileName: `${track.title}.mp3`,
      }, { quoted: mek });
    }

    await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

  } catch (e) {
    console.error('Suno Error:', e);
    await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
    reply(`*💥 Suno Error: ${e.message || e} 😔*`);
  } finally {
    if (q) {
      const cleanPrompt = q.replace(/--style\s+[^\s]+/i, '').replace(/--quick/i, '').trim();
      const genKey = `${m.sender}_${cleanPrompt}_${isQuick? 'quick' : musicStyle}`;
      activeGenerations.delete(genKey);
    }
  }
});