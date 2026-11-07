// The spread, upright (DESIGN.md rule 11, PLAN-V2.md section 2): a paradox drawn for the phone. Pole A's
// word sits centred on the top rule and pole B's on the bottom rule, the seam runs down between them, and
// each goal sits on its pole's side of the seam (A left, B right) at the height of its lean: -1 at the top
// rule, +1 at the bottom. A goal and its balance share a row, tied across the seam by the dotted line; a
// goal without one shares its row with the dashed slot. The paradox's middle word sits on the seam at
// mid-height and the rows keep clear of it. Drawn arrows join goals that follow one another. Long press
// lifts a goal and its row; it slides up and down between the poles. Earlier versions of the three words
// stay struck through in the sheet Edit opens (the poles and the middle now say the current version here).
//
// Nothing is laid out while hidden: the width comes from a ResizeObserver (zero while not displayed, so
// nothing is placed), every goal's height (and the poles' and the middle's) is measured after it is
// displayed, and resize or a turn of the phone lays it out again.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Item, Paradox, Pole } from '../../db/schema';
import type { Read } from '../../db/fields';
import { Arrow, linkPath, type Rect } from './Arrow';
import { tick } from './Haptic';
import { arrows, layoutColumn, riders, rowOf, rowsOf, slotLine, yToLean, type Pin } from '../../model/paradox';

const LIFT_MS = 350;      // how long a press must rest before the goal lifts
const SLOP_PX = 8;        // movement that turns a press into a scroll
const MIN_BAND = 300;     // the usable height between the two pole rules, at the least
const PAD = 8;            // between a pole rule and the nearest row
const GAP = 16;           // between stacked rows (room for an arrow from one row to the next)
const GUESS_H = 44;       // a goal's height before it has been measured
const GUESS_POLE = 29;    // a pole's line before it has been measured
const GUESS_MID = 18;     // the middle word's line before it has been measured

export type SpreadProps = {
  paradox: Read<Paradox>;
  items: Read<Item>[];
  /** "+ Goal": the primary act on the card. */
  onAdd: () => void;
  /** A goal tapped (or its slot: focus is the side to write on). */
  onGoal: (id: string, focus: Item['pole']) => void;
  onEdit: () => void;
  /** A goal let go at a new lean. Resolves when written. */
  onDrop: (id: string, lean: number) => Promise<void>;
};

type Drag = { id: string; row: string; pointer: number; x0: number; y0: number; grab: number; lifted: boolean; top: number; lean: number; timer?: ReturnType<typeof setTimeout> };

const PoleWord = ({ pole }: { pole: Pole }) => <>{pole.value}{pole.shadow && <i> ({pole.shadow})</i>}</>;

export function Spread({ paradox, items, onAdd, onGoal, onEdit, onDrop }: SpreadProps) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const boxes = useRef(new Map<string, HTMLElement>());
  const [width, setWidth] = useState(0);
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({});
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const suppress = useRef(false);

  // ---- measure after display ----
  useEffect(() => {
    const el = pagesRef.current;
    if (!el) return;
    const read = () => setWidth(el.clientWidth);
    read();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null;
    ro?.observe(el);
    addEventListener('orientationchange', read);
    addEventListener('resize', read);
    return () => { ro?.disconnect(); removeEventListener('orientationchange', read); removeEventListener('resize', read); };
  }, []);

  // A lifted goal owns the finger: the page must not scroll under it (iOS needs a non-passive touchmove).
  useEffect(() => {
    const el = pagesRef.current;
    if (!el) return;
    const hold = (e: TouchEvent) => { if (dragRef.current?.lifted) e.preventDefault(); };
    el.addEventListener('touchmove', hold, { passive: false });
    return () => el.removeEventListener('touchmove', hold);
  }, []);

  const middle = paradox.middle?.word ?? paradox.middle?.scenario;

  // the drag's lean is what the layout sees for the goal and its balance riding with it
  const live = useMemo(() => {
    if (!drag?.lifted) return items;
    const ride = new Set(riders(items, drag.id));
    return items.map(i => (ride.has(i.id) ? { ...i, lean: drag.lean } : i));
  }, [items, drag]);
  const rows = useMemo(() => rowsOf(live), [live]);

  const layout = useMemo(() => {
    if (!width) return null;
    const h = (id: string, guess = GUESS_H) => sizes[id]?.h ?? guess;
    const w = (id: string) => sizes[id]?.w ?? width * 0.44;
    const rowH = (r: (typeof rows)[number]) => Math.max(r.a ? h(r.a) : 0, r.b ? h(r.b) : 0, r.slot ? h(`slot:${r.slot.forId}`) : 0);
    const poleA = h('pole:a', GUESS_POLE), poleB = h('pole:b', GUESS_POLE), mid = middle ? h('mid', GUESS_MID) : 0;
    const top = poleA + PAD;
    const run = (band: number) => {
      const pins: Pin[] = [];
      if (middle) pins.push({ id: 'mid', top: top + band / 2 - mid / 2, h: mid });
      if (drag?.lifted) pins.push({ id: drag.row, top: drag.top });
      return layoutColumn(rows.map(r => ({ id: r.id, lean: r.lean, h: rowH(r) })), top, top + band, GAP, pins);
    };
    let band = MIN_BAND;
    let col = run(band);
    // grow until nothing overlaps (a pin at mid-height moves down with the growth, so this takes a few rounds)
    for (let k = 0; k < 8 && col.overflow && !drag?.lifted; k++) { band += Math.ceil(col.overflow); col = run(band); }
    const tops = col.tops;
    const rowTop = (id: string) => { const r = rowOf(rows, id) ?? rows.find(x => x.slot && `slot:${x.slot.forId}` === id); return (r && tops[r.id]) ?? top; };
    const rect = (id: string, pole: Item['pole']): Rect => ({ x: pole === 'a' ? 0 : width - w(id), y: rowTop(id), w: w(id), h: h(id) });
    const H = top + band + PAD + poleB;
    return { top, band, H, tops, rect, rowTop, poleA, poleB, rowH };
  }, [width, sizes, rows, drag, middle]);

  // after every layout, read the real heights; a change lays it out again (once, then it is stable)
  useLayoutEffect(() => {
    if (!width) return;
    const next: Record<string, { w: number; h: number }> = {};
    let changed = false;
    for (const [id, el] of boxes.current) {
      if (!el.isConnected) { boxes.current.delete(id); continue; }
      const hh = el.offsetHeight, ww = el.offsetWidth;
      if (!hh) return; // not displayed: lay nothing out
      next[id] = { w: ww, h: hh };
      if (sizes[id]?.h !== hh || sizes[id]?.w !== ww) changed = true;
    }
    if (changed || Object.keys(next).length !== Object.keys(sizes).length) setSizes(next);
  });

  const ref = (id: string) => (el: HTMLElement | null) => { if (el) boxes.current.set(id, el); else boxes.current.delete(id); };

  // ---- touch: long press lifts, the goal's row slides between the poles, release writes the lean ----
  const down = (id: string) => (e: PointerEvent) => {
    if (e.button !== 0 || !layout) return;
    const el = e.currentTarget as HTMLElement;
    const row = rowOf(rows, id)?.id ?? id;
    const top = layout.tops[row] ?? layout.top;
    const box = pagesRef.current!.getBoundingClientRect();
    const d: Drag = { id, row, pointer: e.pointerId, x0: e.clientX, y0: e.clientY, grab: e.clientY - box.top - top, lifted: false, top, lean: items.find(i => i.id === id)?.lean ?? 0 };
    d.timer = setTimeout(() => {
      d.lifted = true;
      try { el.setPointerCapture(d.pointer); } catch { /* the pointer has gone */ }
      setDrag({ ...d });
    }, LIFT_MS);
    dragRef.current = d;
  };
  const move = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointer !== e.pointerId || !layout) return;
    if (!d.lifted) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > SLOP_PX) { clearTimeout(d.timer); dragRef.current = null; }
      return;
    }
    e.preventDefault();
    const r = rows.find(x => x.id === d.row);
    const h = r ? layout.rowH(r) : GUESS_H;
    const box = pagesRef.current!.getBoundingClientRect();
    const lo = layout.top, hi = layout.top + layout.band - h;
    d.top = Math.max(lo, Math.min(hi, e.clientY - box.top - d.grab));
    d.lean = yToLean(d.top + h / 2, layout.top, layout.top + layout.band);
    setDrag({ ...d });
  };
  const up = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointer !== e.pointerId) return;
    clearTimeout(d.timer);
    dragRef.current = null;
    if (!d.lifted) return; // a tap: the click opens the goal
    suppress.current = true;
    tick('drop');
    void onDrop(d.id, d.lean).finally(() => setDrag(null));
  };
  const cancel = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointer !== e.pointerId) return;
    clearTimeout(d.timer);
    dragRef.current = null;
    setDrag(null);
  };
  const click = (id: string, pole: Item['pole']) => () => {
    if (suppress.current) { suppress.current = false; return; }
    onGoal(id, pole);
  };

  const valueOf = (pole: Item['pole']) => (pole === 'a' ? paradox.poleA.value : paradox.poleB.value);
  const H = layout?.H ?? 0;
  const lifted = drag?.lifted ? new Set(riders(items, drag.id)) : null;
  const label = `${paradox.poleA.value} and ${paradox.poleB.value}`;

  return (
    <article class={`fs-spread${paradox.status !== 'active' ? ' resting' : ''}`} id={`be-${paradox.id}`} aria-label={label} data-paradox={paradox.id}>
      <div ref={pagesRef} class="fs-spread-pages" style={{ height: H ? `${H}px` : undefined }} data-laid={layout ? 'true' : 'false'}>
        {layout && (
          <svg class="fs-spread-ink" width={width} height={H} viewBox={`0 0 ${width} ${H}`} aria-hidden="true">
            <line class="fs-seam" x1={width / 2} y1={layout.poleA} x2={width / 2} y2={H - layout.poleB} />
            {rows.map(r => {
              if (r.a && r.b) return <path key={`l${r.id}`} class="fs-pair" data-pair={`${r.a} ${r.b}`} d={linkPath(layout.rect(r.a, 'a'), layout.rect(r.b, 'b'))} />;
              if (!r.slot) return null;
              const g = layout.rect(r.slot.forId, r.slot.pole === 'a' ? 'b' : 'a');
              const s = layout.rect(`slot:${r.slot.forId}`, r.slot.pole);
              return <path key={`s${r.id}`} class="fs-pair open" d={r.slot.pole === 'b' ? linkPath(g, s) : linkPath(s, g)} />;
            })}
            {arrows(live).map(({ from, to }) => {
              const f = live.find(i => i.id === from)!, t = live.find(i => i.id === to)!;
              return <Arrow key={`a${from}`} id={`${from} ${to}`} from={layout.rect(from, f.pole)} to={layout.rect(to, t.pole)} />;
            })}
          </svg>
        )}

        {layout && <p ref={ref('pole:a')} class="fs-pole a"><PoleWord pole={paradox.poleA} /></p>}
        {layout && middle && <span ref={ref('mid')} class="fs-mid" style={{ top: `${layout.tops.mid ?? 0}px` }}>{middle}</span>}

        {layout && live.map(i => (
          <button key={i.id} ref={ref(i.id)} type="button"
            class={`fs-goal ${i.pole}${lifted?.has(i.id) ? (i.id === drag!.id ? ' lift' : ' riding') : ''}`}
            style={{ top: `${layout.rowTop(i.id)}px` }}
            data-goal={i.id} data-lean={i.lean} data-row={rowOf(rows, i.id)?.id}
            onPointerDown={down(i.id)} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
            onClick={click(i.id, i.pole)} onContextMenu={(e: Event) => e.preventDefault()}>
            <span class="fs-goal-text">{i.locked ? '' : i.text}</span>
            {i.cadence && <small class="fs-state fs-cadence">{i.cadence}</small>}
          </button>
        ))}
        {layout && rows.filter(r => r.slot).map(({ slot: s, id }) => (
          <button key={`slot:${s!.forId}`} ref={ref(`slot:${s!.forId}`)} type="button" class={`fs-slot ${s!.pole}`}
            style={{ top: `${layout.tops[id] ?? layout.top}px` }}
            data-slot-for={s!.forId} data-row={id} onClick={() => onGoal(s!.forId, s!.pole)}>
            {slotLine(valueOf(s!.pole))}
          </button>
        ))}

        {layout && <p ref={ref('pole:b')} class="fs-pole b" style={{ top: `${H - layout.poleB}px` }}><PoleWord pole={paradox.poleB} /></p>}

        <div class="fs-spread-words">
          {paradox.status !== 'active' && <span class="fs-state fs-print">{paradox.status}</span>}
          <button type="button" class="fs-word" onClick={onEdit}>Edit</button>
        </div>
      </div>
      <button type="button" class="fs-addgoal" onClick={onAdd}>+ Goal</button>
    </article>
  );
}
