// The shelves (PLAN.md section 8.1, PLAN-V3.md section 5): each chosen playlist read once, grouped by album in
// first-song order, one shelf row per album per playlist; each cover fetched once and kept as a Blob in the
// albums table (one cover per album however many playlists hold it), so the grids draw offline. Every row
// goes through the store. An album that leaves a playlist leaves that playlist's shelf only: its albums row
// and cover stay, because another playlist or a page that heard it still shows the cover.
import type { Album as Row, PageMusic, Playlist, Shelf } from '../db/schema';
import { NAMED_IDS } from './poems';
import { store } from '../db/fields';
import { ApiError, TokenError, fetchCover, groupAlbums, readMyPlaylists, readPlaylistItems, type Album, type MyPlaylist, type NowPlaying } from './spotify';
import { NotConnected, withTokens, type Keep } from './connect';

/** How long a kept cover stands before it is fetched again (V9: "a cache that expires every month or so").
 *  A stale cover still shows until its fresh one has landed; one that fails to arrive keeps the old. */
export const COVER_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
/** A cover kept within the month: never fetched again. A row from before V9 (no coverAt) is not fresh, so
 *  it is fetched once more and kept as bytes. */
export const isFresh = (row: Pick<Row, 'cover' | 'coverAt'>, now = Date.now()) =>
  !!row.cover && !!row.coverAt && now - row.coverAt < COVER_MAX_AGE;
/** A fetched cover as it is kept: plain bytes, its type, and when (iOS Safari can lose a Blob kept in IndexedDB). */
async function kept(b: Blob): Promise<Pick<Row, 'cover' | 'coverType' | 'coverAt'>> {
  return { cover: await b.arrayBuffer(), coverType: b.type || 'image/jpeg', coverAt: Date.now() };
}

/** How many covers are fetched at once. */
export const COVERS_AT_ONCE = 4;
/** How many covers a read fetches straight away: the list's strip of six and the grid's first screen (five
 *  rows of three on an iPhone). The rest wait until their tile is scrolled near (the grid's observer). */
export const COVERS_FIRST = 15;

/** An album on a playlist's shelf: the albums row (cover included) at its place in that playlist. */
export type ShelfAlbum = Row & Shelf;

type Progress = () => void | Promise<void>;

/** Writes one playlist's shelf at once and without waiting for a single cover, so its tiles are there the
 *  moment the playlist is read; albums gone from the read leave this playlist's shelf only. Then the first
 *  covers still missing arrive a few at a time, each written as it lands (onProgress fires after the rows
 *  and after every cover, so the grid fills in). A cover already kept is not fetched again; one that fails
 *  to arrive is tried again next time. */
export async function storeShelf(
  playlistId: string, list: Album[], getCover: (url: string) => Promise<Blob> = fetchCover, onProgress?: Progress, first = COVERS_FIRST,
): Promise<ShelfAlbum[]> {
  const uris = list.map(a => a.albumUri);
  const before = new Map((await store.query('albums', tb => tb.where('albumUri').anyOf(uris))).map(r => [r.albumUri, r]));
  const albums: Row[] = list.map(a => {
    const had = before.get(a.albumUri);
    return { ...had, albumUri: a.albumUri, album: a.album, artist: a.artist, coverUrl: a.coverUrl || had?.coverUrl, cover: had?.cover };
  });
  const shelf: Shelf[] = list.map(a => ({ playlistId, albumUri: a.albumUri, order: a.order, firstTrackUri: a.firstTrackUri, firstTrackAt: a.firstTrackAt }));
  const listed = new Set(uris);
  const gone = (await store.query('shelves', tb => tb.where('playlistId').equals(playlistId)))
    .filter(r => !listed.has(r.albumUri)).map(r => [r.playlistId, r.albumUri]);
  await store.many({ albums, shelves: shelf });
  if (gone.length) await store.bulkDelete('shelves', gone);
  await onProgress?.();
  await fillCovers(albums.slice(0, first), getCover, onProgress);
  return albums.map((a, i) => ({ ...a, ...shelf[i] }));
}

/** The covers missing or past the month among these rows, four at a time, each written as it lands. */
async function fillCovers(rows: Row[], getCover: (url: string) => Promise<Blob>, onProgress?: Progress) {
  const todo = rows.filter(r => !isFresh(r) && r.coverUrl);
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const row = todo[next++];
      const cover = await getCover(row.coverUrl!).catch(() => undefined);
      if (!cover) continue;
      Object.assign(row, await kept(cover));
      await store.put('albums', row);
      await onProgress?.();
    }
  };
  await Promise.all(Array.from({ length: Math.min(COVERS_AT_ONCE, todo.length) }, worker));
}

/** A playlist whose snapshot has not moved is not read again; only the first covers still missing are fetched. */
export async function fillFirstCovers(playlistId: string, getCover: (url: string) => Promise<Blob> = fetchCover, onProgress?: Progress) {
  const rows = (await shelf(playlistId)).slice(0, COVERS_FIRST);
  await fillCovers(rows, getCover, onProgress);
}

// ---- a tile below the fold: its cover is fetched when it is scrolled near, never more than four at once ----
let running = 0;
const waiting: (() => void)[] = [];
const asking = new Map<string, Promise<Row | undefined>>();

/** The cover of a kept album with none yet, or one past the month, fetched from where Spotify keeps it and
 *  written to its row. A tile asks when it comes near the screen. Gives the row as it now stands (the old
 *  cover when the fetch fails); undefined when there is no such album. */
export function coverWhenNear(albumUri: string, getCover: (url: string) => Promise<Blob> = fetchCover): Promise<Row | undefined> {
  const had = asking.get(albumUri);
  if (had) return had;
  const p = (async () => {
    const row = await store.get('albums', albumUri);
    if (!row || isFresh(row) || !row.coverUrl) return row;
    while (running >= COVERS_AT_ONCE) await new Promise<void>(r => waiting.push(r));
    running++;
    try {
      const cover = await getCover(row.coverUrl).catch(() => undefined);
      if (!cover) return row;
      const next = { ...row, ...(await kept(cover)) };
      await store.put('albums', next);
      return next;
    } finally {
      running--;
      waiting.shift()?.();
    }
  })().finally(() => asking.delete(albumUri));
  asking.set(albumUri, p);
  return p;
}

/** One playlist read in full, paged, then its shelf written and the snapshot it was read at kept. */
export async function readPlaylist(
  keep: Keep, playlist: Pick<Playlist, 'id'>, snapshotId?: string, getCover?: (url: string) => Promise<Blob>, onProgress?: Progress,
): Promise<ShelfAlbum[]> {
  const items = await withTokens(keep, t => readPlaylistItems(t, playlist.id));
  const rows = await storeShelf(playlist.id, groupAlbums(items), getCover, onProgress);
  const row = await store.get('playlists', playlist.id);
  if (row) await store.put('playlists', { ...row, snapshotId: snapshotId ?? row.snapshotId, readAt: Date.now() });
  return rows;
}

// ---- the guards for big playlists (PLAN-V3.md 5.2): the snapshot skip, one read at a time, a 429 stops ----

/** True when a playlist need not be read again: Spotify's snapshot now is the one its shelf was read at. */
export const unchanged = (p: Pick<Playlist, 'snapshotId'>, snapshotNow: string | undefined, hasShelf: boolean) =>
  hasShelf && !!snapshotNow && snapshotNow === p.snapshotId;

/** A refusal that must stop every read after it: Spotify asks for a pause (429), there is no connection, or no session. */
export const stopsReads = (e: unknown) =>
  (e instanceof ApiError && e.status === 429) || e instanceof TypeError || e instanceof NotConnected
  || (e instanceof TokenError && e.code === 'invalid_grant');

export type ReadHooks = {
  /** A playlist is about to be read (not skipped): the quiet line names it. */
  reading?: (p: Playlist) => void;
  /** Its shelf has new rows or a new cover. */
  progress?: (playlistId: string) => Progress;
  getCover?: (url: string) => Promise<Blob>;
};
export type ReadOutcome = { read: string[]; skipped: string[]; failed: { id: string; name: string; error: unknown }[] };

/** One playlist: read in full when its snapshot moved or it was never read; otherwise only its first missing covers. */
export async function readOne(keep: Keep, p: Playlist, snapshotNow: string | undefined, hooks: ReadHooks = {}): Promise<'read' | 'skipped'> {
  const has = (await store.query('shelves', tb => tb.where('playlistId').equals(p.id))).length > 0;
  if (unchanged(p, snapshotNow, has)) {
    await fillFirstCovers(p.id, hooks.getCover, hooks.progress?.(p.id)).catch(() => undefined);
    return 'skipped';
  }
  hooks.reading?.(p);
  await readPlaylist(keep, p, snapshotNow, hooks.getCover, hooks.progress?.(p.id));
  return 'read';
}

/** The chosen playlists, one after another, never in parallel. A playlist Spotify refuses is noted and the
 *  next one read; a pause (429), no connection or no session stops the rest and is thrown, never retried. */
export async function readChosen(keep: Keep, snapshots: Map<string, string>, hooks: ReadHooks = {}): Promise<ReadOutcome> {
  const out: ReadOutcome = { read: [], skipped: [], failed: [] };
  for (const p of (await playlistRows()).filter(r => r.chosen)) {
    try {
      out[(await readOne(keep, p, snapshots.get(p.id), hooks)) === 'read' ? 'read' : 'skipped'].push(p.id);
    } catch (e) {
      if (stopsReads(e)) throw e;
      out.failed.push({ id: p.id, name: p.name, error: e });
    }
  }
  return out;
}

/** /me/playlists read and written: every owned playlist in Spotify's order, a ticked one keeps its tick and
 *  its last-read snapshot. A named playlist (poems.ts: Poems, master (ii), staging, candidate) is ticked the
 *  first time a list holds it, once; an untick after that is kept (spotify.ticked remembers). A playlist gone
 *  from the list leaves it, unless it is ticked (its shelf still shows offline). Returns the list as read,
 *  with each playlist's snapshot now, for the snapshot skip. */
export async function readMine(keep: Keep): Promise<MyPlaylist[]> {
  const list = await withTokens(keep, readMyPlaylists);
  const before = new Map((await store.all('playlists')).map(r => [r.id, r]));
  const ticked = new Set(keep.read()?.ticked ?? []);
  const named = new Set(NAMED_IDS.filter(id => !ticked.has(id)));
  const rows: Playlist[] = list.map(p => {
    const had = before.get(p.id);
    return {
      id: p.id, name: p.name, uri: p.uri, order: p.order, total: p.total, coverUrl: p.coverUrl,
      chosen: (had?.chosen ?? false) || named.has(p.id), snapshotId: had?.snapshotId ?? '', readAt: had?.readAt,
    };
  });
  const nowTicked = rows.filter(r => named.has(r.id)).map(r => r.id);
  const state = keep.read();
  if (nowTicked.length && state) await keep.write({ ...state, ticked: [...ticked, ...nowTicked] });
  const listed = new Set(list.map(p => p.id));
  const gone = [...before.values()].filter(r => !listed.has(r.id) && !r.chosen);
  await store.bulkPut('playlists', rows);
  for (const g of gone) {
    await store.delete('playlists', g.id);
    const kept = await store.query('shelves', tb => tb.where('playlistId').equals(g.id));
    if (kept.length) await store.bulkDelete('shelves', kept.map(r => [r.playlistId, r.albumUri]));
  }
  return list;
}

/** Every playlist kept, in Spotify's order (Settings lists them all). */
export async function playlistRows(): Promise<Playlist[]> {
  return store.query('playlists', tb => tb.orderBy('order'));
}

/** Ticks or unticks a playlist. Unticking keeps its shelf and covers. */
export async function choosePlaylist(id: string, chosen: boolean): Promise<Playlist | undefined> {
  const row = await store.get('playlists', id);
  if (!row) return undefined;
  const next = { ...row, chosen };
  await store.put('playlists', next);
  return next;
}

/** One playlist's albums, in first-song order, each with its kept cover when there is one. */
export async function shelf(playlistId: string): Promise<ShelfAlbum[]> {
  const rows = (await store.query('shelves', tb => tb.where('playlistId').equals(playlistId))).sort((a, b) => a.order - b.order);
  const albums = new Map((await store.query('albums', tb => tb.where('albumUri').anyOf(rows.map(r => r.albumUri)))).map(a => [a.albumUri, a]));
  return rows.flatMap(r => {
    const a = albums.get(r.albumUri);
    return a ? [{ ...a, ...r }] : [];
  });
}

export async function albumRow(albumUri: string): Promise<Row | undefined> {
  return store.get('albums', albumUri);
}

/** The cover for what is playing: from the albums table when it is there, else fetched once and kept (on no
 *  shelf). Returns the page's music record, coverId set when a cover is kept. */
export async function keepCover(np: NonNullable<NowPlaying>, getCover: (url: string) => Promise<Blob> = fetchCover): Promise<PageMusic> {
  const music: PageMusic = { albumUri: np.albumUri, album: np.album, artist: np.artist };
  const row = await store.get('albums', np.albumUri);
  if (row && isFresh(row)) return { ...music, coverId: row.albumUri };
  const cover = np.coverUrl ? await getCover(np.coverUrl).catch(() => undefined) : undefined;
  if (!cover) return row?.cover ? { ...music, coverId: row.albumUri } : music;
  await store.put('albums', { ...(row ?? music), coverUrl: np.coverUrl || row?.coverUrl, ...(await kept(cover)) });
  return { ...music, coverId: np.albumUri };
}
