const {
    proto,
    getContentType,
    jidNormalizedUser,
    downloadContentFromMessage,
    downloadMediaMessage
} = require('@whiskeysockets/baileys');

function unwrapMessage(message) {
    if (!message || typeof message !== 'object') return message;
    const wrappers = [
        'ephemeralMessage',
        'viewOnceMessage',
        'viewOnceMessageV2',
        'viewOnceMessageV2Extension',
        'documentWithCaptionMessage',
        'editedMessage'
    ];
    let current = message;
    for (let i = 0; i < 4; i++) {
        const type = getContentType(current) || Object.keys(current)[0];
        if (!wrappers.includes(type)) return current;
        const next = current[type]?.message;
        if (!next) return current;
        current = next;
    }
    return current;
}

function extractText(message) {
    if (!message) return '';
    const unwrapped = unwrapMessage(message);
    const type = getContentType(unwrapped);
    const content = type ? unwrapped[type] : null;
    return (
        unwrapped.conversation ||
        content?.text ||
        content?.caption ||
        content?.selectedButtonId ||
        content?.singleSelectReply?.selectedRowId ||
        content?.selectedId ||
        content?.name ||
        ''
    );
}

function resolveSender(conn, m) {
    if (m.fromMe) {
        return jidNormalizedUser(conn?.user?.id || m.key.participant || m.key.remoteJid);
    }
    const candidate =
        m.key.participantAlt ||
        m.participant ||
        m.key.participant ||
        m.key.remoteJidAlt ||
        m.chat;
    return jidNormalizedUser(candidate);
}

async function bufferFromContent(content, innerType) {
    const DOWNLOADABLE = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage'];
    if (!DOWNLOADABLE.includes(innerType)) throw new Error('Message has no downloadable media.');
    const dlType = innerType.replace('Message', '');
    const stream = await downloadContentFromMessage(content, dlType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
}

const sms = (conn, m) => {
    if (!m) return m;

    if (m.key) {
        m.id = m.key.id;
        const id = String(m.id || '');
        m.isBaileys = (id.startsWith('BAE5') && id.length === 16) || id.startsWith('3EB0');
        m.chat = m.key.remoteJid;
        m.fromMe = m.key.fromMe;
        m.isGroup = typeof m.chat === 'string' && m.chat.endsWith('@g.us');
        m.sender = resolveSender(conn, m);
        m.pushName = m.pushName || m.verifiedBizName || 'User';
    }

    if (m.message) {
        m.message = unwrapMessage(m.message);
        m.mtype = getContentType(m.message);
        m.msg = m.message[m.mtype];

        const qCtx = m.msg?.contextInfo;
        if (qCtx?.quotedMessage) {
            let innerMessage = unwrapMessage(qCtx.quotedMessage);
            let innerType = getContentType(innerMessage) || Object.keys(innerMessage)[0];
            const quotedSender = jidNormalizedUser(qCtx.participantAlt || qCtx.participant || '');
            const content = innerMessage?.[innerType];

            m.quoted = {
                message: innerMessage,
                mtype: innerType,
                stanzaId: qCtx.stanzaId,
                participant: qCtx.participant,
                sender: quotedSender || undefined,
                key: {
                    remoteJid: m.chat,
                    fromMe: quotedSender && conn?.user?.id
                        ? jidNormalizedUser(quotedSender) === jidNormalizedUser(conn.user.id)
                        : false,
                    id: qCtx.stanzaId,
                    participant: qCtx.participant,
                    participantAlt: qCtx.participantAlt
                },
                text: extractText(innerMessage),
                download: async () => bufferFromContent(content, innerType)
            };

            if (innerMessage && typeof innerMessage === 'object') {
                for (const key of Object.keys(innerMessage)) {
                    if (key.endsWith('Message') || key === 'conversation') m.quoted[key] = innerMessage[key];
                }
            }
        } else {
            m.quoted = null;
        }

        m.body = extractText(m.message);
        m.text = m.body;

        m.reply = (text, chatId = m.chat, options = {}) => {
            return conn.sendMessage(chatId, { text }, { quoted: m, ...options });
        };

        m.react = async (emoji) => {
            if (!emoji || !m.key) return;
            return conn.sendMessage(m.chat, { react: { text: emoji, key: m.key } });
        };

        m.download = async () => {
            try {
                const buf = await downloadMediaMessage(m, 'buffer', {}, {
                    reuploadRequest: conn.updateMediaMessage
                });
                if (buf) return buf;
            } catch (_) {}
            return bufferFromContent(m.msg, m.mtype);
        };
    }
    return m;
};

module.exports = { sms, unwrapMessage, extractText };
