// The land (PLAN-MOUNTAIN.md pass 5 and pass 6, R1): the horn and everything round it, as path data on the 328 by 476
// box, drawn once. Pure and seeded, so the mountain is the same mountain every time it is drawn; the SVG under the
// plate draws these paths dim (the rock in the dark), and the plate's canvas strokes the same paths again in the
// water's light where the water reaches (./plate.ts), so the lit rock and the dark rock are the same lines.
//
// Every mark carries where it falls in the arrival (at, len: fractions of --t-arrive), in the order a pen would draw
// it (rule 27): the far ranges and the lesser horns first and faint, the horn from the summit down tier by tier, both
// flanks and the near corner, its faces falling in behind, the foot, and last the snow settling on the cap and its
// cornice.
//
// How it is drawn (Tommy, 2026-11-12): geometric and a little in the round. The horn is seven tiers, one a sign (see
// TIER_Y), each a block of flat faces seen from just above its near corner: a lit face, a face in shadow, and its top
// where the tier below steps out. Every face is cut into facets with a tone each, so depth comes from planes, not from
// scratches; every edge is ruled. Each tier carries a breath of its sign's hue (none in Still). What is where: the
// crown's spire with a torn cornice hanging off its lee side; the third eye's ledge out on the lit side; the throat's
// narrows with the fall over its step; the heart's broad shoulder holding the tarn; the solar plexus's buttress on
// the shadow side; the sacral's step holding the pool; the root's foot in the firs. Two lesser horns and two far
// ranges behind, each fainter and lower in contrast the further away it is (the night's own depth, no tint); a black
// treeline over sea cliffs.
// No sun and no moon: nothing here stands for nothing.
import { PEAK, SHORE, W } from '../../parts/cycle/river';
import { CHAKRAS } from '../../../model/mountain';

/** A line in chalk. cls is its look (mountain.css); w its width in box units (the SVG and the canvas's lit copy both
 *  use it); lit how much of the water's light it catches (0 none). */
export type Pen = { kind: 'pen'; d: string; cls: string; w: number; at: number; len: number; lit: number };
/** A filled shape (a mass, a face, a tarn). */
export type Fill = { kind: 'fill'; d: string; cls: string; at: number; len: number; hue?: number };
export type Star = { x: number; y: number; r: number; at: number };
type P = [number, number];

export interface Land {
  /** Every mark, back to front: what is behind is drawn first, so a mass covers what it stands in front of. */
  marks: (Fill | Pen)[];
  stars: Star[];
}

/** The default line where the cap's snow ends, in box units; R2 moves it with the meter (snowCap takes any). */
export const SNOW_Y = 96;

// a seeded wobble
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const f1 = (n: number) => n.toFixed(1);
const line = (pts: readonly (readonly [number, number])[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${f1(p[0])} ${f1(p[1])}`).join(' ');

/** The horn is seven tiers stacked to the summit, one a sign (Tommy, 2026-11-12: "slightly 2.5d and geometric with
 *  parts corresponding to their chakras"). TIER_Y are the lines between them, each a little under its sign, so every
 *  sign stands at the foot of its own tier on the step the next one makes: the crown's spire, the third eye's ledge
 *  out on the lit side, the throat's narrows, the heart's broad shoulder holding the tarn, the solar plexus's buttress
 *  on the shadow side, the sacral's step holding the pool, the root's foot in the firs. Each tier has three faces, as a
 *  block seen from a little above its near corner: a lit face, a face in shadow, and where the tier below steps out,
 *  its top. The corner between the two faces is the arete. */
export const TIER_Y: readonly number[] = [PEAK.y, 90, 122, 162, 232, 282, 326, SHORE];
/** Each tier's flanks, left and right, at its top and at its foot. A mountain, not a staircase: where the two numbers
 *  either side of a line are the same the tier below does not step out on that side, and the big steps are the places
 *  (the third eye's ledge and the heart's shoulder on the left, the solar plexus's buttress on the right). */
const TIER_L: readonly (readonly [number, number])[] = [[PEAK.x, 150], [142, 127], [106, 99], [97, 74], [54, 46], [45, 27], [14, 0]];
const TIER_R: readonly (readonly [number, number])[] = [[PEAK.x, 183], [192, 199], [201, 213], [224, 236], [240, 259], [284, 291], [293, 326]];
/** No line is level: how far above or below its line each step meets the left flank and the right. */
const TILT_L: readonly number[] = [0, -7, 4, -9, 3, -8, 5, 0];
const TILT_R: readonly number[] = [0, 5, -6, 6, -8, 4, -7, 0];
/** Each tier's flank breaks once on its way down: how far down (0 to 1) and how far out (+) or in (-). */
const KINK_L: readonly (readonly [number, number])[] = [[0.5, -2], [0.45, 4], [0.55, -4], [0.4, 7], [0.5, -4], [0.6, 6], [0.4, -5]];
const KINK_R: readonly (readonly [number, number])[] = [[0.55, 3], [0.5, -3], [0.4, 5], [0.6, -5], [0.45, 6], [0.5, -4], [0.6, 7]];
/** The arete's x at each line. */
const ARETE_X: readonly number[] = [PEAK.x, 172, 174, 183, 189, 200, 203, 214];
/** The near corner hangs this far below a line (the tier is seen from above), and each step's lip hangs this much lower
 *  again at the corner: how deep the step is. The heart's and the sacral's are deepest: they hold water. */
const DROP = 4;
const DEPTH: readonly number[] = [5, 6, 5, 11, 7, 10];
/** The lip of a step sits this far under the tier's foot at the flank. */
const LIP = 2;

/** A flank as points, three a tier: its top, its break, its foot. */
function flankOf(side: 1 | -1): P[] {
  const X = side === 1 ? TIER_R : TIER_L, T = side === 1 ? TILT_R : TILT_L, K = side === 1 ? KINK_R : KINK_L, pts: P[] = [];
  for (let i = 0; i < 7; i++) {
    const y0 = TIER_Y[i] + T[i] + (i ? LIP : 0), y1 = TIER_Y[i + 1] + T[i + 1], [f, out] = K[i];
    pts.push([X[i][0], y0], [X[i][0] + (X[i][1] - X[i][0]) * f + side * out, y0 + (y1 - y0) * f], [X[i][1], y1]);
  }
  return pts;
}
const FLANK_L = flankOf(-1), FLANK_R = flankOf(1);

const tierAt = (y: number) => { let i = 0; while (i < 6 && y >= TIER_Y[i + 1]) i++; return i; };

/** The flank's x at a height: ruled from point to point. */
export const edge = (side: 1 | -1, y: number) => {
  const pts = side === 1 ? FLANK_R : FLANK_L;
  if (y <= PEAK.y) return PEAK.x;
  let k = 1;
  while (k < pts.length - 1 && pts[k][1] < y) k++;
  const [ax, ay] = pts[k - 1], [bx, by] = pts[k];
  return ax + (bx - ax) * Math.max(0, Math.min(1, (y - ay) / (by - ay || 1)));
};

/** Half the horn's width at a height, on its wider side. */
export const half = (y: number) => (y <= PEAK.y ? 3 : Math.max(PEAK.x - edge(-1, y), edge(1, y) - PEAK.x) + 3);

/** The arete's x at a height: the near corner, falling from the summit a little to the right. */
export const arete = (y: number) => {
  if (y <= PEAK.y) return PEAK.x;
  const i = tierAt(y), t = Math.max(0, Math.min(1, (y - TIER_Y[i]) / (TIER_Y[i + 1] - TIER_Y[i])));
  return ARETE_X[i] + (ARETE_X[i + 1] - ARETE_X[i]) * t;
};

const STEP = 4;

/** Breaks a line by subdivision: each segment's midpoint pushed off the line, so no edge is ruled. */
function crag(pts: P[], times: number, rough: number): P[] {
  let cur = pts;
  for (let t = 0; t < times; t++) {
    const next: P[] = [cur[0]];
    for (let i = 1; i < cur.length; i++) {
      const [ax, ay] = cur[i - 1], [bx, by] = cur[i], len = Math.hypot(bx - ax, by - ay) || 1;
      const off = (rnd() - 0.5) * rough * len;
      next.push([(ax + bx) / 2 - ((by - ay) / len) * off, (ay + by) / 2 + ((bx - ax) / len) * off], cur[i]);
    }
    cur = next;
    rough *= 0.72;
  }
  return cur;
}

/** A fir: a spire of three tiers, its base at y. */
function fir(x: number, y: number, h: number, w: number): string {
  const p: P[] = [
    [x - w * 0.5, y], [x - w * 0.22, y - h * 0.3], [x - w * 0.42, y - h * 0.3], [x - w * 0.16, y - h * 0.58],
    [x - w * 0.3, y - h * 0.58], [x, y - h], [x + w * 0.3, y - h * 0.58], [x + w * 0.16, y - h * 0.58],
    [x + w * 0.42, y - h * 0.3], [x + w * 0.22, y - h * 0.3], [x + w * 0.5, y],
  ];
  return `${line(p)} Z `;
}

/** The cap's snow down to line y: the lit side (flank to arete) and the side in shadow (arete to flank), each with a
 *  torn foot and fingers reaching down the gullies. The foot is the same rock at every line (the fingers lie where the
 *  gullies are, whatever the weather), so the snow coming down the meter reads as one snow growing, not a new shape at
 *  every step. Pure. */
export function snowCap(y: number): { lit: string; shade: string; rim: string } {
  const { lit, shade, rim } = snowFoot(y);
  return { lit: `${line(lit)} Z`, shade: `${line(shade)} Z`, rim: `${line(rim[0])} ${line(rim[1])}` };
}

/** The gullies the snow's foot reaches down (x in box units, width, reach), for snowFoot and the plate's drifts. */
export const GULLIES: readonly (readonly [number, number, number])[] = [[118, 10, 12], [139, 7, 7], [151, 9, 16], [176, 7, 6], [196, 12, 14], [214, 8, 9], [231, 7, 6], [104, 7, 5]];

/** The cap's outline as points: the lit side and the shadow side (each closed), and the two runs of its foot. */
export function snowFoot(y: number): { lit: P[]; shade: P[]; rim: [P[], P[]] } {
  const lo = Math.max(PEAK.y + 6, y);
  // the fingers: where the gullies run down the horn (x in box units), each its own width and reach
  const FINGERS = GULLIES;
  // how far the fingers reach grows with the line (a small cap holds no long fingers)
  const reach = Math.min(1, (lo - PEAK.y) / 90);
  const foot = (x0: number, x1: number) => {
    const n = Math.max(3, Math.round((x1 - x0) / 2.5)), pts: P[] = [];
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n;
      let dy = 2.2 * Math.sin(x * 0.31) + 1.4 * Math.sin(x * 0.83 + 1.3) + 0.8 * Math.sin(x * 1.9 + 0.4);
      for (const [fx, fw, fl] of FINGERS) dy += fl * reach * Math.exp(-(((x - fx) / fw) ** 2));
      pts.push([x, lo + dy]);
    }
    return pts;
  };
  const left: P[] = [], right: P[] = [], ridge: P[] = [];
  for (let yy = PEAK.y; yy <= lo; yy += STEP) { left.push([edge(-1, yy), yy]); right.push([edge(1, yy), yy]); ridge.push([arete(yy), yy]); }
  const a = foot(edge(-1, lo), arete(lo)), b = foot(arete(lo), edge(1, lo));
  return { lit: [...left, ...a, ...ridge.slice().reverse()], shade: [...ridge, ...b, ...right.slice().reverse()], rim: [a, b] };
}

export function land(): Land {
  seed = 7;
  const marks: (Fill | Pen)[] = [], stars: Star[] = [];
  const pen = (d: string, cls: string, w: number, at: number, len: number, lit: number) => marks.push({ kind: 'pen', d, cls, w, at, len, lit });
  const fill = (d: string, cls: string, at: number, len: number) => marks.push({ kind: 'fill', d, cls, at, len });

  /** A line inked with pressure: a run of short strokes along pts, each its own weight between w0 and w1, broken now
   *  and then and gone over again a hair off, drawn one after another over [at, at + len]. */
  const inked = (pts: P[], cls: string, w0: number, w1: number, at: number, len: number, lit: number) => {
    const runs: P[][] = [];
    for (let i = 0; i < pts.length - 1;) {
      const n = 3 + Math.floor(rnd() * 4);
      // a break: the pen lifts for a step
      const from = rnd() < 0.14 && i > 0 ? i + 1 : i;
      runs.push(pts.slice(from, Math.min(pts.length, i + n + 1)));
      i += n;
    }
    runs.forEach((run, k) => {
      if (run.length < 2) return;
      const press = 0.5 + 0.5 * Math.sin(k * 1.1 + rnd() * 2);
      const w = w0 + (w1 - w0) * press, a = at + (len * k) / runs.length, l = Math.max(0.02, (len / runs.length) * 1.6);
      pen(line(run), cls, w, a, l, lit);
      // inked over again, finer and a little off
      if (rnd() < 0.38) {
        const dx = (rnd() - 0.5) * 1.4, dy = (rnd() - 0.5) * 1.4;
        pen(line(run.map(([x, y]) => [x + dx, y + dy] as P)), cls, w * 0.45, a + l * 0.4, l, lit * 0.7);
      }
    });
  };

  // the stars, few and faint, only in the sky
  for (let k = 0; stars.length < 22 && k < 200; k++) {
    const x = 8 + rnd() * (W - 16), y = 6 + rnd() * 120, r = 0.45 + rnd() * 0.75;
    if (Math.abs(x - PEAK.x) < half(y) + 10 || (y > 100 && (x < 140 || x > 196))) continue;
    stars.push({ x, y, r, at: rnd() * 0.12 });
  }

  // the furthest range: one low broken line across the whole width, barely darker than the sky at the horizon
  const farthest = crag([[0, 268], [40, 246], [86, 262], [128, 236], [200, 240], [250, 228], [296, 252], [328, 240]], 1, 0.3);
  fill(`${line(farthest)} L328 398 L0 398 Z`, 'far-far', 0.16, 0.12);
  pen(line(farthest), 'ridge-far', 0.5, 0.16, 0.14, 0);
  // the far ranges, sawtoothed and broken, drawn out from their highest points
  const farL = crag([[0, 252], [12, 230], [22, 238], [40, 198], [50, 212], [62, 176], [74, 202], [82, 190], [98, 224], [110, 236]], 1, 0.25);
  const farR = crag([[222, 226], [234, 204], [246, 186], [254, 198], [270, 158], [280, 182], [292, 170], [306, 204], [316, 194], [328, 214]], 1, 0.25);
  fill(`${line(farL)} L110 398 L0 398 Z`, 'far', 0.2, 0.16);
  fill(`${line(farR)} L328 398 L222 398 Z`, 'far', 0.2, 0.16);
  const topL = farL.reduce((b, p, i) => (p[1] < farL[b][1] ? i : b), 0), topR = farR.reduce((b, p, i) => (p[1] < farR[b][1] ? i : b), 0);
  pen(`${line(farL.slice(0, topL + 1).reverse())} ${line(farL.slice(topL))}`, 'ridge', 0.6, 0.2, 0.14, 0.1);
  pen(`${line(farR.slice(0, topR + 1).reverse())} ${line(farR.slice(topR))}`, 'ridge', 0.6, 0.2, 0.14, 0.1);

  // two lesser horns shouldering in behind the peak: craggy, nearer than the ranges and further than the horn, each
  // with its side in shadow (from the summit down to a line wandering back to its foot)
  const horns: { pts: P[]; base: number }[] = [
    { pts: [[0, 398], [0, 344], [20, 300], [30, 312], [52, 250], [60, 262], [82, 196], [90, 210], [104, 148], [111, 166], [117, 158], [126, 196], [132, 260], [120, 344], [120, 398]], base: 98 },
    { pts: [[200, 398], [198, 190], [206, 172], [214, 136], [221, 150], [232, 116], [240, 142], [246, 134], [262, 184], [272, 174], [292, 236], [300, 226], [328, 290], [328, 398]], base: 258 },
  ];
  for (const h of horns) {
    const pts = crag(h.pts, 1, 0.2);
    const top = pts.reduce((b, p, i) => (p[1] < pts[b][1] ? i : b), 0);
    const [tx, ty] = pts[top];
    fill(`${line(pts)} Z`, 'horn', 0.14, 0.16);
    const inner = crag([[h.base, 398], [h.base + (tx - h.base) * 0.4 + 4, ty + (398 - ty) * 0.5], [tx, ty]], 1, 0.3);
    fill(`${line([...pts.slice(top, pts.length - 1), ...inner])} Z`, 'horn-deep', 0.18, 0.16);
    const up = pts.slice(1, top + 1).reverse(), down = pts.slice(top, pts.length - 1);
    pen(`${line(up)} ${line(down)}`, 'horn-line', 1.1, 0.12, 0.2, 0.4);
    // a few long falls of rock down its lit side, uneven, not ruled
    let falls = '';
    for (let k = 0; k < 5; k++) {
      const i = 1 + Math.floor(rnd() * (top - 1)), [x, y] = pts[i];
      let d = `M${f1(x + 2)} ${f1(y + 3)}`, xx = x + 2, yy = y + 3;
      const n = 3 + Math.floor(rnd() * 5);
      for (let j = 0; j < n; j++) { xx += (rnd() - 0.6) * 3; yy += 5 + rnd() * 6; d += ` L${f1(xx)} ${f1(yy)}`; }
      falls += `${d} `;
    }
    pen(falls, 'horn-fall', 0.5, 0.2, 0.14, 0.2);
  }

  // the horn: seven tiers from the summit down, each a block of flat faces
  const lf = FLANK_L, rt = FLANK_R;
  // the near corner: where each tier's foot meets it, and where the lip of the step below does
  const footC = (i: number): P => [ARETE_X[i + 1], TIER_Y[i + 1] + (i < 6 ? DROP : 0)];
  const lipC = (i: number): P => (i ? [ARETE_X[i] + 1.5, TIER_Y[i] + DROP + DEPTH[i - 1]] : [PEAK.x, PEAK.y]);
  const ridge: P[] = [];
  for (let i = 0; i < 7; i++) ridge.push(lipC(i), footC(i));
  fill(`${line(lf)} ${line(rt.slice().reverse()).replace('M', 'L')} Z`, 'face', 0.08, 0.3);
  fill(`${line(ridge)} ${line(rt.slice().reverse()).replace('M', 'L')} Z`, 'deep', 0.14, 0.26);

  // the faces: each cut into flat facets round a point of its own, every facet a tone of its own, so the rock has
  // planes instead of scratches; each tier carries a breath of its sign's hue
  const tier = (d: string, cls: string, i: number, at: number) => marks.push({ kind: 'fill', d, cls, at, len: 0.1, hue: CHAKRAS[i].hue });
  const mid = (a: P, b: P, u: number): P => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  let creases = '', hatch = '';
  /** One face as facets fanned round a point inside it. top and foot are its upper and lower edges (flank end first),
   *  brk the flank's break; a wide face gets a point more on each edge, so its facets stay near one size. */
  const facets = (top: [P, P], foot: [P, P], brk: P, tones: readonly string[], i: number, at: number) => {
    const wide = Math.abs(foot[1][0] - foot[0][0]) > 60, u = 0.4 + rnd() * 0.2;
    const ring: P[] = [top[0]];
    if (wide && i) ring.push(mid(top[0], top[1], u));
    ring.push(top[1], foot[1]);
    if (wide) ring.push(mid(foot[1], foot[0], 1 - u + (rnd() - 0.5) * 0.16));
    ring.push(foot[0], brk);
    const m = mid(mid(top[0], top[1], 0.36 + rnd() * 0.28), mid(foot[0], foot[1], 0.36 + rnd() * 0.28), 0.38 + rnd() * 0.26);
    const turn = Math.floor(rnd() * tones.length);
    ring.forEach((a, k) => {
      const b = ring[(k + 1) % ring.length];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.5) return;
      tier(`${line([a, b, m])} Z`, tones[(k + turn) % tones.length], i, at);
      creases += `M${f1(a[0])} ${f1(a[1])} L${f1(m[0])} ${f1(m[1])} `;
    });
  };
  const LIT = ['lit-a', 'lit-c', 'lit-b', 'lit-d', 'lit-b'], SHADE = ['shade-b', 'shade-a', 'shade-c', 'shade-a'];
  let lips = '', steps = '';
  for (let i = 0; i < 7; i++) {
    const at = 0.2 + i * 0.03, k = i * 3;
    const tc = lipC(i), bc = footC(i);
    facets([lf[k], tc], [lf[k + 2], bc], lf[k + 1], LIT, i, at);
    facets([rt[k], tc], [rt[k + 2], bc], rt[k + 1], SHADE, i, at);
    // the shadow face ruled, parallel to its far edge, closer toward the corner
    for (let n = 1; n <= 3; n++) {
      const u = Math.pow(n / 4, 1.4) * 0.9, a = mid(mid(rt[k], tc, u), mid(rt[k + 2], bc, u), 0.14), b = mid(mid(rt[k], tc, u), mid(rt[k + 2], bc, u), 0.86);
      hatch += `M${f1(a[0])} ${f1(a[1])} L${f1(b[0])} ${f1(b[1])} `;
    }
    if (i === 6) break;
    // the step the next tier makes: its top, seen from above, a chevron with its point at the near corner
    const nl = lf[k + 3], nr = rt[k + 3], nc = lipC(i + 1);
    tier(`${line([lf[k + 2], bc, nc, nl])} Z`, 'top-lit', i, at + 0.02);
    tier(`${line([bc, rt[k + 2], nr, nc])} Z`, 'top-shade', i, at + 0.02);
    lips += `${line([nl, nc, nr])} `;
    steps += `${line([lf[k + 2], bc, rt[k + 2]])} `;
  }
  pen(hatch, 'hatch', 0.5, 0.26, 0.2, 0.45);
  pen(creases, 'crease', 0.4, 0.28, 0.16, 0.35);
  pen(steps, 'crack', 0.7, 0.3, 0.14, 0.5);
  pen(lips, 'thin', 1, 0.3, 0.14, 0.9);
  // where the cap's snow goes: over the rock's faces, under the chalk of the flanks (snowCap draws it; R2 moves it)
  fill('', 'snow-slot', 0.4, 0.1);

  // the places the stops sit in: the fall over the step under the throat, the tarn on the heart's step, the pool on
  // the sacral's, each a flat six-sided water lying on its step
  pen('M174 162 v13 M178 161 v17 M182 161 v15 M186 163 v11', 'chip', 0.8, 0.32, 0.06, 0.9);
  const water = (x: number, y: number, w: number, h: number) => `M${f1(x - w)} ${f1(y)} L${f1(x - w * 0.55)} ${f1(y - h)} L${f1(x + w * 0.5)} ${f1(y - h * 0.8)} L${f1(x + w)} ${f1(y + h * 0.2)} L${f1(x + w * 0.5)} ${f1(y + h)} L${f1(x - w * 0.5)} ${f1(y + h * 0.9)} Z`;
  for (const [x, y, w, h] of [[113, 236.5, 23, 3.4], [148, 331, 16, 3]] as const) {
    fill(water(x, y, w, h), 'tarn', 0.3, 0.1);
    pen(water(x, y, w, h), 'thin', 0.9, 0.3, 0.08, 1);
  }

  // the flanks and the near corner in chalk, ruled: the shadow side heaviest, each tier a stroke, from the summit down
  for (let i = 0; i < 7; i++) {
    const at = 0.02 + i * 0.045, k = i * 3;
    pen(line(lf.slice(k, k + 4)), 'rock', 1.2 + i * 0.12, at, 0.08, 1);
    pen(line(rt.slice(k, k + 4)), 'bold', 2 + i * 0.16, at, 0.08, 0.9);
    pen(line([lipC(i), footC(i)]), 'arete', 1 + i * 0.1, at + 0.03, 0.08, 1);
  }

  // the cornice: the summit's snow blown out over the lee side and torn off underneath, with ice hanging from the tear
  const lip: P[] = [[PEAK.x, PEAK.y], [167.5, 43.6], [171, 44.6], [174, 45.2], [176.6, 47], [178.2, 49.2], [177.6, 51]];
  const tear: P[] = [[176.2, 51.6], [174.8, 50.9], [173.6, 52.7], [172, 52.1], [170.6, 54.4], [169.2, 53.8], [168, 56]];
  fill(`${line([...lip, ...tear])} L${f1(edge(1, 58))} 58 Z`, 'cornice', 0.42, 0.08);
  pen(line(lip), 'thin', 0.9, 0.42, 0.06, 1);
  let ice = '';
  for (const [x, y] of tear) ice += `M${f1(x)} ${f1(y + 0.4)} v${f1(1.2 + rnd() * 2.6)} `;
  pen(`${line(tear)} ${ice}`, 'chip', 0.5, 0.44, 0.06, 0.8);

  // the foot: a black treeline either side of the river, two ranks deep, a clump of firs round the root, and scree
  let back = '', front = '', clump = '';
  for (let x = 2; x < W - 2; x += 4.4) {
    if (x > 132 && x < 196) continue;
    back += fir(x + 1.5, SHORE - 7, 8 + rnd() * 7, 5 + rnd() * 2);
  }
  for (let x = 3; x < W - 2; x += 3.6 + rnd() * 1.4) {
    if (x > 140 && x < 188) continue;
    front += fir(x, SHORE + 2, 11 + rnd() * 9, 5.5 + rnd() * 2.5);
  }
  for (const [x0, x1, base] of [[170, 190, 377], [208, 238, 380], [150, 166, 384]] as const) {
    for (let x = x0; x < x1; x += 4 + rnd() * 2) clump += fir(x, base + rnd() * 4, 9 + rnd() * 8, 5 + rnd() * 2);
  }
  fill(back, 'trees-back', 0.32, 0.12);
  fill(clump, 'trees', 0.34, 0.12);
  fill(front, 'trees', 0.34, 0.12);
  pen(clump, 'tree', 0.5, 0.34, 0.12, 0.35);
  pen(front, 'tree', 0.5, 0.34, 0.12, 0.2);
  pen('M136 392 q5 -9 12 -2 q6 -4 8 4 M178 394 q4 -8 10 -3 q5 -1 6 5 M146 384 q3 -5 7 -1 M176 386 q3 -5 7 -1 M156 396 q2 -4 5 -1 M168 397 q2 -3 5 0', 'thin', 0.9, 0.36, 0.08, 0.9);

  // the sea cliffs either side of the mouth, the rock dropping into the water
  const cliffL = crag([[0, SHORE + 2], [30, SHORE - 1], [58, SHORE + 3], [96, SHORE], [140, SHORE + 2]], 2, 0.3);
  const cliffR = crag([[188, SHORE + 2], [232, SHORE + 3], [270, SHORE - 1], [300, SHORE + 3], [328, SHORE + 1]], 2, 0.3);
  const foot = (pts: P[]) => pts.map(([x, y]) => [x, y + 9 + rnd() * 5] as P).reverse();
  fill(`${line([...cliffL, ...foot(cliffL)])} Z`, 'cliff', 0.36, 0.1);
  fill(`${line([...cliffR, ...foot(cliffR)])} Z`, 'cliff', 0.36, 0.1);
  inked([...cliffL.slice().reverse()], 'rock', 0.9, 2, 0.36, 0.06, 0.7);
  inked(cliffR, 'rock', 0.9, 2, 0.36, 0.06, 0.7);
  let drop = '';
  for (let x = 3; x < W - 2; x += 4 + rnd() * 6) { if (x > 138 && x < 190) continue; drop += `M${f1(x)} ${SHORE + 4} v${f1(3 + rnd() * 8)} `; }
  pen(drop, 'hatch', 0.6, 0.38, 0.08, 0.4);

  return { marks, stars };
}
