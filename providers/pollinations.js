// ═══════════════════════════════════════════════════════════════════════════
//   🌸 POLLINATIONS PROVIDER — genuinely free text-to-image
//   Powered by Progress Tech
//
//   No API key required. Returns a PNG/JPEG buffer.
// ═══════════════════════════════════════════════════════════════════════════

const axios = require('axios');

/**
 * Generate an image from a text prompt.
 * @param {string} prompt
 * @param {{width?: number, height?: number, seed?: number, model?: string}} [opts]
 * @returns {Promise<Buffer>}
 */
async function generate(prompt, opts = {}) {
    if (!prompt || !String(prompt).trim()) {
        throw new Error('A prompt is required.');
    }

    const width = opts.width || 1024;
    const height = opts.height || 1024;
    const seed = opts.seed ?? Math.floor(Math.random() * 1e6);
    const model = opts.model || 'flux';

    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(String(prompt).trim())}`
        + `?width=${width}&height=${height}&seed=${seed}&model=${model}&nologo=true`;

    const { data } = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 120000,
        maxRedirects: 5,
    });

    if (!data || !data.byteLength) {
        throw new Error('Pollinations returned an empty image.');
    }
    return Buffer.from(data);
}

module.exports = { generate };
