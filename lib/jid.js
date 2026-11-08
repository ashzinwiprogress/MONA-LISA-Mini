function userPart(jid) {
  return String(jid || '').split('@')[0].split(':')[0];
}

function participantIds(p) {
  return [p?.id, p?.jid, p?.lid, p?.phoneNumber, p?.pn].filter(Boolean);
}

function jidMatches(a, b) {
  if (!a || !b) return false;
  try {
    const { areJidsSameUser } = require('@whiskeysockets/baileys');
    if (typeof areJidsSameUser === 'function' && areJidsSameUser(a, b)) return true;
  } catch (_) {}
  const ua = userPart(a);
  const ub = userPart(b);
  if (!ua || !ub) return false;
  if (ua === ub) return true;
  const aLid = String(a).includes('@lid');
  const bLid = String(b).includes('@lid');
  if (aLid !== bLid) return false;
  return ua.replace(/\D/g, '') === ub.replace(/\D/g, '');
}

function findParticipant(participants, jid) {
  if (!jid) return null;
  return (participants || []).find((p) => participantIds(p).some((id) => jidMatches(id, jid))) || null;
}

function resolveUpdateJid(participants, jid) {
  const p = findParticipant(participants, jid);
  if (p) return p.lid || p.id || p.jid || jid;
  return jid;
}

function resolveUpdateJids(participants, jids) {
  return [...new Set((jids || []).filter(Boolean).map((j) => resolveUpdateJid(participants, j)))];
}

function mentionList(participants) {
  return (participants || []).map((p) => p.id || p.jid || p.lid).filter(Boolean);
}

function isBotParticipant(p, conn) {
  const botIds = [
    conn?.user?.id,
    conn?.user?.lid,
    conn?.user?.jid,
    conn?.authState?.creds?.me?.id,
    conn?.authState?.creds?.me?.lid
  ].filter(Boolean);
  return participantIds(p).some((id) => botIds.some((b) => jidMatches(id, b)));
}

function botParticipant(participants, conn) {
  return (participants || []).find((p) => isBotParticipant(p, conn)) || null;
}

module.exports = {
  userPart,
  participantIds,
  jidMatches,
  findParticipant,
  resolveUpdateJid,
  resolveUpdateJids,
  mentionList,
  isBotParticipant,
  botParticipant
};
