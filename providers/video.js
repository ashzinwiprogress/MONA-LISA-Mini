// ═══════════════════════════════════════════════════════════════════════════
//   🎬 VIDEO PROVIDER — text-to-video / image-to-video / talking avatar
//   Powered by Progress Tech
//
//   Runs on Replicate. Configure with your OWN keys in the project's .env:
//     REPLICATE_API_TOKEN    = <your token>
//     REPLICATE_T2V_MODEL    = wan-video/wan-2.2-t2v-fast
//     REPLICATE_I2V_MODEL    = wan-video/wan-2.2-i2v-fast
//     REPLICATE_AVATAR_MODEL = prunaai/p-video-avatar
// ═══════════════════════════════════════════════════════════════════════════

const axios = require('axios');

const REPLICATE_API = 'https://api.replicate.com/v1';

function token() {
    return process.env.REPLICATE_API_TOKEN || '';
}

const t2vModel = () => process.env.REPLICATE_T2V_MODEL || 'wan-video/wan-2.2-t2v-fast';
const i2vModel = () => process.env.REPLICATE_I2V_MODEL || 'wan-video/wan-2.2-i2v-fast';
const avatarModel = () => process.env.REPLICATE_AVATAR_MODEL || 'prunaai/p-video-avatar';

function isConfigured() {
    return Boolean(token());
}

const isT2VConfigured = isConfigured;
const isI2VConfigured = isConfigured;
const isAvatarConfigured = isConfigured;

function configHint() {
    return 'Video generation runs on Replicate. Set REPLICATE_API_TOKEN in your .env — see .env.example.';
}
const t2vConfigHint = configHint;
const i2vConfigHint = configHint;
const avatarConfigHint = configHint;

/**
 * Run a Replicate model and return the output URL.
 * @param {string} model  e.g. "owner/name"
 * @param {object} input
 * @returns {Promise<string>}
 */
async function runModel(model, input) {
    const apiToken = token();
    if (!apiToken) {
        const err = new Error(configHint());
        err.notConfigured = true;
        throw err;
    }

    const headers = {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
    };

    let prediction;
    try {
        const res = await axios.post(`${REPLICATE_API}/models/${model}/predictions`, { input }, {
            headers,
            timeout: 60000,
        });
        prediction = res.data;
    } catch (e) {
        const detail = e?.response?.data ? JSON.stringify(e.response.data).slice(0, 500) : e.message;
        throw new Error(`Replicate request failed: ${detail}`);
    }

    // Poll until the prediction finishes (the "wait" header usually already
    // completes synchronous models, but long jobs need polling).
    const deadline = Date.now() + 5 * 60 * 1000;
    while (prediction && (prediction.status === 'starting' || prediction.status === 'processing')) {
        if (Date.now() > deadline) throw new Error('Timed out waiting for the video to render.');
        await new Promise(r => setTimeout(r, 3000));
        const { data } = await axios.get(`${REPLICATE_API}/predictions/${prediction.id}`, {
            headers: { Authorization: `Bearer ${apiToken}` },
            timeout: 30000,
        });
        prediction = data;
    }

    if (!prediction || prediction.status === 'failed' || prediction.status === 'canceled') {
        throw new Error(`Replicate job ${prediction?.status || 'failed'}: ${prediction?.error || 'unknown error'}`);
    }

    const output = prediction.output;
    if (Array.isArray(output)) return output[output.length - 1];
    if (typeof output === 'string') return output;
    if (output && typeof output === 'object' && output.url) return output.url;
    throw new Error('Replicate returned no usable video URL.');
}

/** Text-to-video. */
async function generateFromText(prompt) {
    if (!prompt || !String(prompt).trim()) throw new Error('A prompt is required.');
    return runModel(t2vModel(), { prompt: String(prompt).trim() });
}

/** Image-to-video. `image` may be a URL or a data URL. */
async function generateFromImage(image, prompt) {
    if (!image) throw new Error('An image is required.');
    return runModel(i2vModel(), { image, prompt: prompt || 'animate this image naturally' });
}

/** Talking avatar — a portrait plus the exact words to speak. */
async function generateAvatar(image, script) {
    if (!image) throw new Error('A portrait image is required.');
    if (!script || !String(script).trim()) throw new Error('The words to speak are required.');
    return runModel(avatarModel(), {
        image,
        voice_script: String(script).trim(),
    });
}

module.exports = {
    isT2VConfigured,
    t2vConfigHint,
    generateFromText,
    isI2VConfigured,
    i2vConfigHint,
    generateFromImage,
    isAvatarConfigured,
    avatarConfigHint,
    generateAvatar,
};
