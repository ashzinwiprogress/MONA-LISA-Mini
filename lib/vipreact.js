const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const { fakevCard } = require('./fakevCard');

const BASE = 'https://api.omegatech.app';
const CHANNEL_LINK = config.CHANNEL_LINK || 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';
const CHANNEL_JID = config.CHANNEL_JID || '120363431455356251@newsletter';
const OWNER_JID = `${(config.OWNER_NUMBER && config.OWNER_NUMBER[0]) || '237682432296'}@s.whatsapp.net`;
const CLOUDINARY_IMAGE = 'https://res.cloudinary.com/di2a9lenz/image/upload/v1786909227/omegatech_ai_media/upload-1786909226872.jpg';
const CLOUDINARY_THUMB = 'https://res.cloudinary.com/di2a9lenz/image/upload/w_400,h_400,c_limit/v1786909227/omegatech_ai_media/upload-1786909226872.jpg';
const MAX_COUNT = 1000;
const BATCH = 3;

function parseReactArgs(q) {
  const raw = String(q || '').trim();
  const urlMatch = raw.match(/https?:\/\/[^\s]+/i);
  if (!urlMatch) return null;
  const url = urlMatch[0].replace(/[),.;]+$/, '');
  if (!/whatsapp\.com\/channel\//i.test(url)) return null;
  const rest = raw.replace(urlMatch[0], ' ').replace(/\s+/g, ' ').trim();
  const tokens = rest ? rest.split(' ') : [];
  let count = 1;
  const emojiParts = [];
  for (const t of tokens) {
    if (/^\d{1,4}$/.test(t)) count = Math.max(1, Math.min(MAX_COUNT, parseInt(t, 10)));
    else if (t) emojiParts.push(t);
  }
  const path = url.match(/whatsapp\.com\/channel\/([0-9A-Za-z]+)(?:\/([0-9A-Za-z_-]+))?/i);
  return {
    url,
    channelId: path ? path[1] : '',
    postId: path ? path[2] : '',
    channelJid: path ? `${path[1]}@newsletter` : '',
    emojis: emojiParts.length ? emojiParts : ['😁'],
    count
  };
}

async function sendVipReaction(channelUrl, emoji) {
  const { data } = await axios.get(`${BASE}/api/Fun/Rch`, {
    timeout: 120000,
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    params: { action: 'react', url: channelUrl, emoji }
  });
  if (!data || data.success === false) {
    throw new Error(data?.error || data?.message || 'Reaction failed');
  }
  const payload = data.data || data;
  if (payload && payload.ok === false) {
    throw new Error(payload.message || 'Reaction failed');
  }
  return payload;
}

async function rch2React(url, emojis) {
  const { data } = await axios.get(`${BASE}/api/Fun/rch2`, {
    timeout: 120000,
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    params: { action: 'react', url, emojis: Array.isArray(emojis) ? emojis.join('') : emojis }
  });
  if (!data || data.success === false) {
    throw new Error(data?.error || data?.message || 'rch2 failed');
  }
  return data.data || data;
}

function successCaption(data, channelUrl, emoji, extra) {
  extra = extra || {};
  const time = data.time || extra.time || '0ms';
  const message = data.message || extra.message || 'Reaction queued';
  const taskId = data.task_id || extra.taskId || 'N/A';
  const emojis = data.emojis || extra.emojis || emoji;
  const vipKey = data.vip_key || extra.vip_key || 'N/A';
  const vipPackage = data.vip_package || extra.vip_package || 'VIP';
  const usageToday = data.usage_today || extra.usage_today || 0;
  const limit = data.limit || extra.limit || 50;
  const pointsRemaining = data.points_remaining || extra.points_remaining || data.result?.points || 0;
  const queued = extra.ok || 1;
  const wanted = extra.count || 1;
  const failed = extra.fail || 0;
  const local = extra.local || 0;
  let extraLine = '';
  if (wanted > 1 || failed || local) {
    extraLine = `📦 *Queued:* ${queued}/${wanted}` + (failed ? `  ·  failed ${failed}` : '') + (local ? `\n📡 *Local:* ${local}` : '') + '\n';
  }
  return (
    `✅ *Reaction Queued Successfully!*\n\n` +
    `🔗 *Target:* ${data.target || channelUrl}\n` +
    `😁 *Emoji:* ${emojis}\n` +
    extraLine +
    `⏱️ *Time:* ${time}\n` +
    `📝 *Status:* ${message}\n` +
    `📋 *Task ID:* ${taskId}\n\n` +
    `⭐ *VIP Details:*\n` +
    `🔑 Key: ${vipKey}\n` +
    `📦 Package: ${vipPackage}\n` +
    `📊 Usage: ${usageToday}/${limit} today\n` +
    `💎 Points: ${Number(pointsRemaining).toLocaleString()}\n\n` +
    `📌 *Note:* Reactions are added to a queue and may take a few seconds to appear.`
  );
}

async function sendRichResponse(conn, chatId, data, channelUrl, emoji, taggedUsers, extra) {
  const caption = successCaption(data, channelUrl, emoji, extra || {});
  try {
    const messageSecret = crypto.randomBytes(32).toString('base64');
    const stanzaId = crypto.randomBytes(16).toString('hex').toUpperCase();
    const responseId = crypto.randomUUID();
    let imageMessage;
    try {
      const { prepareWAMessageMedia } = require('@whiskeysockets/baileys');
      const imgResp = await axios.get(CLOUDINARY_IMAGE, { responseType: 'arraybuffer', timeout: 15000 });
      const media = await prepareWAMessageMedia({ image: Buffer.from(imgResp.data) }, { upload: conn.waUploadToServer });
      imageMessage = media.imageMessage;
    } catch (_) {}

    const responseData = {
      response_id: responseId,
      sections: [
        {
          view_model: {
            primitive: {
              title: '😁 VIP Reaction Sent!',
              brand: 'PROGRESS TECH',
              price: '✅ Success',
              product_url: 'https://wa.me/237682432296',
              image: { url: CLOUDINARY_IMAGE, mime_type: 'image/jpeg' },
              additional_images: [],
              __typename: 'GenAIProductItemCardPrimitive'
            },
            __typename: 'GenAISingleLayoutViewModel'
          },
          __typename: 'GenAIUnifiedResponseSection'
        },
        {
          view_model: {
            primitive: {
              text: caption,
              inline_entities: [],
              __typename: 'GenAIMarkdownTextUXPrimitive'
            },
            __typename: 'GenAISingleLayoutViewModel'
          },
          __typename: 'GenAIUnifiedResponseSection'
        },
        {
          view_model: {
            primitives: [
              {
                __typename: 'GenAI3PExtWidgetPrimitive',
                header: { __typename: 'GenAI3PExtWidgetStandardHeader', title: 'PROGRESS TECH VIP' },
                body: {
                  __typename: 'GenAI3PExtCalendarEventList',
                  sections: [],
                  ctas: [
                    { __typename: 'GenAI3PExtWidgetCTA', label: 'React Again', state: 'PENDING', kind: 'OTHER', tool_call_id: '00', toast: { __typename: 'GenAI3PExtWidgetToast', label: 'Send Another Reaction' } },
                    { __typename: 'GenAI3PExtWidgetCTA', label: 'Menu', state: 'PENDING', kind: 'OTHER', tool_call_id: '01', toast: { __typename: 'GenAI3PExtWidgetToast', label: 'Show Menu' } },
                    { __typename: 'GenAI3PExtWidgetCTA', label: 'Channel', state: 'PENDING', kind: 'OTHER', tool_call_id: '02', toast: { __typename: 'GenAI3PExtWidgetToast', label: 'Join Channel' } }
                  ]
                }
              },
              { prompt_text: 'MONA LISA', prompt_type: 'SUGGESTED_PROMPT', __typename: 'GenAIFollowUpSuggestionPillPrimitive' },
              { title: 'MONA LISA', brand: 'PROGRESS TECH', price: 'V2', sale_price: 'Free', product_url: 'https://wa.me/237682432296', image: { url: CLOUDINARY_THUMB }, additional_images: [{}], __typename: 'GenAIProductItemCardPrimitive' }
            ],
            __typename: 'GenAIHScrollLayoutViewModel'
          },
          __typename: 'GenAIUnifiedResponseSection'
        },
        {
          view_model: {
            primitive: {
              text: `📢 *Join Our Channel:*\n${CHANNEL_LINK}`,
              inline_entities: [
                {
                  key: 'CI_0',
                  metadata: {
                    reference_id: 1,
                    reference_url: CHANNEL_LINK,
                    reference_title: 'PROGRESS TECH',
                    reference_display_name: 'Join Channel',
                    sources: [],
                    __typename: 'GenAISearchCitationItem'
                  }
                }
              ],
              __typename: 'GenAIMarkdownTextUXPrimitive'
            },
            __typename: 'GenAISingleLayoutViewModel'
          },
          __typename: 'GenAIUnifiedResponseSection'
        }
      ]
    };
    if (imageMessage) responseData.sections[0].view_model.primitive.image = imageMessage;

    await conn.relayMessage(chatId, {
      senderKeyDistributionMessage: {
        groupId: '120363425020013890@g.us',
        axolotlSenderKeyDistributionMessage: Buffer.from('Mwi6ieeLBxAHGiD/fbbPrF6NXxievrFYIENndR2KJc/bUm+NZ8Ihva8dGCIhBYacW+mUtF7tWBfr+yb2z1WQoIYpEj/chPPWWQm3j5El', 'base64')
      },
      messageContextInfo: {
        messageSecret,
        botMetadata: { messageDisclaimerText: 'VIP Reaction', botResponseId: responseId }
      },
      botForwardedMessage: {
        message: {
          richResponseMessage: {
            messageType: 1,
            unifiedResponse: { data: Buffer.from(JSON.stringify(responseData)).toString('base64') },
            contextInfo: {
              stanzaId,
              participant: OWNER_JID,
              quotedMessage: { extendedTextMessage: { text: 'VIP Reaction', previewType: 0, inviteLinkGroupTypeV2: 0 } },
              forwardingScore: 1,
              isForwarded: true,
              expiration: 7776000,
              forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' },
              forwardOrigin: 4,
              mentionedJid: taggedUsers,
              forwardedNewsletterMessageInfo: {
                newsletterJid: CHANNEL_JID,
                serverMessageId: 142,
                newsletterName: 'PROGRESS TECH Channel'
              }
            }
          }
        }
      }
    }, {});
    return true;
  } catch (e) {
    console.error('Rich response error:', e.message);
    return false;
  }
}

async function sendPlainSuccess(conn, from, mek, data, channelUrl, emoji, extra) {
  const caption = successCaption(data, channelUrl, emoji, extra || {});
  try {
    const imgResp = await axios.get(CLOUDINARY_IMAGE, { responseType: 'arraybuffer', timeout: 15000 });
    await conn.sendMessage(from, {
      image: Buffer.from(imgResp.data),
      caption,
      contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        mentionedJid: extra?.tagged || [],
        forwardedNewsletterMessageInfo: {
          newsletterJid: CHANNEL_JID,
          newsletterName: 'PROGRESS TECH Channel',
          serverMessageId: 142
        }
      }
    }, { quoted: fakevCard });
    return true;
  } catch (_) {
    await conn.sendMessage(from, { text: caption }, { quoted: mek });
    return true;
  }
}

async function sendSuccess(conn, from, mek, data, channelUrl, emoji, extra) {
  const rich = await sendRichResponse(conn, from, data || {}, channelUrl, emoji, extra?.tagged || [], extra);
  if (!rich) await sendPlainSuccess(conn, from, mek, data || {}, channelUrl, emoji, extra);
}

async function runBatch(jobs, size) {
  const out = [];
  for (let i = 0; i < jobs.length; i += size) {
    const slice = jobs.slice(i, i + size);
    const settled = await Promise.allSettled(slice.map((fn) => fn()));
    out.push(...settled);
    const failedHard = settled.filter((s) => s.status === 'rejected').length;
    if (failedHard === slice.length && i > 0) break;
  }
  return out;
}

module.exports = {
  BASE,
  MAX_COUNT,
  BATCH,
  parseReactArgs,
  sendVipReaction,
  rch2React,
  sendRichResponse,
  sendPlainSuccess,
  sendSuccess,
  runBatch
};
