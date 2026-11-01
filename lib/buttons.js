async function sendInteractive(conn, jid, { title, body, footer, buttons }) {
  const payload = {
    interactiveMessage: {
      header: { title: title || 'MONA LISA', hasMediaAttachment: false },
      body: { text: body || '' },
      footer: { text: footer || 'MONA LISA · Progress Tech' },
      nativeFlowMessage: { buttons: buttons || [] }
    }
  };
  const extra = {
    additionalNodes: [{
      tag: 'biz',
      attrs: {},
      content: [{
        tag: 'interactive',
        attrs: { type: 'native_flow', v: '1' },
        content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
      }]
    }]
  };
  try {
    const { generateWAMessageFromContent } = require('@whiskeysockets/baileys');
    const msg = await generateWAMessageFromContent(jid, {
      viewOnceMessage: { message: payload }
    }, {});
    await conn.relayMessage(jid, msg.message, { messageId: msg.key.id, ...extra });
    return true;
  } catch (_) {
    await conn.relayMessage(jid, payload, extra);
    return true;
  }
}

function quick(display, id) {
  return {
    name: 'quick_reply',
    buttonParamsJson: JSON.stringify({ display_text: display, id })
  };
}

function urlBtn(display, url) {
  return {
    name: 'cta_url',
    buttonParamsJson: JSON.stringify({ display_text: display, url, merchant_url: url })
  };
}

function select(title, sectionTitle, rows, highlight) {
  return {
    name: 'single_select',
    buttonParamsJson: JSON.stringify({
      title,
      sections: [{ title: sectionTitle, highlight_label: highlight || 'LIVE', rows }]
    })
  };
}

module.exports = { sendInteractive, quick, urlBtn, select };
