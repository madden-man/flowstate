import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';
import { groupAlbums, buildAuthUrl, challengeFor, makeVerifier, playBody, playFromAlbum, playFromAlbumWithWake, PLAYLIST_URI, CLIENT_ID, SCOPES } from '../../src/music/spotify';

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

  it('skips local or removed tracks and picks a cover no wider than 640', () => {
    const albums = groupAlbums([{ track: null }, track('t1', 'Range of Light', 'S. Carey', [{ url: 'big', width: 1000 }, { url: 'mid', width: 640 }])]);
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
    expect(playBody('spotify:track:abc')).toEqual({ context_uri: PLAYLIST_URI, offset: { uri: 'spotify:track:abc' } });
  });

  it('PUTs that body to the player and reads the device state from the status', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(null, { status: 204 }); });
    expect(await playFromAlbum(tokens, { firstTrackUri: 'spotify:track:abc' })).toBe('playing');
    expect(calls[0].url).toBe('https://api.spotify.com/v1/me/player/play');
    expect(calls[0].init.method).toBe('PUT');
    expect(JSON.parse(String(calls[0].init.body))).toEqual(playBody('spotify:track:abc'));
    vi.unstubAllGlobals();
  });

  it('wakes the Spotify app on the playlist when no device is active, then retries', async () => {
    let n = 0;
    vi.stubGlobal('fetch', async () => new Response(null, { status: n++ === 0 ? 404 : 204 }));
    const opened: string[] = [];
    expect(await playFromAlbumWithWake(tokens, { firstTrackUri: 'spotify:track:abc' }, h => opened.push(h), 0)).toBe('playing');
    expect(opened).toEqual([PLAYLIST_URI]);
    vi.unstubAllGlobals();
  });
});
