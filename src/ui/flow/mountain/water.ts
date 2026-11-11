// The mountain's water (PLAN-MOUNTAIN.md section 4 and pass 6, R1): about two hundred motes running the river's course
// (parts/cycle/river.ts), each a point of light with a short trail. Pure: no DOM, no canvas; ./plate.ts draws what
// draw() writes. The maths is model/mountain.ts's: per stretch the share of motes showing, their pace and the channel's
// width come from stretch(q); above a part-closed sign the water slows and spreads (pool). Every change of the water
// is eased toward what was set, so nothing flashes; the fastest water is slower than a finger (rule 30).
//
// Colour is an index, not a colour: a mote below a sign carries that sign's tint, strongest just under it and paling
// over TINT_RUN units downstream; the plate turns (stop, tint) into a colour read from the tokens.
import { pool, stretch, POOL_UNITS } from '../../../model/mountain';
import { COURSE, place, stretchAt, type Course, type Placed } from '../../parts/cycle/river';

/** How many motes run. */
export const MOTES = 200;
/** Units a second at pace 1 and --stream 1. */
export const BASE = 30;
/** How many steps a tint takes to pale, and over how many units. */
export const TINTS = 5;
export const TINT_RUN = 64;
/** How quickly the water eases to what was set (per second). */
const EASE = 2.2;

/** What draw() writes per mote: x1 y1 x2 y2 alpha width stop tint (stop -1: untinted). */
export const STRIDE = 8;

export class Water {
  readonly n: number;
  readonly s: Float32Array; readonly u: Float32Array; readonly r: Float32Array; readonly depth: Float32Array; readonly a: Float32Array;
  /** The water in each of the eight stretches now (eased) and where it is going. */
  readonly q = new Float32Array(8).fill(1); readonly qTo = new Float32Array(8).fill(1);
  /** Each gate now (eased) and where it is going. */
  readonly b = new Float32Array(7); readonly bTo = new Float32Array(7);
  /** --stream: how fast and how full (Day 1, Night .85, Still .4, Reduce Motion 0). */
  k = 1;
  /** The arrival: no mote shows past this distance along the course (Infinity once the water is let go). */
  reveal = Infinity;
  /** Still: no tints, no pools, every stretch the same (rule 13). */
  plain = false;
  private p: Placed = { x: 0, y: 0, tx: 0, ty: 1 };

  constructor(readonly course: Course = COURSE, n = MOTES, seed = 11) {
    this.n = n;
    let sd = seed;
    const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    this.s = new Float32Array(n); this.u = new Float32Array(n); this.r = new Float32Array(n); this.depth = new Float32Array(n); this.a = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.s[i] = rnd() * course.total; this.u[i] = rnd() + rnd() - 1; this.r[i] = rnd(); this.depth[i] = rnd();
    }
  }

  /** What runs in each stretch (eight values) and each gate (seven), eased toward from now; `at once` jumps. */
  set(q: readonly number[], b: readonly number[], atOnce = false) {
    for (let i = 0; i < 8; i++) this.qTo[i] = q[i] ?? 1;
    for (let i = 0; i < 7; i++) this.bTo[i] = b[i] ?? 0;
    if (atOnce) { this.q.set(this.qTo); this.b.set(this.bTo); }
  }

  /** Whether the water is still easing toward what was set. */
  get easing(): boolean {
    for (let i = 0; i < 8; i++) if (Math.abs(this.qTo[i] - this.q[i]) > 0.002) return true;
    for (let i = 0; i < 7; i++) if (Math.abs(this.bTo[i] - this.b[i]) > 0.002) return true;
    return false;
  }

  /** The pace and the width of the water at mote i, before the light scales it. */
  private flow(i: number, j: number): { pace: number; wide: number } {
    const c = this.course, s = this.s[i];
    let pace = stretch(this.plain ? 1 : this.q[j]).pace, wide = 4.5;
    if (j < 7 && !this.plain) {
      const above = c.at[j + 1] - s, b = this.b[j];
      pace *= pool(b, above);
      wide += 5 * b * (1 - Math.min(1, above / POOL_UNITS));
    }
    // past the river mouth the water fans into the sea and slows
    const out = Math.max(0, (s - c.mouth) / (c.total - c.mouth));
    return { pace: pace * (1 - 0.6 * out), wide: wide + 46 * out };
  }

  step(dt: number) {
    const e = Math.min(1, dt * EASE);
    for (let i = 0; i < 8; i++) this.q[i] += (this.qTo[i] - this.q[i]) * e;
    for (let i = 0; i < 7; i++) this.b[i] += (this.bTo[i] - this.b[i]) * e;
    const total = this.course.total, fade = Math.min(1, dt * 3);
    for (let i = 0; i < this.n; i++) {
      const j = stretchAt(this.s[i], this.course);
      const { pace } = this.flow(i, j);
      this.s[i] += BASE * pace * this.k * dt;
      if (this.s[i] >= total) this.s[i] -= total;
      const s = this.s[i], q = this.plain ? 1 : this.q[stretchAt(s, this.course)];
      const ends = Math.min(1, s / 14, (total - s) / 10);
      const shown = this.k > 0 && this.r[i] < stretch(q).share && s < this.reveal;
      const want = shown ? (0.35 + 0.55 * this.depth[i]) * ends : 0;
      this.a[i] += (want - this.a[i]) * fade;
    }
  }

  /** Writes each mote's line, alpha, width and tint into out (STRIDE floats a mote). */
  draw(out: Float32Array) {
    const c = this.course, p = this.p;
    for (let i = 0; i < this.n; i++) {
      const o = i * STRIDE, s = this.s[i], j = stretchAt(s, c);
      const { pace, wide } = this.flow(i, j);
      place(s, c, p);
      const v = BASE * pace * Math.max(this.k, 0.4);
      const ox = -p.ty * this.u[i] * wide, oy = p.tx * this.u[i] * wide, dash = Math.max(0.4, Math.min(7, v * 0.1)) * (s > c.mouth ? 0.25 : 1);
      out[o] = p.x + ox; out[o + 1] = p.y + oy;
      out[o + 2] = p.x + ox - p.tx * dash; out[o + 3] = p.y + oy - p.ty * dash;
      out[o + 4] = this.a[i];
      out[o + 5] = 0.9 + 1.5 * this.depth[i];
      // the tint of the last sign passed, paling downstream; none above the crown, none in Still
      const past = j > 0 ? s - c.at[j] : Infinity;
      out[o + 6] = this.plain || j === 0 ? -1 : j - 1;
      out[o + 7] = Math.min(TINTS - 1, Math.floor((past / TINT_RUN) * TINTS));
    }
  }
}
