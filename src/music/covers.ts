// The album shelf (PLAN.md section 8.1): the playlist read once, grouped by album in first-appearance
// order, each cover fetched once and kept as a Blob in the albums table, so the grid draws offline.
// Every row goes through the store. An album that leaves the playlist is kept with order -1, never
// deleted, because a page that heard it still shows its cover.
import type { Album as Row, PageMusic } from '../db/schema';
import { store } from '../db/fields';
import { fetchCover, groupAlbums, readPlaylistItems, type Album, type NowPlaying } from './spotify';
import { withTokens, type Keep } from './connect';

/** Writes the playlist's albums in order. A cover already kept is not fetched again; one that fails
 *  to arrive is tried again at the next refresh. */
export async function storeAlbums(list: Album[], getCover: (url: string) => Promise<Blob> = fetchCover): Promise<Row[]> {
  const before = new Map((await store.all('albums')).map(r => [r.albumUri, r]));
  const rows: Row[] = [];
  for (const a of list) {
    let cover = before.get(a.albumUri)?.cover;
    if (!cover && a.coverUrl) cover = await getCover(a.coverUrl).catch(() => undefined);
    rows.push({ albumUri: a.albumUri, album: a.album, artist: a.artist, order: a.order, firstTrackUri: a.firstTrackUri, cover });
  }
  const listed = new Set(list.map(a => a.albumUri));
  const left = [...before.values()].filter(r => !listed.has(r.albumUri) && r.order >= 0).map(r => ({ ...r, order: -1 }));
  await store.bulkPut('albums', [...rows, ...left]);
  return rows;
}

/** "Refresh playlist": the whole read, paged, then the shelf written. */
export async function readPlaylist(keep: Keep, getCover?: (url: string) => Promise<Blob>): Promise<Row[]> {
  const items = await withTokens(keep, readPlaylistItems);
  return storeAlbums(groupAlbums(items), getCover);
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
