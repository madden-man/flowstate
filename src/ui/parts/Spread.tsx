// The spread (DESIGN.md rule 11): a paradox drawn like the notebook. Two facing pages, pole A's goals on
// the left and pole B's on the right, each at the height of its lean; the seam down the middle carries
// only the vertical rule and the dotted pair links; the diagonal runs between the corner tags. Under the
// spread sits the notebook's three-word line (pole A · middle · pole B) with its struck versions. A goal is linked
// to its balance by a dotted path; a missing balance is a dashed slot at the same height. Drawn arrows
// join goals that follow one another. Long press lifts a goal; it slides up and down its page.
//
// Nothing is laid out while hidden: the width comes from a ResizeObserver (zero while not displayed, so
// nothing is placed), every goal's height is measured after it is displayed, and resize or a turn of the
// phone lays it out again.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Item, Paradox } from '../../db/schema';
import type { Read } from '../../db/fields';
import { CornerTag, tagSize } from './CornerTag';
import { Arrow, linkPath, type Rect } from './Arrow';
import { Strike } from './Strike';
import { tick } from './Haptic';
import { arrows, layoutColumn, openSlots, pairOf, riders, slotLine, threeWordLines, yToLean, type Box } from '../../model/paradox';

const LIFT_MS = 350;      // how long a press must rest before the goal lifts
const SLOP_PX = 8;        // movement that turns a press into a scroll
const MIN_BAND = 300;     // the usable height between the corner tags, at the least
const GAP = 8;            // between stacked goals
const SPINE = 18;         // the gap between the facing pages
const GUESS_H = 40;       // a goal's height before it has been measured

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

type Drag = { id: string; pointer: number; x0: number; y0: number; grab: number; lifted: boolean; top: number; lean: number; timer?: ReturnType<typeof setTimeout> };

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

  const words = threeWordLines(paradox);
  const S = Math.max(tagSize(paradox.poleA.value, paradox.poleA.shadow), tagSize(paradox.poleB.value, paradox.poleB.shadow));
  // a goal leaves a little of its page free by the seam, so the dotted link to its balance has room to show
  const pageW = width ? Math.max(80, (width - SPINE) / 2 - 12) : 0;

  // the drag's lean is what the layout sees for the goal and any pair riding with it
  const live = useMemo(() => {
    if (!drag?.lifted) return items;
    const ride = new Set(riders(items, drag.id));
    return items.map(i => (ride.has(i.id) ? { ...i, lean: drag.lean } : i));
  }, [items, drag]);
  const slots = openSlots(live);

  const layout = useMemo(() => {
    if (!width) return null;
    const h = (id: string) => sizes[id]?.h ?? GUESS_H;
    const w = (id: string) => Math.min(pageW, sizes[id]?.w ?? pageW);
    const page = (pole: Item['pole']): Box[] => [
      ...live.filter(i => i.pole === pole).map(i => ({ id: i.id, lean: i.lean, h: h(i.id) })),
      ...slots.filter(s => s.pole === pole).map(s => ({ id: `slot:${s.forId}`, lean: s.lean, h: h(`slot:${s.forId}`) })),
    ];
    const pin = (pole: Item['pole']) => (drag?.lifted && live.find(i => i.id === drag.id)?.pole === pole ? { id: drag.id, top: drag.top } : undefined);
    let band = MIN_BAND;
    let a = layoutColumn(page('a'), S, S + band, GAP, pin('a'));
    let b = layoutColumn(page('b'), S, S + band, GAP, pin('b'));
    const grow = Math.max(a.overflow, b.overflow);
    if (grow && !drag?.lifted) {
      band += grow;
      a = layoutColumn(page('a'), S, S + band, GAP);
      b = layoutColumn(page('b'), S, S + band, GAP);
    }
    const tops = { ...a.tops, ...b.tops };
    const rect = (id: string, pole: Item['pole']): Rect => ({ x: pole === 'a' ? 0 : width - w(id), y: tops[id] ?? S, w: w(id), h: h(id) });
    return { band, H: S * 2 + band, tops, rect };
  }, [width, sizes, live, drag, S, pageW]);

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

  // ---- touch: long press lifts, the goal slides on its page, release writes the lean ----
  const down = (id: string) => (e: PointerEvent) => {
    if (e.button !== 0 || !layout) return;
    const el = e.currentTarget as HTMLElement;
    const top = layout.tops[id] ?? 0;
    const box = pagesRef.current!.getBoundingClientRect();
    const d: Drag = { id, pointer: e.pointerId, x0: e.clientX, y0: e.clientY, grab: e.clientY - box.top - top, lifted: false, top, lean: items.find(i => i.id === id)?.lean ?? 0 };
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
    const h = sizes[d.id]?.h ?? GUESS_H;
    const box = pagesRef.current!.getBoundingClientRect();
    const lo = S, hi = S + layout.band - h;
    d.top = Math.max(lo, Math.min(hi, e.clientY - box.top - d.grab));
    d.lean = yToLean(d.top + h / 2, S, S + layout.band);
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
  // B's goals hang from the right edge, so a goal's own width (measured) never limits how it wraps
  const side = (pole: Item['pole']) => (pole === 'a' ? { left: '0px' } : { right: '0px' });
  const label = `${paradox.poleA.value} and ${paradox.poleB.value}`;

  return (
    <article class={`fs-spread${paradox.status !== 'active' ? ' resting' : ''}`} id={`be-${paradox.id}`} aria-label={label} data-paradox={paradox.id}>
      <div ref={pagesRef} class="fs-spread-pages" style={{ height: H ? `${H}px` : undefined }} data-laid={layout ? 'true' : 'false'}>
        {layout && (
          <svg class="fs-spread-ink" width={width} height={H} viewBox={`0 0 ${width} ${H}`} aria-hidden="true">
            <line class="fs-diag" x1={0} y1={0} x2={width} y2={H} />
            <line class="fs-seam" x1={width / 2} y1={S * 0.5} x2={width / 2} y2={H - S * 0.5} />
          </svg>
        )}
        <CornerTag corner="tl" value={paradox.poleA.value} shadow={paradox.poleA.shadow} size={S} />
        <CornerTag corner="br" value={paradox.poleB.value} shadow={paradox.poleB.shadow} size={S} />

        {layout && (
          <svg class="fs-spread-ink" width={width} height={H} viewBox={`0 0 ${width} ${H}`} aria-hidden="true">
            {live.filter(i => i.pole === 'a').map(i => {
              const p = pairOf(i, live);
              return p ? <path key={`l${i.id}`} class="fs-pair" data-pair={`${i.id} ${p.id}`} d={linkPath(layout.rect(i.id, 'a'), layout.rect(p.id, 'b'))} /> : null;
            })}
            {slots.map(s => {
              const g = layout.rect(s.forId, s.pole === 'a' ? 'b' : 'a');
              const r = layout.rect(`slot:${s.forId}`, s.pole);
              return <path key={`s${s.forId}`} class="fs-pair open" d={s.pole === 'b' ? linkPath(g, r) : linkPath(r, g)} />;
            })}
            {arrows(live).map(({ from, to }) => {
              const f = live.find(i => i.id === from)!, t = live.find(i => i.id === to)!;
              return <Arrow key={`a${from}`} id={`${from} ${to}`} from={layout.rect(from, f.pole)} to={layout.rect(to, t.pole)} />;
            })}
          </svg>
        )}

        {layout && live.map(i => (
          <button key={i.id} ref={ref(i.id)} type="button"
            class={`fs-goal ${i.pole}${drag?.lifted && drag.id === i.id ? ' lift' : ''}${drag?.lifted && riders(items, drag.id).includes(i.id) ? ' riding' : ''}`}
            style={{ ...side(i.pole), top: `${layout.tops[i.id] ?? S}px`, maxWidth: `${pageW}px` }}
            data-goal={i.id} data-lean={i.lean}
            onPointerDown={down(i.id)} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
            onClick={click(i.id, i.pole)} onContextMenu={(e: Event) => e.preventDefault()}>
            <span class="fs-goal-text">{i.locked ? '' : i.text}</span>
            {i.cadence && <small class="fs-state fs-cadence">{i.cadence}</small>}
          </button>
        ))}
        {layout && slots.map(s => (
          <button key={`slot:${s.forId}`} ref={ref(`slot:${s.forId}`)} type="button" class={`fs-slot ${s.pole}`}
            style={{ ...side(s.pole), top: `${layout.tops[`slot:${s.forId}`] ?? S}px`, maxWidth: `${pageW}px` }}
            data-slot-for={s.forId} onClick={() => onGoal(s.forId, s.pole)}>
            {slotLine(valueOf(s.pole))}
          </button>
        ))}

        <div class="fs-spread-words">
          {paradox.status !== 'active' && <span class="fs-state fs-print">{paradox.status}</span>}
          <button type="button" class="fs-word" onClick={onEdit}>Edit</button>
        </div>
      </div>
      {words && (
        <div class="fs-threewords" aria-label="Three words">
          <p class="fs-threeword">{words.current}</p>
          {words.struck.map((w, k) => <p key={k} class="fs-threeword fs-state"><Strike>{w}</Strike></p>)}
        </div>
      )}
      <button type="button" class="fs-addgoal" onClick={onAdd}>+ Goal</button>
    </article>
  );
}
