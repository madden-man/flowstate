// Package 7: the playlist read with paging, grouped by album, covers fetched once and kept as blobs;
// now-playing written once onto a page; "Pages with this album".
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { freshDB } from '../db/helpers';
import { store } from '../../src/db/fields';
import { defaultSettings } from '../../src/db/seed';
import type { Settings } from '../../src/db/schema';
import { readPlaylist, storeAlbums, shelf, keepCover } from '../../src/music/covers';
import { PLAYLIST_PATH, groupAlbums, type Album } from '../../src/music/spotify';
import type { Keep } from '../../src/music/connect';
import { noteMusic, pagesWithAlbum } from '../../src/model/music';
import { newPage, writeLine } from '../../src/model/pages';

const API = 'https://api.spotify.com/v1';
const entry = (uri: string, album: string, artist: string) => ({
  item: { type: 'track', uri, album: { uri: `spotify:album:${album}`, name: album, images: [{ url: `https://i.scdn.co/${album}-640`, width: 640 }] }, artists: [{ name: artist }] },
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const blob = (s: string) => new Blob([s], { type: 'image/png' });

const keep = (): Keep => {
  let row: Settings['spotify'] = { connectedAt: 1, tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 60_000 } };
  return { read: () => row, write: async n => { row = n; } };
};

beforeEach(async () => { await freshDB(); await store.put('settings', defaultSettings(0)); });
afterEach(() => vi.unstubAllGlobals());

describe('the playlist read', () => {
  it('follows next across pages, reads the /items path, and groups albums in first-appearance order', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      if (url === `${API}${PLAYLIST_PATH}`) return json({ items: [entry('t1', 'Oneknowing', 'Lena Raine'), entry('t2', 'Oneknowing', 'Lena Raine'), entry('t3', 'Pagan', 'CLANN')], next: `${API}/playlists/x/items?offset=50&limit=50` });
      if (url === `${API}/playlists/x/items?offset=50&limit=50`) return json({ items: [entry('t4', 'Pagan', 'CLANN'), { item: null }, { track: entry('t5', 'Range of Light', 'S. Carey').item }], next: null });
      if (url.startsWith('https://i.scdn.co/')) return new Response(blob(url));
      return json({}, 404);
    });
    const rows = await readPlaylist(keep());
    expect(rows.map(r => r.album)).toEqual(['Oneknowing', 'Pagan', 'Range of Light']);
    expect(rows.map(r => r.firstTrackUri)).toEqual(['t1', 't3', 't5']);
    expect(urls[0]).toContain('/playlists/0T6Gzc2hN81u3vGC5IJZ9a/items?limit=50');
    expect(urls.filter(u => u.startsWith('https://i.scdn.co/'))).toHaveLength(3);
    const kept = await shelf();
    expect(kept.map(r => r.order)).toEqual([0, 1, 2]);
    expect(kept.every(r => r.cover instanceof Blob)).toBe(true);
    expect(await kept[0].cover!.text()).toBe('https://i.scdn.co/Oneknowing-640');
  });

  it('skips episodes and fetches a cover once: a refresh only fetches the new album', async () => {
    expect(groupAlbums([{ item: { ...entry('e1', 'Pod', 'X').item, type: 'episode' } }])).toEqual([]);
    const got: string[] = [];
    const getCover = async (u: string) => { got.push(u); return blob(u); };
    const a = (album: string, order: number): Album => ({ albumUri: `spotify:album:${album}`, album, artist: 'A', order, firstTrackUri: `t-${album}`, coverUrl: `c-${album}` });
    await storeAlbums([a('One', 0), a('Two', 1)], getCover);
    await storeAlbums([a('Two', 0), a('Three', 1)], getCover);
    expect(got).toEqual(['c-One', 'c-Two', 'c-Three']);
    expect((await shelf()).map(r => r.album)).toEqual(['Two', 'Three']);
    // One left the playlist: kept off the shelf, never deleted, its cover still there
    const one = await store.get('albums', 'spotify:album:One');
    expect(one?.order).toBe(-1);
    expect(one?.cover).toBeInstanceOf(Blob);
  });

  it('a cover that fails to arrive is tried again next time', async () => {
    const a: Album = { albumUri: 'spotify:album:X', album: 'X', artist: 'A', order: 0, firstTrackUri: 't', coverUrl: 'c' };
    await storeAlbums([a], async () => { throw new TypeError('offline'); });
    expect((await shelf())[0].cover).toBeUndefined();
    await storeAlbums([a], async () => blob('x'));
    expect((await shelf())[0].cover).toBeInstanceOf(Blob);
  });
});

describe('now playing on a page', () => {
  const np = (album: string) => ({ albumUri: `spotify:album:${album}`, album, artist: 'Sigur Rós', coverUrl: `c-${album}`, isPlaying: true });

  it('keeps the cover of an album off the playlist, and reuses one already on the shelf', async () => {
    const got: string[] = [];
    const getCover = async (u: string) => { got.push(u); return blob(u); };
    const m = await keepCover(np('Takk'), getCover);
    expect(m).toEqual({ albumUri: 'spotify:album:Takk', album: 'Takk', artist: 'Sigur Rós', coverId: 'spotify:album:Takk' });
    expect((await store.get('albums', 'spotify:album:Takk'))?.order).toBe(-1);
    expect(await shelf()).toEqual([]);
    await keepCover(np('Takk'), getCover);
    expect(got).toEqual(['c-Takk']);
  });

  it('writes the album onto the page the first time only, even over a stale copy', async () => {
    const r = await writeLine(undefined, undefined, { text: 'Listen to the quiet voices within.' }, 1000);
    const page = r!.page;
    const first = { albumUri: 'spotify:album:Takk', album: 'Takk', artist: 'Sigur Rós', coverId: 'spotify:album:Takk' };
    expect((await noteMusic(page.id, first, 2000))?.music).toEqual(first);
    expect(await noteMusic(page.id, { albumUri: 'spotify:album:Other', album: 'Other', artist: 'B' }, 3000)).toBeNull();
    expect((await store.get('pages', page.id))?.music).toEqual(first);

    // a cover that could not be kept the first time is filled in later; the album itself never changes
    const p2 = newPage('question', 4000, { title: 'How can I gauge my pleasure/pain barometer?' });
    await store.put('pages', p2);
    await noteMusic(p2.id, { albumUri: 'spotify:album:Pagan', album: 'Pagan', artist: 'CLANN' });
    await noteMusic(p2.id, { albumUri: 'spotify:album:Pagan', album: 'Pagan', artist: 'CLANN', coverId: 'spotify:album:Pagan' });
    expect((await store.get('pages', p2.id))?.music?.coverId).toBe('spotify:album:Pagan');
  });

  it('"Pages with this album" lists every page that heard it, newest first, with its line', async () => {
    const takk = { albumUri: 'spotify:album:Takk', album: 'Takk', artist: 'Sigur Rós' };
    const a = (await writeLine(undefined, undefined, { text: 'All this, and I am reduced to simple journaling.' }, 1000))!.page;
    const b = newPage('question', 2000, { title: 'How do I retain skills built on dysfunctional beliefs?' });
    await store.put('pages', b);
    const c = newPage('council', 3000);
    await store.put('pages', c);
    await noteMusic(a.id, takk);
    await noteMusic(b.id, takk);
    await noteMusic(c.id, { ...takk, albumUri: 'spotify:album:Other' });
    const rows = await pagesWithAlbum('spotify:album:Takk');
    expect(rows.map(r => r.line)).toEqual(['How do I retain skills built on dysfunctional beliefs?', 'All this, and I am reduced to simple journaling.']);
  });
});
