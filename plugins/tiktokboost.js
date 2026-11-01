const { cmd } = require('../redx');

cmd({
  pattern: 'tiktokboost',
  alias: ['ttboost'],
  react: 'ℹ️',
  desc: 'Explain that fake TikTok view boosting is not supported',
  category: 'download',
  filename: __filename
}, async (conn, mek, m, { reply, prefix }) => {
  const pre = prefix || '.';
  reply(
    `Fake view / like boosting is not supported.\n\n` +
    `Use these instead:\n` +
    `${pre}tiktok <link> — download a public video\n` +
    `${pre}tiktokviews <link> — public view / like stats`
  );
});
