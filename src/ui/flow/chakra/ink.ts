// The pen for the seven places (R3, the art round): pure geometry that turns a few authored lines into ink with weight.
// Everything here returns SVG path data in the plate's box (scenes.ts W by H); nothing touches the DOM or a colour.
//
//   crag      breaks a straight edge into rock: midpoint displacement, angular, bigger where the edge is longer
//   taper     a stroke as a filled shape whose width follows a pen's pressure: thin in, full, thin out, and never even
//   inked     a heavy edge drawn as a pen would draw it: one full tapered pass, a dry second pass beside it, and breaks
//   hatch     close strokes across a region (the region clips them, ./Plate.tsx), broken and leaning, for tone
//   scree     short ticks and dots in a band, for broken rock and stones
//
// A seeded random (rng) makes every place draw the same way each time it opens.

export type P = readonly [number, number];
export type R = () => number;

/** A small, fast seeded random in [0, 1). */
export function rng(seed: number): R {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f1 = (x: number) => x.toFixed(1);
const pt = (p: P) => `${f1(p[0])} ${f1(p[1])}`;

/** A polyline as path data. */
export const line = (pts: readonly P[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${pt(p)}`).join(' ');
/** A closed shape as path data. */
export const shape = (pts: readonly P[]) => `${line(pts)} Z`;

/** The points at an even spacing along a polyline. */
export function resample(pts: readonly P[], step: number): P[] {
  const out: P[] = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    let d = step - carry;
    while (d <= len) {
      const t = d / len;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
      d += step;
    }
    carry = len - (d - step);
  }
  const last = pts[pts.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > step * 0.3) out.push(last);
  return out;
}

/** An edge broken into rock: each segment's middle pushed off the line by up to rough times its length, levels deep.
 *  Angular on purpose: rock breaks, it does not curve. */
export function crag(pts: readonly P[], rough: number, levels: number, r: R): P[] {
  let cur: P[] = [...pts];
  let k = rough;
  for (let l = 0; l < levels; l++) {
    const next: P[] = [cur[0]];
    for (let i = 1; i < cur.length; i++) {
      const [ax, ay] = cur[i - 1], [bx, by] = cur[i];
      const len = Math.hypot(bx - ax, by - ay);
      if (len > 3) {
        const nx = -(by - ay) / len, ny = (bx - ax) / len;
        const s = (r() - 0.5) * 2 * k * len, along = 0.35 + r() * 0.3;
        next.push([ax + (bx - ax) * along + nx * s, ay + (by - ay) * along + ny * s]);
      }
      next.push(cur[i]);
    }
    cur = next;
    k *= 0.62;
  }
  return cur;
}

/** A smooth curve through points (Catmull-Rom), as points, for water, snow and soft ground. */
export function smooth(pts: readonly P[], per = 6): P[] {
  const out: P[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export type Pen = {
  /** The share of the stroke over which the pen comes down, and lifts. */
  in?: number;
  out?: number;
  /** How uneven the pressure is, 0 even to 1 very. */
  grain?: number;
  /** The thinnest the line gets, as a share of w. */
  floor?: number;
};

const ramp = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/** A stroke as a filled shape: w wide at full pressure, thin where the pen comes down and lifts, and uneven along it. */
export function taper(pts: readonly P[], w: number, r: R, pen: Pen = {}): string {
  const q = resample(pts, 2.2);
  if (q.length < 2) return '';
  const a = pen.in ?? 0.18, b = pen.out ?? 0.3, grain = pen.grain ?? 0.45, floor = pen.floor ?? 0.1;
  const ph1 = r() * 6.3, ph2 = r() * 6.3, fr1 = 0.08 + r() * 0.1, fr2 = 0.27 + r() * 0.2;
  const n = q.length, left: P[] = [], right: P[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const [px, py] = q[Math.max(0, i - 1)], [nx, ny] = q[Math.min(n - 1, i + 1)];
    const len = Math.hypot(nx - px, ny - py) || 1;
    const ox = -(ny - py) / len, oy = (nx - px) / len;
    const press = ramp(t / Math.max(0.01, a)) * ramp((1 - t) / Math.max(0.01, b));
    const wob = 1 + grain * (0.6 * Math.sin(i * fr1 + ph1) + 0.4 * Math.sin(i * fr2 + ph2));
    const hw = (w * (floor + (1 - floor) * press) * Math.max(0.25, wob)) / 2;
    left.push([q[i][0] + ox * hw, q[i][1] + oy * hw]);
    right.push([q[i][0] - ox * hw, q[i][1] - oy * hw]);
  }
  return `${line(left)} L${right.reverse().map(pt).join(' L')} Z`;
}

/** A heavy edge as a pen draws it: the full tapered pass; a dry pass beside it, thinner and broken; and the line lifted
 *  here and there so it is never one mechanical outline. Returns [the full pass, the dry pass]. */
export function inked(pts: readonly P[], w: number, r: R, pen: Pen = {}): [string, string] {
  const q = resample(pts, 2.2);
  // the full pass, lifted once or twice on a long edge
  const full: string[] = [];
  const lifts = q.length > 60 ? 1 + Math.floor(r() * 2) : 0;
  const cuts = Array.from({ length: lifts }, () => Math.floor(q.length * (0.25 + r() * 0.5))).sort((x, y) => x - y);
  let from = 0;
  for (const c of [...cuts, q.length]) {
    const seg = q.slice(Math.max(0, from - 2), c);
    if (seg.length > 2) full.push(taper(seg, w, r, { in: 0.12, out: 0.22, ...pen }));
    from = c + 1 + Math.floor(r() * 2);
  }
  // the dry pass: a little off the line, in pieces
  const dry: string[] = [];
  const off = w * (0.6 + r() * 0.5) * (r() < 0.5 ? -1 : 1);
  let i = Math.floor(r() * 10);
  while (i < q.length - 6) {
    const len = 8 + Math.floor(r() * 26);
    const seg = q.slice(i, Math.min(q.length, i + len)).map((p, k, all) => {
      const [ax, ay] = all[Math.max(0, k - 1)], [bx, by] = all[Math.min(all.length - 1, k + 1)];
      const l = Math.hypot(bx - ax, by - ay) || 1;
      return [p[0] - ((by - ay) / l) * off, p[1] + ((bx - ax) / l) * off] as P;
    });
    if (seg.length > 3) dry.push(taper(seg, w * 0.42, r, { in: 0.3, out: 0.4, grain: 0.7 }));
    i += len + 4 + Math.floor(r() * 16);
  }
  return [full.join(' '), dry.join(' ')];
}

export type Hatch = {
  /** The box to fill: [x0, y0, x1, y1]; the region's clip does the rest. */
  box: readonly [number, number, number, number];
  /** The strokes' lean, in degrees from vertical (positive leans right at the foot). */
  angle: number;
  /** The gap between strokes in a patch at the start of the box (x0 side), and at its end: tone that falls off. */
  gap: number;
  gapEnd?: number;
  /** How long a stroke is, shortest and longest. */
  run?: [number, number];
  /** How much each patch turns from the lean, in degrees. */
  wander?: number;
  /** How full the box is, 0 to 1: the share of patches laid; and at the box's far end (fillEnd), along `along`. */
  fill?: number;
  fillEnd?: number;
  along?: 'x' | 'y';
};

/** Hatching as an engraver lays it on rock: the box is broken into facets (a jittered grid, about one stroke long), and
 *  each facet is a small plane with its own lean (the box's lean turned by one of a few angles) and its own darkness,
 *  filled with parallel strokes that overlap the next facet a little. So the tone breaks into planes, as rock does,
 *  never one ruled field and never fur. Path data of many subpaths. */
export function hatch(h: Hatch, r: R): string {
  const [x0, y0, x1, y1] = h.box;
  const [rmin, rmax] = h.run ?? [8, 18];
  const turn = h.wander ?? 22;
  const fill = h.fill ?? 0.9;
  const out: string[] = [];
  const cell = (rmin + rmax) * 0.62;
  const TURNS = [0, 0, -1, 1, 0.5];
  for (let y = y0 - cell * 0.4; y < y1 + cell * 0.4; y += cell * 0.78) {
    for (let x = x0 - cell * 0.4; x < x1 + cell * 0.4; x += cell * 0.82) {
      const t = Math.max(0, Math.min(1, (x - x0) / Math.max(1, x1 - x0)));
      const ty = Math.max(0, Math.min(1, (y - y0) / Math.max(1, y1 - y0)));
      const f = fill + ((h.fillEnd ?? fill) - fill) * (h.along === 'y' ? ty : t);
      if (r() > f) continue;
      const gap = (h.gap + ((h.gapEnd ?? h.gap) - h.gap) * t) * (0.8 + r() * 0.7);
      const cx = x + (r() - 0.5) * cell * 0.5, cy = y + (r() - 0.5) * cell * 0.5;
      const a = ((h.angle + TURNS[Math.floor(r() * TURNS.length)] * turn + (r() - 0.5) * 6) * Math.PI) / 180;
      const dx = Math.sin(a), dy = Math.cos(a), px = dy, py = -dx;
      const half = cell * (0.45 + r() * 0.2);
      const n = Math.max(2, Math.round((half * 2) / gap));
      const len = rmin + r() * (rmax - rmin);
      for (let k = 0; k < n; k++) {
        if (r() < 0.12) continue;
        const o = -half + (k + 0.5) * ((half * 2) / n);
        // the strokes of a facet start along a ragged line and run about the same length, a little uneven
        const l = len * (0.7 + r() * 0.45), s0 = (r() - 0.5) * len * 0.3;
        const sx = cx + px * o + dx * (s0 - l / 2), sy = cy + py * o + dy * (s0 - l / 2);
        out.push(`M${f1(sx)} ${f1(sy)} l${f1(dx * l + (r() - 0.5) * 0.6)} ${f1(dy * l)}`);
      }
    }
  }
  return out.join(' ');
}

/** Short ticks and specks in a band under a line: broken rock, stones, scree. */
export function scree(along: readonly P[], depth: number, n: number, r: R, size = 2.4): string {
  const q = resample(along, 1.5);
  const out: string[] = [];
  for (let k = 0; k < n; k++) {
    const p = q[Math.floor(r() * q.length)];
    const y = p[1] + 1 + r() * depth * r(), x = p[0] + (r() - 0.5) * 4;
    const s = size * (0.4 + r() * 0.8);
    out.push(r() < 0.6
      ? `M${f1(x)} ${f1(y)} l${f1(s)} ${f1(-s * 0.35)} l${f1(s * 0.4)} ${f1(s * 0.5)}`
      : `M${f1(x)} ${f1(y)} h${f1(s * 0.6)}`);
  }
  return out.join(' ');
}

/** A point at t along a polyline (0 to 1). */
export function along(pts: readonly P[], t: number): P {
  const q = resample(pts, 1);
  return q[Math.max(0, Math.min(q.length - 1, Math.round(t * (q.length - 1))))];
}

/** Moves every point of a line by dx, dy. */
export const shift = (pts: readonly P[], dx: number, dy: number): P[] => pts.map(([x, y]) => [x + dx, y + dy]);
