// The drag across Be's tiers (PLAN-TIERS.md section 5, B2), kept pure so vitest covers it without a browser: the
// lifted row's place from the slots around it, and the speed the list scrolls at under it near an edge.
//
// The run while a row is lifted, top to bottom: for each place its heading; open, its rows and its landing rule (its
// foot); folded, the heading alone (PLAN-FOLDS.md G2: a lift keeps the folds), with the lifted row right under it when
// it rides there. The boxes are every slot but the lifted row, laid out as if it were not there (collapse), on one axis
// (the list's content, so a scroll moves nothing here). The lifted row goes into the gap after every slot whose middle
// its top edge has passed: so it swaps past a heading exactly as it swaps past a row, half the other's height each way,
// and never rocks between two places. A finger on a folded heading's line is in that place, whatever the top edge says.
import type { Tiers, ValuePlace } from '../../model/values';

export type Box = { kind: 'heading' | 'row' | 'land'; place: ValuePlace; top: number; bottom: number; folded?: boolean };
export type Target = { to: ValuePlace; index: number };
/** How many rows a place holds, the lifted one left out: its foot's index. A folded place's rows are not among the
 *  boxes, so the caller says. */
export type Feet = (p: ValuePlace) => number;

/** The slots as they would lie with the lifted row (at liftTop to liftBottom on the same axis) taken out: everything
 *  below it moves up by its height. The lifted row itself is not among the boxes. */
export function collapse(boxes: readonly Box[], liftTop: number, liftBottom: number): Box[] {
  const h = liftBottom - liftTop;
  return boxes.map(b => (b.top >= liftBottom - 0.5 ? { ...b, top: b.top - h, bottom: b.bottom - h } : b));
}

/**
 * Where the lifted row goes: the place and the index within that place's rows without it (placeValue's index). top is
 * the lifted row's top edge (the pointer's y less where it took hold of the row), on the boxes' axis.
 *
 * The gap is named by the slot above it: above the first heading, or under an open heading, is the head of that place;
 * under a folded heading is that place's foot (feet, as its rows are not drawn); under a row is the next index in that
 * row's place; under a landing rule is that place's foot (the rule is the foot, so a row held over it lands last).
 * Above the first heading with that place folded is its foot. Past the last slot is the gap under it.
 * feet defaults to counting each place's rows among the boxes, which is right while every place is open.
 */
export function target(boxes: readonly Box[], top: number, feet?: Feet): Target {
  const sorted = [...boxes].sort((a, b) => a.top - b.top);
  let k = 0;
  while (k < sorted.length && (sorted[k].top + sorted[k].bottom) / 2 < top) k++;
  const rows = (p: ValuePlace, before: number) => sorted.slice(0, before).filter(b => b.kind === 'row' && b.place === p).length;
  const foot = (p: ValuePlace) => (feet ? feet(p) : rows(p, sorted.length));
  const under = (h: Box): Target => ({ to: h.place, index: h.folded ? foot(h.place) : 0 });
  if (k === 0) {
    const first = sorted.find(b => b.kind === 'heading');
    return first ? under(first) : { to: 1, index: 0 };
  }
  const above = sorted[k - 1];
  switch (above.kind) {
    case 'heading': return under(above);
    case 'row': return { to: above.place, index: rows(above.place, k) };
    case 'land': return { to: above.place, index: foot(above.place) };
  }
}

/** The folded place whose heading holds the finger's y (PLAN-FOLDS.md section 5), on the screen as drawn (the boxes not
 *  collapsed: the finger sees the heading where it is). While the lifted row rides in a folded place it is drawn right
 *  under that heading, and its slot (riding) counts as the heading's line too, so the place does not let go of a still
 *  finger when the row's own gap moves from above the heading to under it. */
export function fingerOn(boxes: readonly Box[], y: number, riding?: { place: ValuePlace; bottom: number }): ValuePlace | null {
  for (const b of boxes) {
    if (b.kind !== 'heading' || !b.folded) continue;
    const bottom = riding && riding.place === b.place ? Math.max(b.bottom, riding.bottom) : b.bottom;
    if (y >= b.top && y <= bottom) return b.place;
  }
  return null;
}

/**
 * The whole aim, for the list as drawn: boxes are every slot but the lifted row where they lie now; lift is the lifted
 * row's own slot (where the list has put it, its translate left out) and whether it rides in a folded place; top is its
 * top edge and finger the pointer's y, all on one axis. A finger on a folded line is that place's foot; anywhere else
 * the top edge decides, on the list collapsed.
 */
export function aim(boxes: readonly Box[], lift: { top: number; bottom: number; place: ValuePlace; infold: boolean }, top: number, finger: number, feet: Feet): Target {
  const on = fingerOn(boxes, finger, lift.infold ? lift : undefined);
  if (on !== null) return { to: on, index: feet(on) };
  return target(collapse(boxes, lift.top, lift.bottom), top, feet);
}

/**
 * How far the list scrolls this frame while the pointer is at y (PLAN-TIERS.md section 5, "Scroll"): nothing outside
 * the bands a thumb's height (band) in from the list's top and bottom edges; inside one, up (negative) or down, faster
 * nearer the edge, to max pixels a frame at the edge itself or past it.
 */
export function edgeSpeed(y: number, top: number, bottom: number, band: number, max: number): number {
  if (band <= 0 || bottom - top <= 0) return 0;
  const b = Math.min(band, (bottom - top) / 2);
  const ease = (into: number) => max * Math.min(1, into / b) ** 2;
  if (y < top + b) return -Math.max(1, Math.round(ease(top + b - y)));
  if (y > bottom - b) return Math.max(1, Math.round(ease(y - (bottom - b))));
  return 0;
}

/** True when two targets are the same place and index. */
export const same = (a: Target, b: Target) => a.to === b.to && a.index === b.index;

/** The tiers as drawn while a row rides: the lifted value taken from wherever it is and put at the target. */
export function carry(t: Tiers, id: string, at: Target): Tiers {
  const v = [...t.first, ...t.second, ...t.third, ...t.resting, ...t.legacy].find(x => x.id === id);
  const out: Tiers = {
    first: t.first.filter(x => x.id !== id), second: t.second.filter(x => x.id !== id), third: t.third.filter(x => x.id !== id),
    resting: t.resting.filter(x => x.id !== id), legacy: t.legacy.filter(x => x.id !== id),
  };
  if (!v) return t;
  const key = at.to === 1 ? 'first' : at.to === 2 ? 'second' : at.to === 3 ? 'third' : at.to;
  const rows = [...out[key]];
  rows.splice(Math.max(0, Math.min(rows.length, at.index)), 0, v);
  out[key] = rows;
  return out;
}

/** Where a value is now: its place and its index among that place's rows. */
export function whereIs(t: Tiers, id: string): Target | null {
  for (const [to, rows] of [[1, t.first], [2, t.second], [3, t.third], ['resting', t.resting], ['legacy', t.legacy]] as const) {
    const index = rows.findIndex(x => x.id === id);
    if (index >= 0) return { to, index };
  }
  return null;
}
