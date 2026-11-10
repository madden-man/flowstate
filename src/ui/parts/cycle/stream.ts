// The stream (PLAN-MOTION.md M5, DESIGN.md rule 30): a flow's drawing runs like water. This file is the water itself,
// pure maths with no DOM, so it can be tested; ../Stream.tsx draws it, one line per mote, behind parts/Cycle. It knows
// no shape: it reads Shape.at, slotT, restT and the shape's own water (Shape.stream), and nothing else.
//
// How it reads. Each mote moves along the walk at the pace of the step it is passing (model/pace.ts), eased between
// steps, so the same motes pass every point: they spread thin where it runs fast and pool where it runs slow. That is
// the truth each drawing tells (the wave is quick and passes; settling is slow), shown as motion. A fast mote is a
// short dash, a slow one a dot, and slow water spreads a little wider across the line. The motes are laid down
// already in that steady state, so nothing sweeps in when the page opens.
//
// Where I am. At rest the whole stream shows, a little quieter. With the dot on a step, what is behind it fades to a
// fifth and the water runs on from the dot. Landing on a detent pushes the water near it on for a moment.
// Hold the ring. While a thumb holds the middle, the water gathers on the in-breath and lets go on the out-breath,
// slowing as it goes, and runs a little calmer after each breath (never below CALM_FLOOR); the calm comes back slowly
// after the thumb lifts. The breath is breath.ts's own (the time the thumb landed, 4 in, 6 out); there is no second clock.
//
// The light. k is --stream (1 by day, .85 at night, .4 in Still, 0 under Reduce Motion): it scales the speed and how
// many motes show. It is read by the layer when the light changes, never here.
//
// Lanes in colour (PLAN-ENERGIZE.md X2, DESIGN.md rule 30 amended). On Energize the channel runs as three lanes side by
// side across the line, one a fixation, in slot order; laneOf says which lane a mote's place across the line is in.
// Nothing here colours anything and no flow's water changes: the layer reads laneOf only when it is given hues.
//
// This is the page he opens in a panic. Nothing flashes: every change is eased, no mote appears or goes except where
// its lane has faded it to nothing, and the fastest water stays under FASTEST.
import { walkDistance, type Pt, type Shape, type SideRoad, type Water as ShapeWater } from './shape';
import { walkOf } from './walk';

/** Drawing units a second at pace 1: a walk, about a tenth of the ring's way round each second. */
export const BASE = 30;
/** The fastest any water runs, in drawing units a second (the drop on What if, pushed or not): slower than a finger. */
export const FASTEST = 100;
/** No water stands quite still (as a pace), or the whole stream would end up waiting in one place. */
export const SLOWEST = 0.22;
/** The main stream's motes: one per this many drawing units of walk, between MOTES_MIN and MOTES_MAX. With the side
 *  roads the layer stays under about ninety lines (PLAN-MOTION.md M5 item 7). */
export const SPACING = 6;
export const MOTES_MIN = 40;
export const MOTES_MAX = 78;
/** A mote's depth, near to far: the nearest is NEAR_A of ink and NEAR_W CSS pixels wide, the farthest FAR_A and FAR_W,
 *  so the water has depth instead of one grey. The motes are ink, so they read against the line's print grey. */
export const NEAR_A = 0.9;
export const FAR_A = 0.35;
export const NEAR_W = 3.2;
export const FAR_W = 1.6;
/** At rest (the dot between episodes): the whole stream, a little quieter. */
export const AT_REST = 0.7;
/** Behind the dot, the water fades to this. */
export const BEHIND = 0.2;
/** The dotted stretches carry it at this. */
export const THIN = 0.4;
/** Below this many drawing units a second a mote is a dot; from there its dash grows, eased, to DASH_MAX at FASTEST,
 *  so a single frame tells the jet from the pool. */
export const DOT_BELOW = 12;
/** The longest dash, in drawing units (the top pace). */
export const DASH_MAX = 14;
/** The stream is a channel centred on the line, denser toward its middle: this many drawing units either side where it
 *  runs fast (a jet), up to SPREAD_POOL where it is slow (a pool). */
export const SPREAD_JET = 5.5;
export const SPREAD_POOL = 9.5;
/** Still shows this share of the motes (by day all of them show); the light's own --stream slows them. */
export const STILL_SHARE = 0.5;
/** The channel beside a step's word, as a share of its width, and how far from the word it is back to full. */
export const WORD_NARROW = 0.5;
export const WORD_REACH = 14;
/** A side road is a trickle, narrower than the main channel. */
export const SIDE_NARROW = 0.55;
/** Hold the ring: the calm each breath takes away, and the least it can fall to. */
export const CALM_STEP = 0.12;
export const CALM_FLOOR = 0.45;
/** Hold the ring: the speed at the bottom of the out-breath, and how far the water gathers on the in-breath. */
export const BREATH_SLOW = 0.45;
export const BREATH_GATHER = 0.5;
/** A landing's push: how much quicker the nearest water runs at its height, and how far along the walk it reaches. */
export const PUSH = 1.2;
export const PUSH_REACH = 0.1;

/** Energize's lanes: one a fixation, as many as the slots (model/fixations.ts SLOTS). */
export const LANES = 3;

/**
 * Which of `lanes` lanes, side by side across the line, a mote at place off (-1 to 1) runs in, 0 on the negative side.
 * A mote's place is the sum of two draws (off = r + r - 1, a triangle peaked in the middle), so the edges are cut where
 * the triangle's area is shared out evenly: each lane carries the same share of the water, the middle one narrowest.
 */
export function laneOf(off: number, lanes = LANES): number {
  if (lanes <= 1) return 0;
  const x = Math.max(-1, Math.min(1, off));
  const below = x < 0 ? (x + 1) ** 2 / 2 : 1 - (1 - x) ** 2 / 2;
  return Math.min(lanes - 1, Math.floor(below * lanes));
}

const smooth = (u: number) => { const x = Math.max(0, Math.min(1, u)); return x * x * (3 - 2 * x); };
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const mod1 = (x: number) => ((x % 1) + 1) % 1;
/** The signed shortest way from a to b round a closed walk. */
const wrapSigned = (d: number) => mod1(d + 0.5) - 0.5;

/** The share of motes the light shows: all of them by day and night, STILL_SHARE in Still (--stream .4), none at 0. */
export const shownAt = (k: number) => (k <= 0 ? 0 : lerp(STILL_SHARE, 1, smooth((k - 0.4) / 0.45)));

export type Paces = { rest: number; steps: number[] };

/** The pace along the walk: each step's pace at its detent and the rest's at rest, eased between; a closed walk wraps.
 *  Never below SLOWEST, never above FASTEST. */
export function paceAlong(shape: Pick<Shape, 'closed' | 'slotT' | 'restT'>, n: number, paces: Paces): (t: number) => number {
  const knots = [{ t: shape.restT(n), v: paces.rest }, ...Array.from({ length: n }, (_, i) => ({ t: shape.slotT(i, n), v: paces.steps[i] ?? 1 }))]
    .sort((a, b) => a.t - b.t);
  const top = FASTEST / BASE;
  const clamp = (v: number) => Math.max(SLOWEST, Math.min(top, v));
  const first = knots[0], last = knots.at(-1)!;
  return t => {
    if (t <= first.t || t >= last.t) {
      if (!shape.closed) return clamp(t <= first.t ? first.v : last.v);
      const span = 1 - last.t + first.t, d = t >= last.t ? t - last.t : t + 1 - last.t;
      return clamp(lerp(last.v, first.v, smooth(span ? d / span : 0)));
    }
    let i = 1;
    while (i < knots.length - 1 && t > knots[i].t) i++;
    const a = knots[i - 1], b = knots[i];
    return clamp(lerp(a.v, b.v, smooth(b.t > a.t ? (t - a.t) / (b.t - a.t) : 1)));
  };
}

/** The walk's length in drawing units. */
export function lengthOf(at: (t: number) => Pt, samples = 360): number {
  let len = 0, p = at(0);
  for (let i = 1; i <= samples; i++) { const q = at(i / samples); len += Math.hypot(q.x - p.x, q.y - p.y); p = q; }
  return len;
}

/** Where count motes sit in the steady state of a stream running at v(t): as many pass every point, so the time each
 *  spends in a stretch, and so how many are found in it, goes as 1 / v. Stratified, so even a few lie evenly. */
export function steadyFill(v: (t: number) => number, count: number, rng: () => number = Math.random, samples = 400): number[] {
  const cum = [0];
  for (let i = 1; i <= samples; i++) cum.push(cum[i - 1] + 1 / v((i - 0.5) / samples));
  const out: number[] = [];
  let j = 1;
  for (let i = 0; i < count; i++) {
    const want = ((i + rng()) / count) * cum[samples];
    while (j < samples && cum[j] < want) j++;
    const u = (want - cum[j - 1]) / (cum[j] - cum[j - 1] || 1);
    out.push((j - 1 + u) / samples);
  }
  return out;
}

/** One mote: where it is on its lane (t), its place across the line (off, -1 to 1), its width and brightness, how far
 *  it hangs or lifts (s, 0 to 1), its rank (the light shows the lowest ranks first) and how shown it is now (vis). */
export type Mote = { t: number; off: number; w: number; a: number; s: number; rank: number; vis: number };

export type Lane = {
  at(t: number): Pt; len: number; closed: boolean; v(t: number): number; fade(t: number): number;
  /** How wide the channel may run here (1 is all of it): narrower where a step's word sits beside the line. */
  narrow(t: number, side: number): number;
  alpha: number; main: boolean;
  /** Where on the walk a side road leaves it, for the fade behind the dot. */
  from: number;
  motes: Mote[];
};

/** The breath while held: how fast the water runs (BREATH_SLOW to 1) and how gathered it is (BREATH_GATHER to 1), at
 *  ms into the breath, and how many whole breaths have passed. */
export function breathAt(ms: number, inMs: number, outMs: number): { speed: number; spread: number; breaths: number } {
  const cycle = inMs + outMs, b = ((ms % cycle) + cycle) % cycle, breaths = Math.floor(ms / cycle);
  if (b < inMs) { const u = smooth(b / inMs); return { speed: lerp(BREATH_SLOW, 1, u), spread: lerp(1, BREATH_GATHER, u), breaths }; }
  const u = smooth((b - inMs) / outMs);
  return { speed: lerp(1, BREATH_SLOW, u), spread: lerp(BREATH_GATHER, 1, u), breaths };
}

/** The clock's ticks: a short run on each second of the real clock, then a long wait (mean about .7). */
export function tickAt(ms: number): number {
  const u = mod1(ms / 1000);
  return 0.1 + 2.6 * smooth(u / 0.12) * (1 - smooth((u - 0.2) / 0.2));
}

/** Where a step's word sits beside the line, the side of the channel facing it narrows to WORD_NARROW (eased over
 *  WORD_REACH drawing units), so a pool never sits under a word; the far side keeps its width, and the words keep their
 *  page-coloured edge as well. A table, read by t and by side (side > 0 is the side the layer's offsets call positive). */
function wordsBeside(shape: Shape, n: number, samples = 240): (t: number, side: number) => number {
  const words = Array.from({ length: n }, (_, i) => shape.label(i, n));
  const plus: number[] = [], minus: number[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples, e = 0.004, p = shape.at(t);
    const a = shape.at(Math.max(0, t - e)), b = shape.at(Math.min(1, t + e));
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / d, ny = (b.x - a.x) / d;
    let fp = 1, fm = 1;
    for (const w of words) {
      const f = lerp(WORD_NARROW, 1, smooth((Math.hypot(p.x - w.x, p.y - w.y) - 8) / WORD_REACH));
      if ((w.x - p.x) * nx + (w.y - p.y) * ny >= 0) fp = Math.min(fp, f); else fm = Math.min(fm, f);
    }
    plus.push(fp); minus.push(fm);
  }
  return (t, side) => (side >= 0 ? plus : minus)[Math.round(Math.max(0, Math.min(1, t)) * samples)];
}

/** A side road as a lane of its own, measured along its pieces. */
function sideLane(shape: Shape, side: SideRoad): Lane {
  const walk = walkOf(side.pieces.map(p => ({ ...p, cls: '' })), 48);
  const start = walk.at(0);
  // where it leaves the walk: the nearest place on the walk to its start
  let from = 0, best = Infinity;
  for (let i = 0; i <= 400; i++) { const q = shape.at(i / 400), d = (q.x - start.x) ** 2 + (q.y - start.y) ** 2; if (d < best) { best = d; from = i / 400; } }
  return {
    at: walk.at, len: walk.length, closed: false, v: () => side.pace, narrow: () => SIDE_NARROW, main: false, from, alpha: side.alpha, motes: [],
    fade: t => smooth(t / 0.1) * (side.fades ? 1 - smooth((t - 0.3) / 0.6) : smooth((1 - t) / 0.1)),
  };
}

/** A flow's water: the lanes, their motes, and what the page has told it (the dot, a landing, a held breath). */
export class Water {
  readonly lanes: Lane[] = [];
  readonly size: number;
  /** --stream, from the layer. */
  k = 1;
  private shape: Shape;
  private n: number;
  private water: ShapeWater;
  private rng: () => number;
  private mult = 1;
  private calm = 1;
  private gather = 1;
  /** The breath: when the thumb landed (Date.now() time, breath.ts's own since) and the breath's two halves. */
  private held: { since: number; inMs: number; outMs: number } | null = null;
  private dot: number | null = null;
  private mask = 0;
  private push: { t: number; age: number; life: number } | null = null;

  constructor(shape: Shape, n: number, paces: Paces, rng: () => number = Math.random) {
    this.shape = shape;
    this.n = n;
    this.rng = rng;
    this.water = shape.stream?.(n) ?? {};
    const v = paceAlong(shape, n, paces);
    const len = lengthOf(shape.at);
    const thin = this.water.thin ?? [];
    const thinAt = (t: number) => thin.reduce((f, [a, b]) => f * lerp(1, THIN, smooth((t - a) / 0.04) * smooth((b - t) / 0.04)), 1);
    const main: Lane = {
      at: shape.at, len, closed: shape.closed, v, narrow: wordsBeside(shape, n), main: true, from: 0, alpha: 1, motes: [],
      // an open walk fades in and out at its ends, where its motes go round again; a closed one never ends
      fade: shape.closed ? thinAt : t => smooth(t / 0.06) * smooth((1 - t) / 0.06) * thinAt(t),
    };
    this.lanes.push(main);
    this.seed(main, Math.max(MOTES_MIN, Math.min(MOTES_MAX, Math.round(len / SPACING))));
    for (const side of this.water.sides ?? []) {
      const lane = sideLane(shape, side);
      this.lanes.push(lane);
      this.seed(lane, side.motes);
    }
    this.size = this.lanes.reduce((a, l) => a + l.motes.length, 0);
  }

  private seed(lane: Lane, count: number) {
    const r = this.rng;
    for (const t of steadyFill(lane.v, count, r)) {
      const depth = r();
      lane.motes.push({ t, off: r() + r() - 1, w: lerp(FAR_W, NEAR_W, depth), a: lerp(FAR_A, NEAR_A, Math.min(1, depth + (r() - 0.5) * 0.2)), s: r(), rank: r(), vis: 1 });
    }
  }

  /** Where the dot is: 0 at rest (the whole stream, a little quieter), else the step the water runs on from. From
   *  rest the fade starts at the dot; from step to step it follows the dot along. */
  setAt(k: number) {
    const was = this.dot;
    this.dot = k > 0 ? this.shape.slotT(k - 1, this.n) : null;
    if (was === null && this.dot !== null) this.mask = this.dot;
  }

  /** A landing on detent k (0 is rest): the water near it is pushed on for a moment, over life seconds. Returns where,
   *  for the ring the layer draws going out from it. */
  land(k: number, life: number): Pt {
    const t = k > 0 ? this.shape.slotT(k - 1, this.n) : this.shape.restT(this.n);
    if (life > 0) this.push = { t, age: 0, life };
    return this.shape.at(t);
  }

  /** A thumb on the middle (since is when it landed, breath.ts's clock), or null when it lifts. */
  setHold(since: number | null, inMs: number, outMs: number) {
    this.held = since === null ? null : { since, inMs, outMs };
  }

  /** The calm the held breath has brought (1 is none), for tests. */
  get calmNow() { return this.calm; }
  get speedNow() { return this.mult; }

  /** How fast a mote at t on this lane runs now, in drawing units a second, before the light and the breath. */
  unitsAt(lane: Lane, t: number, wall: number): number {
    let v = lane.v(t);
    if (this.push && lane.main) {
      const e = smooth(this.push.age / 0.15) * (1 - smooth((this.push.age - 0.15) / 0.85));
      v *= 1 + PUSH * e * smooth(1 - walkDistance(this.shape, t, this.push.t) / PUSH_REACH);
    }
    if (this.water.ticks) v *= tickAt(wall);
    return Math.min(FASTEST, v * BASE);
  }

  /** Moves the water on by dt seconds. wall is Date.now() (the breath's clock and the clock's ticks). */
  step(dt: number, wall: number) {
    const k = this.k;
    if (k <= 0) return;
    // the breath: gathering through the in, letting go and slowing through the out, calmer after each
    let target = this.calm, spread = 1;
    if (this.held) {
      const b = breathAt(wall - this.held.since, this.held.inMs, this.held.outMs);
      const want = Math.max(CALM_FLOOR, 1 - CALM_STEP * b.breaths);
      this.calm += (want - this.calm) * Math.min(1, dt * 0.5);
      target = this.calm * b.speed;
      spread = b.spread;
    } else this.calm = Math.min(1, this.calm + dt * 0.02);
    this.mult += (target - this.mult) * Math.min(1, dt * 4);
    this.gather += (spread - this.gather) * Math.min(1, dt * 4);
    if (this.dot !== null) {
      const d = this.shape.closed ? wrapSigned(this.dot - this.mask) : this.dot - this.mask;
      this.mask = this.mask + d * Math.min(1, dt * 5);
      if (this.shape.closed) this.mask = mod1(this.mask);
    }
    if (this.push) { this.push.age += dt / this.push.life; if (this.push.age >= 1) this.push = null; }
    const shown = shownAt(k);
    for (const lane of this.lanes) {
      for (const m of lane.motes) {
        m.t += (this.unitsAt(lane, m.t, wall) * this.mult * k * dt) / lane.len;
        if (m.t >= 1) {
          m.t -= Math.floor(m.t);
          // an open lane starts again at its faded start: a new place across the line is never seen to jump
          if (!lane.closed) m.off = this.rng() + this.rng() - 1;
        }
        // Still shows fewer: the higher ranks fade out, eased, wherever they are
        m.vis += ((m.rank < shown ? 1 : 0) - m.vis) * Math.min(1, dt * 2);
      }
    }
  }

  /** How bright water at walk place `where` is, for the dot: 1 ahead of it, BEHIND behind, AT_REST with no dot. */
  ahead(where: number): number {
    if (this.dot === null) return AT_REST;
    let b: number;
    if (this.shape.closed) {
      // on a ring, ahead runs from the dot round to rest (where the episode ends); the rest of the way is behind
      const s = mod1(where - this.mask), sd = s > 0.5 ? s - 1 : s, restD = mod1(this.shape.restT(this.n) - this.mask);
      b = smooth((sd + 0.02) / 0.04) * (1 - smooth((s - restD + 0.02) / 0.04));
    } else b = smooth((where - this.mask + 0.02) / 0.04);
    return lerp(BEHIND, 1, b);
  }

  /** Writes each mote as a line, x1 y1 x2 y2 and opacity, five numbers a mote in lane order. */
  draw(out: Float32Array, wall: number) {
    const k = this.k, light = 0.85 + 0.15 * Math.min(1, k), hang = this.water.hang ?? 0, lift = this.water.lift ?? 0;
    let o = 0;
    for (const lane of this.lanes) {
      for (const m of lane.motes) {
        const v = lane.v(m.t), units = this.unitsAt(lane, m.t, wall) * this.mult * Math.max(k, 0.0001);
        const e = 0.004;
        const a = lane.at(lane.closed ? mod1(m.t - e) : Math.max(0, m.t - e)), b = lane.at(lane.closed ? mod1(m.t + e) : Math.min(1, m.t + e));
        const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, tx = (b.x - a.x) / d, ty = (b.y - a.y) / d;
        const p = lane.at(m.t);
        const spread = lerp(SPREAD_POOL, SPREAD_JET, smooth((v - 0.3) / 1.6)) * this.gather * lane.narrow(m.t, m.off);
        let x = p.x - ty * m.off * spread, y = p.y + tx * m.off * spread;
        if (lane.main) y += hang * m.s * Math.min(1, 0.6 / v) - lift * m.s * smooth((v - 1.2) / 1.2);
        const L = Math.max(0.01, DASH_MAX * smooth((units - DOT_BELOW) / (FASTEST - DOT_BELOW)));
        out[o] = x - tx * L; out[o + 1] = y - ty * L; out[o + 2] = x; out[o + 3] = y;
        out[o + 4] = Math.min(1, lane.alpha * m.a) * lane.fade(m.t) * this.ahead(lane.main ? m.t : lane.from) * light * m.vis;
        o += 5;
      }
    }
  }
}
