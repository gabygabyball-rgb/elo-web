import { useCallback, useEffect, useState } from 'react';
import ShaderBackground from '@/components/ShaderBackground';
import Navbar, { TABS, type TabId } from '@/components/Navbar';
import { JoinBanner } from '@/components/DiscordButton';
import Ranking from '@/pages/Ranking';
import Admins from '@/pages/Admins';
import HallOfFame from '@/pages/HallOfFame';
import Clips from '@/pages/Clips';
import Profile from '@/pages/Profile';
import { api, type Board, type Games, type Me, type SiteInfo } from '@/lib/api';

function useInterval(fn: () => void, ms: number) {
  useEffect(() => { fn(); const t = setInterval(fn, ms); return () => clearInterval(t); }, [fn, ms]);
}

// Pestaña actual guardada en la URL (#ranking, #clips…) para poder compartir el link y que "atrás" funcione
const readTab = (): TabId => {
  const h = window.location.hash.replace('#', '');
  return (TABS.find(t => t.id === h)?.id ?? 'ranking') as TabId;
};

// Perfil de alguien: #perfil/<id de Discord>
const readProfile = (): string | null => window.location.hash.match(/^#perfil\/(\d{5,25})$/)?.[1] ?? null;

export default function App() {
  const [tab, setTab] = useState<TabId>(() => (readProfile() ? 'clips' : readTab()));
  const [profile, setProfile] = useState<string | null>(readProfile);
  const [me, setMe] = useState<Me | null>(null);
  const [site, setSite] = useState<SiteInfo | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [games, setGames] = useState<Games | null>(null);
  const [live, setLive] = useState(false);
  // Aviso cuando alguien inicia sesión con Discord pero no está en el servidor
  const [notice, setNotice] = useState(() => new URLSearchParams(window.location.search).get('login') === 'noserver');
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('login')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    }
  }, []);

  useEffect(() => {
    const onHash = () => { setTab(readProfile() ? 'clips' : readTab()); setProfile(readProfile()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => { api.me().then(setMe).catch(() => setMe({ user: null, loginReady: false })); }, []);
  const loadSite = useCallback(() => { api.site().then(setSite).catch(() => {}); }, []);
  const loadBoard = useCallback(() => { api.board(500).then(setBoard).catch(() => {}); }, []);
  const loadGames = useCallback(() => { api.games().then(setGames).catch(() => {}); }, []);
  // Respaldo cada minuto por si se cae la conexión en vivo
  useInterval(loadSite, 60_000);
  useInterval(loadBoard, 60_000);
  useInterval(loadGames, 60_000);

  // Tiempo real: el servidor avisa cuando cambia la base de datos del bot ("game") o el staff/fotos ("site")
  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const es = new EventSource('/api/site/stream');
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false); // EventSource reintenta solo
    es.onmessage = e => {
      if (e.data === 'game') { loadBoard(); loadGames(); }
      if (e.data === 'site') { loadSite(); loadBoard(); loadGames(); }
    };
    return () => es.close();
  }, [loadBoard, loadGames, loadSite]);

  const user = me?.user ?? null;
  const loginReady = me?.loginReady ?? false;

  return (
    <div className="relative min-h-screen font-sans">
      <ShaderBackground />
      <div className="relative z-10">
        <Navbar tab={tab} onTab={setTab} invite={site?.invite} user={user} loginReady={loginReady} />
        <main className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:pt-10">
          {notice && (
            <div role="alert" className="glass mb-6 flex items-start justify-between gap-3 rounded-2xl px-4 py-3 text-sm text-amber-200">
              <span>Para iniciar sesión tienes que ser miembro del servidor de Discord de HaxCoRe. Únete con el botón de arriba y vuelve a intentarlo.</span>
              <button onClick={() => setNotice(false)} aria-label="Cerrar aviso" className="shrink-0 rounded px-2 text-white/60 hover:text-white">✕</button>
            </div>
          )}
          {tab === 'ranking' && <Ranking board={board} site={site} games={games} live={live} user={user} loginReady={loginReady} />}
          {tab === 'administrador' && <Admins site={site} />}
          {tab === 'salon' && <HallOfFame site={site} />}
          {tab === 'clips' && (profile ? <Profile id={profile} user={user} /> : <Clips user={user} loginReady={loginReady} />)}
          <div className="mt-16"><JoinBanner href={site?.invite} /></div>
        </main>
        <footer className="pb-10 text-center text-xs text-white/50">HaxCoRe — hecho para la comunidad</footer>
      </div>
    </div>
  );
}