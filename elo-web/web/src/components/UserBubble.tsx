import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, ShieldCheck, User } from 'lucide-react';
import { DiscordLogo } from '@/components/DiscordButton';
import type { Me } from '@/lib/api';

type LoginProps = { next?: string; size?: 'sm' | 'lg'; label?: string };

/** Botón para iniciar sesión con Discord. `next` es la pestaña a la que vuelve después de entrar. */
export function LoginButton({ next = 'ranking', size = 'sm', label }: LoginProps) {
  const lg = size === 'lg';
  return (
    <a
      href={`/auth/discord?next=${encodeURIComponent(next)}`}
      className={lg
        ? 'discord-btn group relative inline-flex items-center gap-3 rounded-2xl px-7 py-3.5 text-base font-bold text-white'
        : 'inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:border-[#5865F2] hover:bg-[#5865F2]/20'}
    >
      <DiscordLogo size={lg ? 26 : 18} />
      <span className="relative">{label ?? (lg ? 'Entrar con Discord' : <><span className="hidden sm:inline">Entrar con Discord</span><span className="sm:hidden">Entrar</span></>)}</span>
    </a>
  );
}

/** Burbuja de la sesión de Discord (arriba a la derecha): foto, nombre y menú para salir. */
export default function UserBubble({ user, loginReady, tab }: { user: Me['user']; loginReady: boolean; tab: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (!user) return loginReady ? <LoginButton next={tab} /> : null;

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu" aria-expanded={open} aria-label={`Sesión de ${user.name}`}
        className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pl-1 pr-2.5 transition hover:bg-white/10 sm:pr-3"
      >
        <span className="relative">
          <img src={user.avatar} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#06051e] bg-emerald-400" aria-hidden="true" />
        </span>
        <span className="hidden max-w-[120px] truncate text-sm font-semibold sm:inline">{user.name}</span>
        <ChevronDown size={14} className={`text-white/60 transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="glass absolute right-0 top-[calc(100%+8px)] z-40 w-64 rounded-2xl p-3 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-white/10 pb-3">
            <img src={user.avatar} alt="" className="h-12 w-12 rounded-full" referrerPolicy="no-referrer" />
            <div className="min-w-0">
              <div className="truncate font-semibold">{user.name}</div>
              <div className="flex items-center gap-1.5 text-xs text-white/60"><DiscordLogo size={13} />Sesión iniciada con Discord</div>
              {user.staff && <div className="mt-1 inline-flex items-center gap-1 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300"><ShieldCheck size={11} />Staff</div>}
            </div>
          </div>
          <a href={`#perfil/${user.id}`} role="menuitem" onClick={() => setOpen(false)} className="mt-2 flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white"><User size={16} />Ver perfil</a>
          <a href="/auth/logout" role="menuitem" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white"><LogOut size={16} />Cerrar sesión</a>
        </div>
      )}
    </div>
  );
}