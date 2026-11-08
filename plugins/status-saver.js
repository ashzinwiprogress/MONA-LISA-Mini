const { cmd } = require("../redx");

cmd({
  on: "body",
  filename: __filename
}, async (client, mek, m, { body, sender, from }) => {
  if (from !== "status@broadcast") return;

  const text = (body || "").toLowerCase().trim();
  if (!["send", "sendme", "save"].includes(text)) return;

  try {
    const quoted = m.quoted;
    if (!quoted) return;
    const type = quoted.mtype || "";
    const buffer = typeof quoted.download === "function" ? await quoted.download() : null;
    if (!buffer) return;

    let msg = null;
    if (type === "imageMessage" || quoted.imageMessage) {
      msg = { image: buffer, caption: quoted.text || "" };
    } else if (type === "videoMessage" || quoted.videoMessage) {
      msg = { video: buffer, caption: quoted.text || "" };
    } else if (type === "audioMessage" || quoted.audioMessage) {
      msg = { audio: buffer, mimetype: "audio/mp4", ptt: false };
    }
    if (!msg) return;
    await client.sendMessage(sender, msg);
  } catch (e) {
    console.error("[status-saver]", e.message);
  }
});
