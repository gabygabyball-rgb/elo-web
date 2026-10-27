'use strict';
/**
 * API del Elo, independiente de la página web. Sin dependencias (Node 18+).
 *   node elo-api/server.js
 * Solo lee data/db.json del bot. Documentación en README.md
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
require('./lib/env').loadEnv();
const { handleV1 } = require('./lib/api');
const { handleSite } = require('./lib/site');

const PORT = Number(process.env.API_PORT || process.env.PORT || 4000);
const GUILD_ID = process.env.GUILD_ID || '';
const BOT_TOKEN = process.env.DISCORD_TOKEN || '';
const DB_PATH = path.resolve(__dirname, process.env.BOT_DB_PATH || path.join('..', 'data', 'db.json'));
const DEMO = process.env.DEMO === '1' || !fs.existsSync(DB_PATH);

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
const fail = (res, status, error) => json(res, status, { error });

// Sirve la web ya compilada (carpeta web/dist) desde el mismo servidor.
const DIST = path.resolve(__dirname, '..', 'web', 'dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json' };
function serveStatic(req, res, url) {
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/') || !fs.existsSync(DIST)) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  let file = path.join(DIST, path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[\/\\])+/, ''));
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': file.includes('assets') ? 'public, max-age=31536000, immutable' : 'no-cache' });
  fs.createReadStream(file).pipe(res);
  return true;
}

const server = http.createServer((req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const url = new URL(req.url, 'http://localhost');
  const ctx = { json, fail, opts: { dbPath: DB_PATH, guildId: GUILD_ID, demo: DEMO, botToken: DEMO ? '' : BOT_TOKEN } };
  if (url.pathname === '/api/export/db') { // el servicio nuevo descarga de aquí el db.json del bot
    const key = process.env.EXPORT_KEY || '', got = String(req.headers['x-export-key'] || '');
    const ok = key.length >= 16 && got.length === key.length && require('crypto').timingSafeEqual(Buffer.from(got), Buffer.from(key));
    if (!ok) return fail(res, 403, 'No autorizado.');
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return fs.createReadStream(DB_PATH).on('error', () => res.end('{}')).pipe(res);
  }
  handleSite(req, res, url, ctx)
    .then(done => done || serveStatic(req, res, url) || handleV1(req, res, url, ctx).then(h => h || fail(res, 404, 'Ruta desconocida.')))
    .catch(e => { console.error('[api]', e); if (!res.headersSent) fail(res, 500, 'Algo falló en el servidor.'); else res.end(); });
});
server.headersTimeout = 20_000;
server.listen(PORT, () => {
  console.log(`[api] Elo API en http://localhost:${PORT}/api/v1`);
  console.log(`[api] Elo desde: ${DEMO ? 'DATOS DE EJEMPLO (no encontré ' + DB_PATH + ')' : DB_PATH}`);
  if (!process.env.API_KEY) console.log('[api] Aviso: sin API_KEY la API es pública (cualquiera puede leer el ranking).');
});
