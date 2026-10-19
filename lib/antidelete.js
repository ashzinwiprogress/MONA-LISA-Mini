const { getContentType, downloadMediaMessage } = require('@whiskeysockets/baileys');
const config = require('../config');

function isRevokeUpdate(update) {
    if (!update) return false;
    const stub = update.update?.messageStubType;
    if (stub === 1 || stub === 'REVOKE' || String(stub).toUpperCase() === 'REVOKE') return true;
    const protocol = update.update?.message?.protocolMessage;
    if (protocol && (protocol.type === 0 || protocol.type === 'REVOKE')) return true;
    if (update.update && Object.prototype.hasOwnProperty.call(update.update, 'message') && update.update.message === null) {
        return true;
    }
    return false;
}

function extractDeletedKey(update) {
    const protocol = update.update?.message?.protocolMessage;
    if (protocol?.key?.id) return protocol.key;
    if (update.key?.id) return update.key;
    if (update.update?.key?.id) return update.update.key;
    return null;
}

function extractText(message) {
    if (!message) return '';
    const type = getContentType(message);
    const content = type ? message[type] : null;
    if (type === 'conversation') return message.conversation || '';
    if (type === 'extendedTextMessage') return content?.text || '';
    if (type === 'imageMessage') return 'Image' + (content?.caption ? `\nCaption: ${content.caption}` : '');
    if (type === 'videoMessage') return 'Video' + (content?.caption ? `\nCaption: ${content.caption}` : '');
    if (type === 'audioMessage') return 'Audio';
    if (type === 'stickerMessage') return 'Sticker';
    if (type === 'documentMessage') return 'Document' + (content?.fileName ? `\nFile: ${content.fileName}` : '');
    if (type === 'locationMessage') return 'Location';
    if (type === 'contactMessage') return 'Contact';
    return type ? String(type).replace(/Message$/, '') : 'Message';
}

function unwrap(message) {
    if (!message) return message;
    const wrappers = ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage'];
    let current = message;
    for (let i = 0; i < 4; i++) {
        const type = getContentType(current);
        if (!wrappers.includes(type)) return current;
        const next = current[type]?.message;
        if (!next) return current;
        current = next;
    }
    return current;
}

function ownerJids(botNumber) {
    const numbers = [...(config.OWNER_NUMBER || [])];
    if (botNumber) numbers.push(String(botNumber));
    return [...new Set(numbers.map(n => String(n || '').replace(/[^0-9]/g, '')).filter(n => n.length >= 8).map(n => `${n}@s.whatsapp.net`))];
}

async function getGroupName(conn, jid) {
    try {
        const metadata = await conn.groupMetadata(jid);
        return metadata.subject || 'Unknown Group';
    } catch {
        return 'Unknown Group';
    }
}

async function handleAntidelete(conn, updates, store, botNumber) {
    try {
        const targets = ownerJids(botNumber);
        if (!targets.length) {
            console.log('[ANTIDELETE] No owner numbers configured');
            return;
        }

        for (const update of updates || []) {
            if (!isRevokeUpdate(update)) continue;

            const deletedKey = extractDeletedKey(update);
            if (!deletedKey?.id) continue;

            let deletedMsg = null;
            try {
                deletedMsg = await store.loadMessage(deletedKey.remoteJid, deletedKey.id);
            } catch (_) {}

            if (!deletedMsg?.message) {
                console.log(`[ANTIDELETE] Deleted message ${deletedKey.id} was not in the in-memory store`);
                continue;
            }

            deletedMsg.message = unwrap(deletedMsg.message);
            const msgType = getContentType(deletedMsg.message);
            const sender = deletedMsg.key.participant || deletedMsg.key.remoteJid;
            const from = deletedMsg.key.remoteJid;
            const isGroup = typeof from === 'string' && from.endsWith('@g.us');
            const content = extractText(deletedMsg.message);
            const chatName = isGroup ? await getGroupName(conn, from) : 'Private Chat';
            const senderName = deletedMsg.pushName || String(sender || '').split('@')[0];

            const antidelMsg =
                `*MESSAGE DELETED DETECTED*\n\n` +
                `From: ${senderName}\n` +
                `Number: @${String(sender || '').split('@')[0]}\n` +
                `Chat: ${chatName}\n` +
                `Message: ${content}\n` +
                `Time: ${new Date().toLocaleString()}\n` +
                `Type: ${isGroup ? 'Group' : 'Private'}`;

            for (const ownerJid of targets) {
                try {
                    await conn.sendMessage(ownerJid, { text: antidelMsg, mentions: [sender].filter(Boolean) });
                } catch (err) {
                    console.error(`[ANTIDELETE] Failed to send to ${ownerJid}:`, err.message);
                }
            }

            const MEDIA_TYPES = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage'];
            if (MEDIA_TYPES.includes(msgType)) {
                try {
                    const buffer = await downloadMediaMessage(deletedMsg, 'buffer', {});
                    const mediaPayload = {
                        imageMessage: { image: buffer, caption: `Deleted image from @${String(sender).split('@')[0]}` },
                        videoMessage: { video: buffer, caption: `Deleted video from @${String(sender).split('@')[0]}` },
                        audioMessage: { audio: buffer, mimetype: 'audio/mpeg', ptt: deletedMsg.message.audioMessage?.ptt || false },
                        stickerMessage: { sticker: buffer },
                        documentMessage: {
                            document: buffer,
                            mimetype: deletedMsg.message.documentMessage?.mimetype,
                            fileName: deletedMsg.message.documentMessage?.fileName || 'file'
                        },
                    }[msgType];
                    for (const ownerJid of targets) {
                        try {
                            await conn.sendMessage(ownerJid, { ...mediaPayload, mentions: [sender].filter(Boolean) });
                        } catch (err) {
                            console.error(`[ANTIDELETE] Failed to forward recovered media to ${ownerJid}:`, err.message);
                        }
                    }
                } catch (err) {
                    console.log(`[ANTIDELETE] Could not recover media: ${err.message}`);
                }
            }

            console.log(`[ANTIDELETE] Recovered deleted message from ${sender} in ${from}`);
        }
    } catch (error) {
        console.error('[ANTIDELETE ERROR]', error);
    }
}

module.exports = { handleAntidelete };
