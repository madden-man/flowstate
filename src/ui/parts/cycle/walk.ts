// A walk made of drawn pieces, for the open shapes (the valley, the arc, the mountain; F4's curve, stairs and fork can
// use it too). Each piece is a line or a cubic curve in viewBox units with the class it is drawn in ('arc' solid,
// 'arc pass' dotted). The walk is the pieces end to end; at(t) is measured by length along it, so equal steps of t are
// equal steps of the finger and the detents keep their spacing however the curve bends.
import type { Pt } from './shape';

export type Piece = { from: Pt; c1?: Pt; c2?: Pt; to: Pt; cls: string };

const lerp = (a: Pt, b: Pt, u: number): Pt => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
function pointOn(p: Piece, u: number): Pt {
  if (!p.c1 || !p.c2) return lerp(p.from, p.to, u);
  const v = 1 - u;
  return {
    x: v * v * v * p.from.x + 3 * v * v * u * p.c1.x + 3 * v * u * u * p.c2.x + u * u * u * p.to.x,
    y: v * v * v * p.from.y + 3 * v * v * u * p.c1.y + 3 * v * u * u * p.c2.y + u * u * u * p.to.y,
  };
}

export const f = (p: Pt) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
/** A piece as path data on its own. */
export const pieceD = (p: Piece) => (p.c1 && p.c2 ? `M${f(p.from)} C${f(p.c1)} ${f(p.c2)} ${f(p.to)}` : `M${f(p.from)} L${f(p.to)}`);
/** Pieces as one path (each piece continues from the last one's end). */
export const piecesD = (ps: Piece[]) => ps.map((p, i) => (i === 0 ? pieceD(p) : pieceD(p).replace(/^M[^CL]+/, ''))).join(' ');

export type Walk = { pieces: Piece[]; at(t: number): Pt; length: number; tNear(p: Pt): number };

/** The walk along these pieces, sampled finely enough that at(t) is good to well under a pixel. */
export function walkOf(pieces: Piece[], samples = 96): Walk {
  const pts: Pt[] = [];
  pieces.forEach((p, k) => { for (let i = k === 0 ? 0 : 1; i <= samples; i++) pts.push(pointOn(p, i / samples)); });
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const length = cum.at(-1)!;
  const at = (t: number): Pt => {
    const d = Math.max(0, Math.min(1, t)) * length;
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
    const span = cum[hi] - cum[lo];
    return lerp(pts[lo], pts[hi], span ? (d - cum[lo]) / span : 0);
  };
  const tNear = (p: Pt) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < pts.length; i++) { const d = (pts[i].x - p.x) ** 2 + (pts[i].y - p.y) ** 2; if (d < bd) { bd = d; best = i; } }
    return cum[best] / length;
  };
  return { pieces, at, length, tNear };
}

/**
 * Where step i of n sits. The shape is drawn for `slots.length` steps, each at a designed place; a flow with that many
 * steps gets them exactly, any other count is spaced evenly from the first designed place to the last, so every
 * step still lands on the walk in order.
 */
export function slotsT(slots: number[], i: number, n: number): number {
  if (n === slots.length) return slots[i];
  if (n <= 1) return slots[0];
  return slots[0] + ((slots.at(-1)! - slots[0]) * i) / (n - 1);
}
