// The land (PLAN-MOUNTAIN.md pass 5 and pass 6, R1): the horn and everything round it, as path data on the 328 by 476
// box, drawn once. Pure and seeded, so the mountain is the same mountain every time it is drawn; the SVG under the
// plate draws these paths dim (the rock in the dark), and the plate's canvas strokes the same paths again in the
// water's light where the water reaches (./plate.ts), so the lit rock and the dark rock are the same lines.
//
// Every mark carries where it falls in the arrival (at, len: fractions of --t-arrive), in the order a pen would draw
// it (rule 27): the far ranges and the lesser horns first and faint, the horn from the summit down both flanks at once
// in strokes of their own, the arete after them, then the hatching falling in behind, the buttresses, gullies and
// scree of the lower face, the foot, and last the snow settling on the cap and its cornice.
//
// How it is drawn: the line has pressure. A flank is not one ruled stroke but a run of strokes, each a little heavier
// or lighter than the last, broken here and there and inked over again a hair off, as a hand does going down a page.
// The ridgelines are broken by subdivision, so no edge is straight. What is where: a horn steepening to the summit with
// a torn cornice hanging off its lee side (downwind, where the spindrift goes); crags broken out of both flanks; a
// ledge out on the lit side under the third eye; a shoulder holding the heart's tarn; an arete splitting the lit face
// from the shadow face (the darkest thing on the screen: its hatching is faint until the water lights it); below the
// Heart, three buttresses stepping down the lit face to the left flank, each with its own shadow, couloirs between
// them spilling into fans of scree, blocks of crag; two lesser horns and two far ranges behind, each fainter and lower
// in contrast the further away it is (the night's own depth, no tint); a black treeline over sea cliffs.
// No sun and no moon: nothing here stands for nothing.
import { COURSE, PEAK, SHORE, W } from '../../parts/cycle/river';

/** A line in chalk. cls is its look (mountain.css); w its width in box units (the SVG and the canvas's lit copy both
 *  use it); lit how much of the water's light it catches (0 none). */
export type Pen = { kind: 'pen'; d: string; cls: string; w: number; at: number; len: number; lit: number };
/** A filled shape (a mass, a face, a tarn). */
export type Fill = { kind: 'fill'; d: string; cls: string; at: number; len: number };
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

/** Half the horn's width at a height: a spire that steepens to the summit. */
export const half = (y: number) => { const t = Math.max(0, (y - PEAK.y) / (SHORE - PEAK.y)); return 3 + 126 * Math.pow(t, 1.5) + 26 * Math.pow(t, 7); };

/** The arete's x at a height: falling from the summit to the right, wandering as rock does. */
export const arete = (y: number) => (y <= PEAK.y ? PEAK.x : PEAK.x + 5 + (y - PEAK.y) * 0.13 + 5 * Math.sin(y / 23) + 3 * Math.sin(y / 9));

/** The ledge under the third eye juts out of the lit flank, with an undercut under it. */
const ledge = (y: number) => (y < 110 || y > 130 ? 0 : y < 114 ? (y - 110) * 0.8 : y < 120 ? 3 + (y - 114) * 2.2 : y < 124 ? 16 - (y - 120) * 0.5 : 14 - (y - 124) * 2.1);
/** The shoulder the heart's tarn rests on. */
const shoulder = (y: number) => 17 * Math.exp(-(((y - 232) / 15) ** 2));
/** A buttress on the shadow flank where the solar plexus keeps its fire. */
const buttress = (y: number) => 9 * Math.exp(-(((y - 282) / 18) ** 2));
/** The toes of the three buttresses on the lit flank below the Heart. */
const TOES = [300, 343, 382];
const spurs = (y: number) => TOES.reduce((a, t, k) => a + (7 + k * 2) * Math.exp(-(((y - t) / 7) ** 2)), 0);

const STEP = 4;
let FLANK: Record<'-1' | '1', P[]> = { '-1': [], '1': [] };

/** The flank's x at a height (after land() has drawn it). */
export const edge = (side: 1 | -1, y: number) => {
  const pts = FLANK[side === 1 ? '1' : '-1'];
  if (!pts.length) return PEAK.x + side * half(y);
  const i = Math.max(0, Math.min(pts.length - 1, Math.round((y - PEAK.y) / STEP)));
  return pts[i][0];
};

function flank(side: 1 | -1): P[] {
  const pts: P[] = [];
  let out = 0;
  for (let y = PEAK.y; y <= SHORE; y += STEP) {
    const amp = y < 120 ? 6 : y < 230 ? 10 : 7;
    if (rnd() < 0.22) out = (rnd() - 0.35) * amp * 1.8; // a crag breaks out, or a notch bites in, and holds a while
    const shape = side < 0 ? ledge(y) + shoulder(y) + spurs(y) : buttress(y) + 6 * Math.exp(-(((y - 340) / 12) ** 2));
    pts.push([PEAK.x + side * (half(y) + shape + out + (rnd() - 0.5) * amp * 0.5), y]);
  }
  pts[0] = [PEAK.x, PEAK.y];
  return pts;
}

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

/** A line falling down a face, breaking left and right as rock does; it stays on the rock and above the trees. */
function fall(x: number, y: number, dx: number, len: number, step: number): string {
  let d = `M${f1(x)} ${f1(y)}`;
  for (let k = 0; k < len; k += step) {
    x += dx * step + (rnd() - 0.5) * 5; y += step;
    if (y > SHORE - 22 || x < edge(-1, y) + 5 || x > edge(1, y) - 5) break;
    d += ` L${f1(x)} ${f1(y)}`;
  }
  return `${d} `;
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

/** How near the water's course a point is (so the rock's blocks keep out of the stream). */
function nearCourse(x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < COURSE.xs.length; i += 2) best = Math.min(best, Math.hypot(COURSE.xs[i] - x, COURSE.ys[i] - y));
  return best;
}

/** The cap's snow down to line y: the lit side (flank to arete) and the side in shadow (arete to flank), each with a
 *  torn foot and fingers reaching down the gullies. Seeded on its own, so the same line gives the same snow. */
export function snowCap(y: number): { lit: string; shade: string; rim: string } {
  let s = 31;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const lo = Math.max(PEAK.y + 6, y);
  const foot = (x0: number, x1: number) => {
    const n = Math.max(3, Math.round((x1 - x0) / 3)), pts: P[] = [];
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n, finger = r() < 0.2 ? 6 + r() * 14 : 0;
      pts.push([x, lo + (k % 2 ? 3.5 : -2.5) + (r() - 0.5) * 4 + finger]);
    }
    return pts;
  };
  const left: P[] = [], right: P[] = [], ridge: P[] = [];
  for (let yy = PEAK.y; yy <= lo; yy += STEP) { left.push([edge(-1, yy), yy]); right.push([edge(1, yy), yy]); ridge.push([arete(yy), yy]); }
  const a = foot(edge(-1, lo), arete(lo)), b = foot(arete(lo), edge(1, lo));
  const lit = `${line([...left, ...a, ...ridge.slice().reverse()])} Z`;
  const shade = `${line([...ridge, ...b, ...right.slice().reverse()])} Z`;
  const rim = `${line(a)} ${line(b)}`;
  return { lit, shade, rim };
}

export function land(): Land {
  seed = 7;
  FLANK = { '-1': [], '1': [] };
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
  const farthest = crag([[0, 268], [40, 246], [86, 262], [128, 236], [200, 240], [250, 228], [296, 252], [328, 240]], 4, 0.5);
  fill(`${line(farthest)} L328 398 L0 398 Z`, 'far-far', 0.16, 0.12);
  pen(line(farthest), 'ridge-far', 0.5, 0.16, 0.14, 0);
  // the far ranges, sawtoothed and broken, drawn out from their highest points
  const farL = crag([[0, 252], [12, 230], [22, 238], [40, 198], [50, 212], [62, 176], [74, 202], [82, 190], [98, 224], [110, 236]], 3, 0.45);
  const farR = crag([[222, 226], [234, 204], [246, 186], [254, 198], [270, 158], [280, 182], [292, 170], [306, 204], [316, 194], [328, 214]], 3, 0.45);
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
    const pts = crag(h.pts, 2, 0.4);
    const top = pts.reduce((b, p, i) => (p[1] < pts[b][1] ? i : b), 0);
    const [tx, ty] = pts[top];
    fill(`${line(pts)} Z`, 'horn', 0.14, 0.16);
    const inner = crag([[h.base, 398], [h.base + (tx - h.base) * 0.4 + 4, ty + (398 - ty) * 0.5], [tx, ty]], 3, 0.5);
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

  // the horn: its two flanks, from the summit down
  const lf = flank(-1), rt = flank(1);
  FLANK = { '-1': lf, '1': rt };
  const ridge: P[] = [];
  for (let y = PEAK.y; y <= SHORE; y += STEP) ridge.push([arete(y), y]);
  fill(`${line(lf)} ${line(rt.slice().reverse()).replace('M', 'L')} Z`, 'face', 0.08, 0.3);
  fill(`${line(ridge)} ${line(rt.slice().reverse()).replace('M', 'L')} Z`, 'deep', 0.14, 0.26);

  // the shadow's hatching: close against the arete, opening toward the far edge, row by row from the top; faint in
  // the dark, so the face stays the darkest thing there is until the water's light finds it
  // engraved: lines running down the face parallel to its far edge, closer together against the arete where it turns
  // away, each broken into runs as a burin lifts, so the face reads as rounded rock and not as rain
  let hatch = '';
  for (let k = 0; k < 9; k++) {
    const f = Math.pow((k + 0.6) / 9, 0.75);
    let d = '', run = 0, gap = 0;
    for (let y = PEAK.y + 14 + rnd() * 6; y < SHORE - 12; y += 3.5) {
      const a = arete(y) + 2, e = edge(1, y) - 2.5;
      if (e - a < 3) { run = 0; continue; }
      const x = e - (e - a) * f + (rnd() - 0.5) * 0.8;
      if (gap > 0) { gap--; run = 0; continue; }
      d += `${run ? 'L' : 'M'}${f1(x)} ${f1(y)} `;
      run++;
      if (run > 3 + rnd() * 9) { run = 0; gap = 1 + Math.floor(rnd() * 3); }
    }
    hatch += d;
  }
  // and short falls of shadow off the arete itself
  for (let y = PEAK.y + 16; y < SHORE - 16; y += 7 + rnd() * 6) {
    const x = arete(y) + 1.5;
    hatch += `M${f1(x)} ${f1(y)} l${f1(1.5 + rnd() * 2)} ${f1(4 + rnd() * 5)} `;
  }
  pen(hatch, 'hatch', 0.5, 0.18, 0.3, 0.45);

  // couloirs down the lower lit face, between the buttresses: dark slots widening as they fall, spilling scree
  const couloirs: [P, P][] = [[[122, 250], [84, 330]], [[108, 306], [60, 372]], [[176, 168], [146, 214]]];
  let gullyLine = '', scree = '';
  for (const [[ax, ay], [bx, by]] of couloirs) {
    const n = 9, l: P[] = [], r: P[] = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = ax + (bx - ax) * t + Math.sin(t * 5 + ax) * 2.5, y = ay + (by - ay) * t, w = 0.8 + 5 * t * t + rnd() * 1.2;
      l.push([x - w, y + w * 0.3]); r.push([x + w * 0.6, y - w * 0.2]);
    }
    fill(`${line([...l, ...r.reverse()])} Z`, 'gully', 0.26, 0.12);
    gullyLine += `${line(l)} `;
    // the fan of scree at its foot: stones thinning and shrinking outward
    for (let k = 0; k < 46; k++) {
      const a = (rnd() - 0.5) * 1.4, d = Math.pow(rnd(), 0.7) * 22, sx = bx + Math.sin(a) * d - 2, sy = by + Math.cos(a) * d * 0.7 + 1;
      if (sy > SHORE - 14 || sx < edge(-1, sy) + 2) continue;
      const z = 0.5 + (1 - d / 22) * 1.3 * rnd();
      scree += `M${f1(sx)} ${f1(sy)} l${f1(z)} ${f1(z * 0.3)} `;
    }
  }
  pen(gullyLine, 'crack', 0.9, 0.26, 0.14, 0.5);

  // three buttresses stepping down the lit face to the left flank, each ridge in chalk with a wedge of shadow under it
  const ribs: [P, P][] = [[[146, 246], [edge(-1, TOES[0]) - 2, TOES[0]]], [[128, 296], [edge(-1, TOES[1]) - 2, TOES[1]]], [[112, 340], [edge(-1, TOES[2]) - 2, TOES[2]]]];
  for (const [[ax, ay], [bx, by]] of ribs) {
    // the crest bows out as it falls, steep at the top and running out at the toe
    const mx = ax + (bx - ax) * 0.45 - 4, my = ay + (by - ay) * 0.62;
    const crest = crag([[ax, ay], [mx, my], [bx, by]], 3, 0.3);
    // the shadow under it: nothing at the top, a hand's width at the toe, ragged
    const under = crest.map(([x, y], i) => {
      const t = i / (crest.length - 1), wd = 0.6 + 6 * t * t * (0.7 + 0.6 * rnd());
      return [x + wd * 0.8, y + wd] as P;
    });
    fill(`${line([...crest, ...under.reverse()])} Z`, 'rib', 0.28, 0.12);
    inked(crest, 'rock', 0.7, 1.7, 0.28, 0.1, 0.4);
  }

  // crags on the lower face: a step of rock, its lit lip in chalk, a sliver of shadow under it, kept out of the water
  let blockLine = '', blockShade = '';
  for (let k = 0, made = 0; k < 200 && made < 11; k++) {
    const y = 150 + rnd() * (SHORE - 180), lo = edge(-1, y) + 6, hi = arete(y) - 6;
    if (hi - lo < 16) continue;
    const x = lo + rnd() * (hi - lo);
    if (nearCourse(x, y) < 12) continue;
    // a ledge: its lip slopes gently down to the left, its face drops under it, and the shadow it throws fills the step
    const w = 5 + rnd() * 6, h = 1.6 + rnd() * 2.2, sl = 0.12 + rnd() * 0.18;
    const B: P = [x, y + w * sl], C: P = [x + w, y], E: P = [x + w + 0.8, y + h], D: P = [x + 1.5, y + w * sl + h * 0.9];
    blockShade += `${line([B, C, E, D])} Z `;
    blockLine += `${line([B, [x + w * 0.5, y + w * sl * 0.4 + (rnd() - 0.5)], C, [x + w + 0.4, y + h * 0.55]])} `;
    made++;
  }
  fill(blockShade, 'crag', 0.3, 0.1);
  pen(blockLine, 'thin', 0.7, 0.3, 0.12, 0.6);

  // gullies cut down the upper face from the arete, and the broken rock between
  let cut = '';
  for (let k = 0; k < 5; k++) { const gy = 70 + k * 36; cut += fall(arete(gy) - 2, gy, -0.4 - k * 0.05, 40 + k * 12, 6); }
  for (let k = 0; k < 3; k++) { const sy = 104 + k * 62; cut += fall(arete(sy) + 4, sy, 0.3, 36 + k * 10, 7); }
  pen(cut, 'crack', 1, 0.22, 0.22, 0.45);
  let chips = '';
  for (let c = 0; c < 34; c++) {
    const cy = 80 + rnd() * (SHORE - 116), lo = edge(-1, cy) + 5, hi = arete(cy) - 6;
    if (hi - lo < 8) continue;
    const cx = lo + rnd() * (hi - lo);
    chips += `M${f1(cx)} ${f1(cy)} l${f1(-1 - rnd() * 2.5)} ${f1(1.5 + rnd() * 3)} l${f1(-0.5 - rnd())} ${f1(2 + rnd() * 3)} `;
  }
  pen(chips, 'chip', 0.6, 0.3, 0.16, 0.6);
  // the scree apron along the foot of the lit face, over the trees' tops
  for (let k = 0; k < 90; k++) {
    const sy = SHORE - 30 + rnd() * 16, lo = edge(-1, sy) + 3, hi = Math.min(arete(sy) - 4, 200);
    if (hi <= lo) continue;
    const sx = lo + rnd() * (hi - lo), z = 0.4 + rnd() * 1.1;
    if (nearCourse(sx, sy) < 5) continue;
    scree += `M${f1(sx)} ${f1(sy)} l${f1(z)} ${f1(z * 0.25)} `;
  }
  pen(scree, 'scree', 0.7, 0.34, 0.1, 0.6);
  // where the cap's snow goes: over the rock's marks, under the chalk of the flanks (snowCap draws it; R2 moves it)
  fill('', 'snow-slot', 0.4, 0.1);

  // the places the stops sit in: the ledge's lip, the narrows' walls and the fall under them, the tarn, the pool
  pen('M124 122 l10 2.5 l12 -1 l9 2.5', 'thin', 1.1, 0.3, 0.06, 1);
  pen('M170 140 q2 8 -1 16 M190 142 q-3 8 0 15', 'rock', 1.6, 0.3, 0.06, 1);
  pen('M174 162 v13 M178 161 v17 M182 161 v15 M186 163 v11', 'chip', 0.8, 0.32, 0.06, 0.9);
  fill('M90 233 q22 -10 46 0 q-22 11 -46 0 Z', 'tarn', 0.3, 0.1);
  pen('M90 233 q22 -10 46 0 q-22 11 -46 0 Z', 'thin', 1, 0.3, 0.08, 1);
  fill('M132 327 q16 -7 32 0 q-16 8 -32 0 Z', 'tarn', 0.32, 0.1);
  pen('M132 327 q16 -7 32 0 q-16 8 -32 0 Z', 'thin', 0.9, 0.32, 0.08, 1);

  // the flanks in chalk with pressure: the shadow side heaviest, both from the summit down at once; the arete behind
  inked(lf, 'rock', 1, 2.5, 0.02, 0.34, 1);
  inked(rt, 'bold', 1.8, 3.6, 0.02, 0.34, 0.9);
  inked(ridge.slice(0, 70), 'arete', 0.7, 2, 0.07, 0.3, 1);
  // crags: a hook of overhang where a flank breaks out
  let hook = '';
  for (const [side, pts] of [[-1, lf], [1, rt]] as const) {
    for (let i = 4; i < pts.length - 6; i++) {
      const [x, y] = pts[i], [px] = pts[i - 1];
      if (side * (x - px) > 3.5) hook += `M${f1(x)} ${f1(y)} l${f1(-side * (4 + rnd() * 4))} ${f1(1 + rnd() * 2)} `;
    }
  }
  pen(hook, 'rock', 1.3, 0.26, 0.14, 0.9);

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
