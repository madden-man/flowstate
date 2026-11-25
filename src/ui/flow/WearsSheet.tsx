// What a cover wears (PLAN-WORLDS.md section 4, decisions 16 and 19): hold a cover on the shelf and this sheet rises,
// "<Name> wears". The tiles are the albums of the playlists ticked under the ♪ of the notebook worn, from the covers
// already kept on the phone, so it works offline and asks Spotify for nothing. A tap ticks a tile and the others
// quieten (the album grid's own hush, held while any is ticked); a sixth tap does nothing and one line says "Five at
// most."; the order tapped is the order worn, the first the largest on the cover. Below the tiles, two rows: "Upload a
// drawing" (from Photos or Files; kept in that notebook, sealed, in its backup, never sent anywhere) and "Plain paper".
// Not connected to Spotify, the sheet says so and offers Connect, as the ♪ sheet does. Every change is kept at once
// (model/shelf.ts dressCover), as everything autosaves (rule 6).
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { Sheet } from '../parts/Sheet';
import { openSheet } from '../sheets';
import { COVER_MAX, coverOf, dressCover } from '../../model/shelf';
import type { Notebook } from '../../model/notebooks';
import { connected, loadMusic, playlists, shelfOf, urlOf } from '../music/state';
import { MusicRows } from '../music/MusicRows';

/** The notebook whose cover is being dressed. */
export const wearsFor = signal<Notebook | null>(null);
/** Bumped when a cover is dressed, so the shelf reads its covers again. */
export const shelfVersion = signal(0);

export function WearsSheet() {
  const book = wearsFor.value;
  const open = openSheet.value === 'wears' && !!book;
  // what it wears now: the album uris in order, and whether it is his drawing
  const [albums, setAlbums] = useState<string[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!open || !book) return;
    let on = true;
    setFull(false);
    // the ticked playlists and their kept covers, from the phone (no request: loadMusic reads the database only)
    void loadMusic().catch(() => undefined);
    void coverOf(book.world).then(c => {
      if (!on) return;
      setAlbums(c && 'albums' in c ? c.albums : []);
      setDrawing(!!c && 'drawing' in c);
    }).catch(() => undefined);
    return () => { on = false; };
  }, [open, book?.id]);

  const keep = async (cover: Parameters<typeof dressCover>[1]) => {
    if (!book) return;
    await dressCover(book.world, cover);
    shelfVersion.value++;
  };
  const tap = (uri: string) => {
    const has = albums.includes(uri);
    if (!has && albums.length >= COVER_MAX) { setFull(true); return; }
    const next = has ? albums.filter(a => a !== uri) : [...albums, uri];
    setFull(false);
    setAlbums(next);
    setDrawing(false);
    void keep(next.length ? { albums: next } : undefined);
  };
  const plain = !drawing && !albums.length;

  return (
    <Sheet open={open} onClose={() => { openSheet.value = null; }} title={book ? `${book.name} wears` : ''}>
      {connected.value ? <Tiles albums={albums} onTap={tap} /> : (
        <div class="fs-music-screen fs-music-connect">
          <p class="fs-note">Not connected to Spotify</p>
          <MusicRows />
        </div>
      )}
      {full && <p class="fs-quiet fl-five" role="status">Five at most.</p>}
      <div class="fs-rows fl-wears">
        <label class="fs-row" aria-current={drawing ? 'true' : undefined}>
          <span>Upload a drawing</span><small>Photos or Files</small>
          <input type="file" accept="image/*" hidden onChange={e => {
            const f = (e.currentTarget as HTMLInputElement).files?.[0];
            (e.currentTarget as HTMLInputElement).value = '';
            if (!f) return;
            setAlbums([]); setDrawing(true); setFull(false);
            void keep({ drawing: f });
          }} />
        </label>
        <button type="button" class="fs-row" aria-pressed={plain} onClick={() => {
          setAlbums([]); setDrawing(false); setFull(false);
          void keep(undefined);
        }}><span>Plain paper</span></button>
      </div>
    </Sheet>
  );
}

/** The kept covers of the ticked playlists, each playlist under its name; an album on two playlists shows once. */
function Tiles({ albums, onTap }: { albums: string[]; onTap: (uri: string) => void }) {
  const lists = playlists.value;
  const seen = new Set<string>();
  const groups = lists.map(p => ({ p, rows: (shelfOf(p.id) ?? []).filter(a => a.cover && !seen.has(a.albumUri) && seen.add(a.albumUri)) }))
    .filter(g => g.rows.length);
  if (!groups.length) return <p class="fs-note">Choose playlists in Settings</p>;
  return (
    <>
      {groups.map(({ p, rows }) => (
        <section key={p.id} class="fl-wears-list">
          <p class="fs-month">{p.name}</p>
          <div class={`fs-tiles${albums.length ? ' hush' : ''}`} role="group" aria-label={p.name}>
            {rows.map(a => {
              const on = albums.includes(a.albumUri);
              const src = urlOf(a);
              return (
                <div key={a.albumUri} class="fs-tile-cell" data-chosen={on ? '' : undefined}>
                  <button type="button" class="fs-tile" aria-label={`${a.album}, ${a.artist}`} aria-pressed={on} data-album={a.albumUri}
                    onClick={() => onTap(a.albumUri)}>
                    {src ? <img src={src} alt="" draggable={false} /> : <span />}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
