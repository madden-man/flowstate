// parts/Cycle (PLAN-FLOWS.md section 4): a flow's drawing, from flow.diagram and its steps, with the dot where you are.
//
// Shapes. Each drawn shape is its own module under ./cycle/ (ring.ts now; valley, arc, mountain, curve, coil, clock,
// stairs and fork later), exporting a Shape (./cycle/shape.ts):
//   title             the shape's name on the list ("The ring")
//   w, h              its viewBox; 328 by 224 is eight rules of the Day page, so the drawing holds the grid
//   closed            the walk wraps (the ring) or runs end to end
//   paths(n)          what is drawn for n steps: lines (class arc), dotted parts (arc pass), arrowheads (arrow), extra
//                     marks and words in the hand (kind text)
//   at(t)             the point at t, 0 to 1, along the walk the dot travels; tangentAt(shape, t) gives its direction
//   slotT(i, n)       where step i sits on the walk (its detent)
//   restT(n)          where the dot rests between episodes (the ring: the middle of the dotted way back)
//   label(i, n)       where step i's word goes and how it hangs
// Adding a shape is one new file plus one line in ./cycle/index.ts. Everything else here (the marks, the words, the
// dot as a slider with detents, the drag, the keys, the tick) works from that interface and knows no shape.
//
// The dot (DESIGN.md rules 19 and 20): a role="slider" from 0 (rest) to n (the last step). It follows the finger with
// no transition, clicks into a detent at each step and at rest with a tick (the "detent" site of rule 19), and settles
// on the nearest detent when let go. Arrow keys walk it a detent at a time. Reduced motion changes nothing here: the
// dot never animates on its own (rule 18).
//
// Walk it once (PLAN-FLOWS.md 3.7): a tap on a step word reads that step, and the dot stays where it is; only a drag
// (or a key) moves the dot. When an episode is live, a tap on a step word moves the walker there.
import { useMemo, useRef, useState } from 'preact/hooks';
import type { DiagramName } from '../../db/schema';
import { tick } from './Haptic';
import { shapeOf } from './cycle/index';
import { nearestT, slotPoint, walkDistance, type Drawn, type Shape } from './cycle/shape';

export type CycleStep = { id: string; name: string };

type Props = {
  diagram: DiagramName;
  steps: CycleStep[];
  /** Where the dot is: 0 at rest, 1 to n on a step. */
  at: number;
  /** The step the page is showing (a tap reads one), 1 to n, or 0 for none. */
  showing?: number;
  /** An episode is open: a tap on a step word moves the walker. */
  live?: boolean;
  /** A step word tapped while no episode is open: read it. */
  onRead?: (n: number) => void;
  /** The dot moved: the steps it entered on the way, in order, and the detent it settled on (0 is rest). */
  onMove?: (visits: number[], to: number) => void;
  /** Read only (the journal is locked): the drawing, no dot to drag. */
  disabled?: boolean;
  /** The words only small, the dot only drawn: the list's row. */
  small?: boolean;
};

/** A side word longer than this wraps at its middle space, so it stays inside the page. */
const WRAP = 10;
function lines(name: string, hang: 'above' | 'below' | 'centre'): string[] {
  if (hang !== 'centre' || name.length <= WRAP || !name.includes(' ')) return [name];
  const mid = name.length / 2;
  const cut = [...name.matchAll(/ /g)].map(m => m.index!).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0];
  return [name.slice(0, cut), name.slice(cut + 1)];
}

/** The detents in walk order: each step's t and rest's, with what each is (0 rest, 1..n a step). */
function detents(shape: Shape, n: number) {
  return [...Array.from({ length: n }, (_, i) => ({ n: i + 1, t: shape.slotT(i, n) })), { n: 0, t: shape.restT(n) }]
    .sort((a, b) => a.t - b.t);
}

/** Within this much of a detent along the walk, the dot is in it. */
const CATCH = 0.045;

export function Drawing({ drawn }: { drawn: Drawn[] }) {
  return (
    <>
      {drawn.map((d, i) => (d.kind === 'path'
        ? <path key={i} class={d.cls} d={d.d} />
        : <text key={i} class={d.cls} x={d.x} y={d.y} text-anchor={d.anchor}>{d.text}</text>))}
    </>
  );
}

export function Cycle({ diagram, steps, at, showing = 0, live, onRead, onMove, disabled, small }: Props) {
  const shape = shapeOf(diagram);
  const n = steps.length;
  const svg = useRef<SVGSVGElement>(null);
  const stops = useMemo(() => detents(shape, n), [shape, n]);
  const tOf = (k: number) => (k === 0 ? shape.restT(n) : shape.slotT(k - 1, n));
  // the drag: where the finger has the dot (t), the detent it is in, and the steps it entered on the way
  const drag = useRef<{ pointer: number; from: number; t: number; inside: number | null; visits: number[] } | null>(null);
  const [dragT, setDragT] = useState<number | null>(null);

  const catchAt = (t: number) => {
    const near = stops.reduce((a, b) => (walkDistance(shape, b.t, t) < walkDistance(shape, a.t, t) ? b : a));
    return { near: near.n, inside: walkDistance(shape, near.t, t) <= CATCH ? near.n : null };
  };
  const tFrom = (e: PointerEvent) => {
    const m = svg.current!.getScreenCTM();
    if (!m) return tOf(at);
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return nearestT(shape, p);
  };

  const down = (e: PointerEvent) => {
    if (disabled || small || e.button > 0) return;
    e.preventDefault();
    drag.current = { pointer: e.pointerId, from: at, t: tOf(at), inside: at, visits: [] };
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* the pointer has gone */ }
    setDragT(tOf(at));
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    const t = tFrom(e);
    const { inside } = catchAt(t);
    if (inside !== null && inside !== d.inside) {
      tick('detent');
      if (inside > 0 && d.visits.at(-1) !== inside) d.visits.push(inside);
    }
    d.inside = inside;
    d.t = t;
    setDragT(t);
  };
  const up = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    const to = catchAt(d.t).near;
    setDragT(null);
    const visits = d.visits.filter((v, i, all) => !(i === all.length - 1 && v === to));
    if (to === d.from && !visits.length) return;
    onMove?.(visits, to);
  };
  const cancel = () => { drag.current = null; setDragT(null); };

  const key = (e: KeyboardEvent) => {
    if (disabled) return;
    const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (dir === undefined) return;
    e.preventDefault();
    const i = stops.findIndex(s => s.n === at);
    const j = shape.closed ? (i + dir + stops.length) % stops.length : Math.max(0, Math.min(stops.length - 1, i + dir));
    if (j === i) return;
    tick('detent');
    onMove?.([], stops[j].n);
  };

  const tapWord = (k: number) => {
    if (live && !disabled) { if (k !== at) onMove?.([], k); else onRead?.(k); }
    else onRead?.(k);
  };

  const dot = shape.at(dragT ?? tOf(at));
  const words = steps.map((s, i) => ({ ...s, k: i + 1, label: shape.label(i, n) }));
  const valueText = at === 0 ? 'At rest' : steps[at - 1]?.name ?? '';

  return (
    <div class={`fs-cycle${small ? ' small' : ''}${dragT !== null ? ' drag' : ''}`} data-diagram={diagram} data-at={at}>
      <svg ref={svg} viewBox={`0 0 ${shape.w} ${shape.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden={small ? 'true' : undefined}>
        <Drawing drawn={shape.paths(n)} />
        {!small && steps.map((s, i) => {
          if (i + 1 === at && dragT === null) return null;
          const p = slotPoint(shape, i, n);
          return <circle key={s.id} class="mark" cx={p.x} cy={p.y} r={3} />;
        })}
        {!small && words.map(w => {
          const ls = lines(w.name, w.label.hang);
          // the block: the step's number in print, then its name in the serif, a line or two
          const rows = [{ text: String(w.k), cls: 'fs-cycle-n', h: 13 }, ...ls.map(text => ({ text, cls: 'fs-cycle-name', h: 16 }))];
          const total = rows.reduce((a, r) => a + r.h, 0);
          let y = w.label.hang === 'above' ? w.label.y - total : w.label.hang === 'below' ? w.label.y : w.label.y - total / 2;
          const top = y;
          return (
            <g key={w.id} class="fs-cycle-word" role="button" tabindex={0} aria-pressed={showing === w.k ? 'true' : 'false'}
              aria-label={w.name} data-step={w.k}
              onClick={() => tapWord(w.k)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapWord(w.k); } }}>
              {/* a 44 point target round the words (rule: --hit), invisible */}
              <rect class="fs-cycle-hit" x={w.label.anchor === 'start' ? w.label.x - 6 : w.label.anchor === 'end' ? w.label.x - 84 : w.label.x - 50}
                y={top - (44 - total) / 2 - 3} width={w.label.anchor === 'middle' ? 100 : 90} height={Math.max(44, total + 6)} />
              {rows.map(r => { y += r.h; return <text key={r.cls + r.text} class={r.cls} x={w.label.x} y={y - 3} text-anchor={w.label.anchor}>{r.text}</text>; })}
            </g>
          );
        })}
        {(!small || at > 0) && (
          <g class="fs-cycle-dot" role={small ? undefined : 'slider'} tabindex={small || disabled ? undefined : 0}
            aria-label={small ? undefined : 'Where you are'} aria-valuemin={small ? undefined : 0} aria-valuemax={small ? undefined : n}
            aria-valuenow={small ? undefined : at} aria-valuetext={small ? undefined : valueText}
            aria-disabled={disabled || undefined}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onKeyDown={key}>
            {!small && <circle class="fs-cycle-grip" cx={dot.x} cy={dot.y} r={22} />}
            <circle class="now" cx={dot.x} cy={dot.y} r={small ? 16 : 5} />
          </g>
        )}
      </svg>
    </div>
  );
}
