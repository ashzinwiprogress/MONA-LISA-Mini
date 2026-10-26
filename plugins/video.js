const axios = require('axios')
const yts = require('yt-search')
const { cmd } = require('../redx')
const { fakevCard } = require('../lib/fakevCard')

async function resolveVideoUrl(query) {
  if (/youtube\.com|youtu\.be/i.test(query)) return query.match(/https?:\/\/\S+/i)[0]
  const search = await yts(query)
  if (!search.videos.length) throw new Error('No video found')
  return search.videos[0]
}

async function getMp4(url) {
  const tries = [
    async () => {
      const { data } = await axios.get(`https://api.omegatech.app/api/download/youtube?action=download&url=${encodeURIComponent(url)}`, { timeout: 60000 })
      const d = data?.data || data
      if (d?.url) return { url: d.url, title: d.title }
      return null
    },
    async () => {
      const { data } = await axios.get(`https://arslan-apis-v2.vercel.app/download/ytmp4?url=${encodeURIComponent(url)}`, { timeout: 60000 })
      if (data?.status && data?.result?.download?.url) {
        return { url: data.result.download.url, title: data.result.metadata?.title }
      }
      return null
    },
    async () => {
      const { data } = await axios.get(`https://gtech-api-xtp1.onrender.com/api/video/yt?apikey=APIKEY&url=${encodeURIComponent(url)}`, { timeout: 60000 })
      const media = data?.result?.media
      const hd = media?.video_url_hd || media?.video_url || media?.url || media?.hd
      const sd = media?.video_url_sd || media?.sd
      const link = (hd && !/No /i.test(hd) ? hd : null) || (sd && !/No /i.test(sd) ? sd : null)
      if (link) return { url: link, title: media?.title }
      return null
    }
  ]
  for (const fn of tries) {
    try {
      const got = await fn()
      if (got?.url) return got
    } catch (_) {}
  }
  throw new Error('Video API failed')
}

cmd({
  pattern: 'videoy',
  alias: ['vid', 'playvideo', 'video'],
  desc: 'Download YouTube Video (Fast)',
  category: 'download',
  react: '🎬',
  filename: __filename
}, async (conn, mek, m, { from, reply, text, q }) => {
  try {
    const query = (text || q || '').trim()
    if (!query) return reply('Example:\n.video pasoori')

    const found = await resolveVideoUrl(query)
    const vid = typeof found === 'string' ? { url: found, title: 'YouTube', timestamp: '', thumbnail: '' } : found

    const caption = `VIDEO FOUND\nTitle: ${vid.title || query}\nDuration: ${vid.timestamp || 'N/A'}\nSending video...`

    if (vid.thumbnail) {
      await conn.sendMessage(from, { image: { url: vid.thumbnail }, caption }, { quoted: fakevCard })
    } else {
      await reply(caption)
    }

    const got = await getMp4(vid.url)
    await conn.sendMessage(from, {
      video: { url: got.url },
      mimetype: 'video/mp4',
      caption: `*${got.title || vid.title}*\n\n> PROGRESS TECH`
    }, { quoted: fakevCard })
  } catch (err) {
    console.log(err)
    reply(err.message || 'Video error')
  }
})
