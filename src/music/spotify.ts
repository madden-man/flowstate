// The only file in FlowState allowed to fetch (CLAUDE.md rule 6, DESIGN lint).
// Authorization Code + PKCE on the phone; no client secret anywhere.
// Setup and the reuse decision: docs/SPOTIFY.md.

import { POEMS_ID } from './poems';

export const CLIENT_ID = 'a4ee189148b042dc8bfda38b9aed4cd2'; // FlowState's own Spotify app (Tommy, 2026-11-07); a client id is public
/** "For the Poems and the Prose; May They Dance Forever": the music line deep-links to it with no account. */
export const PLAYLIST_ID = POEMS_ID;
export const SCOPES = [
  'user-modify-playback-state',
  'user-read-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
];

const ACCOUNTS = 'https://accounts.spotify.com';
const API = 'https://api.spotify.com/v1';

export type Tokens = { accessToken: string; refreshToken: string; expiresAt: number };
/** firstTrackAt (V9) is that first song's place in the playlist, counted the way Spotify's play offset counts. */
export type Album = { albumUri: string; album: string; artist: string; order: number; firstTrackUri: string; firstTrackAt?: number; coverUrl: string };
/** contextUri (V7) is what Spotify is playing from, so the playlists list can mark the one playing. */
export type NowPlaying = { albumUri: string; album: string; artist: string; coverUrl: string; isPlaying: boolean; contextUri?: string } | null;

// ---- PKCE -------------------------------------------------------------

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function makeVerifier(): string {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

export function redirectUri(): string {
  // Spotify accepts the exact registered URL only; the app's own origin plus a trailing slash.
  return `${location.origin}/`;
}

export async function buildAuthUrl(verifier: string, state: string, redirect = redirectUri()): Promise<string> {
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirect,
    scope: SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: await challengeFor(verifier),
    state,
  });
  return `${ACCOUNTS}/authorize?${p}`;
}

/** A refused token call. invalid_grant means the refresh token is spent or revoked: sign in again. */
export class TokenError extends Error {
  constructor(readonly status: number, readonly code: string) { super(`spotify token ${status} ${code}`); this.name = 'TokenError'; }
}

async function tokenCall(body: Record<string, string>): Promise<Tokens> {
  const r = await fetch(`${ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...body }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new TokenError(r.status, String(j.error ?? ''));
  }
  const j = await r.json();
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token ?? body.refresh_token, // PKCE rotates refresh tokens; keep the old one if none came back
    expiresAt: Date.now() + (j.expires_in - 30) * 1000,
  };
}

export const exchangeCode = (code: string, verifier: string, redirect = redirectUri()) =>
  tokenCall({ grant_type: 'authorization_code', code, redirect_uri: redirect, code_verifier: verifier });

export const refresh = (t: Tokens) =>
  tokenCall({ grant_type: 'refresh_token', refresh_token: t.refreshToken });

// One refresh at a time: Spotify may rotate the refresh token, so a second refresh racing the first
// would spend a token that is already gone.
let refreshing: Promise<Tokens> | null = null;

export async function fresh(t: Tokens, save: (t: Tokens) => Promise<void>, force = false): Promise<Tokens> {
  if (!force && Date.now() < t.expiresAt) return t;
  if (!refreshing) {
    refreshing = refresh(t).then(async n => { await save(n); return n; }).finally(() => { refreshing = null; });
  }
  return refreshing;
}

// ---- API --------------------------------------------------------------

/** A Web API answer that was not ok. 401 means the access token has run out early: refresh and try once more.
 *  429 means Spotify asks for a pause: retryAfter is its Retry-After in seconds, and nothing asks again by itself. */
export class ApiError extends Error {
  constructor(what: string, readonly status: number, readonly retryAfter?: number) { super(`${what} ${status}`); this.name = 'ApiError'; }
}

const refused = (what: string, r: Response) => {
  const after = Number(r.headers.get('Retry-After'));
  return new ApiError(what, r.status, r.status === 429 && Number.isFinite(after) && after > 0 ? after : undefined);
};

async function api(t: Tokens, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${t.accessToken}`, ...(init.headers ?? {}) } });
}

type PlaylistTrack = { type?: string; uri: string; album: { uri: string; name: string; images: { url: string; width: number }[] }; artists: { name: string }[] };
// Since February 2026 the entry's key is `item`; `track` is the deprecated old name, still read for safety.
export type PlaylistItem = { item?: PlaylistTrack | null; track?: PlaylistTrack | null };

/** A playlist's first page. February 2026: `/tracks` became `/items`, 50 a page at most, and only for a
 *  playlist the signed-in account owns or collaborates on (only owned ones are ever read). */
export const playlistItemsPath = (id: string) =>
  `/playlists/${id}/items?limit=50&fields=next,items(item(type,uri,album(uri,name,images),artists(name)))`;

/** Every page of a playlist, one after another. A refused page (a 429 included) stops the read there. */
export async function readPlaylistItems(t: Tokens, id: string): Promise<PlaylistItem[]> {
  const items: PlaylistItem[] = [];
  let url: string | null = playlistItemsPath(id);
  while (url) {
    const r = await api(t, url);
    if (!r.ok) throw refused('spotify playlist', r);
    const j = await r.json();
    items.push(...j.items);
    url = j.next ? j.next.replace(API, '') : null;
  }
  return items;
}

/** A playlist the account owns, as /me/playlists lists it (V7). order is its place in that list; snapshotId
 *  changes whenever the playlist does, so an unchanged one is never read again. */
export type MyPlaylist = { id: string; name: string; uri: string; order: number; snapshotId: string; total: number; coverUrl: string };

type ListedPlaylist = {
  id: string; name: string; uri: string; snapshot_id: string;
  images?: { url: string; width: number | null }[] | null;
  owner?: { id: string } | null;
  // February 2026 renamed the count's key from tracks to items; whichever came is read
  items?: { total: number } | null; tracks?: { total: number } | null;
};

export const MY_PLAYLISTS_PATH = '/me/playlists?limit=50&fields=next,items(id,name,uri,snapshot_id,images,owner(id),items(total),tracks(total))';

/** The playlists the signed-in account owns, in Spotify's order, every page followed. Another account's
 *  playlists are left out: their items are refused since February 2026 anyway. */
export async function readMyPlaylists(t: Tokens): Promise<MyPlaylist[]> {
  const mine = (await account(t)).id;
  const out: MyPlaylist[] = [];
  let url: string | null = MY_PLAYLISTS_PATH;
  let order = 0;
  while (url) {
    const r = await api(t, url);
    if (!r.ok) throw refused('spotify playlists', r);
    const j = await r.json();
    for (const p of (j.items ?? []) as (ListedPlaylist | null)[]) {
      if (!p?.id) continue;
      const at = order++;
      // another account's playlist is left out; one with no owner field at all (a trimmed object) is kept, and
      // a read of its items that Spotify refuses is noted for that playlist alone
      if (p.owner?.id && p.owner.id !== mine) continue;
      const img = [...(p.images ?? [])].sort((a, b) => (a.width ?? 0) - (b.width ?? 0)).find(i => (i.width ?? 300) >= 60) ?? p.images?.[0];
      out.push({
        id: p.id, name: p.name, uri: p.uri || `spotify:playlist:${p.id}`, order: at, snapshotId: p.snapshot_id ?? '',
        total: (p.items ?? p.tracks)?.total ?? 0, coverUrl: img?.url ?? '',
      });
    }
    url = j.next ? j.next.replace(API, '') : null;
  }
  return out;
}

// Pure: group tracks by album, keeping the order each album first appears in the playlist.
export function groupAlbums(items: PlaylistItem[]): Album[] {
  const seen = new Map<string, Album>();
  for (const [at, it] of items.entries()) {
    const tr = it.item ?? it.track;
    if (!tr || (tr.type && tr.type !== 'track') || !tr.album?.uri || seen.has(tr.album.uri)) continue;
    // the 300px cover: a tile is about a third of the phone, and the 640px one is four times the bytes
    const cover = [...tr.album.images].sort((a, b) => b.width - a.width).find(i => i.width <= 300) ?? tr.album.images[0];
    seen.set(tr.album.uri, {
      albumUri: tr.album.uri,
      album: tr.album.name,
      artist: tr.artists.map(a => a.name).join(', '),
      order: seen.size,
      firstTrackUri: tr.uri,
      firstTrackAt: at,
      coverUrl: cover?.url ?? '',
    });
  }
  return [...seen.values()];
}

export async function fetchCover(url: string): Promise<Blob> {
  const r = await fetch(url);
  if (!r.ok) throw new ApiError('cover', r.status);
  return r.blob();
}

// Play the playlist itself, starting at the tapped album's first song, so Spotify carries on into the
// next album when this one ends. With no active device Spotify answers 404; the caller opens the playlist
// link to wake the app, then retries.
export const PLAYLIST_URI = `spotify:playlist:${PLAYLIST_ID}`;

export function playBody(playlistUri: string, firstTrackUri: string, firstTrackAt?: number) {
  return { context_uri: playlistUri, offset: firstTrackAt === undefined ? { uri: firstTrackUri } : { position: firstTrackAt } };
}

/** not-found (V9): Spotify had the device but would not start at that song (a stale or unplayable offset). */
export type PlayResult = 'playing' | 'no-device' | 'not-premium' | 'not-found';
type PlayAlbum = Pick<Album, 'firstTrackUri' | 'firstTrackAt'> & { albumUri?: string };

const reasonOf = async (r: Response): Promise<string> => {
  try { const j = await r.json(); return `${j?.error?.reason ?? ''} ${j?.error?.message ?? ''}`; } catch { return ''; }
};

/** One play call: the playlist from the album's first song (by its uri, or by its place), on a device when one is named. */
export async function playFromAlbum(t: Tokens, playlistUri: string, album: PlayAlbum, deviceId?: string, byPlace = false): Promise<PlayResult> {
  const r = await api(t, `/me/player/play${deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ''}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(playBody(playlistUri, album.firstTrackUri, byPlace ? album.firstTrackAt : undefined)),
  });
  if (r.status === 204 || r.status === 200 || r.status === 202) return 'playing';
  const why = await reasonOf(r);
  if (r.status === 404) return !why.trim() || /device/i.test(why) ? 'no-device' : 'not-found';
  if (r.status === 403 && (!why.trim() || /premium/i.test(why))) return 'not-premium';
  if (r.status === 400 && /offset|track|uri|position/i.test(why)) return 'not-found';
  throw refused('spotify play', r);
}

/** How long to give Spotify's player after a 5xx before looking whether the play landed anyway. */
export const GATEWAY_WAIT_MS = 900;

/** True when Spotify is now playing this playlist, at this album (a play answered with a 5xx may still land). */
async function landed(t: Tokens, playlistUri: string, album: PlayAlbum): Promise<boolean> {
  try {
    const np = await nowPlaying(t);
    return !!np && np.contextUri === playlistUri && (!album.albumUri || np.albumUri === album.albumUri);
  } catch { return false; }
}

/** A device Spotify knows the account by (Connect): the phone's app, a speaker, a computer. */
export type Device = { id: string; name: string; type: string; isActive: boolean; isRestricted: boolean };

export async function devices(t: Tokens): Promise<Device[]> {
  const r = await api(t, '/me/player/devices');
  if (!r.ok) throw refused('spotify devices', r);
  const j = await r.json();
  return ((j.devices ?? []) as Record<string, unknown>[]).filter(d => d?.id).map(d => ({
    id: String(d.id), name: String(d.name ?? ''), type: String(d.type ?? ''), isActive: !!d.is_active, isRestricted: !!d.is_restricted,
  }));
}

/** Where a tap should play: the active device, else the phone, else any that takes commands. */
export function pickDevice(ds: Device[]): Device | undefined {
  const ok = ds.filter(d => !d.isRestricted);
  return ok.find(d => d.isActive) ?? ok.find(d => d.type === 'Smartphone') ?? ok[0];
}

/** A tile tapped (V9). Plays the playlist from the album's first song: on the active device; with none active
 *  (Spotify on the phone idle in the background), on the phone's Spotify by its device id; a song Spotify will
 *  not start by uri is tried by its place in the playlist. Shuffle goes off, so the albums run in order.
 *  'no-device' only when Spotify knows no device at all (its app is not running). */
export async function playAlbum(t: Tokens, playlistUri: string, album: PlayAlbum, waitMs = GATEWAY_WAIT_MS): Promise<PlayResult> {
  let device: string | undefined;
  // V14: Spotify answers 502/503/504 when its player times out, most of all starting a song by uri in a playlist
  // thousands long (master (ii), 6,095). Such a play may still land: look before trying again, then try by place.
  const once = async (byPlace = false): Promise<PlayResult | 'gateway'> => {
    try { return await playFromAlbum(t, playlistUri, album, device, byPlace); } catch (e) {
      if (e instanceof ApiError && e.status >= 500) return 'gateway';
      throw e;
    }
  };
  let r = await once();
  if (r === 'no-device') {
    device = pickDevice(await devices(t))?.id;
    if (device) r = await once();
  }
  if (r === 'gateway') {
    await new Promise(res => setTimeout(res, waitMs));
    if (await landed(t, playlistUri, album)) r = 'playing';
    else r = await once(album.firstTrackAt !== undefined);
    if (r === 'gateway') throw new ApiError('spotify play', 502);
  }
  if (r === 'not-found' && album.firstTrackAt !== undefined) r = await once(true);
  if (r === 'gateway') throw new ApiError('spotify play', 502);
  if (r === 'playing') {
    await api(t, `/me/player/shuffle?state=false${device ? `&device_id=${encodeURIComponent(device)}` : ''}`, { method: 'PUT' }).catch(() => undefined);
  }
  return r;
}

export function playlistLink(): string {
  return PLAYLIST_URI; // opens the Spotify app on the playlist (iOS); the caller sets it as an <a href>
}

export const PLAYLIST_WEB = `https://open.spotify.com/playlist/${PLAYLIST_ID}`;

/** With no account: point the phone at the playlist. Both are navigations, never fetches: the spotify:
 *  URI wakes the app; if the page is still in front a moment later (no app), the web player opens. */
export function openPlaylist(go: (href: string) => void = h => location.assign(h), waitMs = 1200): void {
  go(PLAYLIST_URI);
  setTimeout(() => { if (typeof document === 'undefined' || document.visibilityState === 'visible') go(PLAYLIST_WEB); }, waitMs);
}

/** The signed-in account: its id (whose playlists are its own) and its display name. */
export async function account(t: Tokens): Promise<{ id: string; name: string }> {
  const r = await api(t, '/me');
  if (!r.ok) throw refused('spotify me', r);
  const j = await r.json();
  return { id: String(j.id ?? ''), name: String(j.display_name ?? j.id ?? '') };
}

/** The signed-in account's display name, for "Connected as". */
export async function me(t: Tokens): Promise<string> {
  return (await account(t)).name;
}

export async function nowPlaying(t: Tokens): Promise<NowPlaying> {
  const r = await api(t, '/me/player/currently-playing');
  if (r.status === 204) return null;
  if (!r.ok) throw new ApiError('spotify now', r.status);
  const j = await r.json();
  const item = j.item;
  if (!item?.album) return null;
  const cover = item.album.images?.find((i: { width: number }) => i.width <= 300) ?? item.album.images?.[0];
  return {
    albumUri: item.album.uri,
    album: item.album.name,
    artist: item.artists.map((a: { name: string }) => a.name).join(', '),
    coverUrl: cover?.url ?? '',
    isPlaying: !!j.is_playing,
    contextUri: typeof j.context?.uri === 'string' ? j.context.uri : undefined,
  };
}
