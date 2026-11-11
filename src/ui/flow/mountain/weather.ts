// Places with weather of their own (PLAN-MOUNTAIN.md pass 6, R1): each is the stream's own light doing something where
// it is, and each is as strong as the water that reaches it, so none is decoration that stands for nothing.
//   the summit       spindrift torn off the snow, downwind
//   the Throat       spray where the narrows fall
//   the Heart        the tarn holding the lantern's still reflection
//   the Solar plexus embers on the shadow flank, rising
//   the Sacral       slow rings going out on the pool
//   the Root         fireflies of the stream's light in the firs
//   the mouth        phosphorescence where the river fans into the sea
// And the cap's weather, which R2 drives from the meter: the snowline (in the SVG, land.ts snowCap), flakes falling on
// the cap, and the cloud coming down over the summit (set()). R1 leaves the flakes and the cloud at none.
//
// Pure but for draw(), which paints on a 2D context already in the box's units, additively (the plate sets that up).

import { rgb, mix, type Palette, type RGB } from './palette';

/** The cap's weather (R2 moves these with the meter). snowline in box units; flakes and cloud 0 to 1. */
export type CapWeather = { snowline: number; flakes: number; cloud: number };

type Mote = { x: number; y: number; vx: number; vy: number; life: number; age: number; seed: number };

const TAU = Math.PI * 2;

class Drift {
  readonly ps: Mote[] = [];
  private due = 0;
  constructor(private max: number, private spawn: (m: Mote, r: () => number) => void, private r: () => number) {}
  /** rate: births a second; gravity in units/s². */
  step(dt: number, rate: number, gravity = 0, wind = 0) {
    this.due += rate * dt;
    while (this.due >= 1) {
      this.due -= 1;
      let m = this.ps.find(p => p.age >= p.life);
      if (!m) { if (this.ps.length >= this.max) break; m = { x: 0, y: 0, vx: 0, vy: 0, life: 1, age: 0, seed: 0 }; this.ps.push(m); }
      m.age = 0; m.seed = this.r();
      this.spawn(m, this.r);
    }
    for (const p of this.ps) {
      if (p.age >= p.life) continue;
      p.age += dt; p.vy += gravity * dt; p.vx += wind * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }
}

export class Weather {
  cap: CapWeather;
  private t = 0;
  private sd = 23;
  private r = () => { this.sd = (this.sd * 16807) % 2147483647; return this.sd / 2147483647; };
  private spindrift: Drift; private spray: Drift; private embers: Drift; private sparks: Drift; private flakes: Drift;
  private flies: { x: number; y: number; ph: number; per: number; ax: number; ay: number }[] = [];
  private rings: { age: number }[] = [];
  private ringDue = 0;

  constructor(snowline: number) {
    this.cap = { snowline, flakes: 0, cloud: 0 };
    this.spindrift = new Drift(28, (m, r) => { m.x = 162 + r() * 8; m.y = 42 + r() * 10; m.vx = 14 + r() * 26; m.vy = -5 + r() * 6; m.life = 1.6 + r() * 2; }, this.r);
    this.spray = new Drift(30, (m, r) => { m.x = 172 + r() * 16; m.y = 175 + r() * 4; m.vx = (r() - 0.5) * 22; m.vy = -10 - r() * 16; m.life = 0.6 + r() * 0.8; }, this.r);
    this.embers = new Drift(18, (m, r) => { m.x = 206 + r() * 30; m.y = 270 + r() * 26; m.vx = (r() - 0.5) * 3; m.vy = -4 - r() * 7; m.life = 2.2 + r() * 2.6; }, this.r);
    this.sparks = new Drift(26, (m, r) => {
      const a = (r() - 0.5) * Math.PI * 0.9, d = 6 + r() * 70;
      m.x = 164 + Math.sin(a) * d; m.y = 402 + Math.abs(Math.cos(a)) * d * 0.4 + r() * 6; m.vx = (r() - 0.5) * 2; m.vy = 0; m.life = 0.7 + r() * 1.4;
    }, this.r);
    this.flakes = new Drift(50, (m, r) => { m.x = 120 + r() * 90; m.y = 20 + r() * 20; m.vx = (r() - 0.5) * 6; m.vy = 6 + r() * 8; m.life = 4 + r() * 3; }, this.r);
    // fireflies keep to the firs: the clump round the root, and the treelines either side of the river
    const zones: [number, number, number, number][] = [[168, 194, 360, 380], [206, 240, 362, 382], [148, 168, 372, 388], [40, 130, 378, 392], [198, 300, 380, 392]];
    for (let k = 0; k < 16; k++) {
      const z = zones[k % zones.length];
      this.flies.push({ x: z[0] + this.r() * (z[1] - z[0]), y: z[2] + this.r() * (z[3] - z[2]), ph: this.r() * TAU, per: 3 + this.r() * 4, ax: 2 + this.r() * 4, ay: 1 + this.r() * 2 });
    }
  }

  /** The cap's weather, for R2. */
  set(w: Partial<CapWeather>) { this.cap = { ...this.cap, ...w }; }

  /** q: the water in the eight stretches now; b: the gates now. */
  step(dt: number, q: ArrayLike<number>, k: number) {
    this.t += dt;
    const go = k > 0 ? dt : 0;
    this.spindrift.step(go, 9 * (0.3 + 0.7 * q[0]), 0, 4);
    this.spray.step(go, 26 * q[3] * q[3], 34);
    this.embers.step(go, 3.2 * q[5]);
    this.sparks.step(go, 16 * q[7]);
    this.flakes.step(go, 12 * this.cap.flakes, 0, 0);
    // slow rings on the sacral's pool: one every few seconds, more often the more water comes
    this.ringDue += go * (0.2 + 0.25 * q[6]);
    if (this.ringDue >= 1) { this.ringDue -= 1; this.rings.push({ age: 0 }); }
    for (const r of this.rings) r.age += go;
    while (this.rings.length && this.rings[0].age > 6) this.rings.shift();
  }

  /** Paints every place. q and b as in step; gates closed dim their own place. reveal: 0 to 1 along the course while
   *  the arrival's head is still coming (a place shows once the head has passed it). */
  draw(g: CanvasRenderingContext2D, pal: Palette, q: ArrayLike<number>, b: ArrayLike<number>, reveal: (y: number) => number) {
    const glow = pal.glow, hue = pal.hues;
    const life = (p: Mote) => { const f = p.age / p.life; return f >= 1 ? 0 : Math.sin(Math.PI * f); };

    // spindrift: thin dashes of snow-light, downwind
    g.lineCap = 'round';
    g.lineWidth = 0.7;
    for (const p of this.spindrift.ps) {
      const a = life(p) * 0.4 * (0.3 + 0.7 * q[0]) * reveal(p.y);
      if (a < 0.01) continue;
      g.strokeStyle = rgb(glow, a);
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.12, p.y - p.vy * 0.12); g.stroke();
    }
    // the cap's flakes (R2)
    for (const p of this.flakes.ps) {
      const a = life(p) * 0.5 * this.cap.flakes;
      if (a < 0.01 || p.y > this.cap.snowline + 8) continue;
      g.fillStyle = rgb(pal.line, a);
      g.fillRect(p.x + Math.sin(this.t + p.seed * 9) * 2, p.y, 0.9, 0.9);
    }
    // spray at the throat's fall, tinted by the throat's lantern
    const sprayC = mix(hue[2], glow, 0.55 + 0.45 * b[2]);
    for (const p of this.spray.ps) {
      const a = life(p) * 0.55 * q[3] * reveal(p.y);
      if (a < 0.01) continue;
      g.fillStyle = rgb(sprayC, a);
      g.beginPath(); g.arc(p.x, p.y, 0.5 + p.seed * 0.7, 0, TAU); g.fill();
    }
    // the heart's tarn: the lantern's reflection, held still, barely breathing
    const hl = (1 - b[3]) * q[3] * reveal(233);
    if (hl > 0.01) {
      for (let k = 0; k < 6; k++) {
        const y = 230.5 + k * 1.5, w = 11 - k * 1.4 + Math.sin(this.t * 0.6 + k * 1.7) * 1.2;
        g.strokeStyle = rgb(mix(hue[3], glow, 0.25), hl * (0.5 - k * 0.07));
        g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(113 - w, y); g.lineTo(113 + w, y); g.stroke();
      }
    }
    // embers on the solar plexus's shadow flank: a fire kept, rising and going out
    const emberC = mix(hue[4], glow, 0.15);
    for (const p of this.embers.ps) {
      const flick = 0.6 + 0.4 * Math.sin(this.t * 9 + p.seed * 40);
      const a = life(p) * 0.75 * flick * q[5] * (1 - 0.7 * b[4]) * reveal(p.y);
      if (a < 0.01) continue;
      g.fillStyle = rgb(emberC, a);
      g.beginPath(); g.arc(p.x + Math.sin(p.age * 2 + p.seed * 7) * 1.5, p.y, 0.55 + p.seed * 0.5, 0, TAU); g.fill();
    }
    // slow rings on the sacral's pool
    const pl = q[6] * (1 - 0.6 * b[5]) * reveal(327);
    for (const r of this.rings) {
      const f = r.age / 6, rx = 2 + 13 * f, a = (1 - f) * 0.5 * pl;
      if (a < 0.01) continue;
      g.strokeStyle = rgb(mix(hue[5], glow, 0.3), a);
      g.lineWidth = 0.7;
      g.beginPath(); g.ellipse(148, 327, rx, rx * 0.3, 0, 0, TAU); g.stroke();
    }
    // fireflies of the stream's light in the root's firs
    const ff = q[7] * (1 - 0.5 * b[6]);
    for (const f of this.flies) {
      const ph = (this.t / f.per + f.ph) % 1, on = ph < 0.35 ? Math.sin((ph / 0.35) * Math.PI) : 0;
      const a = on * 0.9 * ff * reveal(f.y);
      if (a < 0.01) continue;
      const x = f.x + Math.sin(this.t * 0.4 + f.ph) * f.ax, y = f.y + Math.cos(this.t * 0.3 + f.ph * 2) * f.ay;
      const c = mix(hue[6], glow, 0.6);
      g.fillStyle = rgb(c, a * 0.25);
      g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill();
      g.fillStyle = rgb(c, a);
      g.beginPath(); g.arc(x, y, 0.8, 0, TAU); g.fill();
    }
    // phosphorescence where the river fans into the sea
    for (const p of this.sparks.ps) {
      const a = life(p) * 0.8 * q[7] * reveal(p.y);
      if (a < 0.01) continue;
      g.fillStyle = rgb(glow, a);
      g.fillRect(p.x - 0.6, p.y - 0.25, 1.2 + p.seed * 1.4, 0.5);
    }
    // the cloud coming down over the summit (R2): soft banks of the line colour, nothing that glows
    if (this.cap.cloud > 0.01) {
      for (let k = 0; k < 5; k++) {
        const x = 120 + k * 22 + Math.sin(this.t * 0.05 + k) * 6, y = 50 + (k % 2) * 16 + this.cap.cloud * 30;
        const grd = g.createRadialGradient(x, y, 0, x, y, 34);
        grd.addColorStop(0, rgb(pal.line, 0.1 * this.cap.cloud));
        grd.addColorStop(1, rgb(pal.line, 0));
        g.fillStyle = grd;
        g.fillRect(x - 34, y - 34, 68, 68);
      }
    }
  }
}

export type { RGB };
