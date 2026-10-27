import { useMemo } from 'react';
import { Users } from 'lucide-react';
import { AnimatedTooltip } from '@/components/ui/animated-tooltip';
import type { SiteInfo } from '@/lib/api';

const ROLE_ORDER = [
  { key: 'creador', label: 'Creador', tone: 'from-amber-400 to-orange-500' },
  { key: 'administrador', label: 'Administradores', tone: 'from-rose-400 to-pink-500' },
  { key: 'elo_admin', label: 'Elo Admins', tone: 'from-violet-400 to-indigo-500' },
  { key: 'ayudante', label: 'Ayudantes', tone: 'from-sky-400 to-cyan-500' }
];
const ROLE_LABEL: Record<string, string> = { creador: 'Creador', administrador: 'Administrador', elo_admin: 'Elo Admin', ayudante: 'Ayudante' };

export default function Admins({ site }: { site: SiteInfo | null }) {
  const groups = useMemo(() => ROLE_ORDER.map(r => ({
    ...r, members: (site?.staff ?? []).filter(s => s.roles.some(x => x.key === r.key))
  })), [site]);
  return (
    <section>
      <h1 className="mb-1 flex items-center gap-2 font-display text-3xl font-bold"><Users className="text-sky-300" size={26} />Administrador</h1>
      <p className="mb-6 text-sm text-white/60">El equipo que mantiene el servidor y el Elo de HaxCoRe.</p>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ROLE_ORDER.map(r => (
          <div key={r.key} className="glass rounded-2xl p-4 text-center">
            <div className={`bg-gradient-to-r ${r.tone} bg-clip-text font-display text-3xl font-bold text-transparent`}>{site?.roleCounts[r.key] ?? 0}</div>
            <div className="text-xs text-white/60">{r.label}</div>
          </div>
        ))}
      </div>
      <div className="space-y-6">
        {groups.filter(g => g.members.length > 0).map(g => (
          <div key={g.key} className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl px-6 pb-6 pt-14">
            <div>
              <div className={`bg-gradient-to-r ${g.tone} bg-clip-text font-display text-lg font-bold text-transparent`}>{g.label}</div>
              <div className="text-xs text-white/50">{g.members.map(m => m.name).join(', ')}</div>
            </div>
            <AnimatedTooltip
              className="pr-4"
              items={g.members.map((m, i) => ({ id: i + 1, name: m.name, designation: m.roles.map(r => ROLE_LABEL[r.key] ?? r.label).join(' · '), image: m.avatar }))}
            />
          </div>
        ))}
        {site && site.staff.length === 0 && <p className="text-sm text-white/50">El bot todavía no sincronizó el staff. Enciende el bot de la web (INICIAR-BOT-WEB.bat).</p>}
      </div>
    </section>
  );
}
