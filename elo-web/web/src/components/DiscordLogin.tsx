import { LogOut, ShieldCheck } from 'lucide-react';
import type { Me } from '@/lib/api';

/** Logo oficial de Discord (Simple Icons). */
export function DiscordLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  );
}

/** Botón "Iniciar sesión con Discord". Si el login aún no está configurado, avisa en vez de mandar a una página de error. */
export function DiscordLoginButton({ ready = true, size = 'md' }: { ready?: boolean; size?: 'md' | 'lg' }) {
  const big = size === 'lg';
  const classes = `group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full bg-gradient-to-r from-[#5865F2] to-[#7983f5] font-semibold text-white shadow-[0_0_28px_-6px_#5865F2] transition hover:scale-[1.04] hover:shadow-[0_0_40px_-2px_#5865F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${big ? 'px-7 py-3.5 text-base' : 'px-4 py-2 text-sm'}`;
  const inner = (
    <>
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      <DiscordLogo className={big ? 'relative h-6 w-6' : 'relative h-5 w-5'} />
      <span className="relative">Iniciar sesión con Discord</span>
    </>
  );
  if (!ready) {
    return (
      <button type="button" onClick={() => alert('El login de Discord todavía no está configurado en el servidor (faltan DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET y SESSION_SECRET).')} className={`${classes} opacity-70`}>
        {inner}
      </button>
    );
  }
  return <a href="/auth/discord" className={classes}>{inner}</a>;
}

/** Zona de arriba a la derecha: botón de login o, ya dentro, foto + nombre + salir. */
export function AuthArea({ user, ready }: { user: Me['user']; ready: boolean }) {
  if (!user) return <DiscordLoginButton ready={ready} />;
  return (
    <div className="glass flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2">
      <img src={user.avatar} alt="" className="h-8 w-8 rounded-full ring-2 ring-[#5865F2]" referrerPolicy="no-referrer" />
      <div className="hidden leading-tight sm:block">
        <div className="text-sm font-medium">{user.name}</div>
        {user.staff && <div className="flex items-center gap-1 text-[11px] text-emerald-300"><ShieldCheck size={11} />Staff</div>}
      </div>
      <a href="/auth/logout" className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={16} /></a>
    </div>
  );
}
