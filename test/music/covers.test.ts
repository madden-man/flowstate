// Package 7 and V7: a playlist read with paging, grouped by album, covers fetched once and kept as bytes (V9) for a month, one
// shelf per playlist; /me/playlists and the guards for big playlists (snapshot skip, one at a time, the 429
// stop); now-playing written once onto a page; "Pages with this album".
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { freshDB } from '../db/helpers';
import { store } from '../../src/db/fields';
import { defaultSettings } from '../../src/db/seed';
import { POEMS_ID, coverBytes, type Playlist, type Settings } from '../../src/db/schema';
import {
  readPlaylist, storeShelf, shelf, keepCover, COVERS_AT_ONCE, COVERS_FIRST, COVER_MAX_AGE, isFresh, coverWhenNear, readMine, readChosen, playlistRows, choosePlaylist,
} from '../../src/music/covers';
import { ApiError, MY_PLAYLISTS_PATH, playlistItemsPath, groupAlbums, type Album } from '../../src/music/spotify';
import type { Keep } from '../../src/music/connect';
import { noteMusic, pagesWithAlbum } from '../../src/model/music';
import { newPage, writeLine } from '../../src/model/pages';

const API = 'https://api.spotify.com/v1';
const entry = (uri: string, album: string, artist: string) => ({
  item: { type: 'track', uri, album: { uri: `spotify:album:${album}`, name: album, images: [{ url: `https://i.scdn.co/${album}-640`, width: 640 }, { url: `https://i.scdn.co/${album}-300`, width: 300 }, { url: `https://i.scdn.co/${album}-64`, width: 64 }] }, artists: [{ name: artist }] },
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const blob = (s: string) => new Blob([s], { type: 'image/png' });
const a = (album: string, order: number): Album => ({ albumUri: `spotify:album:${album}`, album, artist: 'A', order, firstTrackUri: `t-${album}`, coverUrl: `c-${album}` });
const P = 'poems';
const playlistRow = (id: string, chosen = true, snapshotId = ''): Playlist => ({ id, name: `name ${id}`, uri: `spotify:playlist:${id}`, order: 0, snapshotId, total: 0, chosen });

const keep = (): Keep => {
  let row: Settings['spotify'] = { connectedAt: 1, tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 60_000 } };
  return { read: () => row, write: async n => { row = n; } };
};

beforeEach(async () => { await freshDB(); await store.put('settings', defaultSettings(0)); });
afterEach(() => vi.unstubAllGlobals());

describe('a playlist read', () => {
  it('follows next across pages, reads that playlist\'s /items path, and groups albums in first-song order', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      if (url === `${API}${playlistItemsPath('M')}`) return json({ items: [entry('t1', 'Oneknowing', 'Lena Raine'), entry('t2', 'Oneknowing', 'Lena Raine'), entry('t3', 'Pagan', 'CLANN')], next: `${API}/playlists/M/items?offset=50&limit=50` });
      if (url === `${API}/playlists/M/items?offset=50&limit=50`) return json({ items: [entry('t4', 'Pagan', 'CLANN'), { item: null }, { track: entry('t5', 'Range of Light', 'S. Carey').item }], next: null });
      if (url.startsWith('https://i.scdn.co/')) return new Response(blob(url));
      return json({}, 404);
    });
    await store.put('playlists', playlistRow('M'));
    const rows = await readPlaylist(keep(), { id: 'M' }, 'snap-2');
    expect(rows.map(r => r.album)).toEqual(['Oneknowing', 'Pagan', 'Range of Light']);
    expect(rows.map(r => r.firstTrackUri)).toEqual(['t1', 't3', 't5']);
    // V9: and each first song's place in the playlist, for a play Spotify will not start by uri
    expect((await shelf('M')).map(r => r.firstTrackAt)).toEqual([0, 2, 5]); // the removed track at 4 still counts
    expect(urls[0]).toContain('/playlists/M/items?limit=50');
    expect(urls.filter(u => u.startsWith('https://i.scdn.co/'))).toHaveLength(3);
    const kept = await shelf('M');
    expect(kept.map(r => r.order)).toEqual([0, 1, 2]);
    expect(kept.every(r => r.cover instanceof ArrayBuffer && r.coverType === 'image/png' && isFresh(r))).toBe(true);
    expect(new TextDecoder().decode(await coverBytes(kept[0].cover!))).toBe('https://i.scdn.co/Oneknowing-300');
    expect(await shelf('other')).toEqual([]);
    // the snapshot it was read at is kept, for the skip
    expect((await store.get('playlists', 'M'))?.snapshotId).toBe('snap-2');
  });

  it('skips episodes and fetches a cover once, across reads and across playlists', async () => {
    expect(groupAlbums([{ item: { ...entry('e1', 'Pod', 'X').item, type: 'episode' } }])).toEqual([]);
    const got: string[] = [];
    const getCover = async (u: string) => { got.push(u); return blob(u); };
    await storeShelf(P, [a('One', 0), a('Two', 1)], getCover);
    await storeShelf(P, [a('Two', 0), a('Three', 1)], getCover);
    await storeShelf('master', [a('Three', 0), a('One', 1)], getCover);
    expect(got).toEqual(['c-One', 'c-Two', 'c-Three']);
    expect((await shelf(P)).map(r => r.album)).toEqual(['Two', 'Three']);
    expect((await shelf('master')).map(r => r.album)).toEqual(['Three', 'One']);
  });

  it('an album gone from one playlist leaves that shelf only; its cover stays', async () => {
    await storeShelf(P, [a('One', 0), a('Two', 1)], async u => blob(u));
    await storeShelf('master', [a('One', 0)], async u => blob(u));
    await storeShelf(P, [a('Two', 0)], async u => blob(u));
    expect((await shelf(P)).map(r => r.album)).toEqual(['Two']);
    expect((await shelf('master')).map(r => r.album)).toEqual(['One']);
    await storeShelf('master', [], async u => blob(u));
    expect(await shelf('master')).toEqual([]);
    const one = await store.get('albums', 'spotify:album:One');
    expect(one?.cover).toBeInstanceOf(ArrayBuffer);
  });

  it('the shelf has every tile before a single cover arrives, and fills in as they land', async () => {
    const list = [a('One', 0), a('Two', 1), a('Three', 2), a('Four', 3), a('Five', 4), a('Six', 5)];
    let release!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    let started = 0;
    const getCover = async (u: string) => { started++; await gate; return blob(u); };
    const seen: number[] = [];
    const onProgress = async () => { seen.push((await shelf(P)).filter(r => r.cover).length); };
    const done = storeShelf(P, list, getCover, onProgress);
    await vi.waitFor(() => expect(started).toBe(COVERS_AT_ONCE));
    // the rows are written and the shelf shows six tiles while every cover is still on its way
    expect((await shelf(P)).map(r => r.album)).toEqual(['One', 'Two', 'Three', 'Four', 'Five', 'Six']);
    expect(seen).toEqual([0]);
    release();
    const rows = await done;
    expect(rows.every(r => r.cover instanceof ArrayBuffer)).toBe(true);
    expect(seen[seen.length - 1]).toBe(6);
    expect(seen.length).toBe(7);
  });

  it('a cover that fails to arrive is tried again next time', async () => {
    await storeShelf(P, [a('X', 0)], async () => { throw new TypeError('offline'); });
    expect((await shelf(P))[0].cover).toBeUndefined();
    await storeShelf(P, [a('X', 0)], async () => blob('x'));
    expect((await shelf(P))[0].cover).toBeInstanceOf(ArrayBuffer);
  });

  it('a big playlist fetches the first screen of covers; a tile below the fold fetches its own when near', async () => {
    const list = Array.from({ length: 40 }, (_, i) => a(`A${i}`, i));
    const got: string[] = [];
    await storeShelf('master', list, async u => { got.push(u); return blob(u); });
    expect(got).toHaveLength(COVERS_FIRST);
    expect((await shelf('master')).filter(r => r.cover)).toHaveLength(COVERS_FIRST);
    // two tiles scrolled near at once ask once
    const near = (u: string) => { got.push(u); return Promise.resolve(blob(u)); };
    const [c1, c2] = await Promise.all([coverWhenNear('spotify:album:A30', near), coverWhenNear('spotify:album:A30', near)]);
    expect(c1?.cover).toBeInstanceOf(ArrayBuffer);
    expect(c2).toBe(c1);
    expect(got.filter(u => u === 'c-A30')).toHaveLength(1);
    expect((await store.get('albums', 'spotify:album:A30'))?.cover).toBeInstanceOf(ArrayBuffer);
  });

  it('a kept cover is not fetched again within the month; past it, it is fetched again and the old one shows until then (V9)', async () => {
    const got: string[] = [];
    const getCover = async (u: string) => { got.push(u); return blob(`${u}@${got.length}`); };
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-11-08T12:00:00Z'));
      await storeShelf(P, [a('One', 0)], getCover);
      // a day on, a read again and a tile near ask nothing
      vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000);
      await storeShelf(P, [a('One', 0)], getCover);
      await coverWhenNear('spotify:album:One', getCover);
      await keepCover({ albumUri: 'spotify:album:One', album: 'One', artist: 'A', coverUrl: 'c-One', isPlaying: true }, getCover);
      expect(got).toEqual(['c-One']);
      // past the month: stale, still shown, fetched again once and dated now
      vi.setSystemTime(Date.now() + COVER_MAX_AGE);
      const stale = (await shelf(P))[0];
      expect(stale.cover).toBeTruthy();
      expect(isFresh(stale)).toBe(false);
      const fresh = await coverWhenNear('spotify:album:One', getCover);
      expect(got).toEqual(['c-One', 'c-One']);
      expect(fresh?.coverAt).toBe(Date.now());
      expect(new TextDecoder().decode(await coverBytes(fresh!.cover!))).toBe('c-One@2');
      // a stale cover whose fetch fails keeps the old one
      vi.setSystemTime(Date.now() + COVER_MAX_AGE);
      const kept = await coverWhenNear('spotify:album:One', async () => { throw new TypeError('offline'); });
      expect(new TextDecoder().decode(await coverBytes(kept!.cover!))).toBe('c-One@2');
    } finally {
      vi.useRealTimers();
    }
  });

  it('a cover kept as a Blob before V9 counts as stale, so it is fetched once more and kept as bytes', async () => {
    await store.put('albums', { albumUri: 'spotify:album:Old', album: 'Old', artist: 'A', coverUrl: 'c-Old', cover: blob('old') });
    expect(isFresh((await store.get('albums', 'spotify:album:Old'))!)).toBe(false);
    const row = await coverWhenNear('spotify:album:Old', async u => blob(u));
    expect(row?.cover).toBeInstanceOf(ArrayBuffer);
    expect(isFresh(row!)).toBe(true);
  });
});

describe('your playlists, and the guards for big ones (V7)', () => {
  const listed = (id: string, owner = 'tommy', snap = `snap-${id}`) => ({ id, name: `name ${id}`, uri: `spotify:playlist:${id}`, snapshot_id: snap, owner: { id: owner }, images: [], items: { total: 3 } });

  it('the first list ticks the Poems playlist; later lists keep the ticks and drop an unticked one that is gone', async () => {
    let lists = [[listed('master'), listed(POEMS_ID), listed('theirs', 'someone')], [listed(POEMS_ID)]];
    vi.stubGlobal('fetch', async (url: string) => {
      if (url === `${API}/me`) return json({ id: 'tommy' });
      if (url === `${API}${MY_PLAYLISTS_PATH}`) { const items = lists[0]; lists = lists.slice(1); return json({ items, next: null }); }
      return json({}, 404);
    });
    const first = await readMine(keep());
    expect(first.map(p => p.id)).toEqual(['master', POEMS_ID]);
    expect((await playlistRows()).map(p => [p.id, p.chosen])).toEqual([['master', false], [POEMS_ID, true]]);
    await choosePlaylist('master', true);
    await readMine(keep());
    // master is ticked, so it stays even though the list no longer has it
    expect((await playlistRows()).map(p => [p.id, p.chosen])).toEqual([[POEMS_ID, true], ['master', true]]);
  });

  it('ticks the named playlists (master (ii), staging, candidate) once; an untick after that stays (V8)', async () => {
    const MASTER = '1QDPVDJSXB9bIrfRg0V36q', STAGING = '7p9SkKTAcwlS8y5Gw8mv2w';
    vi.stubGlobal('fetch', async (url: string) => {
      if (url === `${API}/me`) return json({ id: 'tommy' });
      if (url === `${API}${MY_PLAYLISTS_PATH}`) return json({ items: [listed('other'), listed(MASTER), listed(STAGING)], next: null });
      return json({}, 404);
    });
    // an install from before V8: the Poems row from the upgrade, master already listed and never ticked
    await store.put('playlists', playlistRow(POEMS_ID));
    await store.put('playlists', playlistRow(MASTER, false));
    const k = keep();
    await readMine(k);
    expect((await playlistRows()).filter(p => p.chosen).map(p => p.id).sort()).toEqual([POEMS_ID, MASTER, STAGING].sort());
    expect(k.read()?.ticked?.sort()).toEqual([MASTER, STAGING].sort());
    await choosePlaylist(MASTER, false);
    await readMine(k);
    expect((await playlistRows()).find(p => p.id === MASTER)?.chosen).toBe(false);
    expect((await playlistRows()).find(p => p.id === 'other')?.chosen).toBe(false);
  });

  it('reads the chosen ones one after another, skips one whose snapshot has not moved, and reads it again when it has', async () => {
    let inFlight = 0, most = 0;
    const read: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      const m = url.match(/\/playlists\/(\w+)\/items/);
      if (m) {
        read.push(m[1]);
        inFlight++; most = Math.max(most, inFlight);
        await new Promise(r => setTimeout(r, 5));
        inFlight--;
        return json({ items: [entry(`t-${m[1]}`, `Album${m[1]}`, 'X')], next: null });
      }
      if (url.startsWith('https://i.scdn.co/')) return new Response(blob(url));
      return json({}, 404);
    });
    await store.bulkPut('playlists', [playlistRow('A'), { ...playlistRow('B'), order: 1 }, { ...playlistRow('C', false), order: 2 }]);
    const snaps = new Map([['A', 's1'], ['B', 's1'], ['C', 's1']]);
    const first = await readChosen(keep(), snaps);
    expect(first.read).toEqual(['A', 'B']);
    expect(most).toBe(1);
    const again = await readChosen(keep(), snaps);
    expect(again).toEqual({ read: [], skipped: ['A', 'B'], failed: [] });
    expect(read).toEqual(['A', 'B']);
    snaps.set('B', 's2');
    expect((await readChosen(keep(), snaps)).read).toEqual(['B']);
    expect(read).toEqual(['A', 'B', 'B']);
  });

  it('a 429 stops the read there, with Retry-After, and nothing is retried', async () => {
    const read: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      const m = url.match(/\/playlists\/(\w+)\/items/);
      if (m) { read.push(m[1]); return new Response(null, { status: 429, headers: { 'Retry-After': '240' } }); }
      return json({}, 404);
    });
    await store.bulkPut('playlists', [playlistRow('A'), { ...playlistRow('B'), order: 1 }]);
    const e = await readChosen(keep(), new Map()).catch(x => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.retryAfter).toBe(240);
    expect(read).toEqual(['A']);
    expect(await shelf('A')).toEqual([]);
  });

  it('a playlist Spotify refuses is noted and the next one is read', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('/playlists/A/items')) return json({}, 403);
      if (url.includes('/playlists/B/items')) return json({ items: [entry('t1', 'Pagan', 'CLANN')], next: null });
      return new Response(blob(url));
    });
    await store.bulkPut('playlists', [playlistRow('A'), { ...playlistRow('B'), order: 1 }]);
    const out = await readChosen(keep(), new Map());
    expect(out.read).toEqual(['B']);
    expect(out.failed.map(f => f.id)).toEqual(['A']);
  });
});

describe('now playing on a page', () => {
  const np = (album: string) => ({ albumUri: `spotify:album:${album}`, album, artist: 'Sigur Rós', coverUrl: `c-${album}`, isPlaying: true });

  it('keeps the cover of an album off the playlist, and reuses one already on the shelf', async () => {
    const got: string[] = [];
    const getCover = async (u: string) => { got.push(u); return blob(u); };
    const m = await keepCover(np('Takk'), getCover);
    expect(m).toEqual({ albumUri: 'spotify:album:Takk', album: 'Takk', artist: 'Sigur Rós', coverId: 'spotify:album:Takk' });
    expect((await store.get('albums', 'spotify:album:Takk'))?.cover).toBeInstanceOf(ArrayBuffer);
    expect(await shelf(POEMS_ID)).toEqual([]);
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
