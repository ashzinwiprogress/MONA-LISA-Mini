const { cmd } = require('../redx');
const axios = require('axios');

const API = 'https://api.omegatech.app/api/ai/text2speech-v3';
const API2 = 'https://api.omegatech.app/api/ai/text2speech-v3';

cmd({
  pattern: "tts2",
  alias: ["say2", "speak2"],
  react: "🎙️",
  desc: "Text to speech v3",
  category: "progresstech ai",
  use: ".tts2 woman1 how are you doing",
  filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix }) => {
  try {
    if (!q) return reply(`*Usage:*\n${prefix}tts2 how are you doing\n${prefix}tts2 woman1 how are you doing\nVoices: woman1, man1, woman2`);

    let voice = 'woman1';
    let text = q;

    // check if first word is voice name
    const first = q.split(' ')[0].toLowerCase();
    if (['woman1','man1','woman2','man2','woman3'].includes(first)) {
        voice = first;
        text = q.slice(first.length).trim();
    }
    if (!text) return reply(`*Enter text bro*\n${prefix}tts2 woman1 hello`);

    await conn.sendMessage(from, {
        text: `Generating speech...\nVoice: ${voice}\nText: ${text.slice(0,50)}`
    }, { quoted: mek });

    let audioUrl = null;
    const pickAudio = (data) => data?.audio || data?.audioUrl || data?.audio_url || data?.url || data?.result || data?.data?.audio || data?.data?.url;

    try {
        const { data } = await axios.get(API, { params: { text, voice, language: 'English' }, timeout: 45000 });
        audioUrl = pickAudio(data);
        if (typeof data === 'string' && data.startsWith('http')) audioUrl = data;
    } catch (e) { console.log('TTS2 GET1 fail', e.message); }

    if (!audioUrl) {
        try {
            const { data } = await axios.get(API2, { params: { text, voice, language: 'en' }, timeout: 45000 });
            audioUrl = pickAudio(data);
        } catch (e) {}
    }

    if (!audioUrl) throw new Error('No audio URL returned');

    // Download buffer
    const audioRes = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 30000 });
    const buffer = Buffer.from(audioRes.data);

    // IMPORTANT: Check if buffer is actually JSON/HTML error
    if (buffer.length < 1000) {
        const txt = buffer.toString('utf8');
        if (txt.includes('{') || txt.includes('<')) throw new Error('API returned error file: ' + txt.slice(0,200));
    }

    // FIX: Send as normal audio, NOT ptt:true first
    // ptt:true = only works with opus ogg, mpeg will break
    await conn.sendMessage(from, {
        audio: buffer,
        mimetype: 'audio/mpeg',
        ptt: false,
        fileName: 'voice.mp3'
    }, { quoted: mek });

  } catch (e) {
    console.error('TTS2 ERROR:', e.response?.data || e.message);
    reply(`TTS failed: ${e.message}\nTry shorter text.\nPowered by Progress Tech`);
  }
});