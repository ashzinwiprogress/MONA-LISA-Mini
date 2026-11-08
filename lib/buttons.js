function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function extraNodes() {
  return {
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
}

function toListSections(buttons) {
  const selectBtn = (buttons || []).find((b) => b.name === 'single_select');
  if (!selectBtn) return null;
  try {
    const parsed = JSON.parse(selectBtn.buttonParamsJson || '{}');
    const sections = (parsed.sections || []).map((s) => ({
      title: String(s.title || 'Options').slice(0, 24),
      rows: (s.rows || []).slice(0, 10).map((r) => ({
        title: String(r.title || r.header || '').slice(0, 24),
        rowId: String(r.id || ''),
        description: String(r.description || '').slice(0, 72)
      })).filter((r) => r.rowId && r.title)
    })).filter((s) => s.rows.length);
    return sections.length ? sections : null;
  } catch {
    return null;
  }
}

function toLegacyButtons(buttons) {
  return (buttons || [])
    .filter((b) => b.name === 'quick_reply')
    .slice(0, 3)
    .map((b) => {
      try {
        const p = JSON.parse(b.buttonParamsJson || '{}');
        return {
          buttonId: String(p.id || ''),
          buttonText: { displayText: String(p.display_text || '').slice(0, 20) },
          type: 1
        };
      } catch {
        return null;
      }
    })
    .filter((b) => b && b.buttonId);
}

function buttonFallbackText(title, body, footer, buttons) {
  const lines = [];
  if (title) lines.push(`*${title}*`);
  if (body) lines.push(String(body));
  const selectBtn = (buttons || []).find((b) => b.name === 'single_select');
  if (selectBtn) {
    try {
      const parsed = JSON.parse(selectBtn.buttonParamsJson || '{}');
      for (const section of parsed.sections || []) {
        lines.push('');
        if (section.title) lines.push(`*${section.title}*`);
        (section.rows || []).forEach((r, i) => {
          lines.push(`${i + 1}. ${r.title || r.header || ''}${r.description ? ` — ${r.description}` : ''}`);
        });
      }
    } catch (_) {}
  }
  for (const b of buttons || []) {
    if (b.name !== 'quick_reply') continue;
    try {
      const p = JSON.parse(b.buttonParamsJson || '{}');
      if (p.display_text && p.id) lines.push(`• ${p.display_text}: ${p.id}`);
    } catch (_) {}
  }
  if (footer) lines.push('', String(footer));
  return lines.join('\n');
}

async function sendInteractive(conn, jid, { title, body, footer, buttons, imageMessage }) {
  const text = String(body || '');
  const foot = String(footer || 'MONA LISA · Progress Tech');
  const native = (buttons || []).slice(0, 3);

  try {
    await conn.sendMessage(jid, {
      text,
      footer: foot,
      title: String(title || 'MONA LISA').slice(0, 60),
      interactiveButtons: native
    });
    return true;
  } catch (_) {}

  try {
    await conn.relayMessage(jid, {
      interactiveMessage: {
        header: {
          title: String(title || 'MONA LISA').slice(0, 60),
          hasMediaAttachment: !!imageMessage,
          ...(imageMessage ? { imageMessage } : {})
        },
        body: { text },
        footer: { text: foot },
        nativeFlowMessage: { buttons: native }
      }
    }, extraNodes());
    return true;
  } catch (_) {}

  await conn.sendMessage(jid, { text: buttonFallbackText(title, text, foot, buttons) });
  return true;
}

function quick(display, id) {
  return {
    name: 'quick_reply',
    buttonParamsJson: JSON.stringify({
      display_text: String(display).slice(0, 20),
      id: String(id)
    })
  };
}

function urlBtn(display, url) {
  return {
    name: 'cta_url',
    buttonParamsJson: JSON.stringify({
      display_text: String(display).slice(0, 20),
      url: String(url),
      merchant_url: String(url)
    })
  };
}

function select(title, sectionTitle, rows, highlight) {
  const clean = (rows || []).slice(0, 30).map((r) => ({
    header: String(r.title || '').slice(0, 24),
    title: String(r.title || '').slice(0, 24),
    description: String(r.description || '').slice(0, 72),
    id: String(r.id || '')
  })).filter((r) => r.id && r.title);
  const sections = chunk(clean, 10).map((part, i) => ({
    title: `${String(sectionTitle || 'Options').slice(0, 20)}${i ? ` ${i + 1}` : ''}`.slice(0, 24),
    highlight_label: String(highlight || 'LIVE').slice(0, 8),
    rows: part
  }));
  return {
    name: 'single_select',
    buttonParamsJson: JSON.stringify({
      title: String(title || 'Select').slice(0, 20),
      sections: sections.slice(0, 10)
    })
  };
}

module.exports = { sendInteractive, quick, urlBtn, select, chunk };
