export type Player = { position: number; id: string; name: string; elo: number; wins: number; losses: number; draws: number; games: number; winRate: number; streak: number; rank: { key: string; name: string; emoji: string; color: string }; avatar: string };
export type Board = { season: number | null; demo: boolean; total: number; queue: { key: string | null; name: string }; players: Player[] };
export type StaffMember = { id: string; name: string; username: string; avatar: string; roles: { key: string; label: string }[] };
export type SeasonWinner = { season: number; queue: string; endedAt: number; first: { id: string; name: string; elo: number }; second: { id: string; name: string; elo: number } | null; third: { id: string; name: string; elo: number } | null };
export type SiteInfo = { invite: string; staff: StaffMember[]; roleCounts: Record<string, number>; memberCount: number | null; seasons: SeasonWinner[]; champions: { season: number; queue: string; first: { id: string; name: string; avatar: string } | null; second: { id: string; name: string; avatar: string } | null; third: { id: string; name: string; avatar: string } | null } | null; updatedAt: number | null };
export type Clip = { id: string; title: string; url: string; embed: string | null; kind: string; createdAt: number; author: { id: string; name: string; avatar: string }; reactions: Record<string, number>; mine: string[]; total: number; comments: number; saves: number; saved: boolean };
export type ClipComment = { id: string; text: string; createdAt: number; author: { id: string; name: string; avatar: string }; canDelete: boolean };
export type EloStats = { position: number; total: number; elo: number; rank: { key: string; name: string; emoji: string; color: string }; wins: number; losses: number; draws: number; games: number; winRate: number; streak: number };
export type Achievement = { key: string; icon: string; name: string; desc: string; earned: boolean };
export type Profile = { user: { id: string; name: string; avatar: string; role: string | null; banned: boolean }; stats: { clips: number; likes: number; comments: number; saves: number }; elo: EloStats | null; achievements: Achievement[]; clips: Clip[]; me: boolean };
export type ClipSort = 'new' | 'top' | 'saved' | 'mine';
export type ClipStats = { clips: number; likes: number; comments: number };
export const OUTDATED = 'El servidor está desactualizado: reemplaza elo-api\\lib\\site.js por el nuevo, cierra la ventana negra y vuelve a abrir INICIAR-WEB.bat.';
export type GamePlayer = { id: string; name: string; avatar: string; delta: number | null };
export type Game = { id: number; mode: string; status: 'drafting' | 'pending' | 'finished'; createdAt: number; team1: GamePlayer[]; team2: GamePlayer[]; remaining: { id: string; name: string; avatar: string }[]; captain1: string | null; captain2: string | null; result: string | null };
export type Games = { enabled: boolean; live: Game[]; recent: Game[] };
export type Ban = { id: string; name: string; avatar: string; reason: string; by: { id: string; name: string }; at: number };
export type Me = { user: { id: string; name: string; avatar: string; staff: boolean; banned?: boolean } | null; loginReady: boolean };

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: 'same-origin', ...init });
  const json = (r.headers.get('content-type') || '').includes('json');
  // Si el servidor viejo no conoce la ruta responde con la página en vez de datos
  if (url.startsWith('/api/') && !json && init?.method && init.method !== 'GET') throw new Error(OUTDATED);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as any).error === 'Ruta desconocida.' ? OUTDATED : (data as any).error || 'Algo falló.');
  return data as T;
}
const post = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const api = {
  board: (limit = 10) => req<Board>(`/api/site/board?limit=${limit}`),
  site: () => req<SiteInfo>('/api/site'),
  games: () => req<Games>('/api/site/games'),
  me: () => req<Me>('/auth/me'),
  clips: (sort: ClipSort) => req<{ clips: Clip[]; emojis: string[]; stats: ClipStats; maxUploadMB?: number }>(`/api/clips?sort=${sort}`),
  addClip: (title: string, url: string) => req<{ clip: Clip }>('/api/clips', post({ title, url })),
  react: (id: string, emoji: string) => req<{ clip: Clip }>(`/api/clips/${id}/react`, post({ emoji })),
  save: (id: string) => req<{ clip: Clip }>(`/api/clips/${id}/save`, post({})),
  remove: (id: string) => req<{ ok: true }>(`/api/clips/${id}`, { method: 'DELETE' }),
  comments: (id: string) => req<{ comments: ClipComment[] }>(`/api/clips/${id}/comments`),
  addComment: (id: string, text: string) => req<{ comment: ClipComment; count: number }>(`/api/clips/${id}/comments`, post({ text })),
  removeComment: (id: string, cid: string) => req<{ ok: true; count: number }>(`/api/clips/${id}/comments/${cid}`, { method: 'DELETE' }),
  profile: (id: string) => req<Profile>(`/api/profile/${id}`),
  // Sube un archivo de la galería con barra de progreso
  uploadClip: (file: File, title: string, onProgress: (pct: number) => void) => new Promise<{ clip: Clip }>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', `/api/clips/upload?title=${encodeURIComponent(title)}`);
    x.withCredentials = true;
    x.setRequestHeader('Content-Type', 'application/octet-stream');
    x.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    x.onerror = () => reject(new Error('Se cortó la conexión al subir. Intenta de nuevo.'));
    x.onload = () => {
      let d: any = {}; try { d = JSON.parse(x.responseText); } catch { /* no era JSON */ }
      if (x.status >= 200 && x.status < 300 && d.clip) resolve(d);
      else reject(new Error(x.status === 404 || !d.error || d.error === 'Ruta desconocida.' ? OUTDATED : d.error));
    };
    x.send(file);
  }),
  bans: () => req<{ bans: Ban[] }>('/api/mod/bans'),
  ban: (id: string, reason: string) => req<{ ok: true; ban: Ban }>('/api/mod/ban', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, reason }) }),
  unban: (id: string) => req<{ ok: true }>(`/api/mod/ban/${id}`, { method: 'DELETE' })
};