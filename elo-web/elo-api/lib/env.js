'use strict';
// Lector mínimo de archivos .env (sin dependencias). No pisa variables que
// ya estén definidas en el entorno. Lee primero web/.env y luego el .env del
// bot (así reutiliza CLIENT_ID, OWNER_ID y DISCORD_TOKEN si ya los tienes).
const fs = require('fs');
const path = require('path');

function parse(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

function loadEnv() {
  const files = [path.join(__dirname, '..', '.env'), path.join(__dirname, '..', '..', '.env')];
  for (const f of files) {
    try {
      const vars = parse(fs.readFileSync(f, 'utf8'));
      for (const [k, v] of Object.entries(vars)) if (process.env[k] === undefined) process.env[k] = v;
    } catch { /* no existe: ok */ }
  }
}

module.exports = { loadEnv };
