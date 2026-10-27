const FALLBACK = 'https://discord.gg/dRGdCbC2M';
const DISCORD_PATH = 'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z';

/** Logo oficial de Discord (blanco). */
export function DiscordLogo({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false"><path d={DISCORD_PATH} /></svg>
  );
}

type Props = { href?: string; size?: 'sm' | 'lg' };

/** Botón llamativo para unirse al Discord (degradado animado, brillo que pasa y resplandor). */
export default function DiscordButton({ href, size = 'sm' }: Props) {
  const lg = size === 'lg';
  return (
    <a
      href={href || FALLBACK}
      target="_blank"
      rel="noopener noreferrer"
      className={`discord-btn group relative inline-flex items-center font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${lg ? 'gap-3 rounded-2xl px-8 py-4 text-lg' : 'gap-2 rounded-xl px-3.5 py-2 text-sm sm:px-4'}`}
    >
      <span className={`relative flex items-center justify-center ${lg ? 'h-9 w-9' : 'h-6 w-6'}`}>
        <DiscordLogo size={lg ? 30 : 22} />
      </span>
      <span className="relative">
        {lg ? 'Unirme al Discord' : <><span className="hidden sm:inline">Unirme al Discord</span><span className="sm:hidden">Discord</span></>}
      </span>
    </a>
  );
}

/** Tarjeta grande de invitación que va al final de todas las pestañas. */
export function JoinBanner({ href }: { href?: string }) {
  return (
    <section className="glass relative overflow-hidden rounded-3xl px-6 py-12 text-center">
      <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[#5865F2]/30 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-10 h-56 w-56 rounded-full bg-[#00b4ff]/25 blur-3xl" />
      <h2 className="relative font-display text-2xl font-bold sm:text-3xl">Únete a la comunidad de HaxCoRe</h2>
      <p className="relative mx-auto mt-2 max-w-md text-sm text-white/70">Juega el Elo 4v4, sube de rango y pelea por un lugar en el Salón de la Fama.</p>
      <div className="relative mt-6"><DiscordButton href={href} size="lg" /></div>
    </section>
  );
}