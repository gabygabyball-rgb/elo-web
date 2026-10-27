'use strict';
// Lee el Elo directamente del archivo data/db.json del bot (solo lectura).
// El bot escribe ese archivo con writeFileSync, así que a veces se puede leer
// a mitad de escritura: si el JSON no parsea, se conserva la última lectura buena.
const fs = require('fs');
const path = require('path');
function defaultAvatar(id) {
  let n = 0;
  try { n = Number((BigInt(id) >> 22n) % 6n); } catch { /* id raro */ }
  return `https://cdn.discordapp.com/embed/avatars/${n}.png`;
}

const FALLBACK_RANKS = [
  { key: 'bronce', name: 'Bronce', emoji: '🥉', color: 0xAD8A56, tiers: [{ label: 'I', min: 0 }, { label: 'II', min: 100 }, { label: 'III', min: 200 }] },
  { key: 'plata', name: 'Plata', emoji: '⚪', color: 0xC0C0C0, tiers: [{ label: 'I', min: 300 }, { label: 'II', min: 400 }, { label: 'III', min: 500 }] },
  { key: 'oro', name: 'Oro', emoji: '🟡', color: 0xFFD700, tiers: [{ label: 'I', min: 600 }, { label: 'II', min: 700 }, { label: 'III', min: 800 }] },
  { key: 'diamante', name: 'Diamante', emoji: '💎', color: 0x59D8E6, tiers: [{ label: 'I', min: 900 }, { label: 'II', min: 1000 }, { label: 'III', min: 1100 }] },
  { key: 'mitico', name: 'Mítico', emoji: '🔮', color: 0xB35CFF, tiers: [{ label: 'I', min: 1200 }, { label: 'II', min: 1300 }, { label: 'III', min: 1400 }] },
  { key: 'legendario', name: 'Legendario', emoji: '🔥', color: 0xFF7A1A, tiers: [{ label: 'I', min: 1500 }, { label: 'II', min: 1600 }, { label: 'III', min: 1700 }] },
  { key: 'maestro', name: 'Maestro', emoji: '👑', color: 0xFF3B6B, tiers: [{ label: 'I', min: 1800 }, { label: 'II', min: 1900 }, { label: 'III', min: 2000 }] },
  { key: 'pro', name: 'Pro', emoji: '🏆', color: 0xFFFFFF, min: 2100 }
];

const BOT_ROOT = path.join(__dirname, '..', '..');
let RANKS = FALLBACK_RANKS;
try {
  // Si la carpeta web/ está dentro del bot, usa SUS rangos (así nunca se desincronizan).
  const cfg = require(path.join(BOT_ROOT, 'src', 'config.js'));
  if (Array.isArray(cfg.RANKS) && cfg.RANKS.length) RANKS = cfg.RANKS;
} catch { /* usa los de respaldo */ }

const BADGES_DIR = path.join(BOT_ROOT, 'assets', 'ranks');

const TIERS = [];
for (const r of RANKS) {
  if (r.tiers) for (const t of r.tiers) TIERS.push({ key: r.key, name: r.name, label: t.label, min: t.min, emoji: r.emoji, color: r.color });
  else TIERS.push({ key: r.key, name: r.name, label: null, min: r.min, emoji: r.emoji, color: r.color });
}
TIERS.sort((a, b) => a.min - b.min);

function tierFor(elo) {
  let cur = TIERS[0];
  for (const t of TIERS) { if (elo >= t.min) cur = t; else break; }
  return {
    key: cur.key,
    name: cur.label ? `${cur.name} ${cur.label}` : cur.name,
    emoji: cur.emoji,
    color: '#' + (cur.color >>> 0).toString(16).padStart(6, '0').slice(-6),
    badge: null
  };
}

// ---------- lectura del db.json ----------
let cache = { mtimeMs: 0, data: null };
function readDb(file) {
  try {
    const st = fs.statSync(file);
    if (st.mtimeMs !== cache.mtimeMs || !cache.data) {
      cache = { mtimeMs: st.mtimeMs, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
    }
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    // JSON a medio escribir: se queda con la última lectura buena
  }
  return cache.data;
}

function entries(playersMap) {
  return Object.values(playersMap || {})
    .filter(p => p && (p.gamesPlayed || 0) > 0)
    .map(p => ({
      id: String(p.userId), name: p.name || String(p.userId), elo: Math.round(p.elo || 0),
      wins: p.wins || 0, losses: p.losses || 0, draws: p.draws || 0, games: p.gamesPlayed || 0, streak: p.streak || 0
    }))
    .sort((a, b) => b.elo - a.elo || b.wins - a.wins || a.name.localeCompare(b.name));
}

function pickGuild(db, guildId) {
  if (guildId && db.guilds[guildId]) return [guildId, db.guilds[guildId]];
  // sin GUILD_ID: el servidor con más jugadores registrados
  let best = null, bestN = -1;
  for (const [id, g] of Object.entries(db.guilds || {})) {
    const n = Object.keys(g.players || {}).length + Object.values(g.modes || {}).reduce((s, m) => s + Object.keys(m.players || {}).length, 0);
    if (n > bestN) { best = [id, g]; bestN = n; }
  }
  return best;
}

/** Devuelve { guildId, season, boards:[{key,name,players:[...]}] } o null si no hay db. */
function getBoards({ dbPath, guildId, demo }) {
  if (demo) return demoBoards();
  const db = readDb(dbPath);
  if (!db) return null;
  const picked = pickGuild(db, guildId);
  if (!picked) return { guildId: null, season: null, boards: [] };
  const [gid, g] = picked;
  const boards = [];
  for (const [key, m] of Object.entries(g.modes || {})) boards.push({ key, name: m.name || key, players: entries(m.players) });
  const legacy = entries(g.players);
  if (legacy.length) boards.unshift({ key: 'general', name: 'General', players: legacy });
  boards.sort((a, b) => b.players.length - a.players.length);
  return { guildId: gid, season: g.season || null, boards };
}

function bestTierOf(boards, userId) {
  let best = null;
  for (const b of boards) for (const p of b.players) if (p.id === userId && (!best || p.elo > best.elo)) best = p;
  return best ? { elo: best.elo, rank: tierFor(best.elo) } : null;
}

// ---------- avatares (opcional, con el token del bot) ----------
const avatarCache = new Map(); // id -> { url, at }
async function avatarFor(id, botToken) {
  if (!botToken) return defaultAvatar(id);
  const hit = avatarCache.get(id);
  if (hit && Date.now() - hit.at < 6 * 3600 * 1000) return hit.url;
  let url = defaultAvatar(id);
  try {
    const r = await fetch(`https://discord.com/api/v10/users/${id}`, {
      headers: { Authorization: `Bot ${botToken}` }, signal: AbortSignal.timeout(3000)
    });
    if (r.ok) {
      const u = await r.json();
      if (u.avatar) url = `https://cdn.discordapp.com/avatars/${id}/${u.avatar}.png?size=128`;
    }
  } catch { /* se queda con el avatar por defecto */ }
  avatarCache.set(id, { url, at: Date.now() });
  return url;
}

// ---------- datos de ejemplo (DEMO=1 o si no existe db.json) ----------
function demoBoards() {
  const names = [['Mbappé10', 1830], ['ElProfe', 1712], ['Chiqui', 1655], ['Kaiser', 1540], ['Tormenta', 1388], ['Pipe', 1260], ['LaPulga', 1105]];
  const players = names.map(([name, elo], i) => ({
    id: String(100000000000000000 + i * 7919), name, elo, wins: 40 - i * 3, losses: 12 + i * 2, draws: 3, games: 55 + i, streak: 3 - i
  }));
  return { guildId: 'demo', season: 7, boards: [{ key: '4v4-solo', name: '4v4-solo', players }, { key: '1v1-solo', name: '1v1-solo', players: players.slice(0, 4).reverse().map((p, i) => ({ ...p, elo: 900 - i * 60 })) }] };
}

/** Datos crudos del servidor (para historial y partidas). null si no hay db o estamos en demo. */
function getRawGuild({ dbPath, guildId, demo }) {
  if (demo) return null;
  const db = readDb(dbPath);
  if (!db) return null;
  const picked = pickGuild(db, guildId);
  return picked ? picked[1] : null;
}

function ladder() {
  return RANKS.map(r => ({
    key: r.key, name: r.name, emoji: r.emoji,
    color: '#' + (r.color >>> 0).toString(16).padStart(6, '0').slice(-6),
    tiers: r.tiers ? r.tiers.map(t => ({ label: t.label, minElo: t.min })) : [{ label: null, minElo: r.min }]
  }));
}

module.exports = { getBoards, getRawGuild, ladder, bestTierOf, tierFor, avatarFor };
