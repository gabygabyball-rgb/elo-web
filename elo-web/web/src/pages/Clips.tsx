import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Bookmark, Film, Heart, Home, Link2, Play, ShieldCheck, Upload, User } from 'lucide-react';
import SpotlightCard from '@/components/SpotlightCard';
import GlassIcons from '@/components/GlassIcons';
import CountUp from '@/components/CountUp';
import ClipCard, { hearts, timeAgo, type User_ } from '@/components/ClipCard';
import { LoginButton } from '@/components/UserBubble';
import { api, type Ban as BanT, type Clip, type ClipSort, type ClipStats } from '@/lib/api';

const YELLOW = 'linear-gradient(135deg, hsl(50, 100%, 64%), hsl(42, 96%, 48%))';
const FILTERS: { id: ClipSort; label: string; color: string; icon: ReactNode; needsLogin?: boolean }[] = [
  { id: 'new', label: 'Nuevos', color: 'green', icon: <Home /> },
  { id: 'top', label: 'Más likes', color: 'red', icon: <Heart /> },
  { id: 'saved', label: 'Guardados', color: YELLOW, icon: <Bookmark />, needsLogin: true },
  { id: 'mine', label: 'Mis clips', color: 'blue', icon: <User />, needsLogin: true }
];
const spot = { '--spotlight-card-surface': 'rgba(10, 8, 40, 0.62)', backdropFilter: 'blur(14px)' } as React.CSSProperties;
const input = 'rounded-xl bg-black/30 px-3 py-2.5 text-sm outline-none ring-1 ring-white/10 focus:ring-[#00b4ff]';

export default function Clips({ user, loginReady }: { user: User_; loginReady: boolean }) {
  const [sort, setSort] = useState<ClipSort>('new');
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [stats, setStats] = useState<ClipStats | null>(null);
  const [maxMB, setMaxMB] = useState(90);
  const uid = user?.id ?? null;

  const load = useCallback(() => {
    api.clips(sort).then(d => { setClips(d.clips); setStats(d.stats); if (d.maxUploadMB) setMaxMB(d.maxUploadMB); }).catch(() => setClips([]));
  }, [sort]);
  useEffect(() => { setClips(null); load(); }, [load, uid]);

  // Cambia un clip en la lista y mantiene al día los contadores de arriba
  const patch = (next: Clip) => {
    setClips(list => {
      if (!list) return list;
      const old = list.find(x => x.id === next.id);
      if (old) setStats(s => s && { ...s, likes: s.likes + hearts(next) - hearts(old), comments: s.comments + next.comments - old.comments });
      if (sort === 'saved' && !next.saved) return list.filter(x => x.id !== next.id);
      return list.map(x => (x.id === next.id ? next : x));
    });
  };
  const removed = (c: Clip) => {
    setClips(list => list && list.filter(x => x.id !== c.id));
    setStats(s => s && { clips: s.clips - 1, likes: s.likes - hearts(c), comments: s.comments - c.comments });
  };
  const uploaded = () => { if (sort !== 'new') setSort('new'); else load(); };

  const items = FILTERS.map(f => ({
    id: f.id, label: f.label, icon: f.icon,
    color: f.color,
    className: sort === f.id ? 'is-active' : '',
    onClick: () => setSort(f.id)
  }));
  const needsLogin = !user && FILTERS.find(f => f.id === sort)?.needsLogin;

  return (
    <section>
      <h1 className="mb-1 flex items-center gap-2 font-display text-3xl font-bold"><Play className="text-rose-300" size={26} />Clips de la comunidad</h1>
      <p className="mb-6 text-sm text-white/60">Sube tus mejores jugadas, dales like, guárdalas y coméntalas. Toca el nombre de alguien para ver su perfil.</p>

      {stats && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          {([['Clips', stats.clips, '#8fb4ff'], ['Likes', stats.likes, '#ff7a9c'], ['Comentarios', stats.comments, '#4efafa']] as const).map(([label, n, color]) => (
            <div key={label} className="glass rounded-2xl px-3 py-3 text-center">
              <CountUp to={n} from={0} mode="roll" easing="expo" duration={1.2} separator="," className="font-display" style={{ fontSize: '1.7rem', fontWeight: 700, color }} />
              <div className="text-xs text-white/60">{label}</div>
            </div>
          ))}
        </div>
      )}

      <UploadCard user={user} loginReady={loginReady} maxMB={maxMB} onDone={uploaded} />

      <div className="mb-8 pb-8">
        <GlassIcons items={items} size={52} gap={26} columns={4} plate="circle" spread={0.45} hover="lift" labels="always" iconColor="#ffffff" />
      </div>

      {user?.staff && <ModPanel />}

      {needsLogin && (
        <div className="glass mb-6 flex flex-col items-center gap-3 rounded-2xl px-4 py-8 text-center">
          <p className="text-sm text-white/70">Inicia sesión con Discord para ver tus {sort === 'saved' ? 'clips guardados' : 'clips'}.</p>
          {loginReady && <LoginButton next="clips" />}
        </div>
      )}
      {!needsLogin && clips === null && <p className="text-center text-white/50">Cargando…</p>}
      {!needsLogin && clips && clips.length === 0 && (
        <p className="text-center text-white/50">{sort === 'saved' ? 'Todavía no guardaste ningún clip.' : sort === 'mine' ? 'Todavía no subiste clips.' : 'Aún no hay clips. ¡Sube el primero!'}</p>
      )}
      {!needsLogin && clips && clips.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {clips.map(c => <ClipCard key={c.id} clip={c} user={user} onPatch={patch} onRemoved={removed} onBanned={load} />)}
        </div>
      )}
    </section>
  );
}

/** Subir un clip: pegando un link o eligiendo un video/foto de la galería. */
function UploadCard({ user, loginReady, maxMB, onDone }: { user: User_; loginReady: boolean; maxMB: number; onDone: () => void }) {
  const [mode, setMode] = useState<'link' | 'file'>('file');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const pick = useRef<HTMLInputElement>(null);

  const choose = (f: File | null) => {
    setErr(''); setOk('');
    if (f && f.size > maxMB * 1048576) { setErr(`Ese archivo pesa ${(f.size / 1048576).toFixed(0)} MB y el máximo es ${maxMB} MB. Recórtalo o súbelo a YouTube/Streamable y pega el link.`); return; }
    setFile(f);
    if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, '').slice(0, 80));
  };

  const submit = async () => {
    if (busy) return;
    setErr(''); setOk('');
    if (!title.trim()) { setErr('Ponle un título al clip.'); return; }
    if (mode === 'link' && !url.trim()) { setErr('Pega el link del clip.'); return; }
    if (mode === 'file' && !file) { setErr('Elige un video o una foto de tu galería.'); return; }
    setBusy(true); setPct(0);
    try {
      if (mode === 'link') await api.addClip(title.trim(), url.trim());
      else await api.uploadClip(file!, title.trim(), setPct);
      setTitle(''); setUrl(''); setFile(null); if (pick.current) pick.current.value = '';
      setOk('¡Clip subido!'); onDone();
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };

  const tab = (m: 'link' | 'file', icon: ReactNode, label: string) => (
    <button type="button" onClick={() => { setMode(m); setErr(''); }} aria-pressed={mode === m}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${mode === m ? 'bg-[#00b4ff]/25 text-[#9fe3ff] ring-1 ring-[#00b4ff]/50' : 'bg-black/30 text-white/70 hover:bg-white/10'}`}>{icon}{label}</button>
  );

  return (
    <SpotlightCard theme="dark" spotlightColor="#4efafa" intensity={0.14} spotlightSize={320} softness={0.9} borderGlow={0.7} proximity={60} ambient className="mb-8 !p-5" style={spot}>
      {user?.banned ? (
        <p className="py-3 text-center text-sm text-rose-300">Estás baneado de los clips. Si crees que fue un error, habla con el staff en Discord.</p>
      ) : user ? (
        <form onSubmit={e => { e.preventDefault(); submit(); }} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {tab('file', <Film size={15} aria-hidden="true" />, 'Desde mi galería')}
            {tab('link', <Link2 size={15} aria-hidden="true" />, 'Pegar un link')}
          </div>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} placeholder="Título del clip" aria-label="Título del clip" className={input} />
          {mode === 'link' ? (
            <input value={url} onChange={e => setUrl(e.target.value)} type="url" placeholder="Link (YouTube, Streamable, Medal, Twitch, HaxBall o video de Discord)" aria-label="Link del clip" className={input} />
          ) : (
            <div>
              <input ref={pick} type="file" accept="video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp,image/gif" className="sr-only" aria-label="Elegir archivo"
                onChange={e => choose(e.target.files?.[0] ?? null)} />
              <button type="button" onClick={() => pick.current?.click()}
                onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); choose(e.dataTransfer.files?.[0] ?? null); }}
                className="flex w-full flex-col items-center gap-1 rounded-xl border border-dashed border-white/25 bg-black/20 px-4 py-6 text-sm text-white/75 transition hover:border-[#4efafa]/60 hover:bg-black/30">
                <Upload size={22} aria-hidden="true" />
                {file ? <span className="font-semibold text-white">{file.name} · {(file.size / 1048576).toFixed(1)} MB</span> : <span className="font-semibold">Toca para elegir un video o foto</span>}
                <span className="text-xs text-white/50">mp4, webm, mov, jpg, png, webp o gif · máximo {maxMB} MB (también puedes arrastrarlo aquí)</span>
              </button>
            </div>
          )}
          {busy && mode === 'file' && (
            <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-[#00b4ff] to-[#4efafa] transition-[width]" style={{ width: `${pct}%` }} />
            </div>
          )}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#5865f2] to-[#00b4ff] px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60">
              <Upload size={16} aria-hidden="true" />{busy ? (mode === 'file' ? `Subiendo… ${pct}%` : 'Subiendo…') : 'Publicar clip'}
            </button>
            {err && <p role="alert" className="text-sm text-rose-300">{err}</p>}
            {ok && <p role="status" className="text-sm text-emerald-300">{ok}</p>}
          </div>
        </form>
      ) : (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <p className="font-display text-lg font-semibold">Inicia sesión para subir clips, dar like y comentar</p>
          {loginReady
            ? <LoginButton next="clips" size="lg" />
            : <p className="max-w-md text-sm text-white/60">El login con Discord todavía no está activado en el servidor. Sigue la guía <b>LEEME-LOGIN-Y-PUBLICAR.txt</b> para activarlo.</p>}
          <p className="text-xs text-white/40">Solo pueden entrar los miembros del servidor de Discord.</p>
        </div>
      )}
    </SpotlightCard>
  );
}

// Panel del staff: lista de baneados con botón para desbanear
function ModPanel() {
  const [open, setOpen] = useState(false);
  const [bans, setBans] = useState<BanT[] | null>(null);
  const load = useCallback(() => { api.bans().then(d => setBans(d.bans)).catch(() => setBans([])); }, []);
  useEffect(() => { if (open) load(); }, [open, load]);
  return (
    <div className="glass mb-6 rounded-2xl px-4 py-3">
      <button onClick={() => setOpen(v => !v)} aria-expanded={open} className="flex w-full items-center gap-2 text-left text-sm font-semibold text-emerald-200">
        <ShieldCheck size={16} aria-hidden="true" />Moderación (solo staff)<span className="ml-auto text-xs font-normal text-white/50">{open ? 'Ocultar' : 'Ver baneados'}</span>
      </button>
      {open && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-white/50">Para banear usa el botón rojo «Banear» en cualquier clip, comentario o perfil. Para borrar una publicación usa «Borrar» en el clip.</p>
          {bans === null && <p className="text-sm text-white/50">Cargando…</p>}
          {bans && bans.length === 0 && <p className="text-sm text-white/50">No hay usuarios baneados.</p>}
          {bans && bans.length > 0 && (
            <ul className="space-y-2">
              {bans.map(b => (
                <li key={b.id} className="flex items-center gap-2.5 text-sm">
                  {b.avatar && <img src={b.avatar} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />}
                  <div className="min-w-0 flex-1"><span className="font-semibold">{b.name}</span><span className="ml-2 text-xs text-white/50">por {b.by.name} · {timeAgo(b.at)}{b.reason ? ` · ${b.reason}` : ''}</span></div>
                  <button onClick={async () => { await api.unban(b.id).catch(() => {}); load(); }} className="rounded-full bg-white/10 px-3 py-1 text-xs hover:bg-white/20">Desbanear</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}