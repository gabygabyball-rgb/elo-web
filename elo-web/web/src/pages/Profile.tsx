import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Ban, Bookmark, Film, ShieldCheck } from 'lucide-react';
import SpotlightCard from '@/components/SpotlightCard';
import CountUp from '@/components/CountUp';
import ClipCard, { banUser, hearts, type User_ } from '@/components/ClipCard';
import { api, type Achievement, type Clip, type EloStats, type Profile as ProfileT } from '@/lib/api';

const spot = { '--spotlight-card-surface': 'rgba(10, 8, 40, 0.62)', backdropFilter: 'blur(14px)' } as React.CSSProperties;

/** Perfil estilo TikTok: foto, nombre, cuántos clips subió, likes recibidos y sus videos. Si es el tuyo, también tus guardados. */
export default function Profile({ id, user }: { id: string; user: User_ }) {
  const [data, setData] = useState<ProfileT | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'videos' | 'saved'>('videos');
  const [saved, setSaved] = useState<Clip[] | null>(null);
  const uid = user?.id ?? null;

  const load = useCallback(() => {
    setErr('');
    api.profile(id).then(setData).catch(x => { setData(null); setErr(x.message); });
  }, [id]);
  useEffect(() => { setData(null); setTab('videos'); setSaved(null); load(); }, [load, uid]);
  useEffect(() => { if (tab === 'saved') api.clips('saved').then(d => setSaved(d.clips)).catch(() => setSaved([])); }, [tab]);

  const patchIn = (list: Clip[] | null, next: Clip) => list && list.map(x => (x.id === next.id ? next : x));
  const patch = (next: Clip) => {
    setData(d => d && { ...d, clips: patchIn(d.clips, next)!, stats: { ...d.stats, likes: d.clips.reduce((n, c) => n + hearts(c.id === next.id ? next : c), 0) } });
    setSaved(l => (l ? l.filter(x => x.id !== next.id || next.saved).map(x => (x.id === next.id ? next : x)) : l));
  };
  const removed = (c: Clip) => { setData(d => d && { ...d, clips: d.clips.filter(x => x.id !== c.id), stats: { ...d.stats, clips: d.stats.clips - 1, likes: d.stats.likes - hearts(c) } }); setSaved(l => l && l.filter(x => x.id !== c.id)); };

  const back = <a href="#clips" className="mb-5 inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white"><ArrowLeft size={16} aria-hidden="true" />Volver a Clips</a>;
  if (err) return <section>{back}<p className="glass rounded-2xl px-4 py-10 text-center text-white/70">{err}</p></section>;
  if (!data) return <section>{back}<p className="text-center text-white/50">Cargando perfil…</p></section>;

  const { user: u, stats } = data;
  const list = tab === 'videos' ? data.clips : saved;
  const canBan = !!user?.staff && user.id !== u.id && !u.role;

  return (
    <section>
      {back}
      <SpotlightCard theme="dark" spotlightColor="#4efafa" intensity={0.14} spotlightSize={340} softness={0.9} borderGlow={0.7} proximity={60} ambient className="mb-8 !p-6" style={spot}>
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <img src={u.avatar} alt="" className="h-24 w-24 rounded-full ring-4 ring-[#00b4ff]/60 sm:h-28 sm:w-28" referrerPolicy="no-referrer" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-3xl font-bold">{u.name}</h1>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {u.role && <span className="inline-flex items-center gap-1 rounded bg-amber-400/15 px-2 py-0.5 text-xs font-semibold uppercase text-amber-300"><ShieldCheck size={12} aria-hidden="true" />{u.role}</span>}
              {u.banned && <span className="rounded bg-rose-500/20 px-2 py-0.5 text-xs font-semibold uppercase text-rose-300">Baneado</span>}
              {data.me && <span className="text-xs text-white/50">Este es tu perfil</span>}
            </div>
            {canBan && (
              <button onClick={async () => { if (await banUser(u.id, u.name)) window.location.hash = 'clips'; }} className="mt-3 inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-3 py-1 text-xs text-rose-200 ring-1 ring-rose-400/30 hover:bg-rose-500/25"><Ban size={13} aria-hidden="true" />Banear</button>
            )}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([['Clips', stats.clips, '#8fb4ff'], ['Likes recibidos', stats.likes, '#ff7a9c'], ['Comentarios', stats.comments, '#4efafa'], ['Guardados por otros', stats.saves, '#fbbf24']] as const).map(([label, n, color]) => (
            <div key={label} className="rounded-2xl bg-black/25 px-3 py-3 text-center">
              <CountUp to={n} from={0} mode="roll" easing="expo" duration={1.1} separator="," className="font-display" style={{ fontSize: '1.6rem', fontWeight: 700, color }} />
              <div className="text-xs text-white/60">{label}</div>
            </div>
          ))}
        </div>
      </SpotlightCard>

      <EloTable elo={data.elo ?? null} name={u.name} />
      <Achievements list={data.achievements ?? []} />

      <div className="mb-6 flex items-center justify-center gap-2" role="tablist">
        {([['videos', <Film key="v" size={15} aria-hidden="true" />, 'Videos'], ...(data.me ? [['saved', <Bookmark key="s" size={15} aria-hidden="true" />, 'Guardados']] : [])] as [string, React.ReactNode, string][]).map(([k, icon, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k as 'videos' | 'saved')}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${tab === k ? 'bg-[#00b4ff]/25 text-[#9fe3ff] ring-1 ring-[#00b4ff]/50' : 'bg-black/30 text-white/70 hover:bg-white/10'}`}>{icon}{label}</button>
        ))}
      </div>

      {list === null && <p className="text-center text-white/50">Cargando…</p>}
      {list && list.length === 0 && <p className="text-center text-white/50">{tab === 'saved' ? 'Todavía no guardaste ningún clip.' : data.me ? 'Todavía no subiste clips.' : 'Todavía no ha subido clips.'}</p>}
      {list && list.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(c => <ClipCard key={c.id} clip={c} user={user} onPatch={patch} onRemoved={removed} onBanned={load} />)}
        </div>
      )}
    </section>
  );
}

/** Tabla con las estadísticas del Elo: posición, elo, racha, win rate, ganadas, perdidas... */
function EloTable({ elo, name }: { elo: EloStats | null; name: string }) {
  if (!elo) return <p className="glass mb-8 rounded-2xl px-4 py-5 text-center text-sm text-white/60">{name} todavía no ha jugado partidas del Elo.</p>;
  const rows: [string, React.ReactNode][] = [
    ['Posición', `#${elo.position} de ${elo.total}`],
    ['Elo', <b key="e" className="font-display text-lg">{elo.elo}</b>],
    ['Rango', <span key="r" style={{ color: elo.rank.color }}>{elo.rank.emoji} {elo.rank.name}</span>],
    ['Racha', elo.streak > 0 ? <span key="s" className="text-emerald-300">🔥 {elo.streak} {elo.streak === 1 ? 'victoria' : 'victorias'} seguidas</span> : elo.streak < 0 ? <span key="s" className="text-rose-300">{Math.abs(elo.streak)} {Math.abs(elo.streak) === 1 ? 'derrota' : 'derrotas'} seguidas</span> : '—'],
    ['Win rate', `${elo.winRate}%`],
    ['Partidas ganadas', <span key="w" className="text-emerald-300">{elo.wins}</span>],
    ['Partidas perdidas', <span key="l" className="text-rose-300">{elo.losses}</span>],
    ['Empates', elo.draws],
    ['Partidas jugadas', elo.games]
  ];
  return (
    <div className="glass mb-8 overflow-hidden rounded-2xl">
      <h2 className="border-b border-white/10 px-4 py-3 font-display text-lg font-semibold">Estadísticas del Elo</h2>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-t border-white/5 first:border-0"><th scope="row" className="w-1/2 px-4 py-2.5 text-left font-normal text-white/60">{k}</th><td className="px-4 py-2.5 text-right font-semibold">{v}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="mx-4 mb-4 mt-1 h-2 overflow-hidden rounded-full bg-white/10" title={`${elo.winRate}% de victorias`}><div className="h-full rounded-full bg-gradient-to-r from-[#00b4ff] to-emerald-300" style={{ width: `${Math.min(100, elo.winRate)}%` }} /></div>
    </div>
  );
}

/** Logros: los ganados brillan, los que faltan salen apagados. */
function Achievements({ list }: { list: Achievement[] }) {
  const got = list.filter(a => a.earned).length;
  return (
    <div className="mb-8">
      <h2 className="mb-3 font-display text-lg font-semibold">Logros <span className="text-sm font-normal text-white/50">{got} de {list.length}</span></h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...list].sort((a, b) => Number(b.earned) - Number(a.earned)).map(a => (
          <li key={a.key} className={`glass flex items-center gap-3 rounded-2xl px-3 py-3 ${a.earned ? 'ring-1 ring-amber-300/40' : 'opacity-45 grayscale'}`}>
            <span className="text-3xl" aria-hidden="true">{a.icon}</span>
            <div className="min-w-0"><div className="truncate text-sm font-semibold">{a.name}{!a.earned && <span className="sr-only"> (sin conseguir)</span>}</div><div className="text-xs text-white/60">{a.desc}</div></div>
          </li>
        ))}
      </ul>
    </div>
  );
}