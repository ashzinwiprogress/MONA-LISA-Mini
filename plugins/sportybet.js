const { cmd } = require('../redx');
const axios = require('axios');

const BASE = 'https://www.sportybet.com/api';
const ORIGIN = 'https://www.sportybet.com';
const CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb8rLzOCRs1j79bllH05';
const BRAND = 'Powered by Progress Tech';

const ACTIONS = ['sports', 'live', 'prematch', 'important', 'event', 'redblack'];
const REGIONS = ['ng', 'gh', 'ke', 'tz', 'zm', 'ug', 'cm', 'za'];
const REGION_NAMES = {
  ng: 'Nigeria',
  gh: 'Ghana',
  ke: 'Kenya',
  tz: 'Tanzania',
  zm: 'Zambia',
  ug: 'Uganda',
  cm: 'Cameroon',
  za: 'South Africa'
};
const REGION_ALIASES = {
  nigeria: 'ng', ng: 'ng',
  ghana: 'gh', gh: 'gh',
  kenya: 'ke', ke: 'ke',
  tanzania: 'tz', tz: 'tz',
  zambia: 'zm', zm: 'zm',
  uganda: 'ug', ug: 'ug',
  cameroon: 'cm', cm: 'cm',
  sa: 'za', za: 'za', 'south-africa': 'za'
};
const SPORT_MAP = {
  football: 'sr:sport:1',
  soccer: 'sr:sport:1',
  basketball: 'sr:sport:2',
  tennis: 'sr:sport:5',
  vfootball: 'sr:sport:202120001',
  efootball: 'sr:sport:137'
};
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];

function headers(region) {
  return {
    'User-Agent': pick(USER_AGENTS),
    Accept: 'application/json',
    Origin: ORIGIN,
    Referer: `${ORIGIN}/${region}/`
  };
}

function resolveRegion(input) {
  const raw = String(input.region || input.country || 'ng').toLowerCase().trim();
  return REGION_ALIASES[raw] || (REGIONS.includes(raw) ? raw : 'ng');
}

function resolveSportId(input) {
  const raw = String(input.sportId || input.sport || 'football').trim();
  if (raw.startsWith('sr:sport:')) return raw;
  return SPORT_MAP[raw.toLowerCase()] || raw;
}

function sportLabel(id) {
  const found = Object.entries(SPORT_MAP).find(([, v]) => v === id);
  return found ? found[0] : id;
}

async function apiGet(region, path, query = {}) {
  const params = {};
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params[k] = String(v);
  }
  const { data: json, status } = await axios.get(`${BASE}/${region}${path}`, {
    params,
    timeout: 25000,
    headers: headers(region),
    validateStatus: (s) => s >= 200 && s < 500
  });
  if (!json) throw new Error(`HTTP ${status}`);
  if (json.bizCode && json.bizCode !== 10000) {
    throw new Error(json.message || json.innerMsg || `bizCode ${json.bizCode}`);
  }
  return json.data;
}

function mapOutcome(o) {
  return { id: o.id, desc: o.desc, odds: o.odds, active: o.isActive === 1 };
}

function mapMarket(m) {
  return {
    id: m.id,
    name: m.name || m.desc,
    status: m.status,
    group: m.group,
    outcomes: (m.outcomes || []).map(mapOutcome)
  };
}

function mapEvent(e, tournament) {
  const markets = (e.markets || []).map(mapMarket);
  const m1x2 = markets.find((m) => m.name === '1X2' || m.id === '1');
  return {
    eventId: e.eventId,
    gameId: e.gameId,
    home: e.homeTeamName,
    away: e.awayTeamName,
    score: e.setScore || null,
    period: e.period || null,
    matchStatus: e.matchStatus || null,
    playedSeconds: e.playedSeconds || null,
    status: e.status,
    startTime: e.estimateStartTime || null,
    tournament: tournament || e.sport?.category?.tournament?.name || null,
    category: e.sport?.category?.name || null,
    sport: e.sport?.name || null,
    totalMarkets: e.totalMarketSize || markets.length,
    odds1x2: m1x2
      ? Object.fromEntries((m1x2.outcomes || []).map((o) => [
        o.desc === 'Home' ? '1' : o.desc === 'Draw' ? 'X' : o.desc === 'Away' ? '2' : o.desc,
        o.odds
      ]))
      : null,
    markets: markets.slice(0, 8)
  };
}

function flattenTournaments(data, { limit = 40 } = {}) {
  const out = [];
  for (const t of data || []) {
    for (const e of t.events || []) {
      out.push(mapEvent(e, t.name));
      if (out.length >= limit) return out;
    }
  }
  return out;
}

async function actionSports(input) {
  const region = resolveRegion(input);
  const data = await apiGet(region, '/factsCenter/orderedSportList');
  return {
    region,
    sports: (data || []).map((s) => ({ id: s.id, name: s.name, eventSize: s.eventSize }))
  };
}

async function actionLive(input) {
  const region = resolveRegion(input);
  const sportId = resolveSportId(input);
  const pageSize = Math.min(50, Math.max(1, Number(input.limit) || 20));
  const data = await apiGet(region, '/factsCenter/liveOrPrematchEvents', { sportId, productId: 3, pageSize });
  const events = flattenTournaments(data, { limit: pageSize });
  const liveish = events.filter((e) => e.matchStatus || e.playedSeconds || e.score);
  const list = liveish.length ? liveish : events;
  return { region, sportId, mode: 'live', count: list.length, events: list };
}

async function actionPrematch(input) {
  const region = resolveRegion(input);
  const sportId = resolveSportId(input);
  const pageSize = Math.min(50, Math.max(1, Number(input.limit) || 20));
  const data = await apiGet(region, '/factsCenter/liveOrPrematchEvents', { sportId, productId: 1, pageSize });
  const events = flattenTournaments(data, { limit: pageSize });
  return { region, sportId, mode: 'prematch', count: events.length, events };
}

async function actionImportant(input) {
  const region = resolveRegion(input);
  const sportId = resolveSportId(input);
  const data = await apiGet(region, '/factsCenter/importantEvents', { sportId, productId: 3 });
  return {
    region,
    sportId,
    tournaments: (data || []).map((t) => ({
      id: t.id,
      name: t.name,
      events: (t.events || []).slice(0, 10).map((e) => mapEvent(e, t.name))
    }))
  };
}

async function actionEvent(input) {
  const region = resolveRegion(input);
  const eventId = input.eventId || input.id;
  if (!eventId) throw new Error('eventId is required');
  const sportId = resolveSportId(input);
  for (const productId of [3, 1]) {
    const data = await apiGet(region, '/factsCenter/liveOrPrematchEvents', { sportId, productId, pageSize: 50 });
    for (const t of data || []) {
      for (const e of t.events || []) {
        if (e.eventId === eventId || String(e.gameId) === String(eventId) || String(e.eventId) === String(eventId)) {
          return { region, found: true, event: mapEvent(e, t.name) };
        }
      }
    }
  }
  return { region, found: false, eventId };
}

function actionRedBlackInfo() {
  return {
    game: 'Red-Black',
    type: 'info_only',
    note: 'Official published rules only. No prediction, no RNG reverse, no auto-play.',
    rules: [
      'Choose RED or BLACK for the next card.',
      'Up to 5 turns (hands) per round.',
      'Deck: 52 cards plus green joker cards.',
      'Green joker is neither red nor black — that turn loses.',
      'Correct colour pays 2x the stake.',
      'Win amount becomes the minimum stake for the next turn in the same round.',
      'A loss resets stake to the starting minimum.',
      'Previously drawn cards are shown for counting remaining colours.'
    ],
    pathHint: '/games/red-black (regional Sporty Games)'
  };
}

function fmtTime(ts) {
  if (!ts) return '';
  const n = Number(ts);
  if (!n) return String(ts);
  const d = new Date(n > 1e12 ? n : n * 1000);
  if (Number.isNaN(d.getTime())) return '';
  return d.toUTCString().replace(' GMT', ' UTC');
}

function fmtClock(playedSeconds) {
  const n = Number(playedSeconds);
  if (!n && n !== 0) return '';
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}'${s ? String(s).padStart(2, '0') : ''}`;
}

function fmtOdds(odds) {
  if (!odds) return '';
  const parts = [];
  if (odds['1'] != null) parts.push(`1 ${odds['1']}`);
  if (odds.X != null) parts.push(`X ${odds.X}`);
  if (odds['2'] != null) parts.push(`2 ${odds['2']}`);
  for (const [k, v] of Object.entries(odds)) {
    if (k === '1' || k === '2' || k === 'X') continue;
    parts.push(`${k} ${v}`);
  }
  return parts.join(' | ');
}

function fmtEvent(e, i) {
  const title = `${e.home || '?'} vs ${e.away || '?'}`;
  const bits = [];
  if (e.tournament) bits.push(e.tournament);
  if (e.score) bits.push(`Score ${e.score}`);
  if (e.period) bits.push(e.period);
  if (e.matchStatus) bits.push(e.matchStatus);
  const clock = fmtClock(e.playedSeconds);
  if (clock) bits.push(clock);
  const start = fmtTime(e.startTime);
  if (start && !e.score && !e.matchStatus) bits.push(start);
  const odds = fmtOdds(e.odds1x2);
  let line = `${i + 1}. *${title}*`;
  if (bits.length) line += `\n   ${bits.join(' | ')}`;
  if (odds) line += `\n   ${odds}`;
  if (e.eventId || e.gameId) line += `\n   id: ${e.eventId || e.gameId}`;
  return line;
}

function fmtMarkets(event) {
  const lines = [];
  for (const m of (event.markets || []).slice(0, 6)) {
    const outs = (m.outcomes || [])
      .filter((o) => o.odds != null)
      .slice(0, 8)
      .map((o) => `${o.desc} ${o.odds}`)
      .join(' | ');
    if (outs) lines.push(`*${m.name}*\n${outs}`);
  }
  return lines.join('\n');
}

async function sendButtons(conn, from, title, body, buttons) {
  await conn.relayMessage(from, {
    interactiveMessage: {
      header: { title, hasMediaAttachment: false },
      body: { text: body },
      footer: { text: `${BRAND} | ${CHANNEL_LINK}` },
      nativeFlowMessage: { buttons }
    }
  }, {
    additionalNodes: [{
      tag: 'biz',
      attrs: {},
      content: [{
        tag: 'interactive',
        attrs: { type: 'native_flow', v: '1' },
        content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
      }]
    }]
  });
}

function menuButtons(pre) {
  return [
    {
      name: 'single_select',
      buttonParamsJson: JSON.stringify({
        title: 'Live / Prematch',
        sections: [{
          title: 'Football NG',
          highlight_label: 'LIVE',
          rows: [
            { id: `${pre}sportybet live ng football 12`, title: 'Live football', description: 'Nigeria live matches' },
            { id: `${pre}sportybet prematch ng football 12`, title: 'Prematch football', description: 'Upcoming football' },
            { id: `${pre}sportybet important ng football`, title: 'Important matches', description: 'Top fixtures' },
            { id: `${pre}sportybet live ng basketball 10`, title: 'Live basketball', description: 'Nigeria basketball' }
          ]
        }]
      })
    },
    {
      name: 'single_select',
      buttonParamsJson: JSON.stringify({
        title: 'Region',
        sections: [{
          title: 'SportyBet regions',
          highlight_label: 'NG',
          rows: REGIONS.map((r) => ({
            id: `${pre}sportybet sports ${r}`,
            title: REGION_NAMES[r],
            description: `Sports list • ${r}`
          }))
        }]
      })
    },
    {
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({ display_text: 'Red-Black rules', id: `${pre}sportybet redblack` })
    },
    {
      name: 'cta_url',
      buttonParamsJson: JSON.stringify({ display_text: 'Channel', url: CHANNEL_LINK })
    }
  ];
}

function eventButtons(pre, events, sportId, region) {
  const sport = sportLabel(sportId);
  const rows = events.slice(0, 10).map((e, i) => ({
    id: `${pre}sportybet event ${e.eventId || e.gameId} ${sport} ${region}`,
    title: `${e.home || 'Home'} vs ${e.away || 'Away'}`.slice(0, 24),
    description: `${e.score || e.tournament || e.matchStatus || 'odds'}`.slice(0, 70)
  })).filter((r) => r.id.split(' ').length >= 3);
  if (!rows.length) return [];
  return [{
    name: 'single_select',
    buttonParamsJson: JSON.stringify({
      title: 'Match details',
      sections: [{ title: 'Open event', highlight_label: 'ODDS', rows }]
    })
  }];
}

function parseQuery(q) {
  const parts = String(q || '').trim().split(/\s+/).filter(Boolean);
  const input = {};
  const positional = [];
  for (const p of parts) {
    if (p.includes('=')) {
      const [k, ...rest] = p.split('=');
      if (k) input[k] = rest.join('=').replace(/^["']|["']$/g, '');
    } else {
      positional.push(p);
    }
  }
  let action = (positional[0] || input.action || '').toLowerCase();
  if (action === 'redblack_info') action = 'redblack';
  const rest = positional.slice(1);

  const takeRegionOrSport = (token) => {
    const low = String(token || '').toLowerCase();
    if (REGION_ALIASES[low] || REGIONS.includes(low)) input.region = REGION_ALIASES[low] || low;
    else if (SPORT_MAP[low] || low.startsWith('sr:sport:')) input.sport = low;
    else if (/^\d+$/.test(low) && Number(low) <= 50) input.limit = low;
    else if (token) {
      if (!input.eventId && !input.sport) input.eventId = token;
      else if (!input.sport) input.sport = token;
      else if (!input.region) input.region = token;
    }
  };

  if (action === 'event') {
    if (rest[0]) input.eventId = input.eventId || rest[0];
    rest.slice(1).forEach(takeRegionOrSport);
  } else {
    rest.forEach(takeRegionOrSport);
  }
  return { action, input };
}

function menuText(pre) {
  return (
    `*SPORTYBET*\n` +
    `Live and prematch odds from sportybet.com\n\n` +
    `*Commands*\n` +
    `${pre}sportybet sports ng\n` +
    `${pre}sportybet live ng football 10\n` +
    `${pre}sportybet prematch ng basketball\n` +
    `${pre}sportybet important ng football\n` +
    `${pre}sportybet event <id> football ng\n` +
    `${pre}sportybet redblack\n\n` +
    `*Regions:* ${REGIONS.join(', ')}\n` +
    `*Sports:* football, basketball, tennis, vfootball, efootball\n\n` +
    `${BRAND}`
  );
}

cmd({
  pattern: 'sportybet',
  alias: ['sporty', 'sbet', 'sportyodds', 'sbets'],
  react: '🏟️',
  desc: 'SportyBet live/prematch odds, events and Red-Black rules',
  category: 'sports',
  use: '.sportybet live ng football',
  filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix }) => {
  try {
    const pre = prefix || '.';
    const { action, input } = parseQuery(q);

    if (!action || action === 'menu' || action === 'help') {
      try {
        await sendButtons(conn, from, 'SportyBet', menuText(pre), menuButtons(pre));
      } catch (_) {
        await reply(menuText(pre));
      }
      return;
    }

    await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

    if (action === 'sports') {
      const data = await actionSports(input);
      const lines = (data.sports || []).slice(0, 25).map((s, i) =>
        `${i + 1}. *${s.name}* (${s.id})\n   events: ${s.eventSize || 0}`
      );
      const body =
        `*SportyBet sports* • ${REGION_NAMES[data.region] || data.region}\n` +
        `${data.sports.length} sports\n\n` +
        (lines.join('\n') || 'No sports') +
        `\n\n${BRAND}`;
      const sportRows = (data.sports || []).slice(0, 12).map((s) => {
        const key = Object.keys(SPORT_MAP).find((k) => SPORT_MAP[k] === s.id) || s.id;
        return {
          id: `${pre}sportybet live ${data.region} ${key} 10`,
          title: String(s.name).slice(0, 24),
          description: `${s.eventSize || 0} events • live`
        };
      });
      const buttons = sportRows.length ? [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: 'Open live',
          sections: [{ title: 'Live by sport', highlight_label: 'LIVE', rows: sportRows }]
        })
      }] : [];
      try {
        if (buttons.length) await sendButtons(conn, from, 'SportyBet sports', body, buttons);
        else await reply(body);
      } catch (_) {
        await reply(body);
      }
      return;
    }

    if (action === 'live' || action === 'prematch') {
      const data = action === 'live' ? await actionLive(input) : await actionPrematch(input);
      const events = data.events || [];
      const head =
        `*SportyBet ${data.mode}*\n` +
        `${REGION_NAMES[data.region] || data.region} • ${sportLabel(data.sportId)}\n` +
        `${data.count} matches\n\n`;
      const body = head + (events.length ? events.slice(0, 12).map(fmtEvent).join('\n\n') : 'No matches') + `\n\n${BRAND}`;
      const buttons = eventButtons(pre, events, data.sportId, data.region);
      try {
        if (buttons.length) await sendButtons(conn, from, `SportyBet ${data.mode}`, body, buttons);
        else await reply(body);
      } catch (_) {
        await reply(body);
      }
      return;
    }

    if (action === 'important') {
      const data = await actionImportant(input);
      const blocks = [];
      const flat = [];
      for (const t of data.tournaments || []) {
        const evs = t.events || [];
        if (!evs.length) continue;
        blocks.push(`*${t.name}*\n` + evs.slice(0, 6).map(fmtEvent).join('\n'));
        flat.push(...evs);
      }
      const body =
        `*SportyBet important*\n` +
        `${REGION_NAMES[data.region] || data.region} • ${sportLabel(data.sportId)}\n\n` +
        (blocks.slice(0, 8).join('\n\n') || 'No important matches') +
        `\n\n${BRAND}`;
      const buttons = eventButtons(pre, flat, data.sportId, data.region);
      try {
        if (buttons.length) await sendButtons(conn, from, 'SportyBet important', body, buttons);
        else await reply(body);
      } catch (_) {
        await reply(body);
      }
      return;
    }

    if (action === 'event') {
      const data = await actionEvent(input);
      if (!data.found) {
        return reply(`Event ${data.eventId} not found in ${REGION_NAMES[data.region] || data.region}. Try another sportId.`);
      }
      const e = data.event;
      let body = `*${e.home || '?'} vs ${e.away || '?'}*\n`;
      if (e.tournament) body += `${e.tournament}\n`;
      if (e.category) body += `${e.category}\n`;
      if (e.score) body += `Score: ${e.score}\n`;
      if (e.period) body += `Period: ${e.period}\n`;
      if (e.matchStatus) body += `Status: ${e.matchStatus}\n`;
      const clock = fmtClock(e.playedSeconds);
      if (clock) body += `Time: ${clock}\n`;
      const start = fmtTime(e.startTime);
      if (start) body += `Kickoff: ${start}\n`;
      const odds = fmtOdds(e.odds1x2);
      if (odds) body += `\n1X2: ${odds}\n`;
      const mk = fmtMarkets(e);
      if (mk) body += `\n${mk}\n`;
      body += `\nid: ${e.eventId || e.gameId}\nMarkets: ${e.totalMarkets || 0}\n${BRAND}`;
      await reply(body);
      return;
    }

    if (action === 'redblack') {
      const info = actionRedBlackInfo();
      const body =
        `*${info.game}*\n${info.note}\n\n` +
        info.rules.map((r, i) => `${i + 1}. ${r}`).join('\n') +
        `\n\nPath: ${info.pathHint}\n${BRAND}`;
      await reply(body);
      return;
    }

    return reply(`Unknown action. Use: ${ACTIONS.join(', ')}\n\n${menuText(pre)}`);
  } catch (e) {
    console.error('SportyBet error', e.response?.data || e.message);
    reply(`SportyBet failed: ${e.message || e}\nTry another region or sport.`);
  }
});
