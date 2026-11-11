// The music sheet (PLAN.md section 8.1, PLAN-V3.md section 5.3): two screens in the one sheet. First the
// list, titled Playlists: a row per chosen playlist, its name in serif and a strip of its first six covers
// beneath (first-song order, from the kept covers, offline); the one playing carries the small cover beside
// its name. No counts, in any light. Tap a name and the sheet shows that playlist's grid of square tiles, no
// titles, every album in first-song order, the word Playlists at the head to go back. A tile plays that
// playlist from the album's first song on the phone's Spotify, and it runs on into the next album. A tile
// below the fold fetches its cover only when it is scrolled near. Works in Still, which never starts or
// stops anything. How it moves (PLAN-MOTION.md M3) is in ./motion: the drop, the hush, the ring drawn once
// Spotify says yes, the cover's flight to the ♪, and a strip dealt into its grid.
import { Sheet, tokenMs } from '../parts/Sheet';
import { openSheet } from '../sheets';
import { light } from '../light';
import { notebookDate } from '../date';
import { hrefOf } from '../journal/href';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Playlist } from '../../db/schema';
import { isFresh, type ShelfAlbum } from '../../music/covers';
import { pagesWithAlbum, type AlbumPage } from '../../model/music';
import { Cover } from './MusicLine';
import { albumFor, asked, choosing, musicSegment, nearTile, openPlaylist, play, playing, playingFrom, playlists, playNote, reading, readNote, shelfOf, urlOf, type MusicSegment } from './state';
import { Signs } from './Signs';
import { effect } from '@preact/signals';
import { deal, dealInto, drop, fly, hush, hushOf, takeDeal, unhush, unlight } from './motion';

const STRIP = 6;
/** How far below the sheet's fold a tile starts fetching its cover: about two rows. */
const NEAR = '0px 0px 240px 0px';
/** The grid's columns (parts.css .fs-tiles): the strip fills the first two rows, the rest rise in by the row. */
const COLUMNS = 3;
/** Rows past this many rise in all at once, so a long playlist is not a long wait. */
const RISE_ROWS = 8;

export function MusicSheet() {
  const list = playlists.value;
  const id = openPlaylist.value;
  const shown = id ? list.find(p => p.id === id) : undefined;
  const close = () => { openSheet.value = null; };
  const open = openSheet.value === 'music';
  // the step sheet's "+ album" (P2) chooses only while this sheet is up
  useEffect(() => { if (!open) choosing.value = null; }, [open]);
  // the rows rise in behind the sheet as it opens; back from a grid, the list only fades in
  const was = useRef(false);
  const rise = useRef(false);
  if (open && !was.current) rise.current = true;
  if (shown) rise.current = false;
  was.current = open;
  // the small cover a tile flew to sits lit above the scrim until the sheet has gone down
  useEffect(() => {
    if (open) return;
    const t = setTimeout(unlight, tokenMs('--t-page'));
    return () => clearTimeout(t);
  }, [open]);
  // the Signs segment (PLAN-TASKS.md section 4, T5) beside Playlists on the list; choosing a cover is Playlists only
  const signs = !shown && !choosing.value && musicSegment.value === 'signs';
  return (
    <Sheet open={open} onClose={close} title={shown ? shown.name : signs ? 'Signs' : 'Playlists'}
      back={shown ? { label: 'Playlists', onPress: () => { openPlaylist.value = null; } } : undefined}>
      {!shown && !choosing.value && <Segments here={signs ? 'signs' : 'playlists'} />}
      {reading.value && !signs && <p class="fs-note">{reading.value}</p>}
      {playNote.value && <p class="fs-note" role="status">{playNote.value}</p>}
      {readNote.value && !playNote.value && !signs && <p class="fs-note" role="status">{readNote.value}</p>}
      {shown ? <Grid key={shown.id} playlist={shown} /> : signs ? <Signs /> : <List list={list} rise={rise.current} />}
    </Sheet>
  );
}

/** "Signs | Playlists" over the list: the seven shelves, or his playlists. */
function Segments({ here }: { here: MusicSegment }) {
  const to = (s: MusicSegment) => () => { musicSegment.value = s; };
  return (
    <nav class="fs-seg fs-music-seg" aria-label="Music">
      <button type="button" aria-current={here === 'signs' ? 'true' : undefined} onClick={to('signs')}>Signs</button>
      <button type="button" aria-current={here === 'playlists' ? 'true' : undefined} onClick={to('playlists')}>Playlists</button>
    </nav>
  );
}

function List({ list, rise }: { list: Playlist[]; rise: boolean }) {
  const from = playingFrom.value;
  const now = playing.value;
  return (
    <nav class={`fs-music-screen fs-playlists${rise ? ' rise' : ''}`} aria-label="Playlists">
      {!list.length && !reading.value && <p class="fs-note">Choose playlists in Settings</p>}
      {list.map((p, i) => {
        const strip = (shelfOf(p.id) ?? []).slice(0, STRIP);
        const on = from === p.id && !!now?.coverId;
        return (
          <button key={p.id} type="button" class="fs-playlist" data-playlist={p.id} aria-current={from === p.id ? 'true' : undefined}
            style={{ '--i': i }} onClick={e => { deal(e.currentTarget, p.id); openPlaylist.value = p.id; }}>
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
  // opened from its row: the strip's covers travel to the first places, measured before the first paint
  const [from] = useState(() => takeDeal(playlist.id));
  const tiles = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (from && tiles.current) dealInto([...tiles.current.querySelectorAll<HTMLElement>('.fs-tile')], from);
  }, []);
  const hushed = useHush();
  return (
    <div class={`fs-music-screen${from ? ' deal' : ''}`}>
      {albums && !albums.length && !reading.value && <p class="fs-note">Read again in Settings</p>}
      <div ref={tiles} class={`fs-tiles${hushed ? ' hush' : ''}`} role="group" aria-label="Albums">
        {albums?.map((a, i) => (
          <Tile key={a.albumUri} playlist={playlist} album={a} pressed={here && now === a.albumUri} chosen={hushed === a.albumUri}
            row={from && i >= from.length ? Math.min(Math.floor(i / COLUMNS) - 1, RISE_ROWS) : 0} />
        ))}
      </div>
    </div>
  );
}

/** The hush, for a screen of tiles (this grid, and the On sheet's covers, PLAN-PICKS.md P1): it holds while the tap
 *  waits on Spotify, and lets go the moment it is not waiting on this album any more (playing, refused, an error,
 *  another cover); the page hidden (a hop out to Spotify) or the tiles gone (closed, back to the list, another
 *  playlist) lets go at once, so it can never be left on. Returns the album hushed for, if any. */
export function useHush(): string | null {
  useEffect(() => {
    const off = effect(() => { if (hushOf.value && asked.value !== hushOf.value) unhush(); });
    const hidden = () => { if (document.visibilityState === 'hidden') unhush(true); };
    document.addEventListener('visibilitychange', hidden);
    return () => { off(); document.removeEventListener('visibilitychange', hidden); unhush(true); };
  }, []);
  return hushOf.value;
}

/** The ring round the playing album: there already when the grid opens on it, drawn in one stroke when Spotify
 *  says yes, lifted over --t-ui when another album takes over. A bead walks it while it plays (parts.css says
 *  where it does not: Still, Reduce Motion). A square path from the top middle, clockwise, as a pen goes. */
function Ring({ on }: { on: boolean }) {
  const [mark, setMark] = useState<'there' | 'drawn' | 'lift' | null>(on ? 'there' : null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (on) { setMark('drawn'); return; }
    setMark(m => (m ? 'lift' : null));
    const t = setTimeout(() => setMark(m => (m === 'lift' ? null : m)), tokenMs('--t-ui'));
    return () => clearTimeout(t);
  }, [on]);
  if (!mark) return null;
  const d = 'M50 1H93A6 6 0 0 1 99 7V93A6 6 0 0 1 93 99H7A6 6 0 0 1 1 93V7A6 6 0 0 1 7 1Z';
  return (
    <svg class={`fs-tile-ring ${mark}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path class="ink" d={d} pathLength={1} />
      <path class="bead" d={d} pathLength={1} />
    </svg>
  );
}

/** One cover: a tap plays it (play), drops, hushes the rest; Spotify's yes draws its ring and flies it to the ♪ (M3).
 *  The On sheet (PLAN-PICKS.md P1) uses the same tile, so the same motion comes with it: playlist is the one the album
 *  plays on (an album on no read playlist plays as itself, its own uri for the playlist's), and onTap hears the play. */
export function Tile({ playlist, album, pressed, chosen, row, onTap }: {
  playlist: Pick<Playlist, 'id' | 'uri'>; album: ShelfAlbum; pressed: boolean; chosen: boolean; row: number; onTap?: (played: Promise<void>) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  // Spotify said yes to this tile's tap: the cover travels to the ♪ (only then; a refusal draws nothing)
  useEffect(() => {
    if (!pressed || asked.peek() !== album.albumUri || !ref.current) return;
    asked.value = null;
    void fly(ref.current, album.albumUri);
  }, [pressed]);
  const [late, setLate] = useState<string | undefined>();
  // a cover past the month still shows while its fresh one is fetched
  const src = late ?? urlOf(album);
  const wants = !late && !isFresh(album) && !!album.coverUrl;
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
    <div class={`fs-tile-cell${row ? ' rise' : ''}`} style={row ? { '--row': row } : undefined} data-chosen={chosen ? '' : undefined}>
      <button ref={ref} type="button" class="fs-tile" aria-label={`${album.album}, ${album.artist}`} aria-pressed={pressed}
        data-album={album.albumUri} onClick={e => {
          // the step sheet's "+ album" (P2): the cover is chosen, not played, and the sheet goes down
          const choose = choosing.peek();
          if (choose) { choosing.value = null; choose(album); openSheet.value = null; return; }
          // the request leaves first, exactly as it did; the motion runs alongside it
          const played = play(playlist, album);
          if (onTap) onTap(played); else void played;
          drop(e.currentTarget, e);
          hush(album.albumUri);
        }}>
        {src ? <img src={src} alt="" draggable={false} /> : <span />}
      </button>
      <Ring on={pressed} />
    </div>
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
