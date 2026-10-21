const { cmd } = require('../redx');
const axios = require('axios');
const zlib = require('zlib');

const API = 'https://api.omegatech.app/api/ai/llamacoder';
const BRAND = 'Powered by Progress Tech';
const CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';

global.llamaSessions = global.llamaSessions || {};
global.llamaZipIds = global.llamaZipIds || {};

async function callLlama({ action = 'create', prompt = '', sessionId = '', quality = 'low' }) {
  const params = { action, quality };
  if (prompt) params.prompt = prompt;
  if (sessionId) params.sessionId = sessionId;
  const { data } = await axios.get(API, { params, timeout: 180000 });
  return data;
}

function safePath(p, i) {
  let name = String(p || `file_${i}.tsx`).replace(/\\/g, '/').replace(/^\/+/, '');
  name = name.replace(/\.\./g, '').replace(/\/+/g, '/');
  return name || `file_${i}.tsx`;
}

function dosDateTime(d = new Date()) {
  const dosTime = (d.getSeconds() >> 1) | (d.getMinutes() << 5) | (d.getHours() << 11);
  const dosDate = d.getDate() | ((d.getMonth() + 1) << 5) | ((d.getFullYear() - 1980) << 9);
  return { dosTime, dosDate };
}

function zipFiles(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const now = dosDateTime();

  for (const f of files) {
    const nameBuf = Buffer.from(f.path, 'utf8');
    const data = Buffer.isBuffer(f.content) ? f.content : Buffer.from(String(f.content ?? ''), 'utf8');
    const compressed = zlib.deflateRawSync(data);
    const crc = zlib.crc32(data) >>> 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(now.dosTime, 10);
    local.writeUInt16LE(now.dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    const localFull = Buffer.concat([local, nameBuf, compressed]);
    localParts.push(localFull);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(now.dosTime, 12);
    central.writeUInt16LE(now.dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(Buffer.concat([central, nameBuf]));
    offset += localFull.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDir, eocd]);
}

function runGuide(fileList) {
  const hasPkg = fileList.some((p) => /(^|\/)package\.json$/i.test(p));
  let steps = '*How to run this app*\n\n1. Download and unzip the ZIP on your computer.\n';
  if (hasPkg) {
    steps +=
      '2. Open a terminal in the unzipped folder.\n' +
      '3. npm install\n' +
      '4. npm run dev\n' +
      '5. Open the local URL printed in the terminal (usually http://localhost:5173).\n';
  } else {
    steps +=
      '2. Open the unzipped folder.\n' +
      '3. If you see HTML, open index.html in a browser.\n' +
      '4. If you see package.json, run npm install then npm run dev.\n';
  }
  steps +=
    '\n*Edit this app in WhatsApp*\n' +
    'Reply to this ZIP with any change you want, for example:\n' +
    'add dark mode\n' +
    'make the homepage a todo list\n\n' +
    `_${BRAND}_\n${CHANNEL_LINK}`;
  return steps;
}

function hasPath(files, name) {
  return files.some((f) => f.path.replace(/\\/g, '/') === name);
}

function addScaffold(files) {
  const out = files.slice();
  if (!hasPath(out, 'package.json')) {
    out.push({
      path: 'package.json',
      content: JSON.stringify({
        name: 'mona-lisa-llama-app',
        private: true,
        version: '1.0.0',
        type: 'module',
        scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
        dependencies: {
          react: '^18.3.1',
          'react-dom': '^18.3.1',
          'lucide-react': '^0.453.0',
          clsx: '^2.1.1',
          'tailwind-merge': '^2.5.4',
          'class-variance-authority': '^0.7.0'
        },
        devDependencies: {
          '@types/react': '^18.3.12',
          '@types/react-dom': '^18.3.1',
          '@vitejs/plugin-react': '^4.3.3',
          autoprefixer: '^10.4.20',
          postcss: '^8.4.47',
          tailwindcss: '^3.4.14',
          typescript: '^5.6.3',
          vite: '^5.4.10'
        }
      }, null, 2)
    });
  }
  if (!hasPath(out, 'index.html')) {
    out.push({
      path: 'index.html',
      content:
        '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>MONA LISA App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n'
    });
  }
  if (!hasPath(out, 'vite.config.ts') && !hasPath(out, 'vite.config.js')) {
    out.push({
      path: 'vite.config.ts',
      content:
        "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nimport path from 'path';\nimport { fileURLToPath } from 'url';\nconst __dirname = path.dirname(fileURLToPath(import.meta.url));\n\nexport default defineConfig({\n  plugins: [react()],\n  resolve: { alias: { '@': path.resolve(__dirname, 'src') } }\n});\n"
    });
  }
  if (!hasPath(out, 'tsconfig.json')) {
    out.push({
      path: 'tsconfig.json',
      content: JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',
          strict: false,
          baseUrl: '.',
          paths: { '@/*': ['src/*'] }
        },
        include: ['src']
      }, null, 2)
    });
  }
  if (!hasPath(out, 'postcss.config.js')) {
    out.push({
      path: 'postcss.config.js',
      content: "export default { plugins: { tailwindcss: {}, autoprefixer: {} } };\n"
    });
  }
  if (!hasPath(out, 'tailwind.config.js')) {
    out.push({
      path: 'tailwind.config.js',
      content:
        "/** @type {import('tailwindcss').Config} */\nexport default {\n  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],\n  theme: { extend: {} },\n  plugins: []\n};\n"
    });
  }
  if (!hasPath(out, 'src/main.tsx') && !hasPath(out, 'src/main.jsx')) {
    out.push({
      path: 'src/main.tsx',
      content:
        "import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nimport './index.css';\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n"
    });
  }
  if (!hasPath(out, 'src/index.css')) {
    out.push({
      path: 'src/index.css',
      content: '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nhtml, body, #root { min-height: 100%; }\n'
    });
  }
  if (!hasPath(out, 'src/vite-env.d.ts')) {
    out.push({ path: 'src/vite-env.d.ts', content: '/// <reference types="vite/client" />\n' });
  }
  if (!hasPath(out, 'src/App.tsx') && !hasPath(out, 'src/App.jsx')) {
    out.push({ path: 'src/App.tsx', content: 'export default function App() {\n  return <div className="p-6">MONA LISA App</div>;\n}\n' });
  }
  const ui = {
    'src/lib/utils.ts':
      "import { clsx } from 'clsx';\nimport { twMerge } from 'tailwind-merge';\nexport function cn(...inputs) {\n  return twMerge(clsx(inputs));\n}\n",
    'src/components/ui/button.tsx':
      "import * as React from 'react';\nimport { cn } from '@/lib/utils';\nexport function Button({ className, children, ...props }) {\n  return (\n    <button className={cn('inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium', className)} {...props}>\n      {children}\n    </button>\n  );\n}\n",
    'src/components/ui/input.tsx':
      "import * as React from 'react';\nimport { cn } from '@/lib/utils';\nexport function Input({ className, ...props }) {\n  return <input className={cn('flex h-10 w-full rounded-md border px-3 py-2 text-sm', className)} {...props} />;\n}\n",
    'src/components/ui/badge.tsx':
      "import * as React from 'react';\nimport { cn } from '@/lib/utils';\nexport function Badge({ className, children, ...props }) {\n  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs', className)} {...props}>{children}</span>;\n}\n",
    'src/components/ui/card.tsx':
      "import * as React from 'react';\nimport { cn } from '@/lib/utils';\nexport function Card({ className, ...props }) {\n  return <div className={cn('rounded-xl border bg-card', className)} {...props} />;\n}\nexport function CardContent({ className, ...props }) {\n  return <div className={cn('p-4', className)} {...props} />;\n}\n",
    'src/components/ui/dialog.tsx':
      "import * as React from 'react';\nexport function Dialog({ children }) {\n  return <>{children}</>;\n}\nexport function DialogContent({ className, children, ...props }) {\n  return <div className={className} {...props}>{children}</div>;\n}\nexport function DialogTitle({ children }) {\n  return <h2>{children}</h2>;\n}\n"
  };
  for (const [p, content] of Object.entries(ui)) {
    if (!hasPath(out, p)) out.push({ path: p, content });
  }
  return out;
}

function buildReadme(prompt, sessionId, fileList) {
  return (
    `MONA LISA LlamaCoder App\n` +
    `========================\n` +
    `Built by Progress Tech\n\n` +
    `Prompt: ${prompt}\n` +
    `Session: ${sessionId}\n` +
    `Files:\n${fileList.map((p) => '- ' + p).join('\n')}\n\n` +
    runGuide(fileList).replace(/\*/g, '') +
    `\n`
  );
}

function quotedZipMeta(m, mek) {
  const stanzaId = m.quoted?.key?.id || m.quoted?.stanzaId || mek.message?.extendedTextMessage?.contextInfo?.stanzaId;
  if (stanzaId && global.llamaZipIds[stanzaId]) return global.llamaZipIds[stanzaId];
  const q = m.quoted;
  if (!q) return null;
  const doc = q.documentMessage || q.message?.documentMessage;
  const name = (doc && doc.fileName) || '';
  const caption = q.text || doc?.caption || '';
  if (/\.zip$/i.test(name) || /LLAMACODER|llama/i.test(caption + name)) {
    return global.llamaSessions[m.chat || ''] || null;
  }
  return null;
}

async function deliverLlama(conn, mek, from, res, quality, action, prompt) {
  const data = res?.data || res;
  const files = data?.files || res?.files || [];
  const newSid = data?.sessionId || res?.sessionId || '';
  const chatId = data?.chatId || res?.chatId || '';
  const promptUsed = data?.prompt || res?.prompt || prompt;

  if (!files.length) {
    throw new Error('No files returned: ' + JSON.stringify(res).slice(0, 500));
  }

  let packed = files.map((f, i) => ({
    path: safePath(f.path || f.name, i),
    content: f.content || f.code || ''
  }));
  packed = addScaffold(packed);
  const fileList = packed.map((f) => f.path).filter((p) => p !== 'README.md');
  packed.push({
    path: 'README.md',
    content: buildReadme(promptUsed, newSid, fileList)
  });

  const zipBuf = zipFiles(packed);
  const zipName = `mona-lisa-app-${Date.now()}.zip`;
  const meta = { sessionId: newSid, from, files: fileList, zipName };
  if (newSid) global.llamaSessions[from] = meta;

  const caption =
    `*LlamaCoder app ready*\n` +
    `Prompt: ${promptUsed}\n` +
    `Files: ${fileList.length}\n` +
    `Quality: ${quality}\n` +
    `Action: ${action}\n` +
    `Session: ${newSid}\n` +
    (chatId ? `ChatId: ${chatId}\n` : '') +
    `\nDownload the ZIP, unzip, then follow README.md to run it.\n` +
    `Reply to this ZIP with any change you want.\n\n_${BRAND}_`;

  const sent = await conn.sendMessage(from, {
    document: zipBuf,
    mimetype: 'application/zip',
    fileName: zipName,
    caption
  }, { quoted: mek });

  const msgId = sent?.key?.id;
  if (msgId) global.llamaZipIds[msgId] = meta;

  await conn.sendMessage(from, { text: runGuide(fileList) }, { quoted: sent || mek });
  return meta;
}

cmd({
  pattern: 'llama',
  alias: ['llamacoder', 'lcoder', 'lc', 'buildapp', 'appgen'],
  react: '🦙',
  desc: 'LlamaCoder - build a full app ZIP you can download and run',
  category: 'ai',
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    const current = global.llamaSessions[from] || {};
    const currentSid = current.sessionId || '';

    if (!q) {
      return reply(
        `*LlamaCoder*\nBuilds a full app and sends a ZIP you can run.\nSession: ${currentSid ? currentSid.slice(0, 18) + '...' : 'None'}\n\n` +
        `Usage:\n.llama Build a movie streaming website\n.llama followup Add dark mode\n.llama quality high | Build a CRM\n.llama reset\n\n` +
        `Reply to the ZIP with the change you want — no prefix needed.\n\n_${BRAND}_\n${CHANNEL_LINK}`
      );
    }

    const low = q.toLowerCase().trim();
    if (low === 'reset' || low === 'clear' || low.startsWith('delete')) {
      try { if (currentSid) await callLlama({ action: 'delete_session', sessionId: currentSid }); } catch (_) {}
      delete global.llamaSessions[from];
      return reply('LlamaCoder session deleted.');
    }

    if (low === 'list' || low === 'list_sessions') {
      const data = await callLlama({ action: 'list_sessions' });
      const sessions = data?.sessions || data?.data?.sessions || [];
      if (!sessions.length) return reply('No sessions found.');
      return reply(`*LlamaCoder sessions*\n\n${sessions.map((s) => `• ${s.sessionId || s.id} - ${s.prompt || ''}`).join('\n').slice(0, 1500)}`);
    }

    await conn.sendMessage(from, { react: { text: '🦙', key: mek.key } });
    await conn.sendPresenceUpdate('composing', from);
    await reply('Building your app. This can take a minute...');

    let action = 'create';
    let prompt = q;
    let quality = 'low';
    let sessionId = currentSid;
    const zipMeta = quotedZipMeta(m, mek);
    if (zipMeta?.sessionId) {
      sessionId = zipMeta.sessionId;
      action = 'followup';
    }

    if (q.toLowerCase().startsWith('quality')) {
      const parts = q.split('|');
      const qPart = parts[0].toLowerCase();
      if (qPart.includes('high')) quality = 'high';
      if (qPart.includes('low')) quality = 'low';
      prompt = parts.slice(1).join('|').trim() || 'Build a website';
    }

    if (q.toLowerCase().startsWith('followup')) {
      action = 'followup';
      prompt = q.replace(/followup/i, '').replace('|', '').trim();
      if (!sessionId) return reply('No session for followup. First build with: .llama Build a WhatsApp Bot');
    }

    if (q.includes('|') && !q.toLowerCase().startsWith('quality')) {
      const maybeSid = q.split('|')[0].trim();
      if (maybeSid.length > 10 && maybeSid.includes('-')) {
        sessionId = maybeSid;
        prompt = q.split('|').slice(1).join('|').trim();
        action = 'followup';
      }
    }

    if (!prompt) return reply('Give a prompt, e.g. .llama Build a todo app');

    const res = await callLlama({ action, prompt, sessionId, quality });
    await deliverLlama(conn, mek, from, res, quality, action, prompt);
  } catch (e) {
    console.error('LlamaCoder error', e.response?.data || e.message);
    reply(`LlamaCoder failed: ${e.response?.data?.message || e.response?.data?.error || e.message}`);
  }
});

cmd({
  pattern: 'llama-zip-edit',
  on: 'body',
  dontAddCommandList: true,
  filename: __filename
}, async (conn, mek, m, { from, body, isCmd, reply }) => {
  try {
    if (isCmd) return;
    const text = String(body || '').trim();
    if (!text || text.length < 2) return;
    const meta = quotedZipMeta(m, mek);
    if (!meta?.sessionId) return;
    if (global.llamaBusy && global.llamaBusy[from]) return;
    global.llamaBusy = global.llamaBusy || {};
    global.llamaBusy[from] = true;
    try {
      await conn.sendPresenceUpdate('composing', from);
      await reply('Updating the app from your ZIP reply...');
      const res = await callLlama({
        action: 'followup',
        prompt: text,
        sessionId: meta.sessionId,
        quality: 'low'
      });
      await deliverLlama(conn, mek, from, res, 'low', 'followup', text);
    } finally {
      global.llamaBusy[from] = false;
    }
  } catch (e) {
    global.llamaBusy = global.llamaBusy || {};
    global.llamaBusy[from] = false;
    reply(`LlamaCoder edit failed: ${e.response?.data?.message || e.message}`);
  }
});
