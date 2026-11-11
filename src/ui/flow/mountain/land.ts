// The land (PLAN-MOUNTAIN.md pass 5 and pass 6, R1): the horn and everything round it, as path data on the 328 by 476
// box, drawn once. Pure and seeded, so the mountain is the same mountain every time it is drawn; the SVG under the
// plate draws these paths dim (the rock in the dark), and the plate's canvas strokes the same paths again in the
// water's light where the water reaches (./plate.ts), so the lit rock and the dark rock are the same lines.
//
// Every mark carries where it falls in the arrival (at, len: fractions of --t-arrive), in the order a pen would draw
// it (rule 27): the horn from the summit down both flanks at once, the arete after them, the lesser horns and the far
// ranges from their own summits, then the hatching falling in behind (its rows run top to bottom, so a dash drawn
// along the one path falls row by row), the gullies, the foot, and last the snow settling on the cap.
//
// What is where (the mock's land(), pushed further): a horn steepening to the summit, crags held for a while and
// broken out of both flanks, a ledge out on the lit side under the third eye, a shoulder holding the heart's tarn,
// an arete splitting the lit face from the shadow face (the darkest thing on the screen, hatched close against the
// arete and cross-hatched closer still), gullies and bedding cut down the lit face, two lesser horns and two far
// ranges behind, a black treeline two ranks deep with a clump of firs round the root, scree at the river mouth, sea
// cliffs dropping into the water. No sun and no moon: nothing here stands for nothing.
import { PEAK, SHORE, W } from '../../parts/cycle/river';

/** A line in chalk. cls is its weight class (mountain.css); w its width in box units, for the canvas's lit copy; lit
 *  how much of the water's light it catches (0 none). */
export type Pen = { kind: 'pen'; d: string; cls: string; w: number; at: number; len: number; lit: number };
/** A filled shape (a mass, a face, a tarn). */
export type Fill = { kind: 'fill'; d: string; cls: string; at: number; len: number };
export type Star = { x: number; y: number; r: number; at: number };

export interface Land {
  /** Every mark, back to front: what is behind is drawn first, so a mass covers what it stands in front of. */
  marks: (Fill | Pen)[];
  stars: Star[];
}

/** The default line where the cap's snow ends, in box units; R2 moves it with the meter (snowCap takes any). */
export const SNOW_Y = 96;

// a seeded wobble (the mock's)
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const f1 = (n: number) => n.toFixed(1);
const line = (pts: readonly (readonly [number, number])[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${f1(p[0])} ${f1(p[1])}`).join(' ');

/** Half the horn's width at a height: a spire that steepens to the summit. */
export const half = (y: number) => { const t = Math.max(0, (y - PEAK.y) / (SHORE - PEAK.y)); return 3 + 150 * Math.pow(t, 1.5); };

/** The arete's x at a height: falling from the summit to the right, wandering as rock does. */
export const arete = (y: number) => (y <= PEAK.y ? PEAK.x : PEAK.x + 5 + (y - PEAK.y) * 0.13 + 5 * Math.sin(y / 23) + 3 * Math.sin(y / 9));

/** The ledge under the third eye juts out of the lit flank, with an undercut under it. */
const ledge = (y: number) => (y < 110 || y > 130 ? 0 : y < 114 ? (y - 110) * 0.8 : y < 120 ? 3 + (y - 114) * 2.2 : y < 124 ? 16 - (y - 120) * 0.5 : 14 - (y - 124) * 2.1);
/** The shoulder the heart's tarn rests on. */
const shoulder = (y: number) => 17 * Math.exp(-(((y - 232) / 15) ** 2));
/** A buttress on the shadow flank where the solar plexus keeps its fire. */
const buttress = (y: number) => 9 * Math.exp(-(((y - 282) / 18) ** 2));

const STEP = 4;
let FLANK: Record<'-1' | '1', [number, number][]> = { '-1': [], '1': [] };

/** The flank's x at a height (after land() has drawn it). */
export const edge = (side: 1 | -1, y: number) => {
  const pts = FLANK[side === 1 ? '1' : '-1'];
  if (!pts.length) return PEAK.x + side * half(y);
  const i = Math.max(0, Math.min(pts.length - 1, Math.round((y - PEAK.y) / STEP)));
  return pts[i][0];
};

function flank(side: 1 | -1): [number, number][] {
  const pts: [number, number][] = [];
  let out = 0;
  for (let y = PEAK.y; y <= SHORE; y += STEP) {
    const amp = y < 200 ? 7.5 : 4.5;
    if (rnd() < 0.22) out = (rnd() - 0.3) * amp * 1.7; // a crag breaks out, or a notch bites in, and holds a while
    const shape = side < 0 ? ledge(y) + shoulder(y) : buttress(y);
    pts.push([PEAK.x + side * (half(y) + shape + out + (rnd() - 0.5) * amp * 0.5), y]);
  }
  pts[0] = [PEAK.x, PEAK.y];
  return pts;
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
  const p: [number, number][] = [
    [x - w * 0.5, y], [x - w * 0.22, y - h * 0.3], [x - w * 0.42, y - h * 0.3], [x - w * 0.16, y - h * 0.58],
    [x - w * 0.3, y - h * 0.58], [x, y - h], [x + w * 0.3, y - h * 0.58], [x + w * 0.16, y - h * 0.58],
    [x + w * 0.42, y - h * 0.3], [x + w * 0.22, y - h * 0.3], [x + w * 0.5, y],
  ];
  return `${line(p)} Z `;
}

/** The cap's snow down to line y: the lit side (flank to arete) and the side in shadow (arete to flank), each with a
 *  ragged foot and fingers reaching down the gullies. Seeded on its own, so the same line gives the same snow. */
export function snowCap(y: number): { lit: string; shade: string; rim: string } {
  let s = 31;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const lo = Math.max(PEAK.y + 6, y);
  const foot = (x0: number, x1: number) => {
    const n = Math.max(3, Math.round((x1 - x0) / 4)), pts: [number, number][] = [];
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n, finger = r() < 0.18 ? 6 + r() * 10 : 0;
      pts.push([x, lo + (k % 2 ? 3 : -2) + (r() - 0.5) * 3 + finger]);
    }
    return pts;
  };
  const left: [number, number][] = [], right: [number, number][] = [], ridge: [number, number][] = [];
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
  const fills = { push: (f: Omit<Fill, 'kind'>) => marks.push({ kind: 'fill', ...f }) };

  // the stars, few and faint, only in the sky
  for (let k = 0; stars.length < 22 && k < 200; k++) {
    const x = 8 + rnd() * (W - 16), y = 6 + rnd() * 120, r = 0.45 + rnd() * 0.75;
    if (Math.abs(x - PEAK.x) < half(y) + 10 || (y > 100 && (x < 140 || x > 196))) continue;
    stars.push({ x, y, r, at: rnd() * 0.12 });
  }

  // the far ranges, sawtoothed, low behind everything; drawn out from their highest points
  const farL: [number, number][] = [[0, 252], [12, 230], [22, 238], [40, 198], [50, 212], [62, 176], [74, 202], [82, 190], [98, 224], [110, 236]];
  const farR: [number, number][] = [[222, 226], [234, 204], [246, 186], [254, 198], [270, 158], [280, 182], [292, 170], [306, 204], [316, 194], [328, 214]];
  fills.push({ d: `${line(farL)} L110 344 L0 344 Z`, cls: 'far', at: 0.2, len: 0.16 });
  fills.push({ d: `${line(farR)} L328 344 L222 344 Z`, cls: 'far', at: 0.2, len: 0.16 });
  pen(`${line(farL.slice(0, 6).reverse())} ${line(farL.slice(5))}`, 'far', 0.8, 0.2, 0.14, 0.2);
  pen(`${line(farR.slice(0, 5).reverse())} ${line(farR.slice(4))}`, 'far', 0.8, 0.2, 0.14, 0.2);

  // two lesser horns shouldering in behind the peak, each with its dark side, outlined out from the summit
  const horns: { pts: [number, number][]; top: number; dark: [number, number][] }[] = [
    { pts: [[0, 344], [20, 300], [30, 312], [52, 250], [60, 262], [82, 196], [90, 210], [104, 148], [111, 166], [117, 158], [126, 196], [132, 260], [120, 344]], top: 7,
      dark: [[104, 148], [111, 166], [117, 158], [126, 196], [132, 260], [120, 344], [96, 344], [104, 300], [100, 240], [106, 190]] },
    { pts: [[200, 344], [198, 190], [206, 172], [214, 136], [221, 150], [232, 116], [240, 142], [246, 134], [262, 184], [272, 174], [292, 236], [300, 226], [328, 290], [328, 344]], top: 5,
      dark: [[232, 116], [240, 142], [246, 134], [262, 184], [272, 174], [292, 236], [300, 226], [328, 290], [328, 344], [262, 344], [250, 260], [244, 196], [236, 150]] },
  ];
  horns.forEach(h => {
    fills.push({ d: `${line(h.pts)} Z`, cls: 'horn', at: 0.14, len: 0.16 });
    fills.push({ d: `${line(h.dark)} Z`, cls: 'horn-deep', at: 0.18, len: 0.16 });
    const up = h.pts.slice(0, h.top + 1).reverse(), down = h.pts.slice(h.top, h.pts.length - 1);
    pen(`${line(up)} ${line(down)}`, 'rock', 1.3, 0.12, 0.2, 0.45);
  });
  let dark = '';
  for (let y = 160; y < 336; y += 7) for (let x = 108 + (y - 148) * 0.06; x < 112 + (y - 148) * 0.13; x += 3.6) dark += `M${f1(x)} ${y} l-3 7 `;
  for (let y = 128; y < 336; y += 7) for (let x = 236 + (y - 116) * 0.1; x < 240 + (y - 116) * 0.42; x += 4.4) dark += `M${f1(x)} ${y} l-3 7 `;
  pen(dark, 'hatch', 0.55, 0.22, 0.2, 0.25);

  // the horn: its two flanks first, from the summit down
  const lf = flank(-1), rt = flank(1);
  FLANK = { '-1': lf, '1': rt };
  const ridge: [number, number][] = [];
  for (let y = PEAK.y; y <= SHORE; y += STEP) ridge.push([arete(y), y]);
  fills.push({ d: `${line(lf)} ${line(rt.slice().reverse()).replace('M', 'L')} Z`, cls: 'face', at: 0.08, len: 0.3 });
  fills.push({ d: `${line(ridge)} ${line(rt.slice().reverse()).replace('M', 'L')} Z`, cls: 'deep', at: 0.14, len: 0.26 });

  // the shadow's hatching: close against the arete, opening toward the far edge, row by row from the top
  let hatch = '', cross = '';
  for (let y = PEAK.y + 10; y < SHORE - 10; y += 5) {
    const x0 = arete(y) + 2, x1 = edge(1, y) - 3;
    for (let x = x0, gap = 3.2; x < x1; x += gap, gap = Math.min(10, gap * 1.18)) hatch += `M${f1(x + (rnd() - 0.5))} ${y} l-3.5 ${f1(6 + rnd() * 3)} `;
    // cross-hatched closer still against the arete, so the face goes black where it turns away
    for (let x = x0 + 1, k = 0; x < Math.min(x1, x0 + 22) && k < 6; x += 4.2, k++) cross += `M${f1(x)} ${y + 1} l3 ${f1(5 + rnd() * 2)} `;
  }
  pen(hatch, 'hatch', 0.6, 0.2, 0.28, 0.35);
  pen(cross, 'hatch', 0.5, 0.26, 0.24, 0.2);

  // gullies cut down the lit face from the arete, bedding across it, and the broken rock between
  let cut = '';
  for (let k = 0; k < 7; k++) { const gy = 70 + k * 40; cut += fall(arete(gy) - 2, gy, -0.4 - k * 0.04, 46 + k * 16, 6); }
  for (let k = 0; k < 4; k++) { const sy = 104 + k * 62; cut += fall(arete(sy) + 4, sy, 0.3, 40 + k * 10, 7); }
  pen(cut, 'crack', 1, 0.22, 0.22, 0.8);
  let bed = '';
  for (let k = 0; k < 9; k++) {
    const y = 150 + k * 24 + rnd() * 8, x0 = edge(-1, y) + 6 + rnd() * 10, x1 = Math.min(arete(y) - 8, x0 + 22 + rnd() * 30);
    if (x1 - x0 < 10) continue;
    bed += `M${f1(x0)} ${f1(y)} L${f1((x0 + x1) / 2)} ${f1(y - 3 - rnd() * 3)} L${f1(x1)} ${f1(y - 7 - rnd() * 4)} `;
  }
  pen(bed, 'far', 0.8, 0.28, 0.16, 0.55);
  let chips = '';
  for (let c = 0; c < 80; c++) {
    const cy = 80 + rnd() * (SHORE - 116), lo = edge(-1, cy) + 5, hi = arete(cy) - 6;
    if (hi - lo < 8) continue;
    const cx = lo + rnd() * (hi - lo);
    chips += `M${f1(cx)} ${f1(cy)} l${f1(-2 - rnd() * 3)} ${f1(4 + rnd() * 5)} `;
  }
  pen(chips, 'far', 0.7, 0.3, 0.16, 0.6);
  // where the cap's snow goes: over the rock's marks, under the chalk of the flanks (snowCap draws it; R2 moves it)
  fills.push({ d: '', cls: 'snow-slot', at: 0.4, len: 0.1 });

  // the places the stops sit in: the ledge's lip, the narrows' walls and the fall under them, the tarn, the pool
  pen('M124 122 l10 2.5 l12 -1 l9 2.5', 'thin', 1.1, 0.3, 0.06, 1);
  pen('M170 140 q2 8 -1 16 M190 142 q-3 8 0 15', 'rock', 1.6, 0.3, 0.06, 1);
  pen('M174 162 v13 M178 161 v17 M182 161 v15 M186 163 v11', 'far', 0.8, 0.32, 0.06, 0.9);
  fills.push({ d: 'M90 233 q22 -10 46 0 q-22 11 -46 0 Z', cls: 'tarn', at: 0.3, len: 0.1 });
  pen('M90 233 q22 -10 46 0 q-22 11 -46 0 Z', 'thin', 1, 0.3, 0.08, 1);
  fills.push({ d: 'M132 327 q16 -7 32 0 q-16 8 -32 0 Z', cls: 'tarn', at: 0.32, len: 0.1 });
  pen('M132 327 q16 -7 32 0 q-16 8 -32 0 Z', 'thin', 0.9, 0.32, 0.08, 1);

  // the flanks in chalk: the shadow side heaviest, both from the summit down at once; the arete close behind them
  pen(line(lf), 'rock', 1.8, 0.04, 0.26, 1);
  pen(line(rt), 'bold', 2.6, 0.04, 0.26, 0.9);
  pen(line(ridge.slice(0, 70)), 'arete', 1.5, 0.08, 0.22, 1);
  pen(line(ridge.slice(1, 40).map(([x, y]) => [x + 1.6, y + 1] as [number, number])), 'thin', 0.7, 0.1, 0.18, 0.8);
  // crags: a hook of overhang where a flank breaks out
  let crag = '';
  for (const [side, pts] of [[-1, lf], [1, rt]] as const) {
    for (let i = 4; i < pts.length - 6; i++) {
      const [x, y] = pts[i], [px] = pts[i - 1];
      if (side * (x - px) > 3.5) crag += `M${f1(x)} ${f1(y)} l${f1(-side * (4 + rnd() * 4))} ${f1(1 + rnd() * 2)} `;
    }
  }
  pen(crag, 'rock', 1.2, 0.16, 0.16, 0.9);
  // spindrift torn off the summit, downwind
  pen('M167 41 q20 -13 50 -10 M171 47 q28 -9 64 -2 M169 35 q12 -9 30 -10 M178 53 q22 -4 44 4', 'far', 0.7, 0.4, 0.1, 0.5);

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
  fills.push({ d: back, cls: 'trees-back', at: 0.32, len: 0.12 });
  fills.push({ d: clump, cls: 'trees', at: 0.34, len: 0.12 });
  fills.push({ d: front, cls: 'trees', at: 0.34, len: 0.12 });
  pen(back, 'far', 0.6, 0.32, 0.12, 0.35);
  pen(clump, 'thin', 0.7, 0.34, 0.12, 0.7);
  pen(front, 'thin', 0.8, 0.34, 0.12, 0.6);
  pen('M136 392 q5 -9 12 -2 q6 -4 8 4 M178 394 q4 -8 10 -3 q5 -1 6 5 M146 384 q3 -5 7 -1 M176 386 q3 -5 7 -1 M156 396 q2 -4 5 -1 M168 397 q2 -3 5 0', 'thin', 0.9, 0.36, 0.08, 0.9);

  // the sea cliffs either side of the mouth, the rock dropping into the water
  const cliffL: [number, number][] = [[0, SHORE + 2], [30, SHORE - 1], [58, SHORE + 3], [96, SHORE], [140, SHORE + 2]];
  const cliffR: [number, number][] = [[188, SHORE + 2], [232, SHORE + 3], [270, SHORE - 1], [300, SHORE + 3], [328, SHORE + 1]];
  const foot = (pts: [number, number][]) => pts.map(([x, y]) => [x, y + 9 + rnd() * 5] as [number, number]).reverse();
  fills.push({ d: `${line([...cliffL, ...foot(cliffL)])} Z`, cls: 'cliff', at: 0.36, len: 0.1 });
  fills.push({ d: `${line([...cliffR, ...foot(cliffR)])} Z`, cls: 'cliff', at: 0.36, len: 0.1 });
  pen(`${line(cliffL.slice().reverse())} ${line(cliffR)}`, 'rock', 1.6, 0.36, 0.1, 0.7);
  let drop = '';
  for (let x = 3; x < W - 2; x += 3.4) { if (x > 138 && x < 190) continue; drop += `M${f1(x)} ${SHORE + 4} v${f1(4 + rnd() * 6)} `; }
  pen(drop, 'hatch', 0.6, 0.38, 0.08, 0.4);

  return { marks, stars };
}
