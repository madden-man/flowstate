import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';
import { groupAlbums, readMyPlaylists, readPlaylistItems, ApiError, MY_PLAYLISTS_PATH, buildAuthUrl, challengeFor, makeVerifier, playBody, playFromAlbum, playFromAlbumWithWake, PLAYLIST_URI, PLAYLIST_WEB, CLIENT_ID, SCOPES, openPlaylist } from '../../src/music/spotify';

const track = (uri: string, album: string, artist: string, images = [{ url: `${album}-640`, width: 640 }, { url: `${album}-300`, width: 300 }]) => ({
  track: { uri, album: { uri: `spotify:album:${album}`, name: album, images }, artists: [{ name: artist }] },
});

describe('groupAlbums', () => {
  it('keeps one entry per album in first-appearance order with the first track', () => {
    const albums = groupAlbums([
      track('t1', 'Oneknowing', 'Lena Raine'),
      track('t2', 'Oneknowing', 'Lena Raine'),
      track('t3', 'Ágætis byrjun', 'Sigur Rós'),
      track('t4', 'Oneknowing', 'Lena Raine'),
    ]);
    expect(albums.map(a => a.album)).toEqual(['Oneknowing', 'Ágætis byrjun']);
    expect(albums[0].firstTrackUri).toBe('t1');
    expect(albums.map(a => a.order)).toEqual([0, 1]);
  });

  it('skips local or removed tracks and picks a cover no wider than 300', () => {
    const albums = groupAlbums([{ track: null }, track('t1', 'Range of Light', 'S. Carey', [{ url: 'big', width: 640 }, { url: 'mid', width: 300 }, { url: 'small', width: 64 }])]);
    expect(albums).toHaveLength(1);
    expect(albums[0].coverUrl).toBe('mid');
  });
});

describe('auth url', () => {
  it('carries the shared client id, S256 and every scope, and no secret', async () => {
    const v = makeVerifier();
    const url = new URL(await buildAuthUrl(v, 'st', 'https://example.test/'));
    expect(url.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe(await challengeFor(v));
    expect(url.searchParams.get('scope')).toBe(SCOPES.join(' '));
    expect(url.searchParams.has('client_secret')).toBe(false);
  });
});

describe('play from an album', () => {
  const tokens = { accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 60000 };

  it('plays the playlist itself, offset to the album\'s first song', () => {
    expect(playBody(PLAYLIST_URI, 'spotify:track:abc')).toEqual({ context_uri: PLAYLIST_URI, offset: { uri: 'spotify:track:abc' } });
    expect(playBody('spotify:playlist:M', 'spotify:track:abc').context_uri).toBe('spotify:playlist:M');
  });

  it('PUTs that body to the player and reads the device state from the status', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(null, { status: 204 }); });
    expect(await playFromAlbum(tokens, PLAYLIST_URI, { firstTrackUri: 'spotify:track:abc' })).toBe('playing');
    expect(calls[0].url).toBe('https://api.spotify.com/v1/me/player/play');
    expect(calls[0].init.method).toBe('PUT');
    expect(JSON.parse(String(calls[0].init.body))).toEqual(playBody(PLAYLIST_URI, 'spotify:track:abc'));
    vi.unstubAllGlobals();
  });

  it('wakes the Spotify app on the playlist when no device is active, then retries', async () => {
    let n = 0;
    vi.stubGlobal('fetch', async () => new Response(null, { status: n++ === 0 ? 404 : 204 }));
    const opened: string[] = [];
    expect(await playFromAlbumWithWake(tokens, PLAYLIST_URI, { firstTrackUri: 'spotify:track:abc' }, h => opened.push(h), 0)).toBe('playing');
    expect(opened).toEqual([PLAYLIST_URI]);
    vi.unstubAllGlobals();
  });
});

describe('with no account', () => {
  it('points the phone at the playlist: the spotify: URI, then the web player if the page is still in front', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('document', { visibilityState: 'visible' });
    const went: string[] = [];
    openPlaylist(h => went.push(h), 1200);
    expect(went).toEqual([PLAYLIST_URI]);
    vi.advanceTimersByTime(1200);
    expect(went).toEqual([PLAYLIST_URI, PLAYLIST_WEB]);
    expect(PLAYLIST_WEB).toBe('https://open.spotify.com/playlist/0T6Gzc2hN81u3vGC5IJZ9a');

    // the Spotify app opened: the page went to the back, so the web player stays shut
    const again: string[] = [];
    openPlaylist(h => again.push(h), 1200);
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    vi.advanceTimersByTime(1200);
    expect(again).toEqual([PLAYLIST_URI]);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});

describe('your playlists (V7)', () => {
  const tokens = { accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 60000 };
  const API = 'https://api.spotify.com/v1';
  const pl = (id: string, owner: string, count: Record<string, unknown>) => ({
    id, name: `name ${id}`, uri: `spotify:playlist:${id}`, snapshot_id: `snap-${id}`, owner: { id: owner },
    images: [{ url: `${id}-640`, width: 640 }, { url: `${id}-60`, width: 60 }], ...count,
  });

  it('pages /me/playlists, reads items(total) or tracks(total), and keeps only the account\'s own', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      if (url === `${API}/me`) return Response.json({ id: 'tommy', display_name: 'Thomas Madden' });
      if (url === `${API}${MY_PLAYLISTS_PATH}`) return Response.json({ items: [pl('A', 'tommy', { items: { total: 3120 } }), pl('B', 'someone', { items: { total: 9 } })], next: `${API}/me/playlists?offset=50&limit=50` });
      // D carries no owner field at all (a trimmed object): it is kept, only another account's playlist is left out
      if (url === `${API}/me/playlists?offset=50&limit=50`) return Response.json({ items: [null, pl('C', 'tommy', { tracks: { total: 41 } }), { ...pl('D', 'tommy', { items: { total: 2 } }), owner: undefined }], next: null });
      return new Response(null, { status: 404 });
    });
    const mine = await readMyPlaylists(tokens);
    expect(mine.map(p => p.id)).toEqual(['A', 'C', 'D']);
    expect(mine.map(p => p.total)).toEqual([3120, 41, 2]);
    expect(mine.map(p => p.order)).toEqual([0, 2, 3]);
    expect(mine[0]).toMatchObject({ name: 'name A', uri: 'spotify:playlist:A', snapshotId: 'snap-A', coverUrl: 'A-60' });
    expect(urls[1]).toContain('/me/playlists?limit=50');
    expect(urls[1]).toContain('items(total)');
    expect(urls[1]).toContain('tracks(total)');
    expect(urls[1]).toContain('owner(id)');
    vi.unstubAllGlobals();
  });

  it('a 429 stops the read with Spotify\'s Retry-After, and nothing asks again', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', async () => { calls++; return new Response(null, { status: 429, headers: { 'Retry-After': '240' } }); });
    const e = await readPlaylistItems(tokens, 'A').catch(x => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(429);
    expect(e.retryAfter).toBe(240);
    expect(calls).toBe(1);
    vi.unstubAllGlobals();
  });
});
