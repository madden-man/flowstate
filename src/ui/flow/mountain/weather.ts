// Places with weather of their own (PLAN-MOUNTAIN.md pass 6, R1): each is the stream's own light doing something where
// it is, and each is as strong as the water that reaches it, so none is decoration that stands for nothing.
//   the summit       spindrift: fine snow torn off the cornice, blowing out downwind in a drifting plume, as much
//                    as the snow is letting go
//   the Throat       spray where the narrows fall
//   the Heart        the tarn holding the lantern's still reflection
//   the Solar plexus embers on the shadow flank, rising
//   the Sacral       slow rings going out on the pool
//   the Root         fireflies of the stream's light in the firs
//   the mouth        phosphorescence where the river fans into the sea
// And the mountain's weather, which the Depression meter sets (R2, capOf): the snowline comes down the horn, the snow
// it holds glows brighter the more it holds back (a heavy day is a dark mountain with a bright cap), slow snow fills the
// air, and bands of mist gather over the stars and come down round the horn, lit from under by the held snow. A clear
// day is a small sharp cap under a sky full of stars. Each is the meter's: none moves on its own account.
//   what turns back  at a closing gate, the water it does not let through sinks into the rock as embers in the sign's
//                    hue, as many as it holds back (R2)
//
// Pure but for the draws: drawAir() paints the things that stand in front of the land (the snow, the mist, the veil
// over the stars) on the plate's air canvas, in its ordinary blending; draw() paints the light, additively. Both are on
// a 2D context already in the box's units (the plate sets that up).

import { rgb, mix, type Palette, type RGB } from './palette';
import { snowCap } from './land';
import { COURSE, PEAK, place, type Placed } from '../../parts/cycle/river';
import { POOL_UNITS } from '../../../model/mountain';

/** The mountain's weather (R2 moves these with the meter). snowline in box units; flakes, cloud and held 0 to 1. */
export type CapWeather = { snowline: number; flakes: number; cloud: number; held: number };

const unit = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
const smooth = (x: number) => { const c = unit(x); return c * c * (3 - 2 * c); };

/** Where the snow ends on a clear day and on the heaviest, in box units: just under the Crown, and just over the Heart. */
export const SNOW_CLEAR = 86, SNOW_HEAVY = 212;

/** The weather the meter d sets: the snowline comes down the horn, the snow holds more back (held), slow snow starts
 *  past a quarter, and the mist gathers from the first touch of it. */
export function capOf(d: number): CapWeather {
  const v = unit(d);
  return { snowline: SNOW_CLEAR + (SNOW_HEAVY - SNOW_CLEAR) * Math.pow(v, 1.1), flakes: smooth((v - 0.22) / 0.78), cloud: smooth((v - 0.06) / 0.94), held: v };
}

/** A band of mist (box units): its centre, length and thickness; where it lies high on a light day (hi) and low round
 *  the horn on the heaviest (lo); the cloud it needs before it shows (th); its drift. */
type Band = { x: number; w: number; h: number; hi: number; lo: number; th: number; sp: number; ph: number; behind: boolean; puffs: Float32Array };
/** Puffs a band, and what each holds: x, y (from the band's centre), width, height. The first LOW are the band's
 *  body, long and low; the rest are the rounder heads that heap up on it. */
const PUFFS = 12, LOW = 7;
const BANDS: Omit<Band, 'puffs'>[] = [
  // behind the horn first: the mist gathers in the sky and behind the peak before it comes round in front
  { x: 150, w: 300, h: 16, hi: 6, lo: 60, th: 0, sp: 0.9, ph: 0, behind: true },
  { x: 214, w: 220, h: 13, hi: 30, lo: 104, th: 0.12, sp: -0.6, ph: 1.7, behind: true },
  { x: 90, w: 220, h: 15, hi: -8, lo: 132, th: 0.24, sp: 0.5, ph: 3.1, behind: true },
  { x: 196, w: 260, h: 15, hi: 40, lo: 160, th: 0.4, sp: -0.4, ph: 4.2, behind: false },
  { x: 120, w: 210, h: 11, hi: 20, lo: 88, th: 0.55, sp: 0.7, ph: 5.3, behind: false },
  { x: 170, w: 320, h: 18, hi: -16, lo: 192, th: 0.72, sp: -0.3, ph: 2.4, behind: false },
];
/** The settle after the meter last rose (seconds), and how often the drifting mist is painted again (seconds). */
const SETTLE = 1.6, DRIFT_EVERY = 0.5;
/** How far a band rides on the air, in box units. */
const DRIFT = 10;

/** The snow's paths for a line, kept (a drag through the meter makes each whole unit's once). */
const CAPS = new Map<number, { lit: Path2D; shade: Path2D; rim: Path2D; all: Path2D }>();
export function capPaths(line: number) {
  const k = Math.round(line);
  let c = CAPS.get(k);
  if (!c) {
    const p = snowCap(k);
    const all = new Path2D(p.lit);
    all.addPath(new Path2D(p.shade));
    c = { lit: new Path2D(p.lit), shade: new Path2D(p.shade), rim: new Path2D(p.rim), all };
    CAPS.set(k, c);
  }
  return c;
}

type Mote = { x: number; y: number; vx: number; vy: number; life: number; age: number; seed: number; k: number };

const TAU = Math.PI * 2;

class Drift {
  readonly ps: Mote[] = [];
  private due = 0;
  constructor(private max: number, private spawn: (m: Mote, r: () => number) => void, private r: () => number) {}
  /** n births now (a fraction is kept for the next), each then changed by then. */
  add(n: number, then: (m: Mote, r: () => number) => void) {
    this.due += n;
    while (this.due >= 1) {
      this.due -= 1;
      const m = this.born();
      if (!m) break;
      then(m, this.r);
    }
  }
  private born(): Mote | undefined {
    let m: Mote | undefined;
    for (const p of this.ps) if (p.age >= p.life) { m = p; break; }
    if (!m) { if (this.ps.length >= this.max) return undefined; m = { x: 0, y: 0, vx: 0, vy: 0, life: 1, age: 0, seed: 0, k: 0 }; this.ps.push(m); }
    m.age = 0; m.seed = this.r();
    this.spawn(m, this.r);
    return m;
  }
  /** rate: births a second; gravity in units/s². */
  step(dt: number, rate: number, gravity = 0, wind = 0) {
    this.due += rate * dt;
    while (this.due >= 1) {
      this.due -= 1;
      if (!this.born()) break;
    }
    for (const p of this.ps) {
      if (p.age >= p.life) continue;
      p.age += dt; p.vy += gravity * dt; p.vx += wind * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }
}

export class Weather {
  /** The weather as drawn now (eased), and as it was last set. */
  cap: CapWeather; capTo: CapWeather;
  private t = 0;
  private sd = 23;
  private r = () => { this.sd = (this.sd * 16807) % 2147483647; return this.sd / 2147483647; };
  private spindrift: Drift; private spray: Drift; private embers: Drift; private sparks: Drift; private flakes: Drift;
  private flies: { x: number; y: number; ph: number; per: number; ax: number; ay: number }[] = [];
  private rings: { age: number }[] = [];
  private ringDue = 0;
  private pal: Palette | null = null;
  private st!: { glow: string; line: string; tarn: string; ember: string; pool: string; fly: string; spray: string[]; hues: string[]; mist: string; snowLit: string; snowShade: string };
  private cloud: HTMLCanvasElement | null = null;
  private veil: HTMLCanvasElement | null = null;
  private under: HTMLCanvasElement | null = null;
  private flake: HTMLCanvasElement | null = null;
  private bands: Band[];
  private turned: Drift;
  private turnedDue = new Float32Array(7);
  private gust = 0;
  /** Seconds of settling left after the meter last rose: the snow thins out over them, then stops. */
  private settle = 0;
  /** When the air was last painted for the mist's drift (it moves under a pixel a second, so twice a second does). */
  private drifted = 0;
  private p: Placed = { x: 0, y: 0, tx: 0, ty: 1 };
  /** Whether the air needs painting again (the snow or the mist moved, or the light changed). */
  airDirty = true;
  /** Everything but the horn (a clip, evenodd), so a band can lie behind the peak; set by the plate from the land. */
  behind: Path2D | null = null;

  constructor(snowline: number) {
    this.cap = { snowline, flakes: 0, cloud: 0, held: 0 };
    this.capTo = { ...this.cap };
    // each band is a few long puffs, uneven at the ends, each with its own place along it and its own size
    this.bands = BANDS.map(b => {
      const puffs = new Float32Array(PUFFS * 4);
      for (let k = 0; k < PUFFS; k++) {
        const low = k < LOW, n = low ? LOW : PUFFS - LOW, j = low ? k : k - LOW;
        const along = (j / (n - 1) - 0.5) * b.w * (low ? 0.8 : 0.5) + (this.r() - 0.5) * b.w * 0.1;
        // the middle of a band is the thickest of it, its ends trail off
        const mid = Math.max(0.2, 1 - Math.abs(along) / (b.w * 0.5));
        const h = b.h * (low ? 1.1 + 0.6 * mid : 0.8 + 0.9 * mid * this.r());
        puffs.set([along, low ? (this.r() - 0.5) * b.h * 0.2 : -b.h * (0.35 + 0.25 * this.r()) * mid, h * (low ? 2.6 : 1.5 + 0.4 * this.r()), h], k * 4);
      }
      return { ...b, puffs };
    });
    // what a closing gate turns back: embers sinking into the rock beside its pool, in the sign's hue
    this.turned = new Drift(70, (m, r) => {
      // which gate: the one holding back the most, by lot
      let sum = 0;
      for (let i = 0; i < 7; i++) sum += this.turnedDue[i];
      let pick = r() * sum, i = 0;
      while (i < 6 && pick > this.turnedDue[i]) { pick -= this.turnedDue[i]; i++; }
      place(COURSE.at[i + 1] - 3 - r() * (POOL_UNITS - 6), COURSE, this.p);
      const side = r() < 0.5 ? -1 : 1, off = 2 + r() * 6;
      m.k = i;
      m.x = this.p.x - this.p.ty * off * side; m.y = this.p.y + this.p.tx * off * side;
      m.vx = -this.p.ty * side * (1.5 + r() * 3); m.vy = 2.5 + r() * 4;
      m.life = 1.4 + r() * 2;
    }, this.r);
    this.spindrift = new Drift(90, (m, r) => { m.x = 166 + r() * 20; m.y = 43 + r() * 12; m.vx = 10 + r() * 22; m.vy = -6 + r() * 7; m.life = 2 + r() * 2.6; }, this.r);
    this.spray = new Drift(30, (m, r) => { m.x = 172 + r() * 16; m.y = 175 + r() * 4; m.vx = (r() - 0.5) * 22; m.vy = -10 - r() * 16; m.life = 0.6 + r() * 0.8; }, this.r);
    this.embers = new Drift(18, (m, r) => { m.x = 206 + r() * 30; m.y = 270 + r() * 26; m.vx = (r() - 0.5) * 3; m.vy = -4 - r() * 7; m.life = 2.2 + r() * 2.6; }, this.r);
    this.sparks = new Drift(26, (m, r) => {
      const a = (r() - 0.5) * Math.PI * 0.9, d = 6 + r() * 70;
      m.x = 164 + Math.sin(a) * d; m.y = 402 + Math.abs(Math.cos(a)) * d * 0.4 + r() * 6; m.vx = (r() - 0.5) * 2; m.vy = 0; m.life = 0.7 + r() * 1.4;
    }, this.r);
    // slow snow in the air: it comes into the light anywhere over the plate, drifts down and goes out again
    // snow let go by the meter rising: it comes into the light over the horn and the sky, slanting down on a slow wind,
    // and is gone in a few seconds (plan pass 6: flakes fall while it rises; rule 31: then the air is still)
    this.flakes = new Drift(170, (m, r) => { m.x = -30 + r() * 340; m.y = -40 + r() * 300; m.vx = 4 + r() * 4; m.vy = 9 + r() * 8; m.life = 3.5 + r() * 2.5; }, this.r);
    // fireflies keep to the firs: the clump round the root, and the treelines either side of the river
    const zones: [number, number, number, number][] = [[168, 194, 360, 380], [206, 240, 362, 382], [148, 168, 372, 388], [40, 130, 378, 392], [198, 300, 380, 392]];
    for (let k = 0; k < 16; k++) {
      const z = zones[k % zones.length];
      this.flies.push({ x: z[0] + this.r() * (z[1] - z[0]), y: z[2] + this.r() * (z[3] - z[2]), ph: this.r() * TAU, per: 3 + this.r() * 4, ax: 2 + this.r() * 4, ay: 1 + this.r() * 2 });
    }
  }

  /** The weather to ease toward (or to take at once: Reduce Motion, no loop). A meter rising throws snow. */
  set(w: Partial<CapWeather>, atOnce = false) {
    const was = this.capTo.held;
    this.capTo = { ...this.capTo, ...w };
    // only a rise he is making throws snow: a day put at once (opening the tab, Reduce Motion) is already settled
    if (!atOnce && this.capTo.held > was + 0.002) {
      this.gust = Math.min(40, this.gust + (this.capTo.held - was) * 90);
      this.settle = SETTLE;
    }
    if (atOnce) this.cap = { ...this.capTo };
    this.airDirty = true;
  }

  /** q: the water in the eight stretches now; b: the gates now. */
  step(dt: number, q: ArrayLike<number>, k: number, b?: ArrayLike<number>) {
    this.t += dt;
    const go = k > 0 ? dt : 0;
    // the weather follows the meter closely, so it answers under the finger without a snap
    const e = Math.min(1, dt * 6), c = this.cap, to = this.capTo;
    const moved = Math.abs(to.snowline - c.snowline) > 0.05 || Math.abs(to.cloud - c.cloud) > 0.002 || Math.abs(to.held - c.held) > 0.002;
    if (moved) {
      c.snowline += (to.snowline - c.snowline) * e; c.cloud += (to.cloud - c.cloud) * e;
      c.flakes += (to.flakes - c.flakes) * e; c.held += (to.held - c.held) * e;
      this.airDirty = true;
    }
    // the mist drifts, so while there is any the air is painted every frame
    if (c.cloud > 0.01 && go > 0 && this.t - this.drifted > DRIFT_EVERY) this.airDirty = true;
    // what each closing gate turns back: the water above it less what it lets through
    let turning = 0;
    for (let i = 0; i < 7; i++) { const v = b ? b[i] * q[i] * 0.85 : 0; this.turnedDue[i] = v; turning += v; }
    this.turned.step(go, 26 * Math.min(1.5, turning), 0.6, 0);
    this.spindrift.step(go, 26 * (0.3 + 0.7 * q[0]), -1.5, 7);
    // the gusts turn the plume over itself as it goes
    for (const p of this.spindrift.ps) if (p.age < p.life) { p.vy += Math.sin(p.age * 2.6 + p.seed * 31) * 9 * go; p.vx += Math.cos(p.age * 1.9 + p.seed * 17) * 4 * go; }
    this.spray.step(go, 26 * q[3] * q[3], 34);
    this.embers.step(go, 3.2 * q[5]);
    this.sparks.step(go, 16 * q[7]);
    // snow only while the meter rises, thinning over a short settle after it stops
    this.settle = Math.max(0, this.settle - go);
    this.flakes.step(go, 34 * (this.settle / SETTLE) * (0.35 + 0.65 * this.cap.held), 0, 0);
    // a meter rising throws a flurry
    if (this.gust > 0 && go > 0) { const n = Math.min(this.gust, 360 * go); this.flakes.add(n, this.high); this.gust -= n; }
    // slow rings on the sacral's pool: one every few seconds, more often the more water comes
    this.ringDue += go * (0.2 + 0.25 * q[6]);
    if (this.ringDue >= 1) { this.ringDue -= 1; this.rings.push({ age: 0 }); }
    for (const r of this.rings) r.age += go;
    while (this.rings.length && this.rings[0].age > 6) this.rings.shift();
  }

  /** A flurry's flake: it comes in high, round the summit, and is gone sooner. */
  private high = (m: Mote, r: () => number) => { m.y = -30 + r() * 150; m.x = 20 + r() * 260; m.life = 3.5 + r() * 2.5; };

  /** The colours each place draws in, made once a palette (no string a particle a frame). */
  private styles(pal: Palette) {
    if (this.pal === pal) return this.st;
    this.pal = pal;
    const glow = pal.glow, hue = pal.hues, c = (x: RGB) => rgb(x);
    this.st = {
      glow: c(glow), line: c(pal.line), tarn: c(mix(hue[3], glow, 0.25)), ember: c(mix(hue[4], glow, 0.15)),
      pool: c(mix(hue[5], glow, 0.3)), fly: c(mix(hue[6], glow, 0.6)),
      spray: [0, 0.25, 0.5, 0.75, 1].map(t => c(mix(hue[2], glow, 0.55 + 0.45 * t))),
      hues: hue.map(h => c(mix(h, glow, 0.25))),
      mist: c(mix(pal.plate, pal.line, 0.13)),
      snowLit: c(mix(pal.plate, pal.line, 0.34)), snowShade: c(mix(pal.deep, pal.line, 0.13)),
    };
    // a band's puff: a long soft ellipse of mist, drawn once
    const m = document.createElement('canvas');
    m.width = 64; m.height = 64;
    const mg = m.getContext('2d')!;
    mg.setTransform(2, 0, 0, 2, 0, 0);
    const mgr = mg.createRadialGradient(16, 16, 0, 16, 16, 16);
    const mc = mix(pal.plate, pal.line, 0.13);
    mgr.addColorStop(0, rgb(mc, 1)); mgr.addColorStop(0.5, rgb(mc, 0.9)); mgr.addColorStop(0.8, rgb(mc, 0.35)); mgr.addColorStop(1, rgb(mc, 0));
    mg.fillStyle = mgr; mg.fillRect(0, 0, 32, 32);
    this.cloud = m;
    // the veil the mist draws over the stars: the mist's colour, thinning downward
    const v = document.createElement('canvas');
    v.width = 1; v.height = 64;
    const vg = v.getContext('2d')!, vgr = vg.createLinearGradient(0, 0, 0, 64);
    vgr.addColorStop(0, rgb(mc, 1)); vgr.addColorStop(0.6, rgb(mc, 0.7)); vgr.addColorStop(1, rgb(mc, 0));
    vg.fillStyle = vgr; vg.fillRect(0, 0, 1, 64);
    this.veil = v;
    // the held snow's light on a band's underside: warm, soft, wide
    const u = document.createElement('canvas');
    u.width = 64; u.height = 64;
    const ug = u.getContext('2d')!;
    ug.setTransform(2, 0, 0, 2, 0, 0);
    const ugr = ug.createRadialGradient(16, 16, 0, 16, 16, 16);
    ugr.addColorStop(0, rgb(glow, 1)); ugr.addColorStop(0.5, rgb(glow, 0.3)); ugr.addColorStop(1, rgb(glow, 0));
    ug.fillStyle = ugr; ug.fillRect(0, 0, 32, 32);
    this.under = u;
    // a flake: soft, so it is never taken for a star
    const f = document.createElement('canvas');
    f.width = f.height = 16;
    const fg = f.getContext('2d')!, fgr = fg.createRadialGradient(8, 8, 0, 8, 8, 8);
    fgr.addColorStop(0, rgb(pal.line, 1)); fgr.addColorStop(0.35, rgb(pal.line, 0.6)); fgr.addColorStop(1, rgb(pal.line, 0));
    fg.fillStyle = fgr; fg.fillRect(0, 0, 16, 16);
    this.flake = f;
    return this.st;
  }

  draw(g: CanvasRenderingContext2D, pal: Palette, q: ArrayLike<number>, b: ArrayLike<number>, reveal: (y: number) => number) {
    const st = this.styles(pal);
    const life = (p: Mote) => { const f = p.age / p.life; return f >= 1 ? 0 : Math.sin(Math.PI * f); };

    // spindrift: fine snow-light blowing off the cornice, drifting and turning, thinning as it goes
    g.fillStyle = st.glow;
    for (const p of this.spindrift.ps) {
      const a = life(p) * 0.5 * (0.3 + 0.7 * q[0]) * reveal(p.y) * (1 - p.age / p.life);
      if (a < 0.01) continue;
      const z = 0.35 + p.seed * 0.55;
      g.globalAlpha = a;
      g.fillRect(p.x - z / 2, p.y - z / 2, z, z);
    }
    // the snow the meter lets fall (R2): each flake a soft point with a short slanting trail the way the wind takes it,
    // each its own size (the near ones larger and fainter), so a still frame reads falling snow, never stars
    g.strokeStyle = st.line; g.lineCap = 'round';
    if (this.flake) for (const p of this.flakes.ps) {
      const a = life(p) * (0.6 - 0.28 * p.seed);
      if (a < 0.01) continue;
      const z = 1.3 + 2.6 * p.seed * p.seed, x = p.x + Math.sin(this.t * 0.9 + p.seed * 9) * 1.6, tl = 0.07 + 0.05 * p.seed;
      g.globalAlpha = a * 0.45;
      g.lineWidth = z * 0.45;
      g.beginPath(); g.moveTo(x, p.y); g.lineTo(x - p.vx * tl, p.y - p.vy * tl); g.stroke();
      g.globalAlpha = a;
      g.drawImage(this.flake, x - z / 2, p.y - z / 2, z, z);
    }
    // what the closing gates turn back, sinking into the rock as embers
    for (const p of this.turned.ps) {
      const f = p.age / p.life;
      if (f >= 1) continue;
      const a = (1 - f) * Math.min(1, f * 6) * (0.55 + 0.45 * Math.sin(this.t * 11 + p.seed * 50));
      if (a < 0.02) continue;
      g.fillStyle = st.hues[p.k];
      g.globalAlpha = a * 0.9;
      g.beginPath(); g.arc(p.x, p.y, 0.45 + 0.45 * (1 - f) + p.seed * 0.3, 0, TAU); g.fill();
    }
    // spray at the throat's fall, tinted by the throat's lantern
    g.fillStyle = st.spray[Math.min(4, Math.round(b[2] * 4))];
    for (const p of this.spray.ps) {
      const a = life(p) * 0.55 * q[3] * reveal(p.y);
      if (a < 0.01) continue;
      g.globalAlpha = a;
      g.beginPath(); g.arc(p.x, p.y, 0.5 + p.seed * 0.7, 0, TAU); g.fill();
    }
    // the heart's tarn: the lantern's reflection, held still, barely breathing
    const hl = (1 - b[3]) * q[3] * reveal(233);
    if (hl > 0.01) {
      g.strokeStyle = st.tarn; g.lineWidth = 0.8;
      for (let k = 0; k < 6; k++) {
        const y = 230.5 + k * 1.5, w = 11 - k * 1.4 + Math.sin(this.t * 0.6 + k * 1.7) * 1.2;
        g.globalAlpha = hl * (0.5 - k * 0.07);
        g.beginPath(); g.moveTo(113 - w, y); g.lineTo(113 + w, y); g.stroke();
      }
    }
    // embers on the solar plexus's shadow flank: a fire kept, rising and going out
    g.fillStyle = st.ember;
    for (const p of this.embers.ps) {
      const flick = 0.6 + 0.4 * Math.sin(this.t * 9 + p.seed * 40);
      const a = life(p) * 0.75 * flick * q[5] * (1 - 0.7 * b[4]) * reveal(p.y);
      if (a < 0.01) continue;
      g.globalAlpha = a;
      g.beginPath(); g.arc(p.x + Math.sin(p.age * 2 + p.seed * 7) * 1.5, p.y, 0.55 + p.seed * 0.5, 0, TAU); g.fill();
    }
    // slow rings on the sacral's pool
    const pl = q[6] * (1 - 0.6 * b[5]) * reveal(327);
    g.strokeStyle = st.pool; g.lineWidth = 0.7;
    for (const r of this.rings) {
      const f = r.age / 6, rx = 2 + 13 * f, a = (1 - f) * 0.5 * pl;
      if (a < 0.01) continue;
      g.globalAlpha = a;
      g.beginPath(); g.ellipse(148, 327, rx, rx * 0.3, 0, 0, TAU); g.stroke();
    }
    // fireflies of the stream's light in the root's firs
    const ff = q[7] * (1 - 0.5 * b[6]);
    g.fillStyle = st.fly;
    for (const f of this.flies) {
      const ph = (this.t / f.per + f.ph) % 1, on = ph < 0.35 ? Math.sin((ph / 0.35) * Math.PI) : 0;
      const a = on * 0.9 * ff * reveal(f.y);
      if (a < 0.01) continue;
      const x = f.x + Math.sin(this.t * 0.4 + f.ph) * f.ax, y = f.y + Math.cos(this.t * 0.3 + f.ph * 2) * f.ay;
      g.globalAlpha = a * 0.25;
      g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill();
      g.globalAlpha = a;
      g.beginPath(); g.arc(x, y, 0.8, 0, TAU); g.fill();
    }
    // phosphorescence where the river fans into the sea
    g.fillStyle = st.glow;
    for (const p of this.sparks.ps) {
      const a = life(p) * 0.8 * q[7] * reveal(p.y);
      if (a < 0.01) continue;
      g.globalAlpha = a;
      g.fillRect(p.x - 0.6, p.y - 0.25, 1.2 + p.seed * 1.4, 0.5);
    }
    // the mist lit from under where it passes over the light on the horn (the held snow, the water's first run): each
    // low puff's belly, as bright as the light under it, so a bank has a top in shadow and an underside that glows
    if (this.cap.cloud > 0.01 && this.under) {
      const src = PEAK.y + (this.cap.snowline - PEAK.y) * 0.45, lightUp = 0.12 + 0.4 * this.cap.held + 0.2 * q[0];
      for (const b of this.bands) {
        const a = this.bandOn(b);
        if (a < 0.01) continue;
        const x = this.bandX(b), y = this.bandY(b), P = b.puffs;
        for (let k = 0; k < LOW; k++) {
          const o = k * 4, px = x + P[o], py = y + P[o + 1], w = P[o + 2], h = P[o + 3];
          const near = Math.exp(-(((px - PEAK.x) / 62) ** 2)) * Math.exp(-(((py - src) / 85) ** 2));
          if (near < 0.03) continue;
          g.globalAlpha = Math.min(1, a * near * lightUp);
          g.drawImage(this.under, px - w * 0.42, py, w * 0.84, h * 0.7);
        }
      }
    }
    g.globalAlpha = 1;
  }

  private bandOn(b: Band) { return smooth((this.cap.cloud - b.th) / 0.22); }
  private bandY(b: Band) { return b.hi + (b.lo - b.hi) * Math.pow(this.cap.cloud, 1.2); }
  private bandX(b: Band) { return b.x + DRIFT * Math.sin(this.t * 0.045 * b.sp + b.ph); }

  /** Paints what stands in front of the land: the snow down to its line, the veil the mist draws over the stars, and
   *  the bands of mist, each with a chalk stroke along its top. snow: 0 to 1, how far the arrival has let it settle. */
  drawAir(g: CanvasRenderingContext2D, pal: Palette, snow: number, drawSnow: (g: CanvasRenderingContext2D, a: number) => void) {
    const st = this.styles(pal), c = this.cap;
    this.airDirty = false; this.drifted = this.t;
    if (snow > 0.01) { g.globalAlpha = 1; drawSnow(g, 0.95 * snow); }
    if (c.cloud > 0.01 && this.veil && this.cloud) {
      // the veil: the stars go first, high up, then the sky over the summit
      g.globalAlpha = smooth(c.cloud / 0.75);
      g.drawImage(this.veil, -40, -240, 408, 250 + 150 * c.cloud);
      g.lineCap = 'round';
      g.strokeStyle = st.line;
      let clipped = false;
      for (const b of this.bands) {
        const a = this.bandOn(b);
        if (b.behind && !clipped && this.behind) { g.save(); g.clip(this.behind, 'evenodd'); clipped = true; }
        if (!b.behind && clipped) { g.restore(); clipped = false; }
        if (a < 0.01) continue;
        const x = this.bandX(b), y = this.bandY(b), P = b.puffs;
        g.globalAlpha = a * 0.95;
        for (let k = 0; k < PUFFS; k++) {
          const o = k * 4, w = P[o + 2], h = P[o + 3];
          g.drawImage(this.cloud, x + P[o] - w / 2, y + P[o + 1] - h / 2, w, h);
        }
      }
      if (clipped) g.restore();
    }
    g.globalAlpha = 1;
  }
}

export type { RGB };
