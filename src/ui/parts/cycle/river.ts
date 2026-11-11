// The mountain's river (PLAN-MOUNTAIN.md sections 3 and 4, pass 5; R1): the one uneven course the water runs, from the
// spring under the summit's snow down through the seven signs to the river mouth and out into the sea. Pure geometry
// on the mock's 328 by 476 box (design/mountain/mountain.js STOPS and its walk); no DOM, no drawing, no colour.
//
// The course is sampled once as a polyline (each leg a cubic that leaves and arrives vertically, so the water falls
// off one stop and swings into the next), and everything else reads it by distance along it, s, in the box's units:
//   at[0]          the spring          at[1..7]  the seven signs, crown to root
//   at[8]          the river mouth     at[9]     the end, out in the sea (TOTAL)
// The stretch a point is in is how many signs the water has passed (0 above the crown, 7 below the root), so the water
// it carries is spring(d) above the crown and reach(d, gates)[j - 1] below sign j (model/mountain.ts).
import { CHAKRA_IDS, type ChakraId } from '../../../model/mountain';

/** The box the mountain is drawn in (the mock's). */
export const W = 328;
export const H = 476;
/** The summit, the shore line, and the row the sea's circles float on. */
export const PEAK = { x: 164, y: 44 } as const;
export const SHORE = 394;
export const SEA_Y = 424;
/** A sea circle's radius. */
export const CIRCLE_R = 15;

/** Where each sign sits on the mountain, and the side its name goes (1 right, -1 left), placed by what it is for:
 *  the crown in the snow under the summit (letting go), the third eye on a ledge out on the lit side (a long view),
 *  the throat at the narrows against the arete (the loudest water: speech), the heart at the end of the long swing out
 *  to the tarn (where water rests), the solar plexus across on the shadow flank (a fire kept: will), the sacral a short
 *  drop to a pool low on the lit side (feeling), the root at the foot in the firs (safety). */
export const STOPS: Readonly<Record<ChakraId, { x: number; y: number; side: 1 | -1 }>> = {
  'crown': { x: 172, y: 80, side: 1 },
  'third-eye': { x: 138, y: 112, side: -1 },
  'throat': { x: 180, y: 152, side: 1 },
  'heart': { x: 112, y: 222, side: -1 },
  'solar-plexus': { x: 216, y: 272, side: 1 },
  'sacral': { x: 148, y: 316, side: -1 },
  'root': { x: 198, y: 360, side: 1 },
};

export type Point = { x: number; y: number };
export type Placed = Point & { tx: number; ty: number };

/** Samples per leg of the walk. */
const PER_LEG = 28;

export interface Course {
  /** The polyline: x, y and the distance along it at each sample. */
  xs: Float32Array; ys: Float32Array; ls: Float32Array;
  /** The spring, the seven signs, the mouth and the end, as distances along the course (ten values). */
  at: readonly number[];
  total: number;
  mouth: number;
}

function build(): Course {
  const way: Point[] = [{ x: PEAK.x, y: PEAK.y + 14 }, ...CHAKRA_IDS.map(id => STOPS[id]), { x: 164, y: SHORE }, { x: 164, y: SEA_Y + 4 }];
  const xs: number[] = [], ys: number[] = [], ls: number[] = [], at: number[] = [0];
  let len = 0;
  for (let w = 0; w < way.length - 1; w++) {
    const a = way[w], b = way[w + 1], my = (a.y + b.y) / 2;
    for (let j = w ? 1 : 0; j <= PER_LEG; j++) {
      const t = j / PER_LEG, u = 1 - t;
      const x = u * u * u * a.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t * t * t * b.x;
      const y = u * u * u * a.y + 3 * u * u * t * my + 3 * u * t * t * my + t * t * t * b.y;
      if (xs.length) len += Math.hypot(x - xs[xs.length - 1], y - ys[ys.length - 1]);
      xs.push(x); ys.push(y); ls.push(len);
    }
    at.push(len);
  }
  return { xs: Float32Array.from(xs), ys: Float32Array.from(ys), ls: Float32Array.from(ls), at, total: len, mouth: at[8] };
}

/** The one course, built once. */
export const COURSE: Course = build();

/** The point at distance s along the course, with the direction the water runs there. */
export function place(s: number, c: Course = COURSE, out: Placed = { x: 0, y: 0, tx: 0, ty: 1 }): Placed {
  const { xs, ys, ls } = c;
  const v = Math.max(0, Math.min(c.total, s));
  let lo = 0, hi = ls.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ls[m] <= v) lo = m; else hi = m; }
  const f = (v - ls[lo]) / ((ls[hi] - ls[lo]) || 1), dx = xs[hi] - xs[lo], dy = ys[hi] - ys[lo], d = Math.hypot(dx, dy) || 1;
  out.x = xs[lo] + dx * f; out.y = ys[lo] + dy * f; out.tx = dx / d; out.ty = dy / d;
  return out;
}

/** How many signs the water at s has passed: 0 above the crown, 7 below the root (and out in the sea). */
export function stretchAt(s: number, c: Course = COURSE): number {
  let i = 0;
  while (i < 7 && s >= c.at[i + 1]) i++;
  return i;
}

/** The water each stretch carries, 0 (spring to crown) to 7 (root to the sea), from the spring and reach. */
export function stretches(spring: number, reached: readonly number[]): number[] {
  return [spring, ...CHAKRA_IDS.map((_, i) => reached[i] ?? spring)];
}

/** The course as an SVG path, one piece a stretch (eight pieces, the last running on into the sea), so each stretch's
 *  channel line can be as wide as what runs in it. */
export function channelPaths(c: Course = COURSE): string[] {
  const out: string[] = [];
  for (let i = 0; i < 8; i++) {
    const from = c.at[i], to = i === 7 ? c.at[8] : c.at[i + 1];
    let d = '';
    for (let j = 0; j < c.ls.length; j++) {
      if (c.ls[j] < from - 0.01 || c.ls[j] > to + 0.01) continue;
      d += `${d ? 'L' : 'M'}${c.xs[j].toFixed(1)} ${c.ys[j].toFixed(1)} `;
    }
    out.push(d.trim());
  }
  return out;
}

/** Where up to five circles float on the sea, spaced about the river mouth: two either side of it, more across it. */
export function seaSlots(n: number): number[] {
  const k = Math.max(0, Math.min(5, Math.floor(n)));
  const gap = k <= 2 ? 112 : k === 3 ? 96 : k === 4 ? 74 : 60;
  return Array.from({ length: k }, (_, i) => PEAK.x + (i - (k - 1) / 2) * gap);
}
