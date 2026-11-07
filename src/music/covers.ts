// The album shelf (PLAN.md section 8.1): the playlist read once, grouped by album in first-appearance
// order, each cover fetched once and kept as a Blob in the albums table, so the grid draws offline.
// Every row goes through the store. An album that leaves the playlist is kept with order -1, never
// deleted, because a page that heard it still shows its cover.
import type { Album as Row, PageMusic } from '../db/schema';
import { store } from '../db/fields';
import { fetchCover, groupAlbums, readPlaylistItems, type Album, type NowPlaying } from './spotify';
import { withTokens, type Keep } from './connect';

/** How many covers are fetched at once. */
export const COVERS_AT_ONCE = 4;

/** Writes the playlist's albums in order, at once and without waiting for a single cover, so the shelf
 *  has its tiles the moment the playlist is read; then the covers still missing arrive a few at a time,
 *  each written as it lands (onProgress fires after the rows and after every cover, so the grid fills in).
 *  A cover already kept is not fetched again; one that fails to arrive is tried again at the next refresh. */
export async function storeAlbums(
  list: Album[], getCover: (url: string) => Promise<Blob> = fetchCover, onProgress?: () => void | Promise<void>,
): Promise<Row[]> {
  const before = new Map((await store.all('albums')).map(r => [r.albumUri, r]));
  const rows: Row[] = list.map(a => ({
    albumUri: a.albumUri, album: a.album, artist: a.artist, order: a.order, firstTrackUri: a.firstTrackUri, cover: before.get(a.albumUri)?.cover,
  }));
  const listed = new Set(list.map(a => a.albumUri));
  const left = [...before.values()].filter(r => !listed.has(r.albumUri) && r.order >= 0).map(r => ({ ...r, order: -1 }));
  await store.bulkPut('albums', [...rows, ...left]);
  await onProgress?.();
  const urlOf = new Map(list.map(a => [a.albumUri, a.coverUrl]));
  const todo = rows.filter(r => !r.cover && urlOf.get(r.albumUri));
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const row = todo[next++];
      const cover = await getCover(urlOf.get(row.albumUri)!).catch(() => undefined);
      if (!cover) continue;
      row.cover = cover;
      await store.put('albums', row);
      await onProgress?.();
    }
  };
  await Promise.all(Array.from({ length: Math.min(COVERS_AT_ONCE, todo.length) }, worker));
  return rows;
}

/** "Refresh playlist": the whole read, paged, then the shelf written. */
export async function readPlaylist(keep: Keep, getCover?: (url: string) => Promise<Blob>, onProgress?: () => void | Promise<void>): Promise<Row[]> {
  const items = await withTokens(keep, readPlaylistItems);
  return storeAlbums(groupAlbums(items), getCover, onProgress);
}

/** The music sheet's albums: the playlist's, in its order. */
export async function shelf(): Promise<Row[]> {
  return (await store.all('albums')).filter(r => r.order >= 0).sort((a, b) => a.order - b.order);
}

export async function albumRow(albumUri: string): Promise<Row | undefined> {
  return store.get('albums', albumUri);
}

/** The cover for what is playing: from the shelf when it is there, else fetched once and kept off the
 *  playlist (order -1). Returns the page's music record, coverId set when a cover is kept. */
export async function keepCover(np: NonNullable<NowPlaying>, getCover: (url: string) => Promise<Blob> = fetchCover): Promise<PageMusic> {
  const music: PageMusic = { albumUri: np.albumUri, album: np.album, artist: np.artist };
  const row = await store.get('albums', np.albumUri);
  if (row?.cover) return { ...music, coverId: row.albumUri };
  const cover = np.coverUrl ? await getCover(np.coverUrl).catch(() => undefined) : undefined;
  if (!cover) return music;
  await store.put('albums', row ? { ...row, cover } : { ...music, order: -1, firstTrackUri: '', cover });
  return { ...music, coverId: np.albumUri };
}
