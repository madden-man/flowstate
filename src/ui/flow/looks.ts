// What each cover on the shelf shows and what stands under it (PLAN-WORLDS.md section 4), as the shelf draws it: the
// album covers a notebook wears as object URLs from the kept covers, or his drawing, and the last line written in it
// (model/shelf.ts reads them). A cover with nothing to show is plain paper (decision 16).
import { notebookShown } from '../../model/shelf';
import type { Notebook } from '../../model/notebooks';
import { urlOf } from '../music/state';

/** A cover's face: the album covers it wears, in the order worn, or his drawing; null is plain paper. */
export type Looks = { albums: { uri: string; src: string }[] } | { drawing: string } | null;
/** What the shelf shows for one notebook. */
export type Shown = { looks: Looks; last: { text: string; at: number } | null };

/** One object URL a notebook's drawing, made again only when the drawing changes. */
const drawn = new Map<string, { blob: Blob; url: string }>();
function drawingUrl(id: string, blob: Blob): string {
  const had = drawn.get(id);
  if (had && had.blob === blob) return had.url;
  if (had) URL.revokeObjectURL(had.url);
  const url = URL.createObjectURL(blob);
  drawn.set(id, { blob, url });
  return url;
}

/** Reads what one notebook shows on the shelf. */
export async function shownOf(book: Notebook): Promise<Shown> {
  const s = await notebookShown(book.world);
  if (s.drawing) return { looks: { drawing: drawingUrl(book.id, s.drawing) }, last: s.last };
  const albums = s.albums.flatMap(a => { const src = urlOf(a); return src ? [{ uri: a.albumUri, src }] : []; });
  return { looks: albums.length ? { albums } : null, last: s.last };
}
