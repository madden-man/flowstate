// The mountain's water (PLAN-MOUNTAIN.md section 4 and pass 6, R1): a couple of hundred motes of light running the
// river's course (parts/cycle/river.ts). Pure: no DOM, no canvas; ./plate.ts draws what draw() writes.
//
// The maths is model/mountain.ts's and it drives everything: per stretch the share of motes showing, their pace and
// the spread of the water come from stretch(q); above a part-closed sign the water slows and spreads (pool). On top of
// that the water is shaped by the place it runs through, the same on every day: it quickens down the steep and through
// the narrows and the fall under the Throat, slows and eddies at the bends, and slows and gathers in the tarn at the
// Heart and the pool at the Sacral. And it is water, not a conveyor: each mote has a pace of its own, a size and a
// brightness of its own, wanders across the channel so the motes braid, glints now and then, and the spring lets go
// in uneven surges that travel down. Every change of the water is eased toward what was set, so nothing flashes; the
// fastest water is slower than a finger (rule 30).
//
// Colour is an index, not a colour: a mote below a sign carries that sign's tint, strongest just under it and paling
// over TINT_RUN units downstream; the plate turns (stop, tint) into a colour read from the tokens.
import { pool, stretch, POOL_UNITS } from '../../../model/mountain';
import { COURSE, place, type Course, type Placed } from '../../parts/cycle/river';

/** How many motes run. */
export const MOTES = 260;
/** Units a second at pace 1 and --stream 1. */
export const BASE = 30;
/** How many steps a tint takes to pale, and over how many units. */
export const TINTS = 5;
export const TINT_RUN = 64;
/** How quickly the water eases to what was set (per second). */
const EASE = 2.2;

/** What draw() writes per mote: x1 y1 x2 y2 (the head, then the tail's end) alpha size stop tint (stop -1: untinted).
 *  alpha may pass 1 on a glint; size is the glow's radius in box units. */
export const STRIDE = 8;

/** The place's own shape along the course, one value a unit: how much faster or slower than the stretch's pace, how
 *  much wider or narrower, and how much it eddies. Built once from the course's geometry and the signs. */
type Shape = { speed: Float32Array; wide: Float32Array; eddy: Float32Array };

function shapeOf(c: Course): Shape {
  const n = Math.ceil(c.total) + 1;
  const speed = new Float32Array(n), wide = new Float32Array(n), eddy = new Float32Array(n);
  const p: Placed = { x: 0, y: 0, tx: 0, ty: 1 }, q: Placed = { x: 0, y: 0, tx: 0, ty: 1 };
  const bump = (s: number, at: number, before: number, after: number) => {
    const d = s - at;
    return d < 0 ? Math.exp(-((d / before) ** 2)) : Math.exp(-((d / after) ** 2));
  };
  for (let i = 0; i < n; i++) {
    place(i, c, p); place(Math.min(c.total, i + 6), c, q);
    // steep water runs, water across the slope ambles
    const steep = Math.max(0, p.ty);
    // the bend: how far the direction turns over six units
    const turn = Math.min(1, Math.abs(p.tx * q.ty - p.ty * q.tx) * 2.2);
    let sp = (0.62 + 0.62 * steep * steep) * (1 - 0.3 * turn), wd = 1 - 0.2 * steep + 0.35 * turn;
    // the narrows at the Throat and the fall under it: loud, quick and tight
    const narrows = bump(i, c.at[3], 14, 34);
    sp *= 1 + 0.9 * narrows; wd *= 1 - 0.45 * narrows;
    // the tarn at the Heart and the pool at the Sacral: the water rests and gathers
    const tarn = bump(i, c.at[4], 10, 16), pl = bump(i, c.at[6], 8, 12);
    sp *= 1 - 0.62 * tarn - 0.5 * pl; wd *= 1 + 1.4 * tarn + 0.9 * pl;
    speed[i] = sp; wide[i] = wd; eddy[i] = Math.min(1, turn * 1.4 + 0.8 * tarn + 0.6 * pl);
  }
  return { speed, wide, eddy };
}

export class Water {
  readonly n: number;
  /** Per mote: distance along, where across the channel it keeps to, its share threshold, its depth (size and
   *  brightness), its alpha now, its own pace, and the phases of its wander and its glint. */
  readonly s: Float32Array; readonly u: Float32Array; readonly r: Float32Array; readonly depth: Float32Array; readonly a: Float32Array;
  private sp: Float32Array; private ph: Float32Array; private fq: Float32Array; private gl: Float32Array;
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
  /** The water's own clock, in seconds of running (stands still at --stream 0). */
  t = 0;
  private shape: Shape;
  private p: Placed = { x: 0, y: 0, tx: 0, ty: 1 };
  // what flow() leaves for its caller (no object a mote a frame)
  private fPace = 0; private fWide = 0;
  // stretch(q) for each of the eight stretches, taken once a frame (model/mountain.ts)
  private stPace = new Float32Array(8); private stWidth = new Float32Array(8); private stShare = new Float32Array(8);

  constructor(readonly course: Course = COURSE, n = MOTES, seed = 11) {
    this.n = n;
    let sd = seed;
    const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    this.s = new Float32Array(n); this.u = new Float32Array(n); this.r = new Float32Array(n); this.depth = new Float32Array(n); this.a = new Float32Array(n);
    this.sp = new Float32Array(n); this.ph = new Float32Array(n); this.fq = new Float32Array(n); this.gl = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.s[i] = rnd() * course.total;
      this.u[i] = (rnd() + rnd() + rnd()) / 1.5 - 1;
      this.r[i] = rnd();
      // most motes are small and faint, a few are large and bright
      this.depth[i] = Math.pow(rnd(), 2.2);
      this.sp[i] = 0.62 + 0.8 * rnd();
      this.ph[i] = rnd() * Math.PI * 2; this.fq[i] = 0.4 + 1.1 * rnd(); this.gl[i] = rnd() * 40;
    }
    this.shape = shapeOf(course);
  }

  /** What runs in each stretch (eight values) and each gate (seven), eased toward from now; `at once` jumps. */
  set(q: readonly number[] | ArrayLike<number>, b: readonly number[] | ArrayLike<number>, atOnce = false) {
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

  /** The stretch at s: how many signs the water has passed (river.ts stretchAt, without the call). */
  private stretchOf(s: number): number {
    const at = this.course.at;
    let j = 0;
    while (j < 7 && s >= at[j + 1]) j++;
    return j;
  }

  /** The pace and the half-width of the water at mote i in stretch j, before the light scales it (into fPace, fWide). */
  private flow(i: number, j: number) {
    const c = this.course, s = this.s[i], u = Math.min(this.shape.speed.length - 1, Math.max(0, s | 0));
    let pace = this.stPace[j] * this.shape.speed[u] * this.sp[i];
    // the spread follows the channel's width (1 to 3.5 px a stretch carries), shaped by the place
    let wide = (1.4 + 1.45 * this.stWidth[j]) * this.shape.wide[u];
    if (j < 7 && !this.plain) {
      const above = c.at[j + 1] - s, b = this.b[j];
      pace *= pool(b, above);
      wide += 5 * b * (1 - Math.min(1, above / POOL_UNITS));
    }
    // past the river mouth the water fans into the sea and slows
    const out = Math.max(0, (s - c.mouth) / (c.total - c.mouth));
    this.fPace = pace * (1 - 0.6 * out); this.fWide = wide + 46 * out;
  }

  /** Takes stretch(q) for every stretch, once. */
  private stretches() {
    for (let j = 0; j < 8; j++) {
      const st = stretch(this.plain ? 1 : this.q[j]);
      this.stPace[j] = st.pace; this.stWidth[j] = st.width; this.stShare[j] = st.share;
    }
  }

  /** The surges the spring lets go, travelling down: 0.6 to 1.2 at distance s and time t. */
  private surge(s: number): number {
    const t = this.t;
    return 0.9 + 0.2 * Math.sin(s * 0.043 - t * 1.25) + 0.1 * Math.sin(s * 0.107 - t * 2.1 + 1.3);
  }

  step(dt: number) {
    const e = Math.min(1, dt * EASE);
    for (let i = 0; i < 8; i++) this.q[i] += (this.qTo[i] - this.q[i]) * e;
    for (let i = 0; i < 7; i++) this.b[i] += (this.bTo[i] - this.b[i]) * e;
    const total = this.course.total, fade = Math.min(1, dt * 3), go = this.k * dt;
    this.t += go;
    this.stretches();
    for (let i = 0; i < this.n; i++) {
      this.flow(i, this.stretchOf(this.s[i]));
      this.s[i] += BASE * this.fPace * go;
      if (this.s[i] >= total) this.s[i] -= total;
      const s = this.s[i];
      const ends = Math.min(1, s / 14, (total - s) / 10);
      const share = this.stShare[this.stretchOf(s)] * (this.plain ? 1 : this.surge(s));
      const shown = this.k > 0 && this.r[i] < share && s < this.reveal;
      const want = shown ? (0.3 + 0.6 * this.depth[i]) * ends : 0;
      this.a[i] += (want - this.a[i]) * fade;
    }
  }

  /** Writes each mote's head and tail, alpha, size and tint into out (STRIDE floats a mote). */
  draw(out: Float32Array) {
    const c = this.course, p = this.p, t = this.t, eddy = this.shape.eddy;
    this.stretches();
    for (let i = 0; i < this.n; i++) {
      const o = i * STRIDE, s = this.s[i], j = this.stretchOf(s);
      this.flow(i, j);
      const pace = this.fPace, wide = this.fWide;
      place(s, c, p);
      // across the channel: its own line, wandering over it so the motes braid, turning over itself at a bend
      const ph = this.ph[i], u = Math.min(c.total, Math.max(0, s | 0));
      const ed = eddy[Math.min(eddy.length - 1, u)];
      const lat = (0.72 * this.u[i] + 0.34 * Math.sin(t * this.fq[i] + ph + s * 0.06)) * wide;
      const swirl = ed * 2.4 * Math.sin(t * 2.3 + ph * 3);
      const along = ed * 1.6 * Math.cos(t * 2.3 + ph * 3);
      const x = p.x - p.ty * (lat + swirl) + p.tx * along, y = p.y + p.tx * (lat + swirl) + p.ty * along;
      // the tail: as long as it runs fast, a bead where it rests
      const v = BASE * pace * Math.max(this.k, 0.4);
      const tail = Math.max(0.2, Math.min(5.5, v * 0.075)) * (s > c.mouth ? 0.3 : 1);
      out[o] = x; out[o + 1] = y;
      out[o + 2] = x - p.tx * tail; out[o + 3] = y - p.ty * tail;
      // now and then a mote catches and glints
      const g = Math.sin(t * 1.7 + this.gl[i]);
      const glint = this.plain ? 1 : 1 + 1.6 * Math.pow(Math.max(0, g), 24);
      out[o + 4] = this.a[i] * glint;
      out[o + 5] = (2.4 + 4 * this.depth[i]) * (0.8 + 0.2 * glint);
      // the tint of the last sign passed, paling downstream; none above the crown, none in Still
      const past = j > 0 ? s - c.at[j] : Infinity;
      out[o + 6] = this.plain || j === 0 ? -1 : j - 1;
      out[o + 7] = Math.min(TINTS - 1, Math.floor((past / TINT_RUN) * TINTS));
    }
  }
}
