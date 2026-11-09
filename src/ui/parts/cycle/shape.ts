// The shape interface for parts/Cycle (PLAN-FLOWS.md section 4): one module per drawn shape under this folder,
// each exporting a Shape; index.ts registers them by DiagramName. See the top of ../Cycle.tsx for how to add one.

/** A point in the shape's own viewBox units. */
export type Pt = { x: number; y: number };

/** Something drawn: a path (class arc, pass for dotted, faint, arrow) or a word in the hand (class hand, print). */
export type Drawn =
  | { kind: 'path'; d: string; cls: string }
  | { kind: 'text'; x: number; y: number; text: string; anchor: 'start' | 'middle' | 'end'; cls: string };

/** Where a step's word sits: its anchor point, how the text hangs from it, and which way the block grows. */
export type Label = Pt & { anchor: 'start' | 'middle' | 'end'; hang: 'above' | 'below' | 'centre' };

export interface Shape {
  /** The shape's name on the list, in the user's words: "The ring". */
  title: string;
  /** The viewBox. 328 by 224 is eight rules of the Day page, so the drawing holds the grid (DESIGN.md rule 5). */
  w: number;
  h: number;
  /** The walk wraps round (the ring) or runs end to end (a slope). Drag distance wraps only on a closed walk. */
  closed: boolean;
  /** The drawing for a flow of n steps: the shape's lines, the dotted parts, arrowheads and any extra marks. */
  paths(n: number): Drawn[];
  /** The point at t along the walk the dot travels, t from 0 to 1 (rest included, if the shape has one). */
  at(t: number): Pt;
  /** Where step i (0 based) of n sits on the walk. A flow with more steps than the shape has places spaces them. */
  slotT(i: number, n: number): number;
  /** Where the dot rests between episodes (the ring: on the dotted way back). */
  restT(n: number): number;
  /** Where step i's word goes. */
  label(i: number, n: number): Label;
  /** F4: where the middle of the page (F2's clock, "hold") sits on this drawing, if not its centre: an open shape whose
   *  centre is drawn on puts it in a clear place. */
  mid?: Pt;
  /** F4/F6: the same shape with his outcomes drawn on it (the curve's stamps); a shape without it draws none itself. */
  withStamps?(outcomes: Stamp[]): Shape;
  /** M5: the shape's own water (the stream, ./stream.ts), for a flow of n steps; a shape without it runs plain. */
  stream?(n: number): Water;
}

/** A side road the stream runs along beside the walk (the crash, "say it", "one small thing"): drawn pieces, in
 *  viewBox units, from where it leaves the walk. Its water has its own pace and a few motes of its own. */
export type SideRoad = {
  pieces: { from: Pt; c1?: Pt; c2?: Pt; to: Pt }[];
  pace: number;
  /** How many motes run it (the whole layer stays under about ninety). */
  motes: number;
  /** How bright, against the main stream's 1. */
  alpha: number;
  /** It leads away and its water fades out on the way (the fork's hide and hit back), instead of reaching the end. */
  fades?: boolean;
};

/** What a shape may add to the stream (PLAN-MOTION.md M5 item 3). All optional; none is a plain stream. */
export type Water = {
  /** It moves in ticks, a second apart (the clock). */
  ticks?: boolean;
  /** Slow water hangs this far below the line (the valley), in drawing units. */
  hang?: number;
  /** Fast water lifts this far off the line (the arc's crest), in drawing units. */
  lift?: number;
  /** Stretches of the walk, as [from, to] in t, where the water runs thin (the ring's dotted way back). */
  thin?: [number, number][];
  sides?: SideRoad[];
};

/** An outcome stamped on a drawing (episodes.prediction): a check for "didn't happen", a cross for "happened". */
export type Stamp = 'didnt' | 'happened';

/** Where the middle sits, as fractions of the drawing (the centre unless the shape says otherwise). */
export const midOf = (s: Shape) => ({ x: (s.mid?.x ?? s.w / 2) / s.w, y: (s.mid?.y ?? s.h / 2) / s.h });

/** The point of step i: the dot's detent there. */
export const slotPoint = (s: Shape, i: number, n: number): Pt => s.at(s.slotT(i, n));
/** The direction of travel at t, in degrees (0 is to the right, 90 is down), measured along the walk. */
export function tangentAt(s: Shape, t: number): number {
  const e = 0.002;
  const a = s.at(Math.max(0, t - e)), b = s.at(Math.min(1, t + e));
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}
export const restPoint = (s: Shape, n: number): Pt => s.at(s.restT(n));

/** An open arrowhead at p pointing along deg, as path data (the mock's drawn chevron). */
export function arrowHead(p: Pt, deg: number, size = 5): string {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const pt = (dx: number, dy: number) => `${(p.x + dx * c - dy * s).toFixed(1)} ${(p.y + dx * s + dy * c).toFixed(1)}`;
  return `M${pt(-size, -size * 0.7)} L${pt(0, 0)} L${pt(-size, size * 0.7)}`;
}

/** The t on the walk nearest to p, by sampling (good to a third of a degree on the ring). */
export function nearestT(s: Shape, p: Pt, samples = 720): number {
  let best = 0, bd = Infinity;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples, q = s.at(t), d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

/** Distance between two places on the walk; a closed walk wraps. */
export const walkDistance = (s: Shape, a: number, b: number) => {
  const d = Math.abs(a - b);
  return s.closed ? Math.min(d, 1 - d) : d;
};
