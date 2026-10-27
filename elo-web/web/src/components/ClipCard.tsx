import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ban, Bookmark, ExternalLink, MessageCircle, Send, X } from 'lucide-react';
import SpotlightCard from '@/components/SpotlightCard';
import ClickSpark from '@/components/ClickSpark';
import SlingButton from '@/components/SlingButton';
import FuseButton from '@/components/FuseButton';
import PulseHeart from '@/components/ui/PulseHeart';
import { api, type Clip, type ClipComment, type Me } from '@/lib/api';

export type User_ = Me['user'];

const EXTRA_EMOJIS = ['🔥', '😂', '👏', '💀', '👍'];
const SPARK_LIKE = ['#ff4d6d', '#ffd166', '#ffffff'];
const SPARK_SAVE = ['#fbbf24', '#fff3b0', '#ffffff'];
const sparkBox = { width: 'auto', height: 'auto', display: 'inline-flex' } as const;
const NEED = 'Inicia sesión con Discord';

export const timeAgo = (t: number) => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'hace un momento';
  if (m < 60) return `hace ${m} min`;
  if (m < 1440) return `hace ${Math.round(m / 60)} h`;
  return `hace ${Math.round(m / 1440)} d`;
};
export const hearts = (c: Clip) => c.reactions['❤️'] ?? 0;
export const profileHref = (id: string) => `#perfil/${id}`;

// Banear (solo staff): pide confirmación y un motivo opcional
export async function banUser(id: string, name: string): Promise<boolean> {
  if (!window.confirm(`¿Banear a ${name}?\nSe borran todos sus clips y comentarios y ya no podrá publicar.`)) return false;
  const reason = window.prompt('Motivo (opcional):', '') ?? '';
  try { await api.ban(id, reason); return true; } catch (x: any) { window.alert(x.message); return false; }
}

type Props = { clip: Clip; user: User_; onPatch: (c: Clip) => void; onRemoved: (c: Clip) => void; onBanned: () => void };

/** Tarjeta de clip estilo TikTok: video vertical, acciones a la derecha y autor abajo. */
export default function ClipCard({ clip: c, user, onPatch, onRemoved, onBanned }: Props) {
  const [sheet, setSheet] = useState(false);
  const [err, setErr] = useState('');
  const canDelete = !!user && (user.id === c.author.id || user.staff);
  const canBan = !!user?.staff && user.id !== c.author.id;
  const banned = !!user?.banned;

  const react = async (emoji: string) => { try { onPatch((await api.react(c.id, emoji)).clip); setErr(''); } catch (x: any) { setErr(x.message); } };
  const save = async () => { try { onPatch((await api.save(c.id)).clip); setErr(''); } catch (x: any) { setErr(x.message); } };
  const del = async () => { try { await api.remove(c.id); onRemoved(c); } catch (x: any) { setErr(x.message); } };
  const can = !!user && !banned;
  const why = !user ? NEED : banned ? 'Estás baneado' : undefined;

  return (
    <SpotlightCard theme="dark" spotlightColor="#4efafa" intensity={0.16} spotlightSize={300} softness={0.9} borderGlow={0.7} proximity={50}
      className="!p-0" style={{ '--spotlight-card-surface': 'rgba(10, 8, 40, 0.7)', backdropFilter: 'blur(14px)', borderRadius: '1.25rem' } as React.CSSProperties}>
      <div className="relative aspect-[9/14] bg-black">
        <Media clip={c} />
        {/* autor arriba a la izquierda */}
        <a href={profileHref(c.author.id)} className="absolute left-3 top-3 z-10 flex max-w-[70%] items-center gap-2 rounded-full bg-black/55 py-1 pl-1 pr-3 text-sm font-semibold backdrop-blur hover:bg-black/75">
          <img src={c.author.avatar} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
          <span className="truncate">{c.author.name}</span>
        </a>
        {/* acciones a la derecha, como en TikTok */}
        <div className="absolute bottom-16 right-2 z-10 flex flex-col items-center gap-3">
          <ClickSpark sparkColor={SPARK_LIKE} shape="star" sparkCount={10} sparkSize={13} sparkRadius={36} duration={650} easing="spring" glow={0.7} ring disabled={!can} style={sparkBox}>
            <PulseHeart size={22} corner={20} count={hearts(c)} liked={c.mine.includes('❤️')} disabled={!can} pillColor="rgba(0,0,0,.55)" label={why ?? 'Me gusta'} onChange={() => react('❤️')} />
          </ClickSpark>
          <RailButton label={`${c.comments} comentarios`} onClick={() => setSheet(true)}><MessageCircle size={20} aria-hidden="true" />{c.comments}</RailButton>
          <ClickSpark sparkColor={SPARK_SAVE} shape="star" sparkCount={8} sparkSize={12} sparkRadius={30} duration={600} glow={0.6} disabled={!can} style={sparkBox}>
            <RailButton label={c.saved ? 'Quitar de guardados' : 'Guardar'} title={why} disabled={!can} active={c.saved} onClick={save}>
              <Bookmark size={20} fill={c.saved ? 'currentColor' : 'none'} aria-hidden="true" />{c.saves}
            </RailButton>
          </ClickSpark>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold leading-snug">{c.title}</h3>
            <p className="mt-0.5 text-xs text-white/50">{timeAgo(c.createdAt)}</p>
          </div>
          {canDelete && (
            <FuseButton label="Borrar" undoLabel="Deshacer" doneLabel="Borrado" size="sm" radius={12} color="#fda4af" background="rgba(255,255,255,0.06)" fuseColor="#fb7185" undoWindow={4000} commitOn="fuseEnd" onCommit={del} />
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {EXTRA_EMOJIS.map(e => (
            <button key={e} disabled={!can} onClick={() => react(e)} aria-pressed={c.mine.includes(e)} title={why}
              className={`rounded-full px-2.5 py-1 text-sm transition disabled:opacity-50 ${c.mine.includes(e) ? 'bg-white/25 ring-1 ring-white/40' : 'bg-black/30 hover:bg-white/15'}`}>
              {e} <span className="text-xs text-white/70">{c.reactions[e] ?? 0}</span>
            </button>
          ))}
          {canBan && (
            <button onClick={async () => { if (await banUser(c.author.id, c.author.name)) onBanned(); }} className="ml-auto inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-1 text-xs text-rose-200 ring-1 ring-rose-400/30 hover:bg-rose-500/25">
              <Ban size={13} aria-hidden="true" />Banear
            </button>
          )}
        </div>
        {err && <p role="alert" className="mt-2 text-xs text-rose-300">{err}</p>}
      </div>
      {sheet && <CommentsSheet clip={c} user={user} onClose={() => setSheet(false)} onCount={n => onPatch({ ...c, comments: n })} onBanned={onBanned} />}
    </SpotlightCard>
  );
}

function RailButton({ children, label, onClick, disabled, active, title }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; active?: boolean; title?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={active} title={title}
      className={`flex min-w-[2.75rem] flex-col items-center gap-0.5 rounded-2xl px-2 py-2 text-xs font-semibold backdrop-blur transition disabled:opacity-50 ${active ? 'bg-amber-400/30 text-amber-200 ring-1 ring-amber-300/50' : 'bg-black/55 text-white hover:bg-black/75'}`}>
      {children}
    </button>
  );
}

/** Muestra el clip según de dónde venga: archivo propio, YouTube/Streamable/Twitch o simple enlace. */
function Media({ clip: c }: { clip: Clip }) {
  let host = '';
  try { host = new URL(c.url, window.location.href).hostname.replace('www.', ''); } catch { /* link raro */ }
  if (c.kind === 'video' && c.embed) return <video src={c.embed} controls playsInline loop preload="metadata" className="h-full w-full bg-black object-contain" />;
  if (c.kind === 'image' && c.embed) return <img src={c.embed} alt={c.title} loading="lazy" className="h-full w-full bg-black object-contain" />;
  if (c.embed) return <div className="flex h-full items-center bg-black"><iframe src={c.embed} title={c.title} loading="lazy" allowFullScreen className="aspect-video w-full" referrerPolicy="strict-origin-when-cross-origin" /></div>;
  return (
    <a href={c.url} target="_blank" rel="noopener noreferrer" className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#1b1760] to-black px-6 text-center text-white/85 hover:text-white">
      <ExternalLink size={34} aria-hidden="true" />
      <span className="font-semibold">{/haxball\.com$|thehax\.pl$/.test(host) ? 'Ver el replay' : `Ver clip en ${host}`}</span>
      <span className="text-xs text-white/50">Se abre en otra pestaña</span>
    </a>
  );
}

/** Panel de comentarios (como en TikTok: abajo en el celular, a la derecha en el PC). */
function CommentsSheet({ clip, user, onClose, onCount, onBanned }: { clip: Clip; user: User_; onClose: () => void; onCount: (n: number) => void; onBanned: () => void }) {
  const [items, setItems] = useState<ClipComment[] | null>(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { api.comments(clip.id).then(d => setItems(d.comments)).catch(x => { setItems([]); setErr(x.message); }); }, [clip.id]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [items?.length]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const send = async () => {
    const t = text.trim();
    if (!user || user.banned || !t || busy) return;
    setBusy(true); setErr('');
    try {
      const { comment, count } = await api.addComment(clip.id, t);
      setItems(l => [...(l ?? []), comment]); setText(''); onCount(count);
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  const del = async (cid: string) => {
    try { const { count } = await api.removeComment(clip.id, cid); setItems(l => (l ?? []).filter(x => x.id !== cid)); onCount(count); }
    catch (x: any) { setErr(x.message); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/65 sm:items-stretch sm:justify-end" onClick={onClose}>
      <div role="dialog" aria-label="Comentarios" onClick={e => e.stopPropagation()}
        className="flex max-h-[85vh] w-full flex-col rounded-t-3xl border border-white/10 bg-[#0b0930] text-white shadow-2xl sm:max-h-none sm:w-[420px] sm:rounded-none sm:rounded-l-3xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="font-semibold">Comentarios <span className="text-white/50">({items?.length ?? clip.comments})</span></h2>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-1.5 hover:bg-white/10"><X size={18} /></button>
        </div>
        <div className="min-h-[8rem] flex-1 overflow-y-auto px-4 py-3">
          {items === null && <p className="text-sm text-white/50">Cargando comentarios…</p>}
          {items && items.length === 0 && <p className="text-sm text-white/50">Todavía no hay comentarios. ¡Sé el primero!</p>}
          <ul className="space-y-4">
            {items?.map(m => (
              <li key={m.id} className="flex gap-2.5 text-sm">
                <a href={profileHref(m.author.id)} onClick={onClose}><img src={m.author.avatar} alt="" className="mt-0.5 h-8 w-8 shrink-0 rounded-full" referrerPolicy="no-referrer" /></a>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 text-xs"><a href={profileHref(m.author.id)} onClick={onClose} className="font-semibold text-white/90 hover:underline">{m.author.name}</a><span className="text-white/40">{timeAgo(m.createdAt)}</span></div>
                  <p className="break-words text-white/85">{m.text}</p>
                </div>
                {user?.staff && m.author.id !== user.id && (
                  <button onClick={async () => { if (await banUser(m.author.id, m.author.name)) { onBanned(); onClose(); } }} aria-label={`Banear a ${m.author.name}`} title="Banear" className="self-start rounded p-1 text-white/40 hover:bg-white/10 hover:text-rose-300"><Ban size={14} /></button>
                )}
                {m.canDelete && <button onClick={() => del(m.id)} aria-label="Borrar comentario" className="self-start rounded p-1 text-white/40 hover:bg-white/10 hover:text-rose-300"><X size={14} /></button>}
              </li>
            ))}
          </ul>
          <div ref={end} />
        </div>
        <div className="border-t border-white/10 p-3">
          {err && <p role="alert" className="mb-2 text-xs text-rose-300">{err}</p>}
          {!user && <p className="text-sm text-white/60">Inicia sesión con Discord (arriba a la derecha) para comentar.</p>}
          {user?.banned && <p className="text-sm text-rose-300">Estás baneado: no puedes comentar.</p>}
          {user && !user.banned && (
            <div className="flex items-center gap-3">
              <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(); } }} maxLength={300} placeholder="Escribe un comentario…" aria-label="Escribe un comentario"
                className="min-w-0 flex-1 rounded-xl bg-black/30 px-3 py-2.5 text-sm outline-none ring-1 ring-white/10 focus:ring-[#00b4ff]" />
              <SlingButton size={40} strokeWidth={2.5} armAt={40} maxPull={120} padColor="#00b4ff" iconColor="#02010a" accentColor="#4efafa" wellColor="rgba(255,255,255,0.10)" bandColor="#5b5aa8" particles={10} flight={90} ariaLabel="Enviar comentario" disabled={busy || !text.trim()} onSend={send} />
              <button onClick={send} disabled={busy || !text.trim()} className="sr-only"><Send size={14} />Enviar</button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
