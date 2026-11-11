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
//
// The water carries what it was given down the mountain (R2). Driven by feed(d, gates), a change does not land on every
// stretch at once: it travels down at TRAVEL units a second, as water does. Each stretch carries the spring as it was
// when that water left the snow, through every gate above as each was when the water passed it, so a gate closed sends
// the dark down the mountain stop by stop and a gate opened sends the water after it the same way. What a closed gate
// holds back pools above it (pooled, 0 to 1, filling over a few seconds); opened, the pool lets go as a surge, a bright
// front of the pooled water running down from the sign at the same pace, rekindling each sign as it reaches it. The
// meter lifted lets the held snow go the same way, from the spring. set(q, b) still sets the stretches directly (Still,
// where every stretch is the same, and the tests).
import { pass, pool, spring, stretch, POOL_UNITS } from '../../../model/mountain';
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
/** How fast a change travels down the mountain, in units a second: the course in about five and a half seconds. */
export const TRAVEL = 110;
/** The carried history: a slot every SLOT seconds, HIST of them (longer than the course takes). */
const SLOT = 1 / 30, HIST = 256;
/** How quickly a stretch takes what reaches it (per second): quick, so the front stays a front. */
const TAKE = 7;
/** How quickly a closed gate's pool fills, and the most surges running at once. */
const FILL = 0.45;
export const SURGES = 6;

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
  /** Real time, in seconds, for what the water carries down (feed()). */
  clock = 0;
  /** What each closed gate holds back, 0 to 1: fills while it is shut, lets go as a surge when it opens. */
  readonly pooled = new Float32Array(7);
  /** The surges running: where each began (distance along), when (clock), how much it carries (0 to 1). */
  readonly surgeFrom = new Float32Array(SURGES); readonly surgeAt = new Float32Array(SURGES); readonly surgeAmp = new Float32Array(SURGES);
  /** A sign a surge has just reached, for the plate to rekindle (the flag is cleared by whoever reads it). */
  readonly reached = new Uint8Array(7);
  // feed(): the meter and the gates as given now, and as they were (HIST slots of eight: d, then the seven gates)
  private carry = false; private inD = 0; private inB = new Float32Array(7);
  private hist = new Float32Array(HIST * 8); private slot = -1;
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

  /** What runs in each stretch (eight values) and each gate (seven), eased toward from now; `at once` jumps. Stops
   *  carrying (feed()). */
  set(q: readonly number[] | ArrayLike<number>, b: readonly number[] | ArrayLike<number>, atOnce = false) {
    this.carry = false;
    for (let i = 0; i < 8; i++) this.qTo[i] = q[i] ?? 1;
    for (let i = 0; i < 7; i++) this.bTo[i] = b[i] ?? 0;
    if (atOnce) { this.q.set(this.qTo); this.b.set(this.bTo); }
  }

  /** The meter and the gates, carried down the mountain from now (see the head of this file). The gates themselves
   *  answer at once (a sign empties under the finger); what runs below them follows as the water gets there. Opening a
   *  gate lets its pool go as a surge; lifting the meter lets the held snow go from the spring. `at once` (Reduce
   *  Motion, no loop running) puts the whole mountain as it is given, with no travel and no surge. */
  feed(d: number, gates: readonly number[] | ArrayLike<number>, atOnce = false) {
    const was = this.carry;
    this.carry = true;
    if (was && !atOnce) {
      // the melt: the meter lifted lets go what the snow was holding
      if (d < this.inD - 0.002) this.surge(0, (this.inD - d) * 1.3);
      for (let i = 0; i < 7; i++) {
        const b = gates[i] ?? 0, from = this.inB[i];
        if (b < from - 0.002 && this.pooled[i] > 0.01) {
          // the share of the pool this much opening lets go
          const let_ = this.pooled[i] * Math.min(1, (from - b) / Math.max(0.05, from));
          this.pooled[i] -= let_;
          this.surge(this.course.at[i + 1], let_ * 1.6);
        }
      }
    }
    this.inD = d;
    for (let i = 0; i < 7; i++) { this.inB[i] = gates[i] ?? 0; this.bTo[i] = this.inB[i]; }
    if (atOnce || !was) {
      this.fillHistory();
      this.carried(this.qTo);
      this.q.set(this.qTo); this.b.set(this.bTo);
      if (atOnce) { this.surgeAmp.fill(0); this.pending.fill(0); for (let i = 0; i < 7; i++) this.pooled[i] = this.inB[i] * this.qTo[i]; }
    }
  }

  /** A touch done on sign i (PLAN-TASKS.md section 5, T2): lets go `share` of what its gate holds back as one surge
   *  from the sign to the sea. The gate is not moved, so the pool fills again (step()). Returns what was let go, 0 when
   *  nothing was (an open gate, Still, the water not yet carried). */
  release(i: number, share: number): number {
    if (!this.carry || this.plain || i < 0 || i > 6) return 0;
    const out = this.pooled[i] * Math.max(0, Math.min(1, share));
    if (out < 0.01) return 0;
    this.pooled[i] -= out;
    this.surge(this.course.at[i + 1], out * 1.6);
    return out;
  }

  /** Starts a surge at s (or adds to one that has only just left from there). A slow opening lets go a little at a
   *  move: it is gathered (pending, per place) until it is enough to see, so a slow lift still sends its melt. */
  private surge(s: number, amp: number) {
    const at = s <= 0 ? 0 : this.course.at.indexOf(s);
    if (at >= 0) {
      if (this.clock - this.pendingAt[at] > 1.2) this.pending[at] = 0;
      this.pendingAt[at] = this.clock;
      this.pending[at] += amp;
      amp = this.pending[at];
    }
    if (this.start(s, amp) && at >= 0) this.pending[at] = 0;
  }
  private pending = new Float32Array(10); private pendingAt = new Float32Array(10).fill(-Infinity);
  /** Starts or adds to a surge; false if it was too little to start one. */
  private start(s: number, amp: number): boolean {
    let free = -1;
    for (let k = 0; k < SURGES; k++) {
      if (this.surgeAmp[k] > 0 && Math.abs(this.surgeFrom[k] - s) < 0.5 && this.clock - this.surgeAt[k] < 0.6) {
        this.surgeAmp[k] = Math.min(1, this.surgeAmp[k] + amp);
        return true;
      }
      if (free < 0 && this.surgeAmp[k] <= 0) free = k;
    }
    if (free < 0 || amp < 0.02) return false;
    this.surgeFrom[free] = s; this.surgeAt[free] = this.clock; this.surgeAmp[free] = Math.min(1, amp);
    return true;
  }

  /** Where surge k's front is now, along the course (meaningless when its amp is 0). */
  surgeHead(k: number): number { return this.surgeFrom[k] + TRAVEL * (this.clock - this.surgeAt[k]); }

  /** Every slot of the history as the inputs are now. */
  private fillHistory() {
    for (let k = 0; k < HIST; k++) this.writeSlot(k);
    this.slot = Math.floor(this.clock / SLOT);
  }
  private writeSlot(k: number) {
    const o = (((k % HIST) + HIST) % HIST) * 8;
    this.hist[o] = this.inD;
    for (let i = 0; i < 7; i++) this.hist[o + 1 + i] = this.inB[i];
  }
  /** Input n (0 the meter, 1 to 7 the gates) as it was ago seconds back (the oldest kept, past the history). */
  private was(n: number, ago: number): number {
    const back = Math.min(HIST - 1, Math.max(0, Math.round(ago / SLOT)));
    const k = this.slot - back;
    return this.hist[(((k % HIST) + HIST) % HIST) * 8 + n];
  }
  /** What reaches each stretch now: the spring as it was when the water there left the snow, times each gate above as
   *  it was when the water passed it (into out, eight values). */
  private carried(out: Float32Array) {
    const at = this.course.at;
    for (let j = 0; j < 8; j++) {
      let q = spring(this.was(0, at[j] / TRAVEL));
      for (let i = 0; i < j; i++) q *= pass(this.was(1 + i, (at[j] - at[i + 1]) / TRAVEL));
      out[j] = q;
    }
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
    // a surge runs: what it carries is fast and full
    if (this.carry && !this.plain) { const r = this.rush(s); pace *= 1 + 0.8 * r; wide *= 1 + 0.5 * r; }
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

  /** How much a surge is passing at s: the front itself and the pooled water behind it, 0 when there is none. */
  rush(s: number): number {
    let r = 0;
    for (let k = 0; k < SURGES; k++) {
      const amp = this.surgeAmp[k];
      if (amp <= 0) continue;
      const h = this.surgeHead(k), d = h - s;
      if (s < this.surgeFrom[k] - 4 || d < -6) continue;
      // brightest at the front, a long body of the let-go water behind it
      r += amp * (d < 0 ? Math.exp(-((d / 4) ** 2)) : Math.exp(-d / 46));
    }
    return Math.min(1.2, r);
  }

  /** The spring's own unevenness, travelling down: 0.6 to 1.2 at distance s and time t. */
  private pulse(s: number): number {
    const t = this.t;
    return 0.9 + 0.2 * Math.sin(s * 0.043 - t * 1.25) + 0.1 * Math.sin(s * 0.107 - t * 2.1 + 1.3);
  }

  step(dt: number) {
    const e = Math.min(1, dt * EASE);
    this.clock += dt;
    if (this.carry) {
      // the history moves on to now, and each stretch takes what has reached it
      const now = Math.floor(this.clock / SLOT);
      for (let k = Math.max(this.slot + 1, now - HIST + 1); k <= now; k++) this.writeSlot(k);
      this.slot = now;
      this.carried(this.qTo);
      const take = Math.min(1, dt * TAKE);
      for (let i = 0; i < 8; i++) this.q[i] += (this.qTo[i] - this.q[i]) * take;
      // the gates answer at once, a little eased; their pools fill with what they hold back
      const gb = Math.min(1, dt * TAKE * 1.5), fill = Math.min(1, dt * FILL);
      for (let i = 0; i < 7; i++) {
        this.b[i] += (this.bTo[i] - this.b[i]) * gb;
        const held = this.b[i] * this.q[i];
        if (held > this.pooled[i]) this.pooled[i] += (held - this.pooled[i]) * fill;
        else this.pooled[i] = held + (this.pooled[i] - held) * (1 - Math.min(1, dt * 3));
      }
      // the surges run down; each sign a front reaches is marked for the plate
      for (let k = 0; k < SURGES; k++) {
        if (this.surgeAmp[k] <= 0) continue;
        const h0 = this.surgeHead(k) - TRAVEL * dt, h1 = this.surgeHead(k);
        for (let i = 0; i < 7; i++) { const a = this.course.at[i + 1]; if (h0 < a && h1 >= a && a > this.surgeFrom[k] + 0.5) this.reached[i] = 1; }
        if (h1 > this.course.total + 40) this.surgeAmp[k] = 0;
      }
    } else {
      for (let i = 0; i < 8; i++) this.q[i] += (this.qTo[i] - this.q[i]) * e;
      for (let i = 0; i < 7; i++) this.b[i] += (this.bTo[i] - this.b[i]) * e;
    }
    const total = this.course.total, fade = Math.min(1, dt * 3), go = this.k * dt;
    this.t += go;
    this.stretches();
    for (let i = 0; i < this.n; i++) {
      this.flow(i, this.stretchOf(this.s[i]));
      this.s[i] += BASE * this.fPace * go;
      if (this.s[i] >= total) this.s[i] -= total;
      const s = this.s[i];
      const ends = Math.min(1, s / 14, (total - s) / 10);
      const rush = this.rush(s);
      const share = this.stShare[this.stretchOf(s)] * (this.plain ? 1 : this.pulse(s)) + rush;
      const shown = this.k > 0 && this.r[i] < share && s < this.reveal;
      const want = shown ? (0.3 + 0.6 * this.depth[i]) * ends * (1 + 0.9 * rush) : 0;
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
      // the water backed up above a closing gate gathers its light
      const near = j < 7 && !this.plain ? this.b[j] * (1 - Math.min(1, (c.at[j + 1] - s) / POOL_UNITS)) : 0;
      out[o + 4] = this.a[i] * glint * (1 + 0.9 * near);
      out[o + 5] = (2.4 + 4 * this.depth[i]) * (0.8 + 0.2 * glint);
      // the tint of the last sign passed, paling downstream; none above the crown, none in Still
      const past = j > 0 ? s - c.at[j] : Infinity;
      out[o + 6] = this.plain || j === 0 ? -1 : j - 1;
      out[o + 7] = Math.min(TINTS - 1, Math.floor((past / TINT_RUN) * TINTS));
    }
  }
}
