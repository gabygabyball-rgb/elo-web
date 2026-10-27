import { Swords } from 'lucide-react';
import type { Game, Games } from '@/lib/api';

const timeAgo = (t: number) => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'hace un momento';
  if (m < 60) return `hace ${m} min`;
  if (m < 1440) return `hace ${Math.round(m / 60)} h`;
  return `hace ${Math.round(m / 1440)} d`;
};

function Team({ title, players, win }: { title: string; players: Game['team1']; win: boolean }) {
  return (
    <div className="min-w-0 flex-1">
      <div className={`mb-1.5 text-xs font-semibold uppercase tracking-wider ${win ? 'text-emerald-300' : 'text-white/50'}`}>{title}{win ? ' · ganó' : ''}</div>
      <ul className="space-y-1">
        {players.length === 0 && <li className="text-xs text-white/40">—</li>}
        {players.map(p => (
          <li key={p.id} className="flex items-center gap-2 text-sm">
            <img src={p.avatar} alt="" className="h-5 w-5 rounded-full" referrerPolicy="no-referrer" />
            <span className="truncate">{p.name}</span>
            {p.delta !== null && <span className={`ml-auto text-xs font-semibold tabular-nums ${p.delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{p.delta > 0 ? '+' : ''}{p.delta}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function GameCard({ g }: { g: Game }) {
  const done = g.status === 'finished';
  const label = g.status === 'drafting' ? 'Eligiendo equipos' : g.status === 'pending' ? 'En juego' : g.result === 'draw' ? 'Empate' : 'Finalizada';
  return (
    <article className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="font-semibold text-white/80">Partida #{g.id} · {g.mode}</span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${done ? 'bg-white/10 text-white/70' : 'bg-emerald-400/15 text-emerald-300'}`}>
          {!done && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}{label}
        </span>
      </div>
      <div className="flex gap-4">
        <Team title="Equipo 1" players={g.team1} win={g.result === 'team1'} />
        <div className="self-center text-white/30"><Swords size={18} /></div>
        <Team title="Equipo 2" players={g.team2} win={g.result === 'team2'} />
      </div>
      {g.status === 'drafting' && g.remaining.length > 0 && <p className="mt-3 text-xs text-white/50">Sin elegir: {g.remaining.map(p => p.name).join(', ')}</p>}
      <div className="mt-3 text-xs text-white/40">{timeAgo(g.createdAt)}</div>
    </article>
  );
}

export default function GamesSection({ games }: { games: Games | null }) {
  if (!games || !games.enabled) return null;
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-bold"><Swords className="text-emerald-300" size={22} />Partidas</h2>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/60">Ahora mismo</h3>
      {games.live.length === 0
        ? <p className="glass mb-6 rounded-2xl px-4 py-5 text-center text-sm text-white/50">No hay partidas en curso.</p>
        : <div className="mb-6 grid gap-4 md:grid-cols-2">{games.live.map(g => <GameCard key={g.id} g={g} />)}</div>}
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/60">Últimas jugadas</h3>
      {games.recent.length === 0
        ? <p className="glass rounded-2xl px-4 py-5 text-center text-sm text-white/50">Aún no hay partidas terminadas.</p>
        : <div className="grid gap-4 md:grid-cols-2">{games.recent.map(g => <GameCard key={g.id} g={g} />)}</div>}
    </section>
  );
}
