// A drawn arrow between two boxes (DESIGN.md rules 7 and 10): an SVG path with a drawn arrowhead, never
// an icon. Rendered inside an <svg> the caller owns, in the caller's coordinates.

export type Rect = { x: number; y: number; w: number; h: number };
type Pt = [number, number];

const HEAD = 6;      // the arrowhead's stroke length, px
const SPREAD = 0.45; // its half angle, radians

/** The shaft and head of an arrow from one box to the next, curving slightly as a pen would. */
export function arrowPath(from: Rect, to: Rect): string {
  const fc: Pt = [from.x + from.w / 2, from.y + from.h / 2];
  const tc: Pt = [to.x + to.w / 2, to.y + to.h / 2];
  const sideways = Math.abs(tc[0] - fc[0]) > (from.w + to.w) / 2; // across the seam
  let a: Pt, b: Pt;
  if (sideways) {
    const right = tc[0] > fc[0];
    a = [right ? from.x + from.w + 3 : from.x - 3, fc[1]];
    b = [right ? to.x - 4 : to.x + to.w + 4, tc[1]];
  } else {
    const down = tc[1] >= fc[1];
    a = [fc[0], down ? from.y + from.h + 2 : from.y - 2];
    b = [tc[0], down ? to.y - 4 : to.y + to.h + 4];
  }
  // one control point, pushed off the straight line so the stroke bows like a hand-drawn one
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const bow = Math.min(14, len * 0.18);
  const c: Pt = [mx - (dy / len) * bow, my + (dx / len) * bow];
  const angle = Math.atan2(b[1] - c[1], b[0] - c[0]);
  const h1: Pt = [b[0] - HEAD * Math.cos(angle - SPREAD), b[1] - HEAD * Math.sin(angle - SPREAD)];
  const h2: Pt = [b[0] - HEAD * Math.cos(angle + SPREAD), b[1] - HEAD * Math.sin(angle + SPREAD)];
  const f = (p: Pt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  return `M${f(a)} Q${f(c)} ${f(b)} M${f(h1)} L${f(b)} L${f(h2)}`;
}

/** A dotted link across the seam between a goal and its balance (or its open slot). */
export function linkPath(left: Rect, right: Rect): string {
  const a: Pt = [left.x + left.w + 4, left.y + Math.min(left.h / 2, 14)];
  const b: Pt = [right.x - 4, right.y + Math.min(right.h / 2, 14)];
  const k = Math.max(12, (b[0] - a[0]) * 0.45);
  return `M${a[0].toFixed(1)} ${a[1].toFixed(1)} C${(a[0] + k).toFixed(1)} ${a[1].toFixed(1)} ${(b[0] - k).toFixed(1)} ${b[1].toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
}

export function Arrow({ from, to, id }: { from: Rect; to: Rect; id?: string }) {
  return <path class="fs-arrow" d={arrowPath(from, to)} data-arrow={id} />;
}
