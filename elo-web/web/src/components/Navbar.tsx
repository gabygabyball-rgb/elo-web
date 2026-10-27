import TechText from '@/components/TechText';
import SpecularButton from '@/components/SpecularButton';
import DiscordButton from '@/components/DiscordButton';
import UserBubble from '@/components/UserBubble';
import { LOGO } from '@/lib/logo';
import type { Me } from '@/lib/api';

export const TABS = [
  { id: 'ranking', label: 'Ranking' },
  { id: 'administrador', label: 'Administrador' },
  { id: 'salon', label: 'Salón de la Fama' },
  { id: 'clips', label: 'Clips' }
] as const;
export type TabId = (typeof TABS)[number]['id'];

type Props = { tab: TabId; onTab: (t: TabId) => void; invite?: string; user: Me['user']; loginReady: boolean };

export default function Navbar({ tab, onTab, invite, user, loginReady }: Props) {
  return (
    <header className="navbar sticky top-0 z-30">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-1.5">
        <div className="flex items-center gap-1">
          <a href="#ranking" onClick={() => onTab('ranking')} aria-label="HaxCoRe — inicio" className="shrink-0">
            <img src={LOGO} alt="Logo HaxCoRe" className="h-10 w-auto drop-shadow-[0_0_10px_rgba(0,180,255,.5)]" />
          </a>
          {/* Letras animadas (React Bits · TechText): pasa el mouse o haz clic en una letra */}
          <div className="h-[60px] w-[150px] sm:w-[240px]">
            <TechText
              text="HaxCoRe"
              fontFamily="Orbitron, 'Space Grotesk', sans-serif"
              fontWeight={900}
              fontSize={34}
              letterSpacing={0.04}
              align="left"
              color="#eaf7ff"
              accentColor="#00b4ff"
              reveal="letter"
              intro="assemble"
              introDuration={1.8}
              dashLength={4}
              dashGap={2}
              specks={12}
              labels={false}
              clickKick
              guides={false}
            />
          </div>
        </div>

        {/* Pestañas: botones de vidrio con luz en el borde (React Bits · SpecularButton).
            En celular bajan a una segunda fila. */}
        <nav className="order-last flex w-full flex-wrap items-center justify-center gap-2 pb-1.5 md:order-none md:w-auto md:pb-0" aria-label="Secciones">
          {TABS.map(t => <TabButton key={t.id} id={t.id} label={t.label} active={tab === t.id} onTab={onTab} />)}
        </nav>

        <div className="flex items-center gap-2">
          <DiscordButton href={invite} />
          <UserBubble user={user} loginReady={loginReady} tab={tab} />
        </div>
      </div>
    </header>
  );
}

// Colores pensados para el fondo morado/azul oscuro: la pestaña activa brilla en azul y gira la luz; las demás quedan tenues y se encienden al acercar el mouse
function TabButton({ id, label, active, onTab }: { id: TabId; label: string; active: boolean; onTab: (t: TabId) => void }) {
  return (
    <SpecularButton
      size="sm"
      radius={12}
      tint={active ? '#00b4ff' : '#ffffff'}
      tintOpacity={active ? 0.16 : 0.03}
      textColor={active ? '#ffffff' : '#cfc6f7'}
      lineColor={active ? '#8fe3ff' : '#a9c8ff'}
      baseColor={active ? '#2f9be0' : '#4b4a8f'}
      intensity={1}
      idleIntensity={active ? 1 : 0.22}
      shineSize={active ? 16 : 12}
      shineFade={40}
      thickness={1.2}
      glow={active ? 1 : 0.7}
      proximity={170}
      autoAnimate={active}
      speed={0.5}
      aria-current={active ? 'page' : undefined}
      className="!px-3 !py-2 md:!px-5 md:!py-2.5"
      onClick={() => { window.location.hash = id; onTab(id); }}
    >
      {label}
    </SpecularButton>
  );
}