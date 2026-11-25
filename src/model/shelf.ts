// The shelf's reads and writes (PLAN-WORLDS.md section 4): what each notebook's cover wears and the last line written
// in it, read from that notebook whether it is worn or not (db/fields.ts peek), and a cover dressed (db/fields.ts
// dress). Nothing here fetches: an album whose cover is not kept on the phone is left out (decision 19). No UI here.
import { dress, peek, store } from '../db/fields';
import type { Album, Cover } from '../db/schema';
import { lastLine } from './pages';

/** At most this many albums on a cover (decision 16). */
export const COVER_MAX = 5;

/** What one notebook shows on the shelf: what its cover wears (the kept album rows in the order worn, or his drawing),
 *  and the last line written in it. */
export type NotebookShown = { albums: Album[]; drawing?: Blob; last: { text: string; at: number } | null };

/** A notebook's cover as kept on its own row; undefined is plain paper (or a world not opened yet, or locked). */
export async function coverOf(world: string | null): Promise<Cover | undefined> {
  const s = await peek(world, r => r.get('settings', 'app'));
  return s && !s.locked ? s.cover : undefined;
}

/** Dresses a notebook's cover: albums (at most COVER_MAX, in the order worn), his drawing, or plain paper (undefined). */
export function dressCover(world: string | null, cover: Cover | undefined): Promise<void> {
  if (cover && 'albums' in cover && cover.albums.length > COVER_MAX) throw new Error('Five at most');
  return dress(world, cover);
}

/** A kept album row with its cover: in the notebook itself, else the one worn, else his own (the ♪ it was picked from). */
async function albumAnywhere(world: string | null, uri: string): Promise<Album | undefined> {
  const tries = [
    () => peek(world, r => r.get('albums', uri)),
    () => store.get('albums', uri),
    () => peek(null, r => r.get('albums', uri)),
  ];
  for (const t of tries) {
    const row = await t().catch(() => undefined);
    if (row?.cover) return row;
  }
  return undefined;
}

/** Reads what one notebook shows on the shelf. */
export async function notebookShown(world: string | null): Promise<NotebookShown> {
  const got = await peek(world, async r => ({ settings: await r.get('settings', 'app'), last: await lastLine(r) }));
  const cover = got?.settings && !got.settings.locked ? got.settings.cover : undefined;
  const last = got?.last ?? null;
  if (cover && 'drawing' in cover && cover.drawing) return { albums: [], drawing: cover.drawing, last };
  const albums: Album[] = [];
  for (const uri of cover && 'albums' in cover ? cover.albums : []) {
    const row = await albumAnywhere(world, uri);
    if (row) albums.push(row);
  }
  return { albums, last };
}
