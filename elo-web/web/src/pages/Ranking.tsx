import { useEffect, useMemo, useState } from 'react';
import { LocateFixed, Search, Trophy, X } from 'lucide-react';
import type { Board, Games, Me, Player, SiteInfo } from '@/lib/api';
import GamesSection from '@/components/Games';
import StatsBar from '@/components/StatsBar';

const PAGE = 50;
const STORE = 'haxcore:me';
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// El jugador elegido se recuerda en este navegador (si el navegador no deja guardar, simplemente no se recuerda)
const readMe = (): string | null => { try { return localStorage.getItem(STORE); } catch { return null; } };
const saveMe = (id: string | null) => { try { if (id) localStorage.setItem(STORE, id); else localStorage.removeItem(STORE); } catch { /* sin almacenamiento */ } };

type Props = { board: Board | null; site: SiteInfo | null; games: Games | null; live: boolean; user: Me['user']; loginReady: boolean };

export default function Ranking({ board, site, games, live, user, loginReady }: Props) {
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [meId, setMeId] = useState<string | null>(readMe);
  const [picking, setPicking] = useState(false);
  const [pickQuery, setPickQuery] = useState('');

  const all = board?.players ?? [];
  const mineId = user?.id ?? meId; // si entró con Discord se usa su cuenta; si no, el jugador que eligió
  const mine = all.find(p => p.id === mineId) ?? null;
  const q = norm(query.trim());
  const filtered = useMemo(() => (q ? all.filter(p => norm(p.name).includes(q)) : all), [all, q]);
  const rows = q ? filtered : filtered.slice(0, shown);
  const pq = norm(pickQuery.trim());
  const matches = useMemo(() => (pq ? all.filter(p => norm(p.name).includes(pq)).slice(0, 6) : []), [all, pq]);

  // Lleva la pantalla a la fila del jugador y la resalta (espera a que la lista se haya expandido)
  useEffect(() => {
    if (!focusId) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`row-${focusId}`);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setFlashId(focusId); }
      setFocusId(null);
    }, 80);
    return () => clearTimeout(t);
  }, [focusId]);
  useEffect(() => {
    if (!flashId) return;
    const t = setTimeout(() => setFlashId(null), 2600);
    return () => clearTimeout(t);
  }, [flashId]);

  const reveal = (p: Player) => {
    setQuery('');
    setShown(s => Math.max(s, p.position));
    setFlashId(null);
    setFocusId(p.id);
  };

  const goToMe = () => {
    setNotice('');
    if (!mineId) { setPicking(v => !v); return; } // primera vez: pide elegir quién eres, sin salir de la página
    if (!mine) { setNotice('Todavía no apareces en el ranking. ¡Juega tu primera partida!'); return; }
    setPicking(false);
    reveal(mine);
  };

  const choose = (p: Player) => {
    saveMe(p.id); setMeId(p.id); setPicking(false); setPickQuery(''); setNotice('');
    reveal(p);
  };
  const change = () => { saveMe(null); setMeId(null); setPickQuery(''); setPicking(true); };

  return (
    <div className="space-y-14">
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-display text-3xl font-bold"><Trophy className="text-amber-300" size={26} />Ranking</h1>
            <p className="mt-1 text-sm text-white/60">{board?.queue.name ?? 'HardCoRe 4-4'}{board?.season ? ` · Temporada ${board.season}` : ''}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-white/50"><span className={`h-2 w-2 rounded-full ${live ? 'animate-pulse bg-emerald-400' : 'bg-white/30'}`} />{live ? 'En vivo' : 'Reconectando…'}</span>
        </div>

        <div className="mb-5"><StatsBar site={site} board={board} /></div>

        <div className="mb-3 flex flex-col gap-3 sm:flex-row">
          <label className="glass flex flex-1 items-center gap-2 rounded-xl px-3 focus-within:ring-1 focus-within:ring-[#00b4ff]">
            <Search size={18} className="text-white/50" aria-hidden="true" />
            <input
              value={query} onChange={e => { setQuery(e.target.value); setNotice(''); }}
              placeholder="Buscar jugador en el Elo…" aria-label="Buscar jugador"
              className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-white/40"
            />
            {query && <button onClick={() => setQuery('')} aria-label="Borrar búsqueda" className="rounded p-1 text-white/50 hover:text-white"><X size={16} /></button>}
          </label>
          <button onClick={goToMe} aria-expanded={picking} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00b4ff] px-5 py-3 text-sm font-semibold text-[#02010a] transition hover:brightness-110">
            <LocateFixed size={18} aria-hidden="true" />Mi posición
          </button>
        </div>

        {picking && (
          <div className="glass mb-3 rounded-2xl p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">¿Cuál eres tú? Escribe tu nombre del Elo</p>
              <button onClick={() => setPicking(false)} aria-label="Cerrar" className="rounded p-1 text-white/50 hover:text-white"><X size={16} /></button>
            </div>
            <input
              autoFocus value={pickQuery} onChange={e => setPickQuery(e.target.value)} placeholder="Tu nombre…" aria-label="Tu nombre en el Elo"
              className="w-full rounded-lg bg-black/30 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-[#00b4ff]"
            />
            {pq && matches.length === 0 && <p className="mt-2 text-sm text-white/50">No encontré a nadie con ese nombre.</p>}
            {matches.length > 0 && (
              <ul className="mt-2 space-y-1">
                {matches.map(p => (
                  <li key={p.id}>
                    <button onClick={() => choose(p)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-white/10">
                      <img src={p.avatar} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
                      <span className="flex-1 truncate font-medium">{p.name}</span>
                      <span className="text-xs text-white/50">#{p.position} · {p.elo} Elo</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-white/40">Se recuerda en este navegador, la próxima vez el botón te lleva directo.{loginReady && <> También puedes <a href="/auth/discord" className="underline hover:text-white">entrar con Discord</a>.</>}</p>
          </div>
        )}
        {!user && meId && mine && !picking && (
          <p className="mb-3 text-xs text-white/50">Viéndote como <span className="font-semibold text-white/80">{mine.name}</span> · <button onClick={change} className="underline hover:text-white">No soy yo</button></p>
        )}
        {notice && <p role="status" className="mb-3 rounded-lg bg-white/5 px-4 py-2 text-sm text-amber-200">{notice}{!user && meId && <> <button onClick={change} className="underline">Cambiar jugador</button></>}</p>}

        <div className="glass overflow-hidden rounded-2xl">
          <table className="w-full text-left text-sm">
            <thead className="text-white/50"><tr><th className="w-14 px-4 py-3">#</th><th className="px-4 py-3">Jugador</th><th className="hidden px-4 py-3 sm:table-cell">V / D / E</th><th className="hidden px-4 py-3 sm:table-cell">% victorias</th><th className="px-4 py-3 text-right">Elo</th></tr></thead>
            <tbody>
              {!board && <tr><td colSpan={5} className="px-4 py-8 text-center text-white/50">Cargando…</td></tr>}
              {board && all.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-white/50">Todavía no hay jugadores con partidas.</td></tr>}
              {board && all.length > 0 && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-white/50">Nadie se llama “{query}” en el ranking.</td></tr>}
              {rows.map(p => {
                const me = mineId === p.id;
                return (
                  <tr key={p.id} id={`row-${p.id}`} className={`border-t border-white/5 ${me ? 'bg-[#00b4ff]/10' : ''} ${flashId === p.id ? 'row-flash' : ''}`}>
                    <td className="px-4 py-3 font-bold">{p.position === 1 ? '🥇' : p.position === 2 ? '🥈' : p.position === 3 ? '🥉' : p.position}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><img src={p.avatar} alt="" className="h-9 w-9 rounded-full" referrerPolicy="no-referrer" loading="lazy" /><div><div className="font-medium"><a href={`#perfil/${p.id}`} className="hover:underline" title="Ver perfil">{p.name}</a>{me && <span className="ml-2 rounded bg-[#00b4ff]/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#7fd6ff]">Tú</span>}</div><div className="text-xs" style={{ color: p.rank.color }}>{p.rank.emoji} {p.rank.name}</div></div></div></td>
                    <td className="hidden px-4 py-3 text-white/70 sm:table-cell">{p.wins} / {p.losses} / {p.draws}</td>
                    <td className="hidden px-4 py-3 text-white/70 sm:table-cell">{p.winRate}%</td>
                    <td className="px-4 py-3 text-right font-display text-lg font-bold">{p.elo}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {board && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 px-4 py-2 text-xs text-white/50">
              <span>{q ? `${filtered.length} resultado(s) de ${all.length}` : `Mostrando ${rows.length} de ${all.length} jugador(es)`}{board.demo ? ' · datos de ejemplo' : ''}</span>
              {!q && rows.length < all.length && <button onClick={() => setShown(s => s + PAGE)} className="rounded-full bg-white/10 px-3 py-1 font-medium text-white hover:bg-white/20">Mostrar más</button>}
            </div>
          )}
        </div>
      </section>

      <GamesSection games={games} />
    </div>
  );
}