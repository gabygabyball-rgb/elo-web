'use strict';
// Rutas de la página web: staff, invitación, temporadas, login con Discord, clips y reacciones.
// Sin dependencias (Node 18+). Guarda los clips en data/clips.json.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bot = require('./botdata');

const DATA_DIR = process.env.WEB_DATA_DIR ? path.resolve(process.env.WEB_DATA_DIR) : path.resolve(__dirname, '..', '..', 'data'); // en Railway: carpeta del Volume
const SITE_FILE = path.join(DATA_DIR, 'site.json');   // lo escribe el bot
const CLIPS_FILE = path.join(DATA_DIR, 'clips.json'); // lo escribe esta API
const BANS_FILE = path.join(DATA_DIR, 'bans.json');   // usuarios baneados de los clips (lo escribe esta API)

const SECRET = process.env.SESSION_SECRET || '';
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID || '';
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const PUBLIC_URL = (process.env.PUBLIC_URL || 'http://localhost:4000').replace(/\/+$/, '');
const GUILD_ID = process.env.GUILD_ID || '';
const SECURE = PUBLIC_URL.startsWith('https://');
const STAFF_ROLE_IDS = [
  process.env.ROLE_CREADOR || '1563614466812153866',
  process.env.ROLE_ADMIN || '1561128451493077052',
  process.env.ROLE_AYUDANTE || '1561853811247685715'
];
const OWNER_IDS = new Set((process.env.SITE_ADMIN_IDS || '1280295562708521001,1064396480582012988,1168945975293923379,1464866755921842177').split(',').map(s => s.trim()).filter(Boolean));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');        // videos/fotos subidos desde la galería
const MAX_UPLOAD = (Number(process.env.MAX_UPLOAD_MB) || 90) * 1024 * 1024;
const MAX_TOTAL = (Number(process.env.MAX_UPLOAD_TOTAL_MB) || 5000) * 1024 * 1024;
const MEDIA_MIME = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
const EMOJIS = ['❤️', '🔥', '😂', '👏', '💀', '👍'];
const TABS = ['ranking', 'administrador', 'salon', 'clips'];
const CLIP_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'medal.tv', 'streamable.com', 'clips.twitch.tv', 'www.twitch.tv', 'twitch.tv', 'cdn.discordapp.com', 'media.discordapp.net',
  'haxball.com', 'www.haxball.com', 'html5.haxball.com',
  'replay.thehax.pl', 'thehax.pl', 'www.thehax.pl',
  ...String(process.env.EXTRA_CLIP_HOSTS || '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean)]; // EXTRA_CLIP_HOSTS: más páginas permitidas, separadas por coma

// ---------- archivos ----------
const readJson = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return def; } };
function writeJson(f, data) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, f);
}

// ---------- sesión (cookie firmada, sin librerías) ----------
const b64 = b => Buffer.from(b).toString('base64url');
const sign = s => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
function makeToken(payload) { const body = b64(JSON.stringify(payload)); return `${body}.${sign(body)}`; }
function readToken(tok) {
  if (!tok || !SECRET) return null;
  const [body, sig] = String(tok).split('.');
  if (!body || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(sign(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
}
const cookies = req => Object.fromEntries(String(req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(x => x[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
const setCookie = (res, name, value, maxAge) => {
  const prev = res.getHeader('Set-Cookie') || [];
  res.setHeader('Set-Cookie', [].concat(prev, `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${SECURE ? '; Secure' : ''}`));
};
// Las sesiones viejas (sin v:2) pierden el permiso de staff hasta que la persona vuelva a iniciar sesión
const me = req => { const t = readToken(cookies(req).session); return t && { ...t, staff: t.v === 2 && !!t.staff }; };
const readBans = () => readJson(BANS_FILE, { bans: {} }).bans || {};
const isBanned = id => Object.prototype.hasOwnProperty.call(readBans(), id);

// ---------- helpers HTTP ----------
function body(req, limit = 20_000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too big')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}); } catch { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}
const redirect = (res, to) => { res.writeHead(302, { Location: to }); res.end(); };

// límite sencillo por IP para escrituras
const writes = new Map();
function writeLimited(key, max = 20) {
  const now = Date.now(); const arr = (writes.get(key) || []).filter(t => now - t < 60_000); arr.push(now); writes.set(key, arr);
  return arr.length > max;
}

// ---------- clips ----------
function normalizeClip(raw) {
  let u; try { u = new URL(String(raw).trim()); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  if (!CLIP_HOSTS.includes(host)) return null;
  let embed = null, kind = 'link';
  if (host.endsWith('youtube.com') || host === 'youtu.be') {
    let id = host === 'youtu.be' ? u.pathname.slice(1) : (u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|embed)\/([\w-]{6,})/) || [])[1]);
    if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
    embed = `https://www.youtube-nocookie.com/embed/${id}`; kind = 'youtube';
  } else if (host === 'streamable.com') {
    const id = u.pathname.split('/').filter(Boolean).pop();
    if (!id || !/^\w+$/.test(id)) return null;
    embed = `https://streamable.com/e/${id}`; kind = 'streamable';
  } else if (host === 'clips.twitch.tv') {
    const id = u.pathname.split('/').filter(Boolean).pop();
    if (!id || !/^[\w-]+$/.test(id)) return null;
    embed = `https://clips.twitch.tv/embed?clip=${id}&parent=${new URL(PUBLIC_URL).hostname}`; kind = 'twitch';
  } else if (host.endsWith('discordapp.com') || host.endsWith('discordapp.net')) {
    if (!/\.(mp4|webm|mov)$/i.test(u.pathname)) return null;
    embed = u.href; kind = 'video';
  } else { kind = 'link'; embed = null; } // medal.tv / twitch.tv: se muestra como tarjeta con botón
  return { url: u.href, embed, kind };
}
// ---------- archivos subidos ----------
// Detecta el tipo REAL mirando los primeros bytes (no confiamos en lo que diga el navegador)
function sniff(b) {
  if (b.length < 12) return null;
  if (b.toString('latin1', 4, 8) === 'ftyp') return b.toString('latin1', 8, 10) === 'qt' ? 'mov' : 'mp4';
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'webm';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.toString('latin1', 1, 4) === 'PNG') return 'png';
  if (b.toString('latin1', 0, 3) === 'GIF') return 'gif';
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}
function uploadsSize() { try { return fs.readdirSync(UPLOAD_DIR).reduce((n, f) => n + fs.statSync(path.join(UPLOAD_DIR, f)).size, 0); } catch { return 0; } }
function dropFiles(clips) { for (const c of clips) if (c.file && /^[a-f0-9]{12}\.\w{3,4}$/.test(c.file)) { try { fs.rmSync(path.join(UPLOAD_DIR, c.file), { force: true }); } catch { /* ya no está */ } } }
function saveUpload(req, id) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const tmp = path.join(UPLOAD_DIR, id + '.part'); const out = fs.createWriteStream(tmp);
    let size = 0, head = Buffer.alloc(0), ext = null, err = null;
    const bad = e => { if (!err) { err = e; out.destroy(); } };
    req.on('data', c => {
      if (err) { if (size > MAX_UPLOAD * 1.2) req.destroy(); return; }
      size += c.length;
      if (size > MAX_UPLOAD) return bad(new Error('big'));
      if (!ext) { head = Buffer.concat([head, c]); if (head.length >= 12) { ext = sniff(head); if (!ext) return bad(new Error('type')); } }
      if (!out.write(c)) { req.pause(); out.once('drain', () => req.resume()); }
    });
    req.on('end', () => {
      if (!err && !ext) err = new Error('type');
      if (err) { fs.rm(tmp, { force: true }, () => {}); return reject(err); }
      out.end(() => { try { fs.renameSync(tmp, path.join(UPLOAD_DIR, `${id}.${ext}`)); resolve({ file: `${id}.${ext}`, ext, size }); } catch (e) { reject(e); } });
    });
    req.on('error', e => { bad(e); fs.rm(tmp, { force: true }, () => {}); reject(e); });
    req.on('aborted', () => { bad(new Error('aborted')); fs.rm(tmp, { force: true }, () => {}); reject(new Error('aborted')); });
  });
}
function serveMedia(req, res, name) {
  const f = path.join(UPLOAD_DIR, name); let st; try { st = fs.statSync(f); } catch { res.writeHead(404); res.end(); return; }
  const type = MEDIA_MIME[name.split('.').pop()] || 'application/octet-stream';
  const H = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : st.size - Number(m[2]), end = m[1] && m[2] ? Number(m[2]) : st.size - 1;
    end = Math.min(end, st.size - 1);
    if (!(start >= 0 && start <= end)) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); res.end(); return; }
    res.writeHead(206, { ...H, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(f, { start, end }).pipe(res); return;
  }
  res.writeHead(200, { ...H, 'Content-Length': st.size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(f).pipe(res);
}

const clipOut = (c, userId) => ({
  id: c.id, title: c.title, url: c.url, embed: c.embed, kind: c.kind, createdAt: c.createdAt,
  author: c.author,
  reactions: Object.fromEntries(EMOJIS.map(e => [e, (c.reactions[e] || []).length])),
  mine: userId ? EMOJIS.filter(e => (c.reactions[e] || []).includes(userId)) : [],
  total: Object.values(c.reactions).reduce((s, a) => s + a.length, 0),
  comments: (c.comments || []).length,
  saves: (c.saves || []).length,
  saved: userId ? (c.saves || []).includes(userId) : false
});
const commentOut = (x, s) => ({ id: x.id, text: x.text, createdAt: x.createdAt, author: x.author, canDelete: !!s && (s.id === x.author.id || !!s.staff) });


// ---------- tiempo real (SSE) ----------
const sseClients = new Set();
const sseTimers = {};
let watching = false, lastDbMtime = 0, lastSiteMtime = 0;
function broadcast(type) { for (const r of sseClients) { try { r.write(`data: ${type}\n\n`); } catch { sseClients.delete(r); } } }
function queue(type) { clearTimeout(sseTimers[type]); sseTimers[type] = setTimeout(() => broadcast(type), 400); }
function mtime(f) { try { return fs.statSync(f).mtimeMs; } catch { return 0; } }
function ensureWatch(opts) {
  if (watching) return; watching = true;
  const dbFile = opts.dbPath || path.join(DATA_DIR, 'db.json');
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch { /* ya existe */ }
  try {
    for (const dir of new Set([DATA_DIR, path.dirname(dbFile)])) {
      try {
        fs.watch(dir, { persistent: false }, (_ev, name) => {
          if (name === path.basename(dbFile) && dir === path.dirname(dbFile)) queue('game');
          else if (name === 'site.json' && dir === DATA_DIR) queue('site');
        });
      } catch { /* sigue el chequeo por intervalo */ }
    }
  } catch { /* si fs.watch falla, queda el chequeo por intervalo */ }
  lastDbMtime = mtime(dbFile); lastSiteMtime = mtime(SITE_FILE);
  setInterval(() => { // respaldo: algunos discos/OS no avisan bien
    const a = mtime(dbFile), b = mtime(SITE_FILE);
    if (a !== lastDbMtime) { lastDbMtime = a; queue('game'); }
    if (b !== lastSiteMtime) { lastSiteMtime = b; queue('site'); }
  }, 5000).unref();
  setInterval(() => { for (const r of sseClients) { try { r.write(': ping\n\n'); } catch { sseClients.delete(r); } } }, 25000).unref();
}

// ---------- partidas ----------
function defaultAvatar(id) { let n = 0; try { n = Number((BigInt(id) >> 22n) % 6n); } catch { /* id raro */ } return `https://cdn.discordapp.com/embed/avatars/${n}.png`; }
function gamesData(opts) {
  const g = bot.getRawGuild(opts);
  if (!g) return { live: [], recent: [], enabled: false };
  const names = {};
  for (const p of Object.values(g.players || {})) if (p && p.userId) names[p.userId] = p.name;
  for (const m of Object.values(g.modes || {})) for (const p of Object.values(m.players || {})) if (p && p.userId) names[p.userId] = p.name || names[p.userId];
  const live = readJson(SITE_FILE, {}).avatars || {};
  const who = id => ({ id: String(id), name: names[id] || live[id]?.n || `Jugador ${String(id).slice(-4)}`, avatar: live[id]?.a || defaultAvatar(id) });
  const modeName = k => (k && g.modes?.[k]?.name) || k || 'General';
  const map = x => {
    const changes = x.eloChanges || {};
    const side = arr => (arr || []).map(id => ({ ...who(id), delta: changes[id] ? Math.round(changes[id].delta) : null }));
    return {
      id: x.number || x.id, mode: modeName(x.modeKey), status: x.status, createdAt: x.createdAt || 0,
      team1: side(x.team1), team2: side(x.team2), remaining: (x.remainingPlayers || []).map(who),
      captain1: x.captain1 ? String(x.captain1) : null, captain2: x.captain2 ? String(x.captain2) : null,
      result: x.result || null
    };
  };
  const all = Object.values(g.games || {});
  return {
    enabled: true,
    live: all.filter(x => x.status === 'drafting' || x.status === 'pending').sort((a, b) => b.createdAt - a.createdAt).map(map),
    recent: all.filter(x => x.status === 'finished').sort((a, b) => b.createdAt - a.createdAt).slice(0, 12).map(map)
  };
}


// Campeones de la temporada que ya terminó: los lee del propio bot de Elo (currentChampionId / Second / Third),
// así no hace falta tocar el bot. El rol de campeón lo reparte /reset_season.
function championsData(opts) {
  const g = bot.getRawGuild(opts);
  if (!g) return null;
  const want = process.env.BOARD_KEY || '';
  const scopes = [];
  if (want && g.modes?.[want]) scopes.push([g.modes[want], g.modes[want].name || want]);
  for (const [k, m] of Object.entries(g.modes || {})) scopes.push([m, m.name || k]);
  scopes.push([g, 'General']);
  const names = {};
  for (const p of Object.values(g.players || {})) if (p && p.userId) names[p.userId] = p.name;
  for (const m of Object.values(g.modes || {})) for (const p of Object.values(m.players || {})) if (p && p.userId) names[p.userId] = p.name || names[p.userId];
  const av = readJson(SITE_FILE, {}).avatars || {};
  const who = id => id ? { id: String(id), name: names[id] || av[id]?.n || `Jugador ${String(id).slice(-4)}`, avatar: av[id]?.a || defaultAvatar(id) } : null;
  for (const [m] of scopes) {
    if (m.currentChampionId) {
      return { season: Math.max(1, Number(m.season || g.season || 1) - 1), queue: process.env.QUEUE_NAME || 'HardCoRe 4-4', first: who(m.currentChampionId), second: who(m.currentSecondId), third: who(m.currentThirdId) };
    }
  }
  return null;
}

// ---------- estadísticas del Elo y logros para el perfil ----------
function eloOf(opts, id) {
  const data = bot.getBoards(opts); const boards = data?.boards || [];
  const want = process.env.BOARD_KEY || '';
  const board = (want && boards.find(b => b.key === want)) || boards[0];
  if (!board) return null;
  const i = board.players.findIndex(x => x.id === id);
  if (i < 0) return null;
  const x = board.players[i];
  return { position: i + 1, total: board.players.length, elo: x.elo, rank: bot.tierFor(x.elo), wins: x.wins, losses: x.losses, draws: x.draws, games: x.games, winRate: x.games ? Math.round(x.wins / x.games * 1000) / 10 : 0, streak: x.streak, name: x.name };
}
function achievementsOf(id, elo, clipStats) {
  const seasons = readJson(SITE_FILE, {}).seasons || [];
  const L = [];
  const add = (key, icon, name, desc, earned) => L.push({ key, icon, name, desc, earned: !!earned });
  const E = elo || { games: 0, wins: 0, streak: 0, winRate: 0, position: 9999 };
  for (const t of seasons) {
    if (t.first?.id === id) add('s1-' + t.season, '🏆', `Campeón · Temporada ${t.season}`, `Terminó 1.º en la temporada ${t.season}`, true);
    if (t.second?.id === id) add('s2-' + t.season, '🥈', `Subcampeón · Temporada ${t.season}`, `Terminó 2.º en la temporada ${t.season}`, true);
    if (t.third?.id === id) add('s3-' + t.season, '🥉', `Tercer lugar · Temporada ${t.season}`, `Terminó 3.º en la temporada ${t.season}`, true);
  }
  add('top1', '👑', 'Número 1', 'Ser el 1.º del ranking', elo && E.position === 1);
  add('top3', '🏅', 'Podio', 'Estar en el top 3 del ranking', elo && E.position <= 3);
  add('top10', '⭐', 'Élite', 'Estar en el top 10 del ranking', elo && E.position <= 10);
  add('debut', '⚽', 'Debut', 'Jugar tu primera partida del Elo', E.games >= 1);
  add('w10', '🔥', '10 victorias', 'Ganar 10 partidas', E.wins >= 10);
  add('w50', '💪', '50 victorias', 'Ganar 50 partidas', E.wins >= 50);
  add('w100', '🦁', '100 victorias', 'Ganar 100 partidas', E.wins >= 100);
  add('g100', '🎖️', 'Veterano', 'Jugar 100 partidas', E.games >= 100);
  add('st3', '🚀', 'En racha', 'Racha actual de 3 victorias o más', E.streak >= 3);
  add('st5', '☄️', 'Imparable', 'Racha actual de 5 victorias o más', E.streak >= 5);
  add('wr60', '🎯', 'Efectivo', 'Win rate de 60% o más con 20+ partidas', E.games >= 20 && E.winRate >= 60);
  add('clip1', '🎬', 'Creador de contenido', 'Subir tu primer clip', clipStats.clips >= 1);
  add('clip10', '📹', 'Director', 'Subir 10 clips', clipStats.clips >= 10);
  add('like10', '❤️', 'Viral', 'Tener un clip con 10 likes o más', clipStats.best >= 10);
  add('like50', '💎', 'Estrella', 'Recibir 50 likes en total', clipStats.likes >= 50);
  add('com10', '💬', 'Comentarista', 'Escribir 10 comentarios', clipStats.comments >= 10);
  return L;
}

// ---------- manejador ----------
async function handleSite(req, res, url, { json, fail, opts }) {
  const p = url.pathname.replace(/\/+$/, '') || '/';
  const ip = req.socket.remoteAddress || '?';

  // --- login con Discord ---
  if (p === '/auth/discord') {
    if (!CLIENT_ID || !CLIENT_SECRET || !SECRET) { fail(res, 500, 'Falta configurar DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET y SESSION_SECRET en el .env.'); return true; }
    const state = crypto.randomBytes(16).toString('hex');
    setCookie(res, 'oauth_state', state, 600);
    const next = url.searchParams.get('next'); // pestaña a la que volver después de iniciar sesión
    if (TABS.includes(next)) setCookie(res, 'oauth_next', next, 600);
    const q = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: `${PUBLIC_URL}/auth/callback`, response_type: 'code', scope: 'identify guilds.members.read', state, prompt: 'none' });
    redirect(res, `https://discord.com/oauth2/authorize?${q}`); return true;
  }
  if (p === '/auth/callback') {
    const code = url.searchParams.get('code'), state = url.searchParams.get('state');
    if (!code || !state || state !== cookies(req).oauth_state) { fail(res, 400, 'Login inválido. Intenta de nuevo.'); return true; }
    try {
      const tr = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: `${PUBLIC_URL}/auth/callback` }),
        signal: AbortSignal.timeout(8000)
      });
      if (!tr.ok) throw new Error('token');
      const tok = await tr.json();
      const H = { Authorization: `Bearer ${tok.access_token}` };
      const u = await (await fetch('https://discord.com/api/v10/users/@me', { headers: H, signal: AbortSignal.timeout(8000) })).json();
      let isStaff = OWNER_IDS.has(u.id), inGuild = false;
      if (GUILD_ID) {
        const mr = await fetch(`https://discord.com/api/v10/users/@me/guilds/${GUILD_ID}/member`, { headers: H, signal: AbortSignal.timeout(8000) });
        if (mr.ok) { inGuild = true; const m = await mr.json(); if ((m.roles || []).some(r => STAFF_ROLE_IDS.includes(r))) isStaff = true; }
      } else inGuild = true;
      if (!inGuild) { redirect(res, '/?login=noserver#clips'); return true; } // solo miembros del servidor pueden votar/subir
      const avatar = u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128` : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(u.id) >> 22n) % 6n)}.png`;
      setCookie(res, 'session', makeToken({ id: u.id, name: u.global_name || u.username, avatar, staff: isStaff, v: 2, exp: Date.now() + 7 * 864e5 }), 7 * 86400);
      setCookie(res, 'oauth_state', '', 0);
      const back = cookies(req).oauth_next; setCookie(res, 'oauth_next', '', 0);
      redirect(res, TABS.includes(back) ? `/#${back}` : '/');
    } catch { fail(res, 502, 'No pude completar el login con Discord.'); }
    return true;
  }
  if (p === '/auth/logout') { setCookie(res, 'session', '', 0); redirect(res, '/'); return true; }
  if (p === '/auth/me') { const s = me(req); json(res, 200, { user: s ? { id: s.id, name: s.name, avatar: s.avatar, staff: !!s.staff, banned: isBanned(s.id) } : null, loginReady: !!(CLIENT_ID && CLIENT_SECRET && SECRET) }); return true; }

  if (p === '/api/site/stream') {
    ensureWatch(opts);
    if (sseClients.size >= 200) { fail(res, 503, 'Demasiadas conexiones en vivo.'); return true; }
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return true;
  }
  if (p === '/api/site/games') { ensureWatch(opts); json(res, 200, gamesData(opts)); return true; }

  // --- ranking público para la web (no pide API_KEY; solo lectura) ---
  if (p === '/api/site/board' && (req.method === 'GET' || req.method === 'HEAD')) {
    const data = bot.getBoards(opts); const boards = data?.boards || [];
    const want = process.env.BOARD_KEY || '';
    const board = (want && boards.find(b => b.key === want)) || boards[0];
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 10));
    const top = board ? board.players.slice(0, limit) : [];
    ensureWatch(opts);
    const liveAv = readJson(SITE_FILE, {}).avatars || {};
    // Solo los primeros 30 piden foto a Discord (evita cientos de peticiones); el resto usa la foto que ya guardó el bot o la de por defecto
    const avatars = await Promise.all(top.map((x, i) => liveAv[x.id]?.a || (i < 30 ? bot.avatarFor(x.id, opts.botToken) : defaultAvatar(x.id))));
    json(res, 200, {
      season: data?.season ?? null, demo: !!opts.demo, total: board ? board.players.length : 0,
      queue: { key: board?.key || null, name: process.env.QUEUE_NAME || 'HardCoRe 4-4' },
      players: top.map((x, i) => ({ position: i + 1, id: x.id, name: x.name, elo: x.elo, wins: x.wins, losses: x.losses, draws: x.draws, games: x.games, winRate: x.games ? Math.round(x.wins / x.games * 1000) / 10 : 0, streak: x.streak, rank: bot.tierFor(x.elo), avatar: avatars[i] }))
    });
    return true;
  }

  // --- datos del bot para la web ---
  if (p === '/api/site') {
    const d = readJson(SITE_FILE, {});
    json(res, 200, {
      invite: d.invite?.url || process.env.FALLBACK_INVITE || 'https://discord.gg/dRGdCbC2M',
      staff: d.staff || [], roleCounts: d.roleCounts || {}, memberCount: d.memberCount || null,
      seasons: d.seasons || [], champions: championsData(opts), updatedAt: d.staffUpdatedAt || null
    });
    return true;
  }

  // --- clips ---
  if (p === '/api/clips' && req.method === 'GET') {
    const s = me(req); const d = readJson(CLIPS_FILE, { clips: [] });
    const q = url.searchParams.get('sort');
    const sort = ['top', 'saved', 'mine'].includes(q) ? q : 'new';
    const all = d.clips.map(c => clipOut(c, s?.id));
    const stats = { clips: all.length, likes: all.reduce((n, c) => n + c.reactions['❤️'], 0), comments: all.reduce((n, c) => n + c.comments, 0) };
    let list = all.slice();
    if (sort === 'saved') list = s ? all.filter(c => c.saved) : [];
    if (sort === 'mine') list = s ? all.filter(c => c.author.id === s.id) : [];
    list.sort(sort === 'top'
      ? (x, y) => y.reactions['❤️'] - x.reactions['❤️'] || y.total - x.total || y.createdAt - x.createdAt
      : (x, y) => y.createdAt - x.createdAt);
    json(res, 200, { clips: list.slice(0, 60), emojis: EMOJIS, stats, maxUploadMB: Math.round(MAX_UPLOAD / 1048576) }); return true;
  }
  if (p === '/api/clips' && req.method === 'POST') {
    const s = me(req); if (!s) { fail(res, 401, 'Inicia sesión con Discord para subir clips.'); return true; }
    if (isBanned(s.id)) { fail(res, 403, 'Estás baneado de los clips. Habla con el staff.'); return true; }
    if (writeLimited('post:' + s.id, 3)) { fail(res, 429, 'Vas muy rápido. Espera un minuto.'); return true; }
    let b; try { b = await body(req); } catch { fail(res, 400, 'Datos inválidos.'); return true; }
    const title = String(b.title || '').trim().slice(0, 80);
    const clip = normalizeClip(b.url);
    if (!title) { fail(res, 400, 'Ponle un título al clip.'); return true; }
    if (!clip) { fail(res, 400, 'Link no válido. Usa YouTube, Streamable, Medal, Twitch o un video de Discord (https).'); return true; }
    const d = readJson(CLIPS_FILE, { clips: [] });
    if (d.clips.some(c => c.url === clip.url)) { fail(res, 409, 'Ese clip ya fue subido.'); return true; }
    const item = { id: crypto.randomBytes(6).toString('hex'), title, ...clip, createdAt: Date.now(), author: { id: s.id, name: s.name, avatar: s.avatar }, reactions: {}, comments: [], saves: [] };
    d.clips.unshift(item); dropFiles(d.clips.slice(500)); d.clips = d.clips.slice(0, 500);
    writeJson(CLIPS_FILE, d);
    json(res, 201, { clip: clipOut(item, s.id) }); return true;
  }
  // subir un archivo de la galería (el cuerpo es el archivo tal cual; el título va en ?title=)
  if (p === '/api/clips/upload' && req.method === 'POST') {
    const s = me(req); if (!s) { req.resume(); fail(res, 401, 'Inicia sesión con Discord para subir clips.'); return true; }
    if (isBanned(s.id)) { req.resume(); fail(res, 403, 'Estás baneado de los clips. Habla con el staff.'); return true; }
    if (writeLimited('post:' + s.id, 3)) { req.resume(); fail(res, 429, 'Vas muy rápido. Espera un minuto.'); return true; }
    const title = String(url.searchParams.get('title') || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 80);
    const len = Number(req.headers['content-length'] || 0);
    if (!title) { req.resume(); fail(res, 400, 'Ponle un título al clip.'); return true; }
    if (len > MAX_UPLOAD) { req.resume(); fail(res, 413, `El archivo pesa demasiado (máximo ${Math.round(MAX_UPLOAD / 1048576)} MB).`); return true; }
    if (uploadsSize() + len > MAX_TOTAL) { req.resume(); fail(res, 507, 'El servidor se quedó sin espacio para clips. Avisa al staff.'); return true; }
    const id = crypto.randomBytes(6).toString('hex');
    let up; try { up = await saveUpload(req, id); } catch (e) {
      fail(res, e.message === 'big' ? 413 : 400, e.message === 'big' ? `El archivo pesa demasiado (máximo ${Math.round(MAX_UPLOAD / 1048576)} MB).` : 'Archivo no válido. Sube un video (mp4, webm, mov) o una imagen (jpg, png, webp, gif).'); return true;
    }
    const kind = ['mp4', 'webm', 'mov'].includes(up.ext) ? 'video' : 'image';
    const item = { id, title, url: `/media/${up.file}`, embed: `/media/${up.file}`, kind, file: up.file, size: up.size, createdAt: Date.now(), author: { id: s.id, name: s.name, avatar: s.avatar }, reactions: {}, comments: [], saves: [] };
    const d = readJson(CLIPS_FILE, { clips: [] });
    d.clips.unshift(item); dropFiles(d.clips.slice(500)); d.clips = d.clips.slice(0, 500);
    writeJson(CLIPS_FILE, d);
    json(res, 201, { clip: clipOut(item, s.id) }); return true;
  }
  let mm;
  if ((mm = p.match(/^\/media\/([a-f0-9]{12}\.(?:mp4|webm|mov|jpg|png|webp|gif))$/)) && (req.method === 'GET' || req.method === 'HEAD')) { serveMedia(req, res, mm[1]); return true; }
  // perfil público: clips, estadísticas del Elo y logros
  if ((mm = p.match(/^\/api\/profile\/(\d{5,25})$/)) && req.method === 'GET') {
    const s = me(req); const id = mm[1]; const d = readJson(CLIPS_FILE, { clips: [] });
    const mine = d.clips.filter(c => c.author.id === id);
    let user = mine[0]?.author, comments = 0;
    for (const c of d.clips) for (const x of c.comments || []) if (x.author.id === id) { comments++; user = user || x.author; }
    const elo = eloOf(opts, id);
    if (!user && elo) {
      const liveAv = readJson(SITE_FILE, {}).avatars || {};
      user = { id, name: elo.name, avatar: liveAv[id]?.a || defaultAvatar(id) };
    }
    if (!user && s?.id === id) user = { id, name: s.name, avatar: s.avatar };
    if (!user) { fail(res, 404, 'No encontré a esta persona: todavía no jugó en el Elo ni publicó nada.'); return true; }
    const st = (readJson(SITE_FILE, {}).staff || []).find(x => x.id === id);
    const role = st ? (st.roles?.[0]?.label || 'Staff') : OWNER_IDS.has(id) ? 'Staff' : null;
    const out = mine.map(c => clipOut(c, s?.id)).sort((a, b) => b.createdAt - a.createdAt);
    const stats = { clips: out.length, likes: out.reduce((n, c) => n + c.reactions['❤️'], 0), comments, saves: out.reduce((n, c) => n + c.saves, 0) };
    const best = out.reduce((n, c) => Math.max(n, c.reactions['❤️']), 0);
    const { name: _n, ...eloOut } = elo || {};
    json(res, 200, { user: { ...user, role, banned: isBanned(id) }, stats, elo: elo ? eloOut : null, achievements: achievementsOf(id, elo, { ...stats, best }), clips: out, me: s?.id === id }); return true;
  }
  let m;
  if ((m = p.match(/^\/api\/clips\/([a-f0-9]{12})\/react$/)) && req.method === 'POST') {
    const s = me(req); if (!s) { fail(res, 401, 'Inicia sesión con Discord para reaccionar.'); return true; }
    if (isBanned(s.id)) { fail(res, 403, 'Estás baneado de los clips. Habla con el staff.'); return true; }
    if (writeLimited('react:' + s.id, 60)) { fail(res, 429, 'Demasiado rápido.'); return true; }
    let b; try { b = await body(req); } catch { fail(res, 400, 'Datos inválidos.'); return true; }
    if (!EMOJIS.includes(b.emoji)) { fail(res, 400, 'Emoji no permitido.'); return true; }
    const d = readJson(CLIPS_FILE, { clips: [] }); const c = d.clips.find(x => x.id === m[1]);
    if (!c) { fail(res, 404, 'Ese clip no existe.'); return true; }
    const arr = c.reactions[b.emoji] = c.reactions[b.emoji] || [];
    const i = arr.indexOf(s.id); if (i >= 0) arr.splice(i, 1); else arr.push(s.id);
    writeJson(CLIPS_FILE, d);
    json(res, 200, { clip: clipOut(c, s.id) }); return true;
  }
  if ((m = p.match(/^\/api\/clips\/([a-f0-9]{12})\/save$/)) && req.method === 'POST') {
    const s = me(req); if (!s) { fail(res, 401, 'Inicia sesión con Discord para guardar clips.'); return true; }
    if (isBanned(s.id)) { fail(res, 403, 'Estás baneado de los clips. Habla con el staff.'); return true; }
    if (writeLimited('save:' + s.id, 60)) { fail(res, 429, 'Demasiado rápido.'); return true; }
    const d = readJson(CLIPS_FILE, { clips: [] }); const c = d.clips.find(x => x.id === m[1]);
    if (!c) { fail(res, 404, 'Ese clip no existe.'); return true; }
    c.saves = c.saves || [];
    const i = c.saves.indexOf(s.id); if (i >= 0) c.saves.splice(i, 1); else c.saves.push(s.id);
    writeJson(CLIPS_FILE, d);
    json(res, 200, { clip: clipOut(c, s.id) }); return true;
  }
  // --- comentarios ---
  const cm = p.match(/^\/api\/clips\/([a-f0-9]{12})\/comments$/);
  if (cm && req.method === 'GET') {
    const s = me(req); const c = readJson(CLIPS_FILE, { clips: [] }).clips.find(x => x.id === cm[1]);
    if (!c) { fail(res, 404, 'Ese clip no existe.'); return true; }
    json(res, 200, { comments: (c.comments || []).slice(-100).map(x => commentOut(x, s)) }); return true;
  }
  if (cm && req.method === 'POST') {
    const s = me(req); if (!s) { fail(res, 401, 'Inicia sesión con Discord para comentar.'); return true; }
    if (isBanned(s.id)) { fail(res, 403, 'Estás baneado de los clips. Habla con el staff.'); return true; }
    if (writeLimited('comment:' + s.id, 10)) { fail(res, 429, 'Vas muy rápido. Espera un minuto.'); return true; }
    let b; try { b = await body(req); } catch { fail(res, 400, 'Datos inválidos.'); return true; }
    const text = String(b.text || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, 300);
    if (!text) { fail(res, 400, 'Escribe algo para comentar.'); return true; }
    const d = readJson(CLIPS_FILE, { clips: [] }); const c = d.clips.find(x => x.id === cm[1]); // se lee DESPUÉS de esperar el body
    if (!c) { fail(res, 404, 'Ese clip no existe.'); return true; }
    c.comments = c.comments || [];
    if (c.comments.length >= 300) { fail(res, 400, 'Este clip ya tiene el máximo de comentarios.'); return true; }
    const item = { id: crypto.randomBytes(4).toString('hex'), text, createdAt: Date.now(), author: { id: s.id, name: s.name, avatar: s.avatar } };
    c.comments.push(item); writeJson(CLIPS_FILE, d);
    json(res, 201, { comment: commentOut(item, s), count: c.comments.length }); return true;
  }
  if ((m = p.match(/^\/api\/clips\/([a-f0-9]{12})\/comments\/([a-f0-9]{8})$/)) && req.method === 'DELETE') {
    const s = me(req); if (!s) { fail(res, 401, 'Inicia sesión.'); return true; }
    const d = readJson(CLIPS_FILE, { clips: [] }); const c = d.clips.find(x => x.id === m[1]);
    const x = c && (c.comments || []).find(y => y.id === m[2]);
    if (!x) { fail(res, 404, 'Ese comentario no existe.'); return true; }
    if (x.author.id !== s.id && !s.staff) { fail(res, 403, 'Solo el autor o el staff puede borrarlo.'); return true; }
    c.comments = c.comments.filter(y => y.id !== x.id); writeJson(CLIPS_FILE, d);
    json(res, 200, { ok: true, count: c.comments.length }); return true;
  }
  if ((m = p.match(/^\/api\/clips\/([a-f0-9]{12})$/)) && req.method === 'DELETE') {
    const s = me(req); if (!s) { fail(res, 401, 'Inicia sesión.'); return true; }
    const d = readJson(CLIPS_FILE, { clips: [] }); const c = d.clips.find(x => x.id === m[1]);
    if (!c) { fail(res, 404, 'Ese clip no existe.'); return true; }
    if (c.author.id !== s.id && !s.staff) { fail(res, 403, 'Solo el autor o el staff puede borrarlo.'); return true; }
    d.clips = d.clips.filter(x => x.id !== c.id); writeJson(CLIPS_FILE, d); dropFiles([c]);
    json(res, 200, { ok: true }); return true;
  }
  // --- moderación (solo staff: Creador, Administrador, Elo Admin y Ayudante) ---
  if (p === '/api/mod/bans' && req.method === 'GET') {
    const s = me(req); if (!s?.staff) { fail(res, 403, 'Solo el staff.'); return true; }
    const list = Object.entries(readBans()).map(([id, b]) => ({ id, ...b })).sort((a, b) => b.at - a.at);
    json(res, 200, { bans: list }); return true;
  }
  if (p === '/api/mod/ban' && req.method === 'POST') {
    const s = me(req); if (!s?.staff) { fail(res, 403, 'Solo el staff puede banear.'); return true; }
    if (writeLimited('ban:' + s.id, 20)) { fail(res, 429, 'Demasiado rápido.'); return true; }
    let b; try { b = await body(req); } catch { fail(res, 400, 'Datos inválidos.'); return true; }
    const id = String(b.id || '');
    if (!/^\d{5,25}$/.test(id)) { fail(res, 400, 'Usuario inválido.'); return true; }
    if (id === s.id) { fail(res, 400, 'No puedes banearte a ti mismo.'); return true; }
    const staffIds = new Set((readJson(SITE_FILE, {}).staff || []).map(x => x.id));
    if (OWNER_IDS.has(id) || staffIds.has(id)) { fail(res, 403, 'No se puede banear a alguien del staff.'); return true; }
    const d = readJson(CLIPS_FILE, { clips: [] });
    let who = null;
    for (const c of d.clips) { if (c.author.id === id) who = c.author; for (const x of c.comments || []) if (x.author.id === id) who = who || x.author; }
    const bans = readBans();
    bans[id] = { name: who?.name || String(b.name || 'Usuario').slice(0, 40), avatar: who?.avatar || '', reason: String(b.reason || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 120), by: { id: s.id, name: s.name }, at: Date.now() };
    writeJson(BANS_FILE, { bans });
    // limpiar todo lo suyo: clips, comentarios, likes y guardados
    dropFiles(d.clips.filter(c => c.author.id === id));
    d.clips = d.clips.filter(c => c.author.id !== id);
    for (const c of d.clips) {
      c.comments = (c.comments || []).filter(x => x.author.id !== id);
      c.saves = (c.saves || []).filter(x => x !== id);
      for (const e of Object.keys(c.reactions || {})) c.reactions[e] = c.reactions[e].filter(x => x !== id);
    }
    writeJson(CLIPS_FILE, d);
    json(res, 200, { ok: true, ban: { id, ...bans[id] } }); return true;
  }
  if ((m = p.match(/^\/api\/mod\/ban\/(\d{5,25})$/)) && req.method === 'DELETE') {
    const s = me(req); if (!s?.staff) { fail(res, 403, 'Solo el staff.'); return true; }
    const bans = readBans(); delete bans[m[1]]; writeJson(BANS_FILE, { bans });
    json(res, 200, { ok: true }); return true;
  }
  return false;
}

module.exports = { handleSite };