// The music sheet (PLAN.md section 5 item 7, section 8.1): the playlist's album covers, every album in
// playlist order, a scrolling grid of square tiles, no titles. Tap one and the playlist plays from that
// album's first song on the phone's Spotify, then runs on into the next album. Works offline from the
// kept covers; works in Still, and Still never starts or stops anything.
import { Sheet } from '../parts/Sheet';
import { openSheet } from '../sheets';
import { light } from '../light';
import { notebookDate } from '../date';
import { hrefOf } from '../journal/href';
import { useEffect, useState } from 'preact/hooks';
import { pagesWithAlbum, type AlbumPage } from '../../model/music';
import { albumFor, albums, play, playing, playNote, reading, urlOf } from './state';

const PLAYLIST_NAME = 'For the Poems and the Prose';

export function MusicSheet() {
  const list = albums.value;
  const now = playing.value?.albumUri;
  return (
    <Sheet open={openSheet.value === 'music'} onClose={() => { openSheet.value = null; }} title={PLAYLIST_NAME}>
      {reading.value && <p class="fs-note">reading the playlist</p>}
      {playNote.value && <p class="fs-note" role="status">{playNote.value}</p>}
      {list && !list.length && !reading.value && <p class="fs-note">Refresh playlist in Settings</p>}
      <div class="fs-tiles" role="group" aria-label="Albums">
        {list?.map(a => {
          const src = urlOf(a);
          return (
            <button key={a.albumUri} type="button" class="fs-tile" aria-label={`${a.album}, ${a.artist}`} aria-pressed={now === a.albumUri}
              data-album={a.albumUri} onClick={() => void play(a)}>
              {src ? <img src={src} alt="" draggable={false} /> : <span />}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

/** "Pages with this album": long press the small cover in a page header. Still shows today only. */
export function AlbumPagesSheet() {
  const album = albumFor.value;
  const open = openSheet.value === 'album' && !!album;
  const [rows, setRows] = useState<AlbumPage[] | null>(null);
  useEffect(() => {
    if (!open || !album) return;
    let live = true;
    void pagesWithAlbum(album.albumUri).then(r => live && setRows(r));
    return () => { live = false; };
  }, [open, album?.albumUri]);
  const still = light.value === 'still';
  const shown = (rows ?? []).filter(r => !still || sameDay(r.page.createdAt, Date.now()));
  return (
    <Sheet open={open} onClose={() => { openSheet.value = null; }} title="Pages with this album">
      {album && <p class="fs-note">{album.album} · {album.artist}</p>}
      <nav class="fs-links fs-albumpages" aria-label="Pages with this album">
        {shown.map(r => (
          <a key={r.page.id} class="fs-link" href={hrefOf(r.page)}>
            <small>{notebookDate(new Date(r.page.createdAt))}</small>
            <span>{r.line || r.page.kind}</span>
          </a>
        ))}
      </nav>
      {rows && !shown.length && <p class="fs-note">No page has heard it yet</p>}
    </Sheet>
  );
}
