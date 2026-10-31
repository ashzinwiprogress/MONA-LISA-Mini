const http = require('http');
const https = require('https');
const axios = require('axios');

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 64, maxFreeSockets: 16, timeout: 30000 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 64, maxFreeSockets: 16, timeout: 30000 });

const client = axios.create({
  timeout: 25000,
  httpAgent,
  httpsAgent,
  maxRedirects: 5,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*'
  },
  validateStatus: (s) => s >= 200 && s < 400
});

async function getJson(url, options = {}) {
  const { data } = await client.get(url, options);
  return data;
}

async function getBuffer(url, options = {}) {
  const { data } = await client.get(url, {
    ...options,
    responseType: 'arraybuffer',
    timeout: options.timeout || 180000
  });
  return Buffer.from(data);
}

module.exports = { client, getJson, getBuffer, httpAgent, httpsAgent };
