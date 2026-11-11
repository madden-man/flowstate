// The seven places (PLAN-MOUNTAIN.md pass 6, "A stop's page opens on its place", R3): a close view of each stop's
// place on the mountain, for the plate at the top of its page. Each is drawn once, here, as ink with weight (./ink.ts):
// heavy tapered edges with a dry second pass, crags broken out of every rock line, the shadow faces close-hatched and
// cross-hatched, the far ranges thin and faint, the near rock heavy. ./Plate.tsx paints it on --plate; the stream of
// light runs along `course` through the large sign at `sign`, and each place's light (`fx`, ./water.ts) is the
// stream's own light doing something there, never decoration that stands for nothing:
//   Crown         wind-packed snow under the summit, a cornice over the shadow face, spindrift lifting off it
//   Third eye     a ledge out on the lit wall; the view falls away range after range to the far sea, glinting
//   Throat        a tight gorge against the arete; the water leaves a lip and falls, with spray at the foot
//   Heart         the tarn in its cirque, holding the headwall and the sign upside down and still
//   Solar plexus  the shadow flank; a fire kept on a shelf in an alcove, its ember glow warming the rock
//   Sacral        a short drop between two stones into a low pool; slow rings
//   Root          the firs at the mountain's foot; fireflies of the stream's own light among them
//
// What a place is made of (Mark): fills that hide what is behind them (`mass` the plate, `deep` the shadow), and chalk
// (`ink` filled strokes and planes, `line` stroked strokes, `hatch` stroked strokes clipped to a region, `snow`). Plate.tsx
// groups the marks into layers (a run of fills, then the chalk over them), so near rock covers far rock; the chalk of
// every near layer is drawn a second time in the water's light, masked to the course, and in the sign's hue, masked
// round the sign, so the rock is lit only as far as the water runs (pass 6). `i` is the pen's order as the page opens.
import type { ChakraId } from '../../../model/mountain';
import { crag, hatch, inked, resample, rng, scree, shape, shift, smooth, taper, type Hatch, type P, type Pen, type R } from './ink';

export const W = 390;
export const H = 220;

/** What the place's light does (./water.ts). */
export type Fx = 'spindrift' | 'view' | 'fall' | 'tarn' | 'embers' | 'rings' | 'fireflies';

export type Mark =
  | { k: 'mass' | 'deep'; d: string; o?: number }
  | { k: 'ink'; d: string; o: number; i: number }
  | { k: 'line'; d: string; o: number; w: number; i: number; clip?: string }
  | { k: 'snow'; d: string; i: number }
  | { k: 'reflect'; layer: number; axis: number; clip: string };

/** A run of fills and the chalk over them. lit: drawn again in the water's light and the sign's hue; glow: marks drawn
 *  only there, so texture in the shadow shows only where the light falls on it. */
export type Layer = { fills: Mark[]; chalk: Mark[]; glow: Mark[]; lit: boolean };

export type Scene = {
  /** The large sign's centre and its width, in the box. */
  sign: [number, number];
  size: number;
  /** The stream, start to the sign, and the sign onward. */
  course: [string, string];
  layers: Layer[];
  /** Regions the hatching is clipped to, by id. */
  clips: Record<string, string>;
  /** How far the sign's hue lights the rock round it, in sign widths. */
  glow: number;
  /** Still water: an ellipse holding the reflection (the tarn) or the rings (the pool). */
  water?: { cx: number; cy: number; rx: number; ry: number; shore: number };
  fx: Fx;
  /** Where the fx starts (the summit, the sea, the foot of the fall, the fire, where the water enters the pool). */
  at?: [number, number];
  /** Where the fireflies keep (Root): [x0, y0, x1, y1]. */
  keep?: [number, number, number, number];
};

/** One place being drawn: marks in the pen's order, grouped into layers as fills and chalk alternate. */
class Draw {
  layers: Layer[] = [];
  clips: Record<string, string> = {};
  private pen = 0;
  /** Far things are not lit by the water: it does not reach them. */
  far = false;
  constructor(readonly r: R) {}
  private top(fill: boolean): Layer {
    const last = this.layers[this.layers.length - 1];
    if (last && (!fill || !last.chalk.length) && last.lit === !this.far) return last;
    const l: Layer = { fills: [], chalk: [], glow: [], lit: !this.far };
    this.layers.push(l);
    return l;
  }
  get layer() { return this.layers.length - 1; }
  mass(pts: readonly P[] | string, o?: number) { this.top(true).fills.push({ k: 'mass', d: typeof pts === 'string' ? pts : shape(pts), o }); }
  deep(pts: readonly P[] | string, o?: number) { this.top(true).fills.push({ k: 'deep', d: typeof pts === 'string' ? pts : shape(pts), o }); }
  reflect(layer: number, axis: number, clip: string) { this.top(true).fills.push({ k: 'reflect', layer, axis, clip }); }
  clip(id: string, pts: readonly P[] | string) { this.clips[id] = typeof pts === 'string' ? pts : shape(pts); return id; }
  /** A heavy edge: the full pass at o and the dry pass beside it, fainter. */
  edge(pts: readonly P[], w: number, o: number, pen?: Pen) {
    // a little lighter than a pen on paper, so the close view is drawn with the mountain's own hand (R1)
    const [full, dry] = inked(pts, w * 0.8, this.r, pen);
    const i = this.pen++;
    const t = this.top(false);
    t.chalk.push({ k: 'ink', d: full, o, i });
    if (dry) t.chalk.push({ k: 'ink', d: dry, o: o * 0.5, i });
  }
  /** One tapered stroke. */
  stroke(pts: readonly P[], w: number, o: number, pen?: Pen) {
    this.top(false).chalk.push({ k: 'ink', d: taper(pts, w, this.r, pen), o, i: this.pen++ });
  }
  /** Many tapered strokes as one mark (sastrugi, the fall's curtain, grass). */
  strokes(all: readonly (readonly P[])[], w: number, o: number, pen?: Pen) {
    this.top(false).chalk.push({ k: 'ink', d: all.map(p => taper(p, w * (0.6 + this.r() * 0.7), this.r, pen)).join(' '), o, i: this.pen++ });
  }
  /** A plane of chalk light (a lit face, the top of a ledge). */
  face(pts: readonly P[] | string, o: number) {
    this.top(false).chalk.push({ k: 'ink', d: typeof pts === 'string' ? pts : shape(pts), o, i: this.pen });
  }
  line(d: string, w: number, o: number, clip?: string) { this.top(false).chalk.push({ k: 'line', d, w, o, i: this.pen++, clip }); }
  hatch(clip: string, h: Hatch, w: number, o: number, lit = 0) {
    const d = hatch(h, this.r);
    this.line(d, w, o, clip);
    // the same strokes, stronger, where the light falls: the rock's grain comes up out of the dark only there
    if (lit > 0 && !this.far) this.top(false).glow.push({ k: 'line', d, w, o: lit, i: this.pen, clip });
  }
  snow(pts: readonly P[] | string) { this.top(false).chalk.push({ k: 'snow', d: typeof pts === 'string' ? pts : shape(pts), i: this.pen }); }
}

const rev = (p: readonly P[]): P[] => [...p].reverse();

/** A fir in drooping tiers, its boughs broken into needles at the tips: [silhouette, the lit side's edge]. The lit side
 *  is the side toward the stream (side -1 lit on its left, 1 on its right). */
function fir(x: number, y: number, h: number, r: R, side: number): [P[], P[]] {
  const w = h * 0.34, tiers = 6;
  const L: P[] = [], Rr: P[] = [];
  for (let k = 0; k < tiers; k++) {
    const t = k / (tiers - 1);
    const yTip = y - h + h * (0.12 + 0.86 * t) - h * 0.02;
    const spread = w * (0.22 + 0.78 * Math.pow(t, 0.85)) * (0.85 + r() * 0.3);
    const tuck = spread * (0.35 + r() * 0.15);
    const lift = h * 0.06;
    for (const [arr, s] of [[L, -1], [Rr, 1]] as const) {
      arr.push([x + s * tuck, yTip - h * 0.1]);
      // the bough droops out to its tip in a few needle steps
      const n = 3;
      for (let j = 1; j <= n; j++) {
        const u = j / n;
        arr.push([x + s * (tuck + (spread - tuck) * u) + (r() - 0.5) * 1.2, yTip - lift * (1 - u) + (j % 2 ? 1.6 : -0.4)]);
      }
      arr.push([x + s * spread * 0.82, yTip + 1.2]);
    }
  }
  const top: P = [x + (r() - 0.5), y - h];
  const sil = [top, ...Rr, [x + 1.2, y], [x - 1.2, y], ...rev(L)] as P[];
  const lit = side < 0 ? [top, ...L] : [top, ...Rr];
  return [sil, lit];
}

/** Tone in shadow: close patches, crossed where it is deepest. */
function shade(d: Draw, clip: string, box: Hatch['box'], angle: number, o = 0.2, cross = true, more: Partial<Hatch> = {}) {
  d.hatch(clip, { box, angle, gap: 1.5, run: [8, 16], fill: 0.85, ...more }, 0.45, o * 0.45, o * 1.5);
  if (cross) d.hatch(clip, { box, angle: angle - 70, gap: 2, run: [6, 12], fill: 0.4, ...more }, 0.4, o * 0.3, o);
}
/** Tone on a lit face: fewer, longer, lighter patches, following the fall of the rock. */
function grain(d: Draw, clip: string, box: Hatch['box'], angle: number, o = 0.15, fill = 0.45, more: Partial<Hatch> = {}) {
  d.hatch(clip, { box, angle, gap: 2.4, run: [8, 18], fill, wander: 26, ...more }, 0.45, o * 0.7, o * 1.8);
}
/** A boulder: a broken top caught by the light, its body hatched into shadow under it. */
function boulder(d: Draw, x: number, y: number, s: number, lean: number, o = 0.85, key = `b${x}-${y}`) {
  const r = d.r;
  const top = crag(smooth([[x - s, y + s * 0.35], [x - s * 0.75, y - s * 0.2], [x - s * 0.2 + lean, y - s * 0.5], [x + s * 0.45 + lean, y - s * 0.42], [x + s, y + s * 0.15]], 3), 0.08, 2, r);
  const body = [...top, [x + s * 0.95, y + s * 0.7], [x - s * 0.9, y + s * 0.75]] as P[];
  d.mass(body);
  d.clip(key, body);
  shade(d, key, [x - s, y - s * 0.2, x + s, y + s * 0.8], 14, 0.22, true);
  d.edge(top, Math.max(1.4, s * 0.09), o);
  // a crack or two across its face
  d.edge(crag([[x - s * 0.1, y - s * 0.3], [x + s * 0.05, y + s * 0.1], [x - s * 0.15, y + s * 0.5]], 0.2, 2, r), 0.8, o * 0.45);
}

function crown(): Scene {
  const d = new Draw(rng(305));
  const r = d.r;
  const S: P = [220, 12];
  // far horns poking up behind, faint and thin: we are above most of the range
  d.far = true;
  const farL = crag([[0, 120], [28, 106], [52, 88], [70, 96], [92, 74], [118, 100], [150, 116]], 0.1, 3, r);
  const farR = crag([[318, 150], [334, 104], [348, 80], [360, 92], [374, 66], [396, 88]], 0.1, 3, r);
  d.deep([...farL, [150, 220], [0, 220]], 0.45);
  d.deep([...farR, [396, 220], [318, 220]], 0.45);
  d.edge(farL, 0.9, 0.28, { floor: 0.2 });
  d.edge(farR, 0.9, 0.28, { floor: 0.2 });
  shade(d, d.clip('cr-farr', [...farR, [396, 220], [318, 220]]), [340, 60, 396, 220], 18, 0.1, false);
  d.far = false;

  // the horn: the lit snow face falls left from the summit; the east ridge runs right under its cornice, and under the
  // cornice the shadow face drops away
  const left = crag([S, [204, 30], [186, 50], [164, 64], [134, 90], [98, 114], [56, 138], [0, 160]], 0.06, 3, r);
  const lip = smooth([S, [242, 22], [262, 34], [284, 50], [304, 68], [316, 80]], 5);
  // the cornice's underside, with icicles hanging off it
  const under: P[] = resample(lip, 7).map(([x, y], k) => [x + 2, y + 6 + (k % 3 === 1 ? 5 + r() * 6 : r() * 2)] as P);
  const arete = crag([[222, 20], [226, 48], [232, 84], [242, 124], [250, 166], [256, 220]], 0.08, 3, r);
  const east = crag([[318, 88], [334, 114], [354, 146], [376, 176], [396, 194]], 0.1, 3, r);
  d.mass([...left, ...lip.slice(1), ...east, [396, 220], [0, 220]]);
  const shadow = [...arete, [396, 220], ...rev(east), ...rev(under)] as P[];
  d.deep(shadow);
  d.clip('cr-shadow', shadow);
  shade(d, 'cr-shadow', [224, 26, 396, 220], 14, 0.2);
  // ribs of ice down the shadow face, barely caught
  for (const [x0, y0] of [[250, 44], [276, 60], [302, 88]] as P[]) {
    d.edge(crag([[x0, y0], [x0 + 6, y0 + 44], [x0 + 16, y0 + 96], [x0 + 22, y0 + 170]], 0.12, 3, r), 1.1, 0.26);
  }
  // the lit face: wind-packed snow, brightest under the summit, with the wind's ridges laid across it
  const lit = [...left, ...arete.slice(1), [0, 220]] as P[];
  d.clip('cr-lit', lit);
  d.snow(lit);
  d.face([S, [204, 30], [186, 50], [196, 76], [226, 60], [222, 20]], 0.05);
  const ridges: P[][] = [];
  for (let k = 0; k < 26; k++) {
    const y = 30 + k * 7 + r() * 5, x1 = 224 - k * 1.2 + r() * 4, len = 26 + r() * 60;
    const x0 = x1 - len;
    ridges.push(smooth([[x1, y], [x1 - len * 0.35, y + 2 + len * 0.1], [x1 - len * 0.7, y + 3 + len * 0.26], [x0, y + 2 + len * 0.44]], 4));
  }
  d.strokes(ridges, 0.9, 0.34, { in: 0.2, out: 0.6, grain: 0.7 });
  grain(d, 'cr-lit', [0, 60, 230, 220], -58, 0.1, 0.35);
  // rock breaking out of the snow low on the face: bands along the slope, dark, their tops caught
  for (const [x, y, len] of [[54, 178, 64], [150, 198, 54], [24, 208, 36], [198, 168, 30], [104, 158, 22]] as [number, number, number][]) {
    // a crest of rock: a few teeth standing out of the snow, the snow banked up against their foot
    const topL = crag([[x - len / 2, y + 6], [x - len * 0.25, y - len * 0.14], [x - len * 0.05, y - 2], [x + len * 0.2, y - len * 0.2], [x + len / 2, y + 2]], 0.22, 3, r);
    const band = [...topL, ...crag([[x + len / 2, y + 2], [x + len * 0.1, y + 8], [x - len / 2, y + 6]], 0.25, 2, r).slice(1)] as P[];
    d.deep(band);
    shade(d, d.clip(`cr-o${x}`, band), [x - len / 2, y - 10, x + len / 2 + 6, y + 14], 10, 0.2, false);
    d.edge(topL, 1.6, 0.78);
  }
  // the cornice: a lip of snow leaning out, heavy and lit, the dark band under it; then the summit's edges
  const cornice = [...lip, ...rev(under)] as P[];
  d.mass(cornice);
  d.snow(cornice);
  d.face(cornice, 0.08);
  d.edge(left, 2.6, 0.92);
  d.edge(lip, 3.6, 1, { in: 0.04 });
  d.edge(under, 0.9, 0.4, { grain: 0.9 });
  d.edge(arete, 1.9, 0.62, { in: 0.05 });
  d.edge(east, 1.6, 0.4);
  // spindrift streaming off the lip, downwind
  d.strokes([0, 1, 2, 3, 4, 5].map(k => smooth([[228 + k * 14, 16 + k * 9], [270 + k * 16, 8 + k * 8 + r() * 4], [340 + k * 10, 4 + k * 10]], 6)), 0.8, 0.14, { in: 0.4, out: 0.6 });
  return {
    sign: [166, 104], size: 56, glow: 2.4,
    course: ['M214 28 C210 52 194 78 166 104', 'M166 104 C140 130 126 150 116 176 C110 192 104 206 98 220'],
    layers: d.layers, clips: d.clips,
    fx: 'spindrift', at: [240, 16],
  };
}

function thirdEye(): Scene {
  const d = new Draw(rng(275));
  const r = d.r;
  const HZ = 100;
  // the view: the far sea at the horizon, then range after range coming nearer and darker, mist lying between
  d.far = true;
  d.face(`M60 ${HZ - 2} H396 V${HZ + 10} H60 Z`, 0.035);
  d.line(Array.from({ length: 9 }, (_, k) => `M${140 + r() * 160} ${HZ + 1 + k * 1.1} h${10 + r() * 60}`).join(' '), 0.45, 0.4);
  const ranges: [number, number, number, number, number][] = [
    // base y, height, fill darkness, line strength, line weight
    [HZ + 10, 8, 0.2, 0.12, 0.5], [HZ + 24, 14, 0.38, 0.16, 0.6], [HZ + 44, 20, 0.55, 0.22, 0.8], [HZ + 72, 28, 0.74, 0.3, 1], [HZ + 108, 34, 0.95, 0.5, 1.5],
  ];
  ranges.forEach(([y, amp, fill, o, w], k) => {
    const pts: P[] = [];
    for (let x = 60 - k * 10; x <= 400; x += 16 + r() * 22) pts.push([x, y - r() * amp - (Math.sin(x / (34 + k * 6) + k * 1.7) + 1) * amp * 0.5]);
    const ridge = crag(pts, 0.14, 3, r);
    const body = [...ridge, [400, 220], [ridge[0][0], 220]] as P[];
    if (k < 4) { d.mass(body); d.face(body, 0.075 - k * 0.018); } else d.deep(body, fill);
    if (k === 4) shade(d, d.clip(`te-rg${k}`, body), [ridge[0][0], y - amp * 2, 400, 220], 22, 0.12, false, { fill: 0.7, fillEnd: 0.1, along: 'y' });
    d.edge(ridge, w, o, { floor: 0.25 });
    // mist lying in the valley in front of it
    d.strokes([0, 1, 2].map(j => { const x = 80 + r() * 200; return [[x, y + 5 + j * 3], [x + 60 + r() * 110, y + 6 + j * 3]] as P[]; }), 2.2, 0.05, { in: 0.45, out: 0.45 });
  });
  d.far = false;

  // the near wall: lit rock, tall, cracked; the ledge stands out from it at the sign; under the ledge the wall falls
  // back into shadow and away
  const wallEdge = crag([[120, 0], [114, 26], [126, 52], [116, 80], [112, 104]], 0.14, 3, r);
  const ledgeTop: P[] = crag([[112, 104], [150, 108], [190, 110], [222, 113]], 0.04, 2, r);
  const ledgeFront: P[] = crag([[222, 113], [226, 119], [218, 125]], 0.05, 1, r);
  const below = crag([[218, 125], [180, 128], [140, 134], [110, 146], [92, 170], [76, 196], [66, 220]], 0.1, 3, r);
  const wall = [[0, 0], ...wallEdge, ...ledgeTop.slice(1), ...ledgeFront.slice(1), ...below.slice(1), [0, 220]] as P[];
  d.mass(wall);
  const under = [[218, 125], ...below.slice(1), [0, 220], [0, 132], [60, 124], [112, 108], [150, 112], [190, 114], [222, 117]] as P[];
  d.deep(under);
  d.clip('te-wall', [[0, 0], ...wallEdge, [112, 104], [60, 120], [0, 128]]);
  d.clip('te-under', under);
  grain(d, 'te-wall', [0, 0, 130, 130], -4, 0.17, 0.6);
  for (let k = 0; k < 7; k++) {
    const y = 10 + k * 16 + r() * 6;
    d.edge(crag([[0, y + 8], [44 + r() * 20, y + r() * 4], [112 - (k > 4 ? 14 : 0), y - 3]], 0.14, 2, r), 0.9, 0.34, { floor: 0.2 });
  }
  d.edge(crag([[40, 14], [46, 40], [42, 60], [50, 84]], 0.2, 2, r), 0.8, 0.4);
  d.edge(crag([[84, 30], [80, 58], [88, 86]], 0.2, 2, r), 0.8, 0.4);
  shade(d, 'te-under', [0, 104, 226, 220], 12, 0.22);
  // the ledge: its top a plane of light, its lip the heaviest line on the plate
  d.face([...ledgeTop, [222, 117], [190, 114], [150, 112], [112, 108]], 0.12);
  d.edge(wallEdge, 2.6, 0.88);
  d.edge(ledgeTop, 3.2, 1, { in: 0.05 });
  d.edge(ledgeFront, 1.6, 0.7);
  d.edge(below, 1.4, 0.36);
  d.line(scree(ledgeTop.slice(2), 2.5, 14, r, 1.8), 0.6, 0.45);
  return {
    sign: [170, 82], size: 50, glow: 2.4,
    course: ['M86 0 C92 26 104 52 124 70 C138 80 154 84 170 82', 'M170 82 C188 90 208 100 222 114 C228 136 230 170 232 220'],
    layers: d.layers, clips: d.clips,
    fx: 'view', at: [150, HZ + 1],
  };
}

function throat(): Scene {
  const d = new Draw(rng(250));
  const r = d.r;
  // deep in the gorge behind the fall, barely there
  d.far = true;
  const backTop = crag([[120, 34], [160, 26], [196, 36], [236, 22], [290, 32]], 0.12, 3, r);
  const back = [...backTop, [290, 220], [120, 220]] as P[];
  d.deep(back, 0.75);
  shade(d, d.clip('th-back', back), [120, 20, 290, 220], 4, 0.08, false);
  d.edge(backTop, 1, 0.3);
  d.far = false;
  // the chockstone jammed high in the slit of sky
  const chock = crag(smooth([[176, 22], [190, 10], [214, 8], [234, 16], [242, 28], [228, 38], [198, 40], [176, 22]], 3), 0.06, 2, r);
  d.deep(chock);
  shade(d, d.clip('th-chock', chock), [174, 6, 244, 42], 10, 0.2, false);
  d.edge(chock.slice(0, Math.floor(chock.length * 0.55)), 1.8, 0.75);

  // the arete's wall, left, in shadow: close-hatched and crossed, its edge the heaviest line on the plate
  const aEdge = crag([[118, 0], [140, 28], [156, 58], [176, 92], [172, 128], [184, 168], [180, 220]], 0.1, 3, r);
  const aWall = [[0, 0], ...aEdge, [0, 220]] as P[];
  d.deep(aWall);
  d.clip('th-a', aWall);
  shade(d, 'th-a', [0, 0, 186, 220], 6, 0.2);
  for (const [x, y] of [[36, 4], [86, 26], [124, 96], [52, 110], [134, 160], [20, 150]] as P[]) d.edge(crag([[x, y], [x + 12, y + 30], [x + 4, y + 64]], 0.16, 2, r), 1, 0.24);
  // the lit wall, right: strata stepping down, cracks, the spray wetting its foot
  const bEdge = crag([[288, 0], [266, 30], [252, 60], [232, 94], [236, 134], [226, 176], [230, 220]], 0.1, 3, r);
  const bWall = [[396, 0], ...bEdge, [396, 220]] as P[];
  d.mass(bWall);
  d.clip('th-b', bWall);
  grain(d, 'th-b', [226, 0, 396, 220], -8, 0.15, 0.55);
  for (let k = 0; k < 8; k++) {
    const y = 4 + k * 27 + r() * 10, x0 = 236 + r() * 10, len = 60 + r() * 110, tilt = 6 + r() * 10;
    d.edge(crag([[x0, y], [x0 + len * 0.5, y + tilt * 0.5 + (r() - 0.5) * 6], [x0 + len, y + tilt]], 0.2, 3, r), 1.1, 0.3 + r() * 0.12, { floor: 0.15 });
  }
  for (const [x, y] of [[268, 30], [318, 84], [290, 140], [350, 170]] as P[]) d.edge(crag([[x, y], [x - 6, y + 20], [x - 2, y + 40]], 0.25, 2, r), 0.7, 0.3);
  d.edge(aEdge, 3.4, 0.92, { in: 0.05 });
  d.edge(bEdge, 2.8, 0.88, { in: 0.05 });
  // the lip the water leaves, and the fall's curtain to the plunge pool
  const lip = crag([[176, 98], [196, 93], [214, 94], [234, 100]], 0.05, 2, r);
  d.edge(lip, 2.8, 0.95);
  const curtain: P[][] = [];
  for (let k = 0; k < 30; k++) {
    const x = 194 + r() * 22, spread = (x - 205) * 0.5;
    curtain.push(smooth([[x, 99 + r() * 6], [x + spread * 0.3, 140 + r() * 10], [x + spread, 194 + r() * 8]], 6));
  }
  d.strokes(curtain, 1.3, 0.34, { in: 0.05, out: 0.5, grain: 0.9 });
  // the plunge pool and its foam; boulders at the foot
  const pool = smooth([[172, 206], [204, 198], [236, 206], [216, 214], [190, 214], [172, 206]], 5);
  d.deep(pool);
  d.strokes([0, 1, 2, 3].map(k => [[182 + k * 5, 205 + k * 2], [226 - k * 4, 205 + k * 2]] as P[]), 0.9, 0.3);
  boulder(d, 168, 214, 18, 2, 0.8);
  boulder(d, 244, 212, 22, -3, 0.8);
  return {
    sign: [205, 70], size: 44, glow: 2.2,
    course: ['M212 38 C210 48 206 58 205 70', 'M205 70 C205 80 205 90 205 99 C205 140 205 170 205 204'],
    layers: d.layers, clips: d.clips,
    fx: 'fall', at: [205, 202],
  };
}

function heart(): Scene {
  const d = new Draw(rng(150));
  const r = d.r;
  const shore = 136;
  d.far = true;
  const farR = crag([[0, 56], [40, 42], [80, 50], [130, 28], [180, 38], [230, 20], [290, 34], [340, 18], [396, 32]], 0.1, 3, r);
  d.deep([...farR, [396, 220], [0, 220]], 0.4);
  d.edge(farR, 0.9, 0.24, { floor: 0.2 });
  d.far = false;
  // the cirque's headwall: an arc of cliffs falling to the tarn's back shore, gullies holding old snow, the right turning
  // into shadow
  const ridge = crag([[0, 82], [36, 66], [70, 72], [104, 48], [138, 56], [176, 34], [214, 46], [252, 36], [292, 54], [334, 50], [396, 72]], 0.11, 3, r);
  const wall = [...ridge, [396, shore + 6], [0, shore + 6]] as P[];
  d.mass(wall);
  const split = crag([[252, 36], [240, 70], [228, 108], [236, shore + 6]], 0.1, 2, r);
  const shadow = [...split, [396, shore + 6], ...rev(ridge.filter(p => p[0] > 252))] as P[];
  d.deep(shadow);
  d.clip('he-wall', wall);
  d.clip('he-shadow', shadow);
  grain(d, 'he-wall', [0, 30, 252, shore + 6], -4, 0.15, 0.55);
  shade(d, 'he-shadow', [226, 30, 396, shore + 6], 10, 0.2);
  // gullies down the headwall, with snow lying in their upper reaches
  for (const [x, y, len] of [[66, 72, 60], [110, 52, 80], [152, 50, 84], [194, 42, 90], [300, 56, 76], [352, 54, 70]] as [number, number, number][]) {
    const g = crag([[x, y], [x + 4, y + len * 0.4], [x - 2, y + len * 0.75], [x + 3, shore]], 0.12, 2, r);
    d.edge(g, 1.2, x > 250 ? 0.28 : 0.5);
    const snow = crag([[x - 4, y + 6], [x + 1, y + 3], [x + 5, y + 9], [x + 3, y + len * 0.3], [x + 1, y + len * 0.42], [x - 1, y + len * 0.26], [x - 4, y + 6]], 0.2, 2, r);
    d.face(snow, x > 250 ? 0.05 : 0.12);
  }
  d.edge(ridge, 2.6, 0.92);
  d.edge(split, 1.7, 0.62);
  d.line(scree([[20, shore - 1], [380, shore - 1]], 5, 70, r, 2.2), 0.6, 0.4);
  const headwall = d.layer;
  // the tarn: black water holding the headwall upside down
  const tarn = { cx: 195, cy: 172, rx: 186, ry: 36, shore };
  d.clip('he-tarn', `M${tarn.cx - tarn.rx} ${tarn.cy} a${tarn.rx} ${tarn.ry} 0 1 0 ${tarn.rx * 2} 0 a${tarn.rx} ${tarn.ry} 0 1 0 ${-tarn.rx * 2} 0 Z`);
  d.deep(d.clips['he-tarn']);
  d.reflect(headwall, shore + 3, 'he-tarn');
  d.line(Array.from({ length: 10 }, (_, k) => `M${20 + r() * 140} ${shore + 7 + k * 6} h${50 + r() * 180}`).join(' '), 0.5, 0.1, 'he-tarn');
  d.edge(smooth([[12, 172], [60, 145], [195, 136], [330, 145], [378, 172]], 6), 1.1, 0.5);
  // the near shore: boulders and rushes
  boulder(d, 22, 208, 30, 4, 0.85);
  boulder(d, 362, 206, 34, -4, 0.85);
  boulder(d, 88, 220, 16, 2, 0.7);
  d.strokes(Array.from({ length: 16 }, () => { const x = 46 + r() * 54; return smooth([[x, 222], [x + (r() - 0.4) * 4, 208], [x + (r() - 0.4) * 10, 188 + r() * 14]], 3); }), 1, 0.45, { in: 0.05, out: 0.75 });
  return {
    sign: [195, 104], size: 52, glow: 2.6,
    course: ['M318 44 C300 70 270 84 236 94 C218 99 204 100 195 104', 'M195 104 C194 116 195 126 195 138'],
    layers: d.layers, clips: d.clips,
    water: tarn, fx: 'tarn', at: [195, shore + 2],
  };
}

function solarPlexus(): Scene {
  const d = new Draw(rng(95));
  const r = d.r;
  // the flank in shadow fills the plate under a thin band of sky
  const crest = crag([[0, 26], [60, 18], [118, 30], [176, 14], [236, 26], [300, 8], [350, 20], [396, 12]], 0.12, 3, r);
  const flank = [...crest, [396, 220], [0, 220]] as P[];
  d.deep(flank);
  d.clip('sp-flank', flank);
  shade(d, 'sp-flank', [0, 6, 396, 220], 18, 0.17);
  // buttresses leaning across the flank, their edges just caught, the gullies between them darker still
  for (const [x, y, lean] of [[30, 20, 40], [128, 30, 34], [330, 12, -30]] as [number, number, number][]) {
    const rib = crag([[x, y], [x + lean * 0.4, y + 60], [x + lean * 0.8, y + 130], [x + lean * 1.3, 220]], 0.14, 3, r);
    d.edge(rib, 1.7, 0.3);
    const gully = [...rib, ...shift(rev(rib), 16, 0)] as P[];
    d.deep(gully, 0.8);
    shade(d, d.clip(`sp-g${x}`, gully), [Math.min(x, x + lean * 1.3) - 4, y, Math.max(x, x + lean * 1.3) + 24, 220], 6, 0.2, false);
  }
  d.edge(crest, 2.2, 0.75);
  // the alcove the fire is kept in: an overhang leaning out above, a shelf below, the back wall the light falls on; its
  // sides are not drawn, so it is a hollow in the flank and not a door
  const roof = crag(smooth([[160, 104], [188, 80], [232, 68], [280, 70], [322, 82], [344, 100]], 5), 0.07, 2, r);
  const lipU = shift(roof, 3, 9);
  const shelf = crag([[184, 152], [220, 146], [262, 148], [312, 156]], 0.05, 2, r);
  const alcove = smooth([[176, 150], [174, 116], [194, 88], [232, 78], [280, 80], [318, 92], [324, 124], [312, 156]], 4);
  d.deep(alcove);
  shade(d, d.clip('sp-roof', [...roof, ...rev(lipU)]), [156, 60, 348, 112], 4, 0.3, false, { fill: 1, gap: 1 });
  d.edge(roof, 3.2, 0.66);
  d.edge(shelf, 2.4, 0.72);
  d.line(scree(shelf, 8, 30, r, 2.4), 0.6, 0.45);
  // the hearth: a ring of stones the fire is kept in
  for (let k = 0; k < 7; k++) {
    const a = Math.PI * (0.05 + (k / 6) * 0.9), x = 245 + Math.cos(a) * 26, y = 146 - Math.sin(a) * 4;
    const s = 4.5 + r() * 3;
    const st = crag([[x - s, y + 2], [x - s * 0.5, y - s * (0.5 + r() * 0.5)], [x + s * 0.4, y - s * (0.4 + r() * 0.5)], [x + s, y + 1], [x - s, y + 2]], 0.15, 2, r);
    d.mass(st);
    d.edge(st.slice(0, Math.ceil(st.length * 0.7)), 1.3, 0.8);
  }
  // the stream below the shelf, dropping on down the flank
  d.edge(crag([[300, 166], [318, 196], [330, 220]], 0.1, 2, r), 0.9, 0.26);
  return {
    sign: [245, 112], size: 48, glow: 2.8,
    course: ['M84 22 C110 58 150 84 190 100 C212 108 230 110 245 112', 'M245 112 C268 122 290 140 302 162 C312 182 322 200 330 220'],
    layers: d.layers, clips: d.clips,
    fx: 'embers', at: [245, 142],
  };
}

function sacral(): Scene {
  const d = new Draw(rng(55));
  const r = d.r;
  d.far = true;
  const hills = smooth([[0, 70], [60, 56], [130, 62], [210, 48], [290, 58], [396, 44]], 6);
  d.deep([...hills, [396, 220], [0, 220]], 0.4);
  d.edge(hills, 0.9, 0.24, { floor: 0.25 });
  d.far = false;
  // the mountain's foot sloping down from the left, in shade; low ground on the right
  const slope = crag([[0, 40], [40, 52], [90, 70], [130, 92], [160, 104]], 0.1, 3, r);
  const lowR = crag([[236, 104], [270, 94], [320, 88], [396, 92]], 0.1, 3, r);
  const land = [...slope, [196, 108], ...lowR, [396, 220], [0, 220]] as P[];
  d.mass(land);
  const shadeP = [...slope, [160, 104], [150, 150], [0, 166]] as P[];
  d.deep(shadeP);
  d.clip('sa-shade', shadeP);
  d.clip('sa-land', land);
  shade(d, 'sa-shade', [0, 36, 162, 166], 12, 0.2);
  grain(d, 'sa-land', [230, 86, 396, 150], -70, 0.12, 0.5);
  d.edge(slope, 2.4, 0.82);
  d.edge(lowR, 2, 0.66);
  // the step the water drops off, and the two stones either side of it
  boulder(d, 150, 112, 30, 6, 0.9);
  boulder(d, 244, 114, 30, -6, 0.9);
  const step = crag([[176, 118], [196, 114], [218, 118]], 0.06, 2, r);
  d.edge(step, 2.4, 0.9);
  d.strokes(Array.from({ length: 12 }, () => { const x = 188 + r() * 16; return smooth([[x, 118], [x + (x - 196) * 0.2, 132], [x + (x - 196) * 0.4, 146]], 4); }), 1, 0.3, { in: 0.05, out: 0.6 });
  // the pool, low and wide, and its banks: grasses and pebbles
  const pool = { cx: 196, cy: 180, rx: 178, ry: 32, shore: 148 };
  d.clip('sa-pool', `M${pool.cx - pool.rx} ${pool.cy} a${pool.rx} ${pool.ry} 0 1 0 ${pool.rx * 2} 0 a${pool.rx} ${pool.ry} 0 1 0 ${-pool.rx * 2} 0 Z`);
  d.deep(d.clips['sa-pool']);
  d.line(Array.from({ length: 8 }, (_, k) => `M${40 + r() * 100} ${pool.shore + 10 + k * 6} h${50 + r() * 150}`).join(' '), 0.5, 0.1, 'sa-pool');
  d.edge(smooth([[20, 180], [80, 154], [196, 148], [312, 154], [372, 180]], 6), 1.1, 0.5);
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? 4 : 322;
    d.strokes(Array.from({ length: 28 }, () => {
      const x = x0 + r() * 66, y = 224;
      return smooth([[x, y], [x + side * (2 + r() * 4), y - 12 - r() * 14], [x + side * (6 + r() * 12), y - 22 - r() * 26]], 4);
    }), 1.1, 0.42, { in: 0.05, out: 0.85 });
  }
  d.line(scree([[110, 214], [280, 214]], 5, 26, r, 2.4), 0.6, 0.4);
  return {
    sign: [196, 100], size: 44, glow: 2.6,
    course: ['M0 60 C46 72 96 88 140 98 C164 102 182 102 196 100', 'M196 100 C196 108 196 114 196 120 C196 132 196 142 196 150'],
    layers: d.layers, clips: d.clips,
    water: pool, fx: 'rings', at: [196, 152],
  };
}

function root(): Scene {
  const d = new Draw(rng(25));
  const r = d.r;
  // the mountain's foot rising out of the top of the plate: its lit face, its shadow side, gullies cut down it
  const footL = crag([[0, 100], [40, 80], [90, 56], [138, 28], [176, 6], [196, -6]], 0.1, 3, r);
  const footR = crag([[244, -6], [272, 14], [310, 38], [350, 58], [396, 68]], 0.1, 3, r);
  const foot = [...footL, ...footR, [396, 220], [0, 220]] as P[];
  d.mass(foot);
  const split = crag([[244, -6], [250, 40], [256, 90], [262, 150]], 0.1, 2, r);
  const shadow = [...split, [396, 150], ...rev(footR)] as P[];
  d.deep(shadow);
  d.clip('ro-foot', foot);
  d.clip('ro-shadow', shadow);
  grain(d, 'ro-foot', [0, -6, 250, 150], 58, 0.13, 0.5);
  shade(d, 'ro-shadow', [244, -6, 396, 150], 12, 0.2);
  d.edge(footL, 2.4, 0.8);
  d.edge(footR, 2, 0.5);
  d.edge(split, 1.6, 0.5);
  for (const [x, y] of [[100, 54], [150, 30], [64, 84], [300, 50], [212, 20]] as P[]) d.edge(crag([[x, y], [x + 6, y + 30], [x - 2, y + 64]], 0.16, 2, r), 1, x > 250 ? 0.22 : 0.38);
  // the ground at the foot, behind the trees
  const ground = smooth([[0, 150], [90, 144], [200, 148], [300, 142], [396, 148]], 6);
  d.edge(ground, 1.2, 0.45);
  // the back rank of firs, then the front rank, leaving the stream its way through the middle
  const back: [number, number, number][] = [[14, 152, 44], [40, 150, 56], [68, 154, 40], [92, 150, 52], [118, 154, 40], [142, 152, 34], [252, 152, 34], [276, 150, 48], [300, 154, 40], [324, 150, 56], [350, 154, 44], [376, 150, 52]];
  const front: [number, number, number][] = [[10, 232, 104], [48, 238, 126], [92, 230, 92], [132, 234, 74], [264, 234, 78], [304, 230, 98], [346, 238, 128], [388, 232, 100]];
  for (const rank of [back, front]) {
    const near = rank === front;
    for (const [x, y, h] of rank) {
      const side = x < 200 ? 1 : -1;
      const [sil, lit] = fir(x, y, h, r, side);
      d.deep(sil);
      d.edge(lit, near ? 1.2 : 0.8, near ? 0.5 : 0.34, { in: 0.05, out: 0.3, grain: 0.8 });
      // needles caught on the side toward the water
      const n = Math.round(h / 7);
      d.strokes(Array.from({ length: n }, () => {
        const t = 0.15 + r() * 0.8, yy = y - h + h * t, half = h * 0.3 * t;
        const x0 = x + side * half * (0.2 + r() * 0.6);
        return [[x0, yy], [x0 + side * (2 + r() * 4), yy + 1.5 + r() * 2]] as P[];
      }), near ? 0.9 : 0.6, near ? 0.32 : 0.22, { in: 0.1, out: 0.6 });
    }
  }
  // the forest floor by the water: stones and roots
  d.line(scree([[150, 204], [270, 208]], 8, 30, r, 2.6), 0.7, 0.4);
  boulder(d, 168, 218, 12, 2, 0.7);
  boulder(d, 238, 214, 10, -2, 0.7);
  return {
    sign: [196, 116], size: 50, glow: 2.6,
    course: ['M222 4 C214 40 204 80 196 116', 'M196 116 C194 146 212 166 238 184 C260 198 290 210 322 220'],
    layers: d.layers, clips: d.clips,
    fx: 'fireflies', at: [196, 150], keep: [20, 100, 370, 210],
  };
}

const BUILD: Readonly<Record<ChakraId, () => Scene>> = {
  crown, 'third-eye': thirdEye, throat, heart, 'solar-plexus': solarPlexus, sacral, root,
};
const made = new Map<ChakraId, Scene>();

/** A place, drawn once per load and kept: the same every time it opens. */
export function sceneOf(c: ChakraId): Scene {
  let s = made.get(c);
  if (!s) { s = BUILD[c](); made.set(c, s); }
  return s;
}

/** The whole course as one path, start to end through the sign. */
export const courseOf = (s: Scene) => `${s.course[0]} ${s.course[1].replace(/^M/, 'L')}`;


