import { Crown } from 'lucide-react';
import type { SiteInfo } from '@/lib/api';

export default function HallOfFame({ site }: { site: SiteInfo | null }) {
  const c = site?.champions;
  // Campeones guardados por el bot de Elo (/reset_season); si no hay, usa el registro manual de temporadas
  const fromBot = c && c.first ? [{ season: c.season, queue: c.queue, first: { name: c.first.name, elo: null as number | null, avatar: c.first.avatar as string | null }, second: c.second ? { name: c.second.name, elo: null as number | null } : null, third: c.third ? { name: c.third.name, elo: null as number | null } : null }] : [];
  const saved = (site?.seasons ?? []).map(s => ({ season: s.season, queue: s.queue, first: { name: s.first.name, elo: s.first.elo as number | null, avatar: null as string | null }, second: s.second ? { name: s.second.name, elo: s.second.elo as number | null } : null, third: s.third ? { name: s.third.name, elo: s.third.elo as number | null } : null }));
  const list = [...saved, ...fromBot.filter(f => !saved.some(s => s.season === f.season && s.queue === f.queue))].sort((a, b) => b.season - a.season);
  const elo = (n: number | null) => (n === null ? '' : ` · ${n}`);
  return (
    <section>
      <h1 className="mb-1 flex items-center gap-2 font-display text-3xl font-bold"><Crown className="text-amber-300" size={26} />Salón de la Fama</h1>
      <p className="mb-6 text-sm text-white/60">Los campeones de cada temporada del Elo.</p>
      {list.length === 0 ? (
        <div className="glass rounded-2xl px-6 py-12 text-center">
          <div className="text-4xl" aria-hidden="true">🏆</div>
          <p className="mt-3 font-display text-lg font-semibold">Aquí aparecerán los campeones</p>
          <p className="mt-1 text-sm text-white/60">Cuando termine la temporada, el podio queda guardado en este salón para siempre.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map(s => (
            <div key={`${s.season}-${s.queue}`} className="glass rounded-2xl p-5 ring-1 ring-amber-300/10">
              <div className="text-xs uppercase tracking-widest text-white/50">Temporada {s.season} · {s.queue}</div>
              <div className="mt-2 flex items-center gap-2 text-xl font-bold">🥇 {s.first.avatar && <img src={s.first.avatar} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />}{s.first.name}<span className="text-base font-normal text-white/60">{elo(s.first.elo)}</span></div>
              {s.second && <div className="mt-1 text-sm text-white/70">🥈 {s.second.name}{elo(s.second.elo)}</div>}
              {s.third && <div className="text-sm text-white/70">🥉 {s.third.name}{elo(s.third.elo)}</div>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
