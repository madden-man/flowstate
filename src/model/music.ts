// A page remembers its album (PLAN.md section 8.1): the first album heard while it is open is written
// onto page.music, once, and stays. "Pages with this album" reads them back.
import type { Page, PageMusic } from '../db/schema';
import { store, type Read } from '../db/fields';
import { firstLine, messagesOf, pagesInOrder } from './pages';

/** Writes the album onto the page the first time one is heard there; afterwards it never changes. The
 *  page is read fresh, so a stale copy elsewhere cannot have dropped it. Returns the page when written. */
export async function noteMusic(pageId: string, music: PageMusic, now = Date.now()): Promise<Read<Page> | null> {
  const page = await store.get('pages', pageId);
  if (!page || page.locked) return null;
  // the album never changes; only a cover that could not be kept the first time may be filled in later
  const fill = page.music && !page.music.coverId && music.coverId && page.music.albumUri === music.albumUri;
  if (page.music && !fill) return null;
  const next = { ...page, music: fill ? { ...page.music!, coverId: music.coverId } : music, updatedAt: now };
  await store.put('pages', next);
  return next;
}

export type AlbumPage = { page: Read<Page>; line: string };

/** Every page that heard this album, newest first, each with the line it is known by. */
export async function pagesWithAlbum(albumUri: string): Promise<AlbumPage[]> {
  const pages = (await pagesInOrder()).filter(p => p.music?.albumUri === albumUri).reverse();
  return Promise.all(pages.map(async page => ({ page, line: firstLine(page, await messagesOf(page.id)) })));
}
