// A sign's shelf (PLAN-TASKS.md section 4, T5): under the gate on every sign's page, and on the sign's row in the ♪
// sheet's Signs segment (ui/music/Signs.tsx). Covers, wordless, then a plus, and under them his written lines.
// Self-contained: it reads its own shelf (model/acts.ts), so a parent only gives it the sign and room on the page.
//
// An album is the ♪ grid's own Tile (MusicSheet.tsx), so a tap plays it as a ♪ tile does: on the first chosen playlist
// that holds it, else as itself, with M3's bell, tick, drop, hush, ring and flight to the ♪. Its cover comes from the
// cache the ♪ grid fills, never fetched here (flow/On.tsx keep), and a kept cover shows whether or not Spotify is
// connected now. An album with no kept cover (every starter until Spotify has been connected: the seed carries a
// Spotify id and no art) is the same tile with nothing in it, the ♪ grid's own look for a cover not yet here, with its
// title written on it in print so the three can be told apart; the title leaves in Still and on the small rows.
// With no account a tap on a tile opens that album in Spotify (music/spotify.ts openAlbum), since nothing can play it
// from here.
//
// Every show, film, game, book and piece of art (Mountain R4) is a written line under the covers: its title and its
// kind word in small print, as the On sheet writes them. The plus on a sign's page raises a small sheet: a rule to
// write a title on, the kind words, Add; connected, "+ album" there raises the ♪ sheet on his playlists, and the cover
// he taps travels down to the shelf (rule 28) and is added at its end (addPick). On the small rows the plus goes
// straight to the ♪ sheet, and only connected, as before.
//
// A long press lifts a cover or a line 2px (rule 20), ringed in ink while the rest dim: it rides under the finger, the
// others make way, and where it is let go is its place (movePick); let go off the shelf, or on the place the plus
// held, it is taken off (removePick). A drop ticks (rule 19). Without a drag: a lifted thing let go where it was stays
// lifted, and a tap on another puts it in that one's place, a tap on the struck place takes it off, a tap on itself,
// Escape or a touch elsewhere puts it down. Keys: Alt with an arrow moves the focused one along, Delete takes it off.
//
// Room (first paint): the shelf holds its height before it has been read, so what is printed under it (the 988 line)
// never moves. One row of covers by default, which is every starter shelf; once drawn, how many rows and lines it
// took is kept per sign in localStorage (two small numbers, no title), and the next first paint holds that much.
//
// Still (rule 13): the covers stay, dimmed by the ♪ grid's own rule; the lines, the plus and lifting leave, as the On
// sheet's lines do. Locked (the door): nothing at all. A locked journal reads every shelf as empty (model/acts.ts),
// and an empty shelf shown at the door would read as one he chose to empty, so the shelf waits behind the PIN with
// the rest of his words.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import type { OnPick, PickKind } from '../../../db/schema';
import type { ChakraId } from '../../../model/mountain';
import { addPick, movePick, removePick, shelf } from '../../../model/acts';
import { albumUriOf } from '../../../db/seed/picks';
import { albumPick } from '../../../model/tips';
import type { ShelfAlbum } from '../../../music/covers';
import { keep, KIND_WORD, type Kept } from '../On';
import { Tile, useHush } from '../../music/MusicSheet';
import { chooseAlbum, connected, playing, shelves, wake } from '../../music/state';
import { openAlbum } from '../../../music/spotify';
import { tick } from '../../parts/Haptic';
import { HOLD_MS } from '../../parts/Hold';
import { Sheet, tokenMs } from '../../parts/Sheet';
import { dataVersion } from '../../sheets';
import { light } from '../../light';
import { gateState } from '../../lock/pin';
import './SignShelf.css';

/** Bumped when any shelf is written, so the sign's page and the Signs segment draw the same shelf. */
export const shelfVersion = signal(0);

/** How far a finger may wander before a long press is a scroll instead (parts/Hold's slop). */
const SLOP_PX = 8;

/** A tile on the shelf: an album Spotify knows. Its cover when one is kept, else the tile with its title on it. */
const isTile = (p: OnPick) => p.kind === 'album' && !!albumUriOf(p);

/** The room a shelf took the last time it was drawn, per sign: rows of covers and written lines. Two small numbers
 *  and no word of his, kept outside the journal so the first paint, before any read, can hold the same height. */
export type Room = { rows: number; lines: number };
const ROOM_KEY = 'fs-shelf-room';
const ONE_ROW: Room = { rows: 1, lines: 0 };
const readRooms = (): Record<string, Room> => {
  try { const v = JSON.parse(localStorage.getItem(ROOM_KEY) ?? '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
};
export function roomOf(chakra: ChakraId): Room {
  const v = readRooms()[chakra];
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.min(40, Math.round(x)) : null);
  const rows = n(v?.rows), lines = n(v?.lines);
  return rows === null || lines === null ? ONE_ROW : { rows: Math.max(1, rows), lines };
}
export function keepRoom(chakra: ChakraId, room: Room) {
  const all = readRooms(), had = all[chakra];
  if (had && had.rows === room.rows && had.lines === room.lines) return;
  try { localStorage.setItem(ROOM_KEY, JSON.stringify({ ...all, [chakra]: room })); } catch { /* private mode: one row is held */ }
}

/** Where a lifted thing goes: the index, in the shelf without it, of the place nearest the finger among its own kind.
 *  others are the rest of its kind in order, with their boxes; along says which way the kind runs (covers sideways,
 *  wrapping; lines down). Past the middle of the nearest one, it goes after it. */
export function placeAt(others: { index: number; box: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'> }[], x: number, y: number,
  along: 'x' | 'y', end: number): number {
  if (!others.length) return end;
  let best = others[0], d = Infinity;
  for (const o of others) {
    const cx = o.box.left + o.box.width / 2, cy = o.box.top + o.box.height / 2;
    const k = Math.hypot(x - cx, y - cy);
    if (k < d) { d = k; best = o; }
  }
  const mid = along === 'x' ? best.box.left + best.box.width / 2 : best.box.top + best.box.height / 2;
  return (along === 'x' ? x : y) > mid ? best.index + 1 : best.index;
}

/** The shelf with one pick moved to index `to` of the shelf without it (movePick's own reading). */
export function moved(picks: OnPick[], id: string, to: number): OnPick[] {
  const from = picks.findIndex(p => p.id === id);
  if (from < 0) return picks;
  const out = [...picks];
  const [p] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, p);
  return out;
}

/** The written kinds the plus offers: flow/On.tsx's LINE_KINDS with the two new ones (R4) first. Written out here, not
 *  derived, because On.tsx and this file import each other by way of the ♪ sheet (test/ui/sign-shelf.test.ts holds
 *  the two lists to the same kinds). */
export const SHELF_KINDS: Exclude<PickKind, 'album'>[] = ['book', 'art', 'show', 'film', 'switch', 'phone'];

type Loaded = { picks: OnPick[]; kept: Kept };

/** The sign's shelf as it is kept, read again after any write, an import, a cover arriving or the lock changing. */
function useShelf(chakra: ChakraId): { got: Loaded | null; locked: boolean; reload: () => void } {
  const locked = gateState() === 'locked';
  const [got, setGot] = useState<Loaded | null>(null);
  const [k, setK] = useState(0);
  const v = shelfVersion.value, d = dataVersion.value, s = shelves.value;
  useEffect(() => {
    if (locked) { setGot(null); return; }
    let on = true;
    void (async () => {
      const picks = (await shelf(chakra)).filter(p => !p.struck);
      const kept = await keep(picks);
      if (on) setGot({ picks, kept });
    })().catch(() => { /* locked under the read: nothing to show */ });
    return () => { on = false; };
  }, [chakra, locked, v, d, s, k]);
  return { got, locked, reload: () => setK(x => x + 1) };
}

/** A write to the shelf: refused while locked (LockedError), and then the shelf only reads again. */
async function write(run: () => Promise<unknown>) {
  try { await run(); } catch { /* locked again under the thumb: nothing was written */ }
  shelfVersion.value++;
}

type Lift = { id: string; px: number; py: number; gx: number; gy: number; tx: number; ty: number; moved: boolean; dragging: boolean };

/** The sign's page's shelf. Needs only the sign: the column's width (it wraps its covers), the page behind it. */
export function SignShelf({ chakra }: { chakra: ChakraId }) {
  return <Shelf chakra={chakra} />;
}

/** The shelf itself. small is the Signs segment's row: smaller covers, beside the sign's name. */
export function Shelf({ chakra, small = false }: { chakra: ChakraId; small?: boolean }) {
  const { got, locked } = useShelf(chakra);
  const hushed = useHush();
  const still = light.value === 'still';
  const root = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState<OnPick[] | null>(null);
  const [lifted, setLifted] = useState<string | null>(null);
  const [off, setOff] = useState(false);
  const lift = useRef<Lift | null>(null);
  const [adding, setAdding] = useState(false);
  /** A hold just lifted something: the click that ends the press must not play it. */
  const swallow = useRef(false);
  /** A cover chosen on the ♪ sheet, on its way here: where its tile was, to travel from once it is on the shelf. */
  const arriving = useRef<{ uri: string; from: DOMRect; src: string } | null>(null);
  /** Writes not yet read back: until they are, the shelf stays drawn as he left it, so an older read cannot undo it. */
  const pending = useRef(0);
  const save = (run: () => Promise<unknown>) => {
    pending.current++;
    void write(run).finally(() => { pending.current--; });
  };

  const picks = order ?? got?.picks ?? [];
  const kept: Kept = got?.kept ?? new Map();
  const now = playing.value?.albumUri;

  const cellOf = (id: string) => root.current?.querySelector<HTMLElement>(`[data-pick="${CSS.escape(id)}"]`) ?? null;

  /** The lifted thing under the finger: wherever layout has put it, it is drawn where the finger holds it. */
  const follow = () => {
    const l = lift.current, el = l && cellOf(l.id);
    if (!l || !el) return;
    const r = el.getBoundingClientRect();
    const left = r.left - l.tx, top = r.top - l.ty;
    l.tx = l.px - l.gx - left;
    l.ty = l.py - l.gy - top;
    el.style.transform = `translate(${l.tx}px, ${l.ty - 2}px)`;
  };
  useLayoutEffect(follow, [order]);

  const putDown = () => {
    const l = lift.current;
    if (l) { const el = cellOf(l.id); if (el) el.style.transform = ''; }
    lift.current = null;
    setLifted(null);
    setOff(false);
    setOrder(null);
  };

  /** Where it was let go: off the shelf takes it off, anywhere else is its place. */
  const drop = (gone: boolean) => {
    const l = lift.current;
    if (!l) return;
    const id = l.id;
    const list = order ?? got?.picks ?? [];
    const to = list.findIndex(p => p.id === id);
    const was = (got?.picks ?? []).findIndex(p => p.id === id);
    tick('drop');
    if (gone) save(() => removePick(chakra, id));
    else if (to !== was && to >= 0) save(() => movePick(chakra, id, to));
    // the shelf as it now stands stays drawn until the write has been read back, so nothing jumps
    if (gone) setOrder(list.filter(p => p.id !== id));
    const el = cellOf(id);
    if (el) el.style.transform = '';
    lift.current = null;
    setLifted(null);
    setOff(false);
  };
  // the kept shelf read back after a write: the drawn order gives way to it
  useEffect(() => { if (!lift.current && !pending.current) setOrder(null); }, [got]);

  const isOff = (x: number, y: number) => {
    const box = root.current?.getBoundingClientRect();
    const place = root.current?.querySelector('.ck-shelf-off')?.getBoundingClientRect();
    if (place && x >= place.left && x <= place.right && y >= place.top && y <= place.bottom) return true;
    if (!box) return false;
    const m = SLOP_PX * 2;
    return x < box.left - m || x > box.right + m || y < box.top - m || y > box.bottom + m;
  };

  // the drag: while something is lifted, the finger anywhere moves it
  useEffect(() => {
    if (!lifted) return;
    const hold = (e: TouchEvent) => { if (lift.current?.dragging) e.preventDefault(); };
    const move = (e: PointerEvent) => {
      const l = lift.current;
      if (!l || !l.dragging) return;
      if (!l.moved && Math.hypot(e.clientX - l.px, e.clientY - l.py) <= SLOP_PX) return;
      l.moved = true;
      l.px = e.clientX; l.py = e.clientY;
      const list = order ?? got?.picks ?? [];
      const me = list.find(p => p.id === l.id);
      if (!me) return;
      const cover = isTile(me);
      const rest = list.filter(p => p.id !== l.id);
      const others = rest.flatMap((p, index) => {
        if (isTile(p) !== cover) return [];
        const el = cellOf(p.id);
        return el ? [{ index, box: el.getBoundingClientRect() }] : [];
      });
      const gone = isOff(e.clientX, e.clientY);
      setOff(gone);
      if (!gone) {
        // after the last of its own kind when it is past them all
        const lastOfKind = rest.reduce((n, p, i) => (isTile(p) === cover ? i + 1 : n), 0);
        const to = placeAt(others, e.clientX, e.clientY, cover ? 'x' : 'y', lastOfKind);
        const next = moved(list, l.id, to);
        if (next.some((p, i) => p.id !== list[i].id)) { setOrder(next); return; }
      }
      follow();
    };
    const up = (e: PointerEvent) => {
      const l = lift.current;
      if (!l || !l.dragging) return;
      l.dragging = false;
      // let go where it was lifted: it stays lifted, for a tap to place it
      if (!l.moved) { const el = cellOf(l.id); if (el) el.style.transform = ''; l.tx = 0; l.ty = 0; return; }
      drop(isOff(e.clientX, e.clientY));
    };
    const cancel = () => { if (lift.current?.dragging) putDown(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') putDown(); };
    // a touch outside the shelf puts a lifted thing down
    const away = (e: PointerEvent) => {
      const l = lift.current;
      if (l && !l.dragging && !root.current?.contains(e.target as Node)) putDown();
    };
    document.addEventListener('touchmove', hold, { passive: false });
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', cancel);
    addEventListener('keydown', key);
    addEventListener('pointerdown', away, true);
    return () => {
      document.removeEventListener('touchmove', hold);
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', cancel);
      removeEventListener('keydown', key);
      removeEventListener('pointerdown', away, true);
    };
  }, [lifted, order, got]);

  // a cover chosen on the ♪ sheet travels from its tile to its place here, once it is drawn (rule 28)
  useLayoutEffect(() => {
    const a = arriving.current;
    if (!a || !got) return;
    const cell = root.current?.querySelector<HTMLElement>(`.fs-tile[data-album="${CSS.escape(a.uri)}"]`);
    if (!cell) return;
    arriving.current = null;
    const run = tokenMs('--t-page');
    if (!run) return;
    const to = cell.getBoundingClientRect();
    if (!to.width) return;
    const copy = document.createElement('img');
    copy.className = 'fs-fly';
    copy.src = a.src;
    copy.alt = '';
    copy.setAttribute('aria-hidden', 'true');
    Object.assign(copy.style, { left: `${a.from.left}px`, top: `${a.from.top}px`, width: `${a.from.width}px`, height: `${a.from.height}px` });
    document.body.appendChild(copy);
    cell.style.visibility = 'hidden';
    const s = to.width / a.from.width;
    const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease-settle').trim() || 'ease-out';
    const anim = copy.animate([{ transform: 'none' }, { transform: `translate(${to.left - a.from.left}px, ${to.top - a.from.top}px) scale(${s})` }],
      { duration: run + tokenMs('--t-ui'), easing, fill: 'forwards' });
    void anim.finished.catch(() => undefined).then(() => { copy.remove(); cell.style.visibility = ''; });
  }, [got]);

  // Still takes lifting away (rule 13): a thing lifted when the light turns is put down where it was
  // and the plus's sheet goes down with it, not to rise again when the light comes back
  useEffect(() => { if (!still) return; if (lift.current) putDown(); setAdding(false); }, [still]);

  // the room this shelf took, kept for the next first paint (the page's shelf, at rest, by Day or Night)
  useLayoutEffect(() => {
    if (!got || small || still || lifted || order) return;
    const row = root.current?.querySelector('.ck-shelf-covers');
    const tops = new Set([...(row?.children ?? [])].map(c => (c as HTMLElement).offsetTop));
    keepRoom(chakra, { rows: Math.max(1, tops.size), lines: got.picks.filter(p => !isTile(p)).length });
  }, [got, small, still, lifted, order]);

  if (locked) return null;
  if (!got) {
    const room = small ? null : roomOf(chakra);
    return <div ref={root} class={`ck-shelf${small ? ' small' : ' wait'}`} aria-hidden="true"
      style={room ? { '--ck-rows': room.rows, '--ck-lines': room.lines } : undefined} />;
  }

  const covers = picks.filter(isTile);
  const lines = picks.filter(p => !isTile(p));
  const canEdit = !still;
  // the page's plus is always there to write a line with; the small rows' plus only chooses a cover, so only connected
  const hasPlus = canEdit && (!small || connected.value);

  const startLift = (id: string, x: number, y: number) => {
    if (!canEdit) return;
    const el = cellOf(id);
    if (!el) return;
    const r = el.getBoundingClientRect();
    lift.current = { id, px: x, py: y, gx: x - r.left, gy: y - r.top, tx: 0, ty: 0, moved: false, dragging: true };
    swallow.current = true;
    setLifted(id);
  };

  /** A tap while something is lifted places it, or puts it down; it never plays. */
  const tapLifted = (id: string) => {
    const l = lift.current;
    if (!l) return;
    if (id === l.id) { putDown(); return; }
    const list = got.picks;
    const to = list.findIndex(p => p.id === id);
    if (to < 0) { putDown(); return; }
    tick('drop');
    setOrder(moved(list, l.id, to));
    save(() => movePick(chakra, l.id, to));
    lift.current = null;
    setLifted(null);
  };

  const keys = (id: string) => (e: KeyboardEvent) => {
    if (!canEdit) return;
    const list = got.picks;
    const i = list.findIndex(p => p.id === id);
    if (i < 0) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      tick('drop');
      setOrder(list.filter(p => p.id !== id));
      save(() => removePick(chakra, id));
      return;
    }
    if (!e.altKey) return;
    const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0;
    if (!step) return;
    e.preventDefault();
    // along its own kind: a cover moves past the next cover, a line past the next line
    const cover = isTile(list[i]);
    let j = i + step;
    while (j >= 0 && j < list.length && isTile(list[j]) !== cover) j += step;
    if (j < 0 || j >= list.length) return;
    tick('drop');
    setOrder(moved(list, id, j));
    save(() => movePick(chakra, id, j));
    requestAnimationFrame(() => cellOf(id)?.querySelector<HTMLElement>('button, [tabindex]')?.focus());
  };

  const choose = () => chooseAlbum((a: ShelfAlbum) => {
    tick('album');
    const tile = document.querySelector<HTMLElement>(`.fs-sheet .fs-tile[data-album="${CSS.escape(a.albumUri)}"]`);
    const img = tile?.querySelector('img');
    if (tile && img?.src) arriving.current = { uri: a.albumUri, from: tile.getBoundingClientRect(), src: img.src };
    save(() => addPick(chakra, albumPick(a)));
  });

  const add = (kind: Exclude<PickKind, 'album'>, title: string) => {
    tick('drop');
    save(() => addPick(chakra, { kind, title }));
  };

  const item = (p: OnPick, child: ComponentChildren, cls: string) => (
    <Lifts key={p.id} id={p.id} cls={cls} lifted={lifted === p.id} off={off && lifted === p.id} canLift={canEdit}
      onLift={startLift} onKey={keys(p.id)}
      onClickCapture={e => {
        if (swallow.current) { swallow.current = false; e.preventDefault(); e.stopPropagation(); return; }
        if (lift.current) { e.preventDefault(); e.stopPropagation(); tapLifted(p.id); return; }
        // with no account nothing plays from here: the tile opens its album in Spotify
        if (isTile(p) && !connected.value) { e.preventDefault(); e.stopPropagation(); tick('album'); openAlbum(p.albumId!, wake.open); }
      }}>
      {child}
    </Lifts>
  );

  return (
    <>
      <div ref={root} class={`ck-shelf${small ? ' small' : ''}${lifted ? ' lifting' : ''}`} data-shelf={chakra}>
        {(covers.length > 0 || !!lifted || hasPlus) && <div class={`ck-shelf-covers fs-tiles${hushed ? ' hush' : ''}`} role="group" aria-label="Albums">
          {covers.map(p => {
            const uri = albumUriOf(p)!;
            const k = kept.get(uri);
            // no cover kept: the same tile, empty, playing the album as itself
            const row: ShelfAlbum = k?.row ?? { albumUri: uri, album: p.title, artist: p.by ?? '', playlistId: '', order: 0, firstTrackUri: '' };
            return item(p, <>
              <Tile playlist={k?.playlist ?? { id: '', uri }} album={row} pressed={now === uri} chosen={hushed === uri} row={0} />
              {!k && !small && <small class="ck-shelf-name fs-notstill" aria-hidden="true">{p.title}</small>}
            </>, `ck-shelf-cover${k ? '' : ' blank'}`);
          })}
          {lifted ? (
            <button type="button" class="ck-shelf-off" aria-label="Off the shelf"
              onClick={() => { if (lift.current) { lift.current.dragging = false; drop(true); } }}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 15.6 C8 11.6 11.6 8 15.5 4.4" pathLength={1} /></svg>
            </button>
          ) : hasPlus && (
            <button type="button" class="ck-shelf-plus fs-notstill" aria-label="Add to the shelf"
              onClick={small ? choose : () => { tick('sheet'); setAdding(true); }}>+</button>
          )}
        </div>}
        {lines.length > 0 && (
          <div class="ck-shelf-lines fs-notstill" role="group" aria-label="Lines">
            {lines.map(p => item(p, (
              <p class="ck-shelf-line" tabIndex={0}>
                <span>{p.title}</span> <small class="fs-print">{KIND_WORD[p.kind]}</small>
              </p>
            ), 'ck-shelf-linecell'))}
          </div>
        )}
      </div>
      {!small && <AddSheet open={adding && canEdit} onClose={() => setAdding(false)} onAdd={add}
        onAlbum={connected.value ? () => { setAdding(false); choose(); } : undefined} />}
    </>
  );
}

/** The plus on a sign's page (Mountain R4): a rule to write a title on, its kind among the written kinds, Add. One
 *  line a rise; connected, "+ album" goes on to the ♪ sheet. Nothing is offered that he did not write (rule 16). */
function AddSheet({ open, onClose, onAdd, onAlbum }: {
  open: boolean; onClose: () => void; onAdd: (kind: Exclude<PickKind, 'album'>, title: string) => void; onAlbum?: () => void;
}) {
  const [kind, setKind] = useState<Exclude<PickKind, 'album'>>('book');
  const [title, setTitle] = useState('');
  // each rise starts clean: nothing written, and Book the kind chosen
  useEffect(() => { if (open) { setTitle(''); setKind('book'); } }, [open]);
  const ready = !!title.trim();
  const go = () => { if (!ready) return; onAdd(kind, title.trim()); onClose(); };
  return (
    <Sheet open={open} onClose={onClose} title="On the shelf" action={{ label: 'Add', inert: !ready, onPress: go }}>
      <div class="ck-shelf-add">
        <input class="fs-input" value={title} aria-label="A title" placeholder="A title" autocomplete="off" enterkeyhint="done"
          onInput={e => setTitle(e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); go(); } }} />
        <div class="fs-opts" role="group" aria-label="Kind">
          {SHELF_KINDS.map(k => (
            <button key={k} type="button" class="fs-opt" aria-pressed={kind === k} onClick={() => setKind(k)}>{KIND_WORD[k]}</button>
          ))}
          {onAlbum && <button type="button" class="fs-chip add" onClick={onAlbum}>+ album</button>}
        </div>
      </div>
    </Sheet>
  );
}

/** One thing on the shelf: a long press lifts it (parts/Hold's timing and slop, with the place it was pressed). */
function Lifts({ id, cls, lifted, off, canLift, onLift, onKey, onClickCapture, children }: {
  id: string; cls: string; lifted: boolean; off: boolean; canLift: boolean;
  onLift: (id: string, x: number, y: number) => void; onKey: (e: KeyboardEvent) => void;
  onClickCapture: (e: MouseEvent) => void; children: ComponentChildren;
}) {
  const press = useRef<{ x: number; y: number; t: ReturnType<typeof setTimeout> } | null>(null);
  const end = () => { if (press.current) clearTimeout(press.current.t); press.current = null; };
  useEffect(() => end, []);
  return (
    <div class={`${cls}${lifted ? ' lift' : ''}${off ? ' off' : ''}`} data-pick={id}
      onPointerDown={e => {
        if (!canLift || e.button > 0) return;
        end();
        const x = e.clientX, y = e.clientY;
        press.current = { x, y, t: setTimeout(() => { press.current = null; onLift(id, x, y); }, HOLD_MS) };
      }}
      onPointerMove={e => { const p = press.current; if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLOP_PX) end(); }}
      onPointerUp={end} onPointerCancel={end}
      onContextMenu={e => e.preventDefault()}
      onKeyDown={onKey}
      onClickCapture={onClickCapture}
      aria-keyshortcuts={canLift ? 'Alt+ArrowLeft Alt+ArrowRight Delete' : undefined}>
      {children}
    </div>
  );
}
