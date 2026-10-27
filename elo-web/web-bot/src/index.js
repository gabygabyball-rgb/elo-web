'use strict';
// Bot de la pagina web. NO juega ni modera: solo mira el servidor y escribe data/site.json.
//  - Staff por rol (con foto) y cuantos hay de cada rol
//  - Fotos y nombres de todos los miembros (para la tabla y las partidas)
//  - Invitacion nueva cada pocas horas (para que el link nunca caduque)
// Todo se actualiza EN VIVO con los eventos de Discord (cambio de foto, de rol, entrada/salida).
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Events } = require('discord.js');

// --- .env sin librerias ---
try {
  for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* sin .env: usa variables del sistema */ }

const TOKEN = process.env.WEB_BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
if (!TOKEN || !GUILD_ID) { console.error('Falta WEB_BOT_TOKEN o GUILD_ID en web-bot/.env'); process.exit(1); }

const SITE_FILE = path.resolve(__dirname, '..', process.env.SITE_FILE || '../data/site.json');
const ROLES = [
  { key: 'creador', label: 'Creador', id: process.env.ROLE_CREADOR || '1563614466812153866' },
  { key: 'administrador', label: 'Administrador', id: process.env.ROLE_ADMIN || '1561128451493077052' },
  { key: 'elo_admin', label: 'Elo Admin', id: process.env.ROLE_ELO_ADMIN || '1561087693960777808' },
  { key: 'ayudante', label: 'Ayudante', id: process.env.ROLE_AYUDANTE || '1561853811247685715' }
];
const INVITE_EVERY = Number(process.env.INVITE_REFRESH_HOURS || 6) * 3600e3;
const INVITE_LIFE = Number(process.env.INVITE_LIFETIME_HOURS || 24) * 3600;
const MAX_AVATARS = 5000;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

// --- archivo compartido: se lee y se mezcla, para no pisar lo que escriban otros (p. ej. las temporadas) ---
const read = () => { try { return JSON.parse(fs.readFileSync(SITE_FILE, 'utf8')); } catch { return {}; } };
function update(patch) {
  const next = { ...read(), ...patch };
  fs.mkdirSync(path.dirname(SITE_FILE), { recursive: true });
  const tmp = SITE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next));
  fs.renameSync(tmp, SITE_FILE); // atomico: la API nunca lee el archivo a medias
}

const avatarOf = m => m.displayAvatarURL({ extension: 'png', size: 128 });

async function syncMembers(guild, refetch = true) {
  if (refetch) await guild.members.fetch(); // los eventos ya mantienen la lista al dia; el fetch completo es solo de respaldo
  const staff = [], counts = {}, avatars = {};
  for (const r of ROLES) {
    const role = guild.roles.cache.get(r.id);
    counts[r.key] = role?.members.size ?? 0;
    // Diagnostico: dice si el rol existe y cuantos lo tienen
    console.log(role
      ? `[web-bot] Rol ${r.label}: "${role.name}" -> ${counts[r.key]} miembro(s)`
      : `[web-bot] ATENCION: el rol ${r.label} (ID ${r.id}) NO existe en este servidor. Revisa la ID en web-bot/.env`);
  }
  let n = 0;
  for (const m of guild.members.cache.values()) {
    if (m.user.bot) continue;
    if (n++ < MAX_AVATARS) avatars[m.id] = { n: m.displayName, a: avatarOf(m) };
    const mine = ROLES.filter(r => m.roles.cache.has(r.id));
    if (mine.length) staff.push({ id: m.id, name: m.displayName, username: m.user.username, avatar: avatarOf(m), roles: mine.map(r => ({ key: r.key, label: r.label })) });
  }
  const rank = s => Math.min(...s.roles.map(x => ROLES.findIndex(r => r.key === x.key)));
  staff.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  update({ staff, roleCounts: counts, avatars, memberCount: guild.memberCount, staffUpdatedAt: Date.now() });
  console.log(`[web-bot] Sincronizado: ${staff.length} del staff, ${Object.keys(avatars).length} fotos.`);
}

async function refreshInvite(guild) {
  const me = guild.members.me;
  const channel = guild.rulesChannel
    || guild.channels.cache.find(c => c.isTextBased() && !c.isThread() && c.permissionsFor(me)?.has('CreateInstantInvite'));
  if (!channel) return console.error('[web-bot] No hay un canal donde pueda crear invitaciones (permiso "Crear invitacion").');
  try {
    const inv = await channel.createInvite({ maxAge: INVITE_LIFE, maxUses: 0, unique: true, reason: 'Link nuevo para la pagina web' });
    update({ invite: { url: inv.url, createdAt: Date.now(), expiresAt: Date.now() + INVITE_LIFE * 1000 } });
    console.log('[web-bot] Invitacion renovada:', inv.url);
  } catch (e) { console.error('[web-bot] No pude crear la invitacion:', e.message); }
}

client.once(Events.ClientReady, async c => {
  console.log(`[web-bot] Conectado como ${c.user.tag}`);
  const guild = await c.guilds.fetch(GUILD_ID).catch(() => null);
  if (!guild) { console.error('[web-bot] No estoy en ese servidor. Invita al bot y revisa GUILD_ID.'); process.exit(1); }
  const G = () => c.guilds.cache.get(GUILD_ID);
  const full = (refetch = true) => syncMembers(G(), refetch).catch(e => console.error('[web-bot] Error sincronizando:', e.message));
  await full(true);
  await refreshInvite(G());
  setInterval(() => refreshInvite(G()), INVITE_EVERY);
  setInterval(() => full(true), 10 * 60 * 1000); // respaldo por si se pierde algun evento

  // En vivo, con antirrebote (si cambian 20 cosas juntas, escribe una sola vez)
  let t = null;
  const soon = () => { clearTimeout(t); t = setTimeout(() => full(false), 1500); };
  c.on(Events.GuildMemberUpdate, (o, n) => { if (o.avatar !== n.avatar || o.nickname !== n.nickname || o.roles.cache.size !== n.roles.cache.size || o.user.avatar !== n.user.avatar) soon(); });
  c.on(Events.UserUpdate, (o, n) => { if (o.avatar !== n.avatar || o.username !== n.username || o.globalName !== n.globalName) soon(); });
  c.on(Events.GuildMemberAdd, soon);
  c.on(Events.GuildMemberRemove, soon);
  c.on(Events.GuildRoleUpdate, soon);
  c.on(Events.GuildRoleDelete, soon);
});

client.on(Events.Error, e => console.error('[web-bot] Error:', e.message));
process.on('unhandledRejection', e => console.error('[web-bot] Promesa rechazada:', e?.message || e));
client.login(TOKEN).catch(e => { console.error('[web-bot] No pude iniciar sesion (revisa WEB_BOT_TOKEN):', e.message); process.exit(1); });