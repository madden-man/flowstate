// The music sheet (PLAN.md section 8.1, PLAN-V3.md section 5.3): two screens in the one sheet. First the
// list, titled Playlists: a row per chosen playlist, its name in serif and a strip of its first six covers
// beneath (first-song order, from the kept covers, offline); the one playing carries the small cover beside
// its name. No counts, in any light. Tap a name and the sheet shows that playlist's grid of square tiles, no
// titles, every album in first-song order, the word Playlists at the head to go back. A tile plays that
// playlist from the album's first song on the phone's Spotify, and it runs on into the next album. A tile
// below the fold fetches its cover only when it is scrolled near. Works in Still, which never starts or
// stops anything.
import { Sheet } from '../parts/Sheet';
import { openSheet } from '../sheets';
import { light } from '../light';
import { notebookDate } from '../date';
import { hrefOf } from '../journal/href';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Playlist } from '../../db/schema';
import type { ShelfAlbum } from '../../music/covers';
import { pagesWithAlbum, type AlbumPage } from '../../model/music';
import { Cover } from './MusicLine';
import { albumFor, nearTile, openPlaylist, play, playing, playingFrom, playlists, playNote, reading, readNote, shelfOf, urlOf } from './state';

const STRIP = 6;
/** How far below the sheet's fold a tile starts fetching its cover: about two rows. */
const NEAR = '0px 0px 240px 0px';

export function MusicSheet() {
  const list = playlists.value;
  const id = openPlaylist.value;
  const shown = id ? list.find(p => p.id === id) : undefined;
  const close = () => { openSheet.value = null; };
  return (
    <Sheet open={openSheet.value === 'music'} onClose={close} title={shown ? shown.name : 'Playlists'}
      back={shown ? { label: 'Playlists', onPress: () => { openPlaylist.value = null; } } : undefined}>
      {reading.value && <p class="fs-note">{reading.value}</p>}
      {playNote.value && <p class="fs-note" role="status">{playNote.value}</p>}
      {readNote.value && !playNote.value && <p class="fs-note" role="status">{readNote.value}</p>}
      {shown ? <Grid key={shown.id} playlist={shown} /> : <List list={list} />}
    </Sheet>
  );
}

function List({ list }: { list: Playlist[] }) {
  const from = playingFrom.value;
  const now = playing.value;
  return (
    <nav class="fs-music-screen fs-playlists" aria-label="Playlists">
      {!list.length && !reading.value && <p class="fs-note">Choose playlists in Settings</p>}
      {list.map(p => {
        const strip = (shelfOf(p.id) ?? []).slice(0, STRIP);
        const on = from === p.id && !!now?.coverId;
        return (
          <button key={p.id} type="button" class="fs-playlist" data-playlist={p.id} aria-current={from === p.id ? 'true' : undefined}
            onClick={() => { openPlaylist.value = p.id; }}>
            <span class="fs-playlist-name">
              <span>{p.name}</span>
              {on && <Cover id={now!.coverId!} class="fs-playlist-now" />}
            </span>
            <span class="fs-strip" aria-hidden="true">
              {strip.map(a => {
                const src = urlOf(a);
                return src ? <img key={a.albumUri} src={src} alt="" draggable={false} /> : <span key={a.albumUri} />;
              })}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function Grid({ playlist }: { playlist: Playlist }) {
  const albums = shelfOf(playlist.id);
  const now = playing.value?.albumUri;
  const here = playingFrom.value === playlist.id || !playingFrom.value;
  return (
    <div class="fs-music-screen">
      {albums && !albums.length && !reading.value && <p class="fs-note">Read again in Settings</p>}
      <div class="fs-tiles" role="group" aria-label="Albums">
        {albums?.map(a => <Tile key={a.albumUri} playlist={playlist} album={a} pressed={here && now === a.albumUri} />)}
      </div>
    </div>
  );
}

function Tile({ playlist, album, pressed }: { playlist: Playlist; album: ShelfAlbum; pressed: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [late, setLate] = useState<string | undefined>();
  const src = urlOf(album) ?? late;
  const wants = !src && !!album.coverUrl;
  useEffect(() => {
    const el = ref.current;
    if (!wants || !el || typeof IntersectionObserver === 'undefined') return;
    let live = true;
    const io = new IntersectionObserver(seen => {
      if (!seen.some(e => e.isIntersecting)) return;
      io.disconnect();
      void nearTile(playlist.id, album.albumUri).then(u => { if (live && u) setLate(u); });
    }, { root: el.closest('.fs-sheet-body'), rootMargin: NEAR });
    io.observe(el);
    return () => { live = false; io.disconnect(); };
  }, [wants, album.albumUri]);
  return (
    <button ref={ref} type="button" class="fs-tile" aria-label={`${album.album}, ${album.artist}`} aria-pressed={pressed}
      data-album={album.albumUri} onClick={() => void play(playlist, album)}>
      {src ? <img src={src} alt="" draggable={false} /> : <span />}
    </button>
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
