// ═══════════════════════════════════════════════════════════════════════════
//   🧠 AI PROVIDER — any OpenAI-compatible chat endpoint
//   Powered by Progress Tech
//
//   Configure with your OWN keys in the project's .env (never hard-coded):
//     USER_LLM_API_KEY   = <your key>
//     USER_LLM_BASE_URL  = https://api.openai.com/v1   (or any compatible URL)
//     USER_LLM_MODEL     = gpt-4o-mini                 (or any model name)
// ═══════════════════════════════════════════════════════════════════════════

const axios = require('axios');

function getConfig() {
    return {
        apiKey: process.env.USER_LLM_API_KEY || process.env.AI_API_KEY || '',
        baseUrl: (process.env.USER_LLM_BASE_URL || process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
        model: process.env.USER_LLM_MODEL || process.env.AI_MODEL || 'gpt-4o-mini',
    };
}

/** True when an API key has been provided for the project. */
function isConfigured() {
    return Boolean(getConfig().apiKey);
}

/** Human-readable explanation of what is missing. */
function configHint() {
    return 'This command needs an OpenAI-compatible endpoint. Set USER_LLM_API_KEY '
        + '(and optionally USER_LLM_BASE_URL / USER_LLM_MODEL) in your .env — see .env.example.';
}

/**
 * Send a prompt to the configured chat endpoint and return the reply text.
 * @param {string} prompt
 * @param {{system?: string, temperature?: number, timeout?: number}} [opts]
 * @returns {Promise<string>}
 */
async function chat(prompt, opts = {}) {
    const { apiKey, baseUrl, model } = getConfig();
    if (!apiKey) {
        const err = new Error(configHint());
        err.notConfigured = true;
        throw err;
    }

    const messages = [];
    if (opts.system) messages.push({ role: 'system', content: opts.system });
    messages.push({ role: 'user', content: prompt });

    const { data } = await axios.post(`${baseUrl}/chat/completions`, {
        model,
        messages,
        temperature: opts.temperature ?? 0.7,
    }, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        timeout: opts.timeout ?? 60000,
    });

    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('The AI endpoint returned an empty response.');
    return String(text).trim();
}

module.exports = { isConfigured, configHint, chat, getConfig };
