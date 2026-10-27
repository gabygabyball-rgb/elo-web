'use strict';
// API pública de solo lectura: /api/v1/...
// Nunca escribe en el db.json del bot. Si defines API_KEY en web/.env, todas las rutas la exigen
// (cabecera "Authorization: Bearer TU_CLAVE" o "X-API-Key: TU_CLAVE").
const crypto = require('crypto');
const bot = require('./botdata');

const API_KEY = process.env.API_KEY || '';
const CORS_ORIGIN = process.env.API_CORS_ORIGIN || '*';
const RATE_PER_MIN = Number(process.env.API_RATE_PER_MIN || 60);
const TRUST_PROXY = process.env.TRUST_PROXY === '1';

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 60_000);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > 60_000) hits.delete(k);
  return arr.length > RATE_PER_MIN;
}
const clientIp = req => (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';

function keyOk(req) {
  if (!API_KEY) return true;
  const h = req.headers.authorization || '';
  const given = h.startsWith('Bearer ') ? h.slice(7) : String(req.headers['x-api-key'] || '');
  const a = crypto.createHash('sha256').update(given).digest(), b = crypto.createHash('sha256').update(API_KEY).digest();
  return crypto.timingSafeEqual(a, b);
}

const num = (v, def, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.floor(Number(v)) : def));
const pct = (w, g) => (g ? Math.round((w / g) * 1000) / 10 : 0);

function playerOut(p, pos, rank) {
  return {
    position: pos, id: p.id, name: p.name, elo: p.elo, rank: { key: rank.key, name: rank.name, emoji: rank.emoji, color: rank.color },
    wins: p.wins, losses: p.losses, draws: p.draws, games: p.games, winRate: pct(p.wins, p.games), streak: p.streak
  };
}

/** Devuelve true si la ruta era de /api/v1 (y ya respondió). */
async function handleV1(req, res, url, ctx) {
  const { json, fail, opts } = ctx;
  if (!url.pathname.startsWith('/api/v1')) return false;

  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, X-API-Key, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return true; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { fail(res, 405, 'La API es de solo lectura (GET).'); return true; }
  if (limited(clientIp(req))) { res.setHeader('Retry-After', '60'); fail(res, 429, 'Demasiadas peticiones. Espera un minuto.'); return true; }
  if (!keyOk(req)) { res.setHeader('WWW-Authenticate', 'Bearer'); fail(res, 401, 'Falta la clave de API o es incorrecta.'); return true; }

  const path = url.pathname.replace(/\/+$/, '');
  const q = url.searchParams;
  const data = bot.getBoards(opts);
  const boards = data?.boards || [];
  const raw = bot.getRawGuild(opts);
  const find = key => boards.find(b => b.key === key) || null;
  const out = (body) => json(res, 200, { ...body, demo: !!opts.demo });
  let m;

  if (path === '/api/v1') {
    out({ name: 'Elo API', version: 1, readOnly: true, authRequired: !!API_KEY, endpoints: [
      'GET /api/v1/health', 'GET /api/v1/ranks', 'GET /api/v1/boards',
      'GET /api/v1/leaderboard?board=KEY&limit=10&offset=0', 'GET /api/v1/players/:discordId', 'GET /api/v1/games?board=KEY&limit=10'
    ] });
    return true;
  }
  if (path === '/api/v1/health') { out({ ok: true, hasData: !!data, season: data?.season ?? null, time: Date.now() }); return true; }
  if (path === '/api/v1/ranks') { out({ ranks: bot.ladder() }); return true; }
  if (path === '/api/v1/boards') {
    out({ season: data?.season ?? null, boards: boards.map(b => ({ key: b.key, name: b.name, players: b.players.length })) });
    return true;
  }
  if (path === '/api/v1/leaderboard') {
    const board = q.get('board') ? find(q.get('board')) : boards[0];
    if (!board) { fail(res, 404, q.get('board') ? 'Ese modo no existe. Mira /api/v1/boards.' : 'Todavía no hay partidas.'); return true; }
    const limit = num(q.get('limit'), 10, 1, 100), offset = num(q.get('offset'), 0, 0, 100000);
    const slice = board.players.slice(offset, offset + limit);
    const avatars = q.get('avatars') === '1' && opts.botToken
      ? await Promise.all(slice.slice(0, 25).map(p => bot.avatarFor(p.id, opts.botToken))) : [];
    out({
      season: data.season, board: { key: board.key, name: board.name }, total: board.players.length, limit, offset,
      players: slice.map((p, i) => ({ ...playerOut(p, offset + i + 1, bot.tierFor(p.elo)), ...(avatars[i] ? { avatar: avatars[i] } : {}) }))
    });
    return true;
  }
  if ((m = path.match(/^\/api\/v1\/players\/(\d{5,25})$/))) {
    const id = m[1];
    const result = [];
    // Datos crudos por modo (incluye historial de Elo y rachas); si no hay crudo (demo), usa el ranking.
    const stores = raw ? [['general', 'General', raw.players], ...Object.entries(raw.modes || {}).map(([k, md]) => [k, md.name || k, md.players])] : [];
    let name = null;
    for (const [key, bname, players] of stores) {
      const p = (players || {})[id]; if (!p) continue;
      name = name || p.name;
      const board = find(key);
      const idx = board ? board.players.findIndex(x => x.id === id) : -1;
      const games = p.gamesPlayed || 0;
      result.push({
        board: { key, name: bname }, position: idx >= 0 ? idx + 1 : null, outOf: board ? board.players.length : 0,
        elo: Math.round(p.elo || 0), rank: bot.tierFor(p.elo || 0),
        wins: p.wins || 0, losses: p.losses || 0, draws: p.draws || 0, games, winRate: pct(p.wins || 0, games),
        streak: p.streak || 0, bestStreak: p.bestStreak || 0, worstStreak: p.worstStreak || 0, bestElo: p.bestElo || 0, worstElo: p.worstElo || 0,
        eloHistory: (p.history || []).slice(-50)
      });
    }
    if (!stores.length) for (const b of boards) { const i = b.players.findIndex(x => x.id === id); if (i >= 0) { const p = b.players[i]; name = p.name; result.push({ board: { key: b.key, name: b.name }, position: i + 1, outOf: b.players.length, ...playerOut(p, i + 1, bot.tierFor(p.elo)) }); } }
    if (!result.length) { fail(res, 404, 'Ese jugador no aparece en el ranking.'); return true; }
    out({ id, name, avatar: await bot.avatarFor(id, opts.botToken), boards: result });
    return true;
  }
  if (path === '/api/v1/games') {
    if (!raw) { out({ games: [] }); return true; }
    const wanted = q.get('board'); const limit = num(q.get('limit'), 10, 1, 50);
    const list = Object.values(raw.games || {})
      .filter(g => g.status === 'finished' && g.team1 && g.team2 && (!wanted || (g.modeKey || 'general') === wanted))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, limit);
    out({
      games: list.map(g => {
        const store = g.modeKey && raw.modes?.[g.modeKey] ? raw.modes[g.modeKey].players : raw.players;
        const side = ids => ids.map(id => { const c = g.eloChanges?.[id]; return { id, name: store?.[id]?.name || id, ...(c ? { before: c.before, after: c.after, delta: c.delta } : {}) }; });
        return { id: g.id, number: g.number ?? g.id, board: g.modeKey || 'general', result: g.result || null, createdAt: g.createdAt || null, team1: side(g.team1), team2: side(g.team2) };
      })
    });
    return true;
  }
  fail(res, 404, 'Ruta desconocida. Mira /api/v1 para ver las disponibles.');
  return true;
}

module.exports = { handleV1 };