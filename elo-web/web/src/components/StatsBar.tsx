import { Shield, Trophy, Users } from 'lucide-react';
import CountUp from '@/components/CountUp';
import type { Board, SiteInfo } from '@/lib/api';

type Item = { label: string; value: number | null; icon: typeof Users; tone: string };

/** Contadores aparte (React Bits · CountUp): los números giran como un odómetro al aparecer y al pasar el mouse. */
export default function StatsBar({ site, board }: { site: SiteInfo | null; board: Board | null }) {
  const items: Item[] = [
    { label: 'Miembros del Discord', value: site?.memberCount ?? null, icon: Users, tone: 'from-[#5865F2] to-[#7b5cff]' },
    { label: 'Jugadores en el ranking', value: board ? board.total : null, icon: Trophy, tone: 'from-amber-400 to-orange-500' },
    { label: 'Miembros del staff', value: site ? site.staff.length : null, icon: Shield, tone: 'from-sky-400 to-cyan-500' }
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map(({ label, value, icon: Icon, tone }) => (
        <div key={label} className="glass flex items-center gap-4 rounded-2xl px-5 py-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${tone}`}><Icon size={22} aria-hidden="true" /></span>
          <div>
            <div className="font-display text-3xl font-bold leading-none">
              <CountUp to={value ?? 0} startWhen={value !== null} mode="roll" easing="expo" duration={1.6} separator="," replayOnHover />
            </div>
            <div className="mt-1.5 text-xs text-white/60">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
