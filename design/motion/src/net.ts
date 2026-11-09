// No network in the walkthrough: the global fetch is replaced before the app runs. The Spotify Web API calls the
// music sheet makes (the same calls test/e2e/music.spec.ts answers) are answered here from fixtures, as an account
// already connected with four playlists; a cover is answered from a file of the artifact; anything else is refused
// as a dropped connection would be, without a request ever leaving the page.
//
// Covers: the app keeps a fetched cover as bytes and shows it through URL.createObjectURL. The artifact host's
// content policy allows its own files, so the cover's file path rides in its type, and createObjectURL hands that
// path back to the <img> instead of a blob: URL. The bytes kept are a placeholder; the picture is the file.
import { POEMS_ID, NAMED_IDS } from '../../../src/music/poems';

const API = 'https://api.spotify.com/v1';
const ACCOUNTS = 'https://accounts.spotify.com';
/** How long Spotify takes to say it is playing: long enough to see the hush and the ring wait for it. */
export const PLAY_ANSWER_MS = 600;

type Alb = { id: string; name: string; artist: string; cover: string };
const named: Alb[] = [
  { id: 'celeste', name: 'Celeste', artist: 'Lena Raine', cover: 'covers/cover-1.jpg' },
  { id: 'all-we-grow', name: 'All We Grow', artist: 'S. Carey', cover: 'covers/cover-2.jpg' },
  { id: 'agaetis-byrjun', name: 'Ágætis byrjun', artist: 'Sigur Rós', cover: 'covers/cover-3.jpg' },
  { id: 'example-4', name: 'Example album 4', artist: 'Example artist', cover: 'covers/cover-4.jpg' },
];
const examples: Alb[] = Array.from({ length: 11 }, (_, i) => ({
  id: `example-${i + 5}`, name: `Example album ${i + 5}`, artist: 'Example artist', cover: `covers/cover-${i + 5}.svg`,
}));
const ALBUMS = [...named, ...examples];
/** The one album whose play Spotify refuses (a Premium refusal), so the refusal shows too: no ring, one line. */
export const REFUSED = 'All We Grow';

const [MASTER, STAGING, CANDIDATE] = [NAMED_IDS[1], NAMED_IDS[2], NAMED_IDS[3]];
const PLAYLISTS: { id: string; name: string; albums: Alb[] }[] = [
  { id: MASTER, name: 'master (ii)', albums: ALBUMS },
  { id: POEMS_ID, name: 'For the Poems and the Prose; May They Dance Forever', albums: [ALBUMS[0], ALBUMS[2], ALBUMS[6], ALBUMS[9], ALBUMS[12]] },
  { id: STAGING, name: 'staging', albums: [ALBUMS[4], ALBUMS[1], ALBUMS[7], ALBUMS[10]] },
  { id: CANDIDATE, name: 'candidate', albums: [ALBUMS[3], ALBUMS[5], ALBUMS[8], ALBUMS[11], ALBUMS[13], ALBUMS[14]] },
];
export const MASTER_ID = MASTER;

const trackUri = (playlistId: string, k: number) => `spotify:track:${playlistId.slice(0, 6)}-${k}`;
const albumUri = (a: Alb) => `spotify:album:${a.id}`;
const albumJson = (a: Alb) => ({ uri: albumUri(a), name: a.name, images: [{ url: a.cover, width: 300 }] });

/** What the player is playing, as the last answered play left it. */
let now: { album: Alb; context: string } | null = null;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const empty = (status = 204) => new Response(null, { status });
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

function items(playlistId: string) {
  const p = PLAYLISTS.find(x => x.id === playlistId);
  if (!p) return json({ error: { status: 404, message: 'Not found' } }, 404);
  // two songs for the first album, one for each after, so the grouping by album is the app's own work
  const tracks = p.albums.flatMap((a, i) => (i === 0 ? [a, a] : [a]));
  return json({ next: null, items: tracks.map((a, k) => ({ item: { type: 'track', uri: trackUri(p.id, k), album: albumJson(a), artists: [{ name: a.artist }] } })) });
}

/** The album a play body starts at, by its first song's uri or its place. */
function albumOfPlay(body: { context_uri?: string; offset?: { uri?: string; position?: number } }) {
  const p = PLAYLISTS.find(x => `spotify:playlist:${x.id}` === body.context_uri);
  if (!p) return null;
  const tracks = p.albums.flatMap((a, i) => (i === 0 ? [a, a] : [a]));
  const k = body.offset?.uri ? tracks.findIndex((_, j) => trackUri(p.id, j) === body.offset!.uri) : body.offset?.position ?? -1;
  return tracks[k] ? { album: tracks[k], context: body.context_uri! } : null;
}

async function spotify(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const bare = path.split('?')[0];
  if (bare === '/me') return json({ id: 'example', display_name: 'Example listener' });
  if (bare === '/me/playlists') {
    return json({ next: null, items: PLAYLISTS.map(p => ({ id: p.id, name: p.name, uri: `spotify:playlist:${p.id}`, snapshot_id: `demo-${p.id}`, owner: { id: 'example' }, images: [], items: { total: p.albums.length + 1 } })) });
  }
  const m = bare.match(/^\/playlists\/(\w+)\/items$/);
  if (m) return items(m[1]);
  if (bare === '/me/player/play' && method === 'PUT') {
    const asked = albumOfPlay(JSON.parse(String(init.body ?? '{}')));
    await wait(PLAY_ANSWER_MS);
    if (!asked) return json({ error: { status: 404, reason: 'NO_ACTIVE_DEVICE', message: 'Player command failed: No active device found' } }, 404);
    if (asked.album.name === REFUSED) return json({ error: { status: 403, reason: 'PREMIUM_REQUIRED', message: 'Player command failed: Premium required' } }, 403);
    now = asked;
    return empty();
  }
  if (bare === '/me/player/shuffle') return empty();
  if (bare === '/me/player/devices') return json({ devices: [{ id: 'example-phone', name: 'Example phone', type: 'Smartphone', is_active: true, is_restricted: false }] });
  if (bare === '/me/player/currently-playing') {
    if (!now) return empty();
    return json({ is_playing: true, context: { uri: now.context }, item: { album: albumJson(now.album), artists: [{ name: now.album.artist }] } });
  }
  return json({ error: { status: 404, message: 'Not found' } }, 404);
}

/** Every request the app makes comes here; none leaves the page. */
async function answer(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (/^covers\/[\w.-]+$/.test(url)) {
    const type = url.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg';
    return new Response(new Blob([url], { type: `${type};fs-cover=${url}` }), { status: 200 });
  }
  if (url.startsWith(API)) return spotify(url.slice(API.length), init);
  if (url.startsWith(`${ACCOUNTS}/api/token`)) return json({ access_token: 'example', refresh_token: 'example', expires_in: 3600 });
  throw new TypeError('No network in the walkthrough');
}

/** The cover's own file, from the path its type carries; any other Blob gets a real object URL. */
function coverUrls(): void {
  const make = URL.createObjectURL.bind(URL);
  const revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = (o: Blob | MediaSource) => {
    const m = o instanceof Blob ? /fs-cover=(covers\/[\w.-]+)/.exec(o.type) : null;
    return m ? m[1] : make(o);
  };
  URL.revokeObjectURL = (u: string) => { if (u.startsWith('blob:')) revoke(u); };
}

export function installNet(): void {
  Object.defineProperty(globalThis, 'fetch', { value: answer, configurable: true, writable: true });
  coverUrls();
}

/** The connected account, as the app keeps it after a sign-in. */
export const DEMO_TOKENS = { accessToken: 'example', refreshToken: 'example', expiresAt: Date.now() + 10 * 365 * 86_400_000, name: 'Example listener' };
