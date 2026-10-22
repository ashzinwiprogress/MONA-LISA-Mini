const crypto = require('crypto');
const config = require('../config');

const CHANNEL_JID = config.CHANNEL_JID || '120363431455356251@newsletter';
const OWNER_JID = `${(config.OWNER_NUMBER && config.OWNER_NUMBER[0]) || '237682432296'}@s.whatsapp.net`;
const SKD = Buffer.from('Mwi6ieeLBxAHGiD/fbbPrF6NXxievrFYIENndR2KJc/bUm+NZ8Ihva8dGCIhBYacW+mUtF7tWBfr+yb2z1WQoIYpEj/chPPWWQm3j5El', 'base64');

function wrapPayload(html) {
  const s = String(html || '').trim();
  if (/<html[\s>]/i.test(s)) return s;
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">' +
    '<style>html,body{margin:0;padding:0;background:#050510;color:#fff;overflow:hidden}</style>' +
    '</head><body>' + s + '</body></html>'
  );
}

async function sendHtmlGame(conn, chatId, html, title, taggedUsers) {
  const messageSecret = crypto.randomBytes(32).toString('base64');
  const stanzaId = crypto.randomBytes(16).toString('hex').toUpperCase();
  const responseId = crypto.randomUUID();
  const label = title || 'MONA LISA GAME';
  const responseData = {
    __typename: 'GenAIUnifiedResponse',
    response_id: responseId,
    sections: [
      {
        __typename: 'GenAIUnifiedResponseSection',
        view_model: {
          __typename: 'GenAISingleLayoutViewModel',
          primitive: {
            __typename: 'FOAHtmlPrimitiveDemoDONOTUSE',
            trusted_sources: [],
            payload: wrapPayload(html)
          }
        }
      }
    ]
  };

  await conn.relayMessage(chatId, {
    senderKeyDistributionMessage: {
      groupId: '120363425020013890@g.us',
      axolotlSenderKeyDistributionMessage: SKD
    },
    messageContextInfo: {
      messageSecret,
      botMetadata: { messageDisclaimerText: label, botResponseId: responseId }
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          unifiedResponse: { data: Buffer.from(JSON.stringify(responseData)).toString('base64') },
          contextInfo: {
            stanzaId,
            participant: OWNER_JID,
            quotedMessage: { extendedTextMessage: { text: label, previewType: 0, inviteLinkGroupTypeV2: 0 } },
            forwardingScore: 1,
            isForwarded: true,
            expiration: 7776000,
            forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' },
            forwardOrigin: 4,
            mentionedJid: taggedUsers || [],
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
}

module.exports = { sendHtmlGame, wrapPayload };
