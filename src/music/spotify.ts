// The only file in FlowState allowed to fetch (CLAUDE.md rule 6, DESIGN lint).
// Authorization Code + PKCE on the phone; no client secret anywhere.
// Setup and the reuse decision: docs/SPOTIFY.md.

export const CLIENT_ID = 'a4ee189148b042dc8bfda38b9aed4cd2'; // FlowState's own Spotify app (Tommy, 2026-11-07); a client id is public
export const PLAYLIST_ID = '0T6Gzc2hN81u3vGC5IJZ9a'; // "For the Poems and the Prose; May They Dance Forever"
export const SCOPES = [
  'user-modify-playback-state',
  'user-read-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
];

const ACCOUNTS = 'https://accounts.spotify.com';
const API = 'https://api.spotify.com/v1';

export type Tokens = { accessToken: string; refreshToken: string; expiresAt: number };
export type Album = { albumUri: string; album: string; artist: string; order: number; firstTrackUri: string; coverUrl: string };
export type NowPlaying = { albumUri: string; album: string; artist: string; coverUrl: string; isPlaying: boolean } | null;

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

/** A Web API answer that was not ok. 401 means the access token has run out early: refresh and try once more. */
export class ApiError extends Error {
  constructor(what: string, readonly status: number) { super(`${what} ${status}`); this.name = 'ApiError'; }
}

async function api(t: Tokens, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${t.accessToken}`, ...(init.headers ?? {}) } });
}

type PlaylistTrack = { type?: string; uri: string; album: { uri: string; name: string; images: { url: string; width: number }[] }; artists: { name: string }[] };
// Since February 2026 the entry's key is `item`; `track` is the deprecated old name, still read for safety.
export type PlaylistItem = { item?: PlaylistTrack | null; track?: PlaylistTrack | null };

/** The playlist's first page. February 2026: `/tracks` became `/items`, 50 a page at most, and only for a
 *  playlist the signed-in account owns or collaborates on (Tommy's own playlist is). */
export const PLAYLIST_PATH = `/playlists/${PLAYLIST_ID}/items?limit=50&fields=next,items(item(type,uri,album(uri,name,images),artists(name)))`;

export async function readPlaylistItems(t: Tokens): Promise<PlaylistItem[]> {
  const items: PlaylistItem[] = [];
  let url: string | null = PLAYLIST_PATH;
  while (url) {
    const r = await api(t, url);
    if (!r.ok) throw new ApiError('spotify playlist', r.status);
    const j = await r.json();
    items.push(...j.items);
    url = j.next ? j.next.replace(API, '') : null;
  }
  return items;
}

// Pure: group tracks by album, keeping the order each album first appears in the playlist.
export function groupAlbums(items: PlaylistItem[]): Album[] {
  const seen = new Map<string, Album>();
  for (const it of items) {
    const tr = it.item ?? it.track;
    if (!tr || (tr.type && tr.type !== 'track') || !tr.album?.uri || seen.has(tr.album.uri)) continue;
    const cover = [...tr.album.images].sort((a, b) => b.width - a.width).find(i => i.width <= 640) ?? tr.album.images[0];
    seen.set(tr.album.uri, {
      albumUri: tr.album.uri,
      album: tr.album.name,
      artist: tr.artists.map(a => a.name).join(', '),
      order: seen.size,
      firstTrackUri: tr.uri,
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

export function playBody(firstTrackUri: string) {
  return { context_uri: PLAYLIST_URI, offset: { uri: firstTrackUri } };
}

export type PlayResult = 'playing' | 'no-device' | 'not-premium';

export async function playFromAlbum(t: Tokens, album: Pick<Album, 'firstTrackUri'>): Promise<PlayResult> {
  const r = await api(t, '/me/player/play', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(playBody(album.firstTrackUri)),
  });
  if (r.status === 204 || r.status === 200) return 'playing';
  if (r.status === 404) return 'no-device';
  if (r.status === 403) return 'not-premium';
  throw new ApiError('spotify play', r.status);
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

/** The signed-in account's display name, for "Connected as". */
export async function me(t: Tokens): Promise<string> {
  const r = await api(t, '/me');
  if (!r.ok) throw new ApiError('spotify me', r.status);
  const j = await r.json();
  return String(j.display_name ?? j.id ?? '');
}

export async function playFromAlbumWithWake(t: Tokens, album: Pick<Album, 'firstTrackUri'>, open: (href: string) => void, waitMs = 2500) {
  const first = await playFromAlbum(t, album);
  if (first !== 'no-device') return first;
  open(playlistLink());
  await new Promise(r => setTimeout(r, waitMs));
  return playFromAlbum(t, album);
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
  };
}
