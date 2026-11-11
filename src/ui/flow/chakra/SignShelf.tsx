// A sign's shelf (PLAN-TASKS.md section 4, T5): under the gate on every sign's page, and on the sign's row in the ♪
// sheet's Signs segment (ui/music/Signs.tsx). Covers, wordless, then a plus. Self-contained: it reads its own shelf
// (model/acts.ts), so a parent only gives it the sign and room on the page.
//
// A cover is the ♪ grid's own Tile (MusicSheet.tsx), so a tap plays it as a ♪ tile does: on the first chosen playlist
// that holds it, else as itself, with M3's bell, tick, drop, hush, ring and flight to the ♪. Only a kept cover is a
// tile; the covers come from the cache the ♪ grid fills, never fetched here (flow/On.tsx keep). An album with no kept
// cover, and every show, film, game, book and piece of art, is a written line under the covers: its title and its kind
// word in small print, as the On sheet writes them.
//
// The plus (connected only: unconnected there is no grid to choose from) raises the ♪ sheet on his playlists, and the
// cover he taps there travels down to the shelf (rule 28) and is added at its end (addPick). A long press lifts a
// cover or a line 2px (rule 20): it rides under the finger, the others make way, and where it is let go is its place
// (movePick); let go off the shelf, or on the place the plus held, it is taken off (removePick). A drop ticks (rule
// 19). Without a drag: a lifted thing let go where it was stays lifted, and a tap on another puts it in that one's
// place, a tap on the struck place takes it off, a tap on itself, Escape or a touch elsewhere puts it down. Keys:
// Alt with an arrow moves the focused one along, Delete takes it off.
//
// Still (rule 13): the covers stay, dimmed by the ♪ grid's own rule; the lines, the plus and lifting leave, as the On
// sheet's lines do. Locked (the door): nothing at all. A locked journal reads every shelf as empty (model/acts.ts),
// and an empty shelf shown at the door would read as one he chose to empty, so the shelf waits behind the PIN with
// the rest of his words.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import type { OnPick } from '../../../db/schema';
import type { ChakraId } from '../../../model/mountain';
import { addPick, movePick, removePick, shelf } from '../../../model/acts';
import { albumUriOf } from '../../../db/seed/picks';
import { albumPick } from '../../../model/tips';
import type { ShelfAlbum } from '../../../music/covers';
import { keep, KIND_WORD, type Kept } from '../On';
import { Tile, useHush } from '../../music/MusicSheet';
import { chooseAlbum, connected, playing, shelves } from '../../music/state';
import { tick } from '../../parts/Haptic';
import { HOLD_MS } from '../../parts/Hold';
import { tokenMs } from '../../parts/Sheet';
import { dataVersion } from '../../sheets';
import { light } from '../../light';
import { gateState } from '../../lock/pin';
import './SignShelf.css';

/** Bumped when any shelf is written, so the sign's page and the Signs segment draw the same shelf. */
export const shelfVersion = signal(0);

/** How far a finger may wander before a long press is a scroll instead (parts/Hold's slop). */
const SLOP_PX = 8;

const isCover = (p: OnPick, kept: Kept) => p.kind === 'album' && !!kept.get(albumUriOf(p) ?? '')?.row.cover;

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
      const cover = isCover(me, kept);
      const rest = list.filter(p => p.id !== l.id);
      const others = rest.flatMap((p, index) => {
        if (isCover(p, kept) !== cover) return [];
        const el = cellOf(p.id);
        return el ? [{ index, box: el.getBoundingClientRect() }] : [];
      });
      const gone = isOff(e.clientX, e.clientY);
      setOff(gone);
      if (!gone) {
        // after the last of its own kind when it is past them all
        const lastOfKind = rest.reduce((n, p, i) => (isCover(p, kept) === cover ? i + 1 : n), 0);
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

  if (locked) return null;
  if (!got) return <div ref={root} class={`ck-shelf${small ? ' small' : ''}`} aria-hidden="true" />;

  const covers = picks.filter(p => isCover(p, kept));
  const lines = picks.filter(p => !isCover(p, kept));
  const canEdit = !still;

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
    const cover = isCover(list[i], kept);
    let j = i + step;
    while (j >= 0 && j < list.length && isCover(list[j], kept) !== cover) j += step;
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

  const item = (p: OnPick, child: ComponentChildren, cls: string) => (
    <Lifts key={p.id} id={p.id} cls={cls} lifted={lifted === p.id} off={off && lifted === p.id} canLift={canEdit}
      onLift={startLift} onKey={keys(p.id)}
      onClickCapture={e => {
        if (swallow.current) { swallow.current = false; e.preventDefault(); e.stopPropagation(); return; }
        if (lift.current) { e.preventDefault(); e.stopPropagation(); tapLifted(p.id); }
      }}>
      {child}
    </Lifts>
  );

  return (
    <div ref={root} class={`ck-shelf${small ? ' small' : ''}${lifted ? ' lifting' : ''}`} data-shelf={chakra}>
      {(covers.length > 0 || !!lifted || (connected.value && canEdit)) && <div class={`ck-shelf-covers fs-tiles${hushed ? ' hush' : ''}`} role="group" aria-label="Albums">
        {covers.map(p => {
          const uri = albumUriOf(p)!;
          const k = kept.get(uri)!;
          return item(p, <Tile playlist={k.playlist} album={k.row} pressed={now === uri} chosen={hushed === uri} row={0} />, 'ck-shelf-cover');
        })}
        {lifted ? (
          <button type="button" class="ck-shelf-off" aria-label="Off the shelf"
            onClick={() => { if (lift.current) { lift.current.dragging = false; drop(true); } }}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 15.6 C8 11.6 11.6 8 15.5 4.4" pathLength={1} /></svg>
          </button>
        ) : connected.value && canEdit && (
          <button type="button" class="ck-shelf-plus fs-notstill" onClick={choose}>+</button>
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
