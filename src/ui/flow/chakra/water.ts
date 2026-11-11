// The light on a stop's plate (PLAN-MOUNTAIN.md pass 6, R3): one canvas over the drawn place, the only light on it.
//
//   the band    a wide soft glow laid along the water, as strong as the water running there (above the sign what reaches
//               it, below it what the gate lets by), so a shut gate visibly darkens everything below it. Drawn once per
//               strength into its own canvas and laid on with an alpha; the rock's own lit chalk is Plate.tsx's.
//   the motes   points of light, irregular in size and brightness, glinting as they go, with short trails (fast water a long
//               dash, slow a bead), by the mountain's maths (model/mountain.ts stretch and pool): above a part-shut gate
//               they slow and pool. They run into the sign and out of it, brightening as they enter it and carrying its hue
//               a short way after before they pale.
//   the lantern the sign's bloom in its hue, breathing on the app's breath (four seconds in, six out), as far as its gate
//               is open; shut, it goes out and the sign is a cold outline.
//   the place   the stream's light doing something there (scenes.ts fx): spindrift, the far sea glinting, the fall's
//               spray, rings on the tarn and the pool, embers, fireflies.
//
// Every soft light is a sprite drawn once (a radial gradient on a small canvas, per colour) and stamped with drawImage:
// no gradient is made inside a frame. One requestAnimationFrame loop, only while the plate is on screen
// (IntersectionObserver) and the document is visible, and only while --stream is above zero. Colours, --stream and the
// tint are read from the tokens at start and on a light change (the caller calls read()); nothing is read from layout or
// style inside a frame. Under Reduce Motion --stream is 0: one still frame is drawn, and nothing runs. Additive light
// ('lighter'), no blur filters.
import { pool, stretch, POOL_UNITS } from '../../../model/mountain';
import { IN_MS, OUT_MS } from '../breath';
import { H, W, type Scene } from './scenes';

type RGB = [number, number, number];

/** How fast the water runs at full strength, in box units a second. Slower than a finger (rule 30). */
const BASE = 30;
/** The close view is about three times the mountain's scale, so the pool reaches three times as far. */
const POOL_REACH = POOL_UNITS * 3;
/** How far the sign's hue is carried down the water, as a share of the course. */
const TINT_RUN = 0.22;
const MOTES = 56;
const MAX_STEP = 0.05;
/** The band's strength is redrawn only when it has moved this much. */
const BAND_STEP = 0.02;

const clamp01 = (a: number) => Math.max(0, Math.min(1, a));
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${clamp01(a).toFixed(3)})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
const ease = (from: number, to: number, dt: number, rate = 3) => from + (to - from) * Math.min(1, dt * rate);

/** A seeded random, so the same place draws the same way each time it opens. */
function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** A CSS colour the page knows, as numbers for the canvas: painted on one pixel and read back. */
export function toRGB(css: string): RGB {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const x = c.getContext('2d', { willReadFrequently: true });
  if (!x) return [0, 0, 0];
  x.fillStyle = css;
  x.fillRect(0, 0, 1, 1);
  const [r, g, b] = x.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

/** A soft round light of one colour, drawn once: stamped with drawImage, scaled to its radius. */
function sprite(c: RGB, size = 64): HTMLCanvasElement {
  const s = document.createElement('canvas');
  s.width = s.height = size;
  const x = s.getContext('2d');
  if (x) {
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, rgba(c, 1));
    g.addColorStop(0.18, rgba(c, 0.55));
    g.addColorStop(0.5, rgba(c, 0.14));
    g.addColorStop(1, rgba(c, 0));
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
  }
  return s;
}

/** Where the breath is, 0 empty to 1 full: in over IN_MS, out over OUT_MS, eased, on the wall clock. */
export function breathAt(ms: number): number {
  const p = ms % (IN_MS + OUT_MS);
  const t = p < IN_MS ? p / IN_MS : 1 - (p - IN_MS) / OUT_MS;
  return t * t * (3 - 2 * t);
}

type Mote = { u: number; jitter: number; w: number; k: number; lane: number; tw: number; ph: number; glint: number };
type Bit = { x: number; y: number; vx: number; vy: number; life: number; age: number; r: number };

export type Strength = {
  /** What reaches the sign from above (model/mountain.ts reach), 0 to 1. */
  above: number;
  /** The gate, 0 open to 1 shut. */
  gate: number;
};

export class PlateLight {
  private ctx: CanvasRenderingContext2D | null;
  private xs: Float32Array = new Float32Array(0);
  private ys: Float32Array = new Float32Array(0);
  private len = 1;
  private uSign = 0.5;
  private motes: Mote[] = [];
  private bits: Bit[] = [];
  private rnd = rand(7);
  private raf = 0;
  private prev = 0;
  private t = 0;
  private seen = typeof IntersectionObserver === 'undefined';
  private io?: IntersectionObserver;
  private ro?: ResizeObserver;
  private on = false;
  private target: Strength = { above: 1, gate: 0 };
  private now: Strength = { above: 1, gate: 0 };
  private glow: RGB = [240, 235, 214];
  private hueRGB: RGB = [240, 235, 214];
  private tint = 1;
  private stream = 1;
  private scale = 1;
  private glowDot: HTMLCanvasElement | null = null;
  private hueDot: HTMLCanvasElement | null = null;
  private band: [HTMLCanvasElement | null, HTMLCanvasElement | null] = [null, null];

  constructor(private canvas: HTMLCanvasElement, private course: SVGPathElement, private scene: Scene, private hue: number) {
    this.ctx = canvas.getContext('2d');
    this.sample();
    const r = rand(11);
    this.motes = Array.from({ length: MOTES }, (_, k) => ({
      u: r(), jitter: 0.7 + r() * 0.6, w: 0.5 + Math.pow(r(), 2.2) * 1.9, k: k / MOTES,
      lane: (r() - 0.5) * 2, tw: 1.5 + r() * 5, ph: r() * 6.3, glint: r() < 0.12 ? 1 : 0,
    }));
  }

  /** The course as points a unit apart, and where the sign sits on it. */
  private sample() {
    let len = 0;
    try { len = this.course.getTotalLength(); } catch { len = 0; }
    if (!len || !Number.isFinite(len)) { this.xs = new Float32Array([this.scene.sign[0], this.scene.sign[0]]); this.ys = new Float32Array([0, H]); this.len = H; return; }
    const n = Math.max(2, Math.ceil(len));
    this.xs = new Float32Array(n + 1);
    this.ys = new Float32Array(n + 1);
    let best = 0, bd = Infinity;
    for (let i = 0; i <= n; i++) {
      const p = this.course.getPointAtLength((i / n) * len);
      this.xs[i] = p.x; this.ys[i] = p.y;
      const d = (p.x - this.scene.sign[0]) ** 2 + (p.y - this.scene.sign[1]) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    this.len = len;
    this.uSign = best / n;
  }

  private at(u: number): [number, number] {
    const n = this.xs.length - 1;
    const f = clamp01(u) * n, i = Math.floor(f), k = f - i;
    const j = Math.min(n, i + 1);
    return [this.xs[i] + (this.xs[j] - this.xs[i]) * k, this.ys[i] + (this.ys[j] - this.ys[i]) * k];
  }

  /** The course's direction at u, as a unit normal. */
  private normal(u: number): [number, number] {
    const [ax, ay] = this.at(u - 0.004), [bx, by] = this.at(u + 0.004);
    const l = Math.hypot(bx - ax, by - ay) || 1;
    return [-(by - ay) / l, (bx - ax) / l];
  }

  /** Reads the tokens again: at start, and when the light changes or Reduce Motion does. */
  read() {
    const cs = getComputedStyle(this.canvas);
    this.glow = toRGB(cs.getPropertyValue('--glow').trim() || 'white');
    const probe = document.createElement('i');
    probe.style.color = `oklch(var(--plate-voice-l) var(--plate-voice-c) ${this.hue})`;
    probe.style.display = 'none';
    this.canvas.parentElement?.append(probe);
    this.hueRGB = toRGB(getComputedStyle(probe).color);
    probe.remove();
    const s = parseFloat(cs.getPropertyValue('--stream'));
    this.stream = Number.isFinite(s) ? Math.max(0, s) : 1;
    // Still puts the hue out of the light (chakra.css --ck-tint 0): the water and the sign are the line colour only
    const tint = parseFloat(cs.getPropertyValue('--ck-tint'));
    this.tint = Number.isFinite(tint) ? tint : 1;
    this.glowDot = sprite(this.glow);
    this.hueDot = sprite(mix(this.glow, this.hueRGB, this.tint));
    this.band = [null, null];
    this.fit();
    this.kick();
  }

  /** How strong the water is: eased toward, never jumped to (nothing flashes), but at once when nothing runs. */
  set(s: Strength) {
    this.target = { ...s };
    if (!this.running()) { this.now = { ...s }; this.draw(0); }
  }

  start() {
    this.on = true;
    if (typeof IntersectionObserver !== 'undefined') {
      this.io = new IntersectionObserver(es => { this.seen = es.some(e => e.isIntersecting); this.kick(); });
      this.io.observe(this.canvas);
    }
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => { this.fit(); if (!this.running()) this.draw(0); });
      this.ro.observe(this.canvas);
    }
    document.addEventListener('visibilitychange', this.kick);
    this.read();
  }

  stop() {
    this.on = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.io?.disconnect();
    this.ro?.disconnect();
    document.removeEventListener('visibilitychange', this.kick);
  }

  /** True while a frame is asked for. */
  get looping() { return this.raf !== 0; }

  private running() { return this.on && this.seen && document.visibilityState === 'visible' && this.stream > 0; }

  private kick = () => {
    if (this.running()) {
      if (!this.raf) { this.prev = 0; this.raf = requestAnimationFrame(this.frame); }
    } else {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.now = { ...this.target };
      this.draw(0);
    }
  };

  private fit() {
    const dpr = Math.min(3, globalThis.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || W, h = this.canvas.clientHeight || H;
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (this.canvas.width !== pw) this.canvas.width = pw;
    if (this.canvas.height !== ph) this.canvas.height = ph;
    this.scale = pw / W;
    this.band = [null, null];
  }

  private frame = (ms: number) => {
    this.raf = 0;
    if (!this.running()) return;
    const dt = this.prev ? Math.min(MAX_STEP, (ms - this.prev) / 1000) : 0;
    this.prev = ms;
    this.now.above = ease(this.now.above, this.target.above, dt);
    this.now.gate = ease(this.now.gate, this.target.gate, dt);
    this.step(dt * this.stream);
    this.draw(dt * this.stream);
    this.raf = requestAnimationFrame(this.frame);
  };

  /** The water's strength at u along the course: what reaches the sign above it, what the gate lets by below it. */
  private q(u: number) {
    const { above, gate } = this.now;
    return u < this.uSign ? above : above * (1 - 0.85 * gate);
  }

  private paceAt(m: Mote) {
    const st = stretch(this.q(m.u));
    const above = m.u < this.uSign ? (this.uSign - m.u) * this.len : Infinity;
    return st.pace * (above === Infinity ? 1 : pool(this.now.gate, above / (POOL_REACH / POOL_UNITS)));
  }

  private step(dt: number) {
    if (dt <= 0) return;
    this.t += dt;
    for (const m of this.motes) {
      m.u += (dt * BASE * this.paceAt(m) * m.jitter) / this.len;
      if (m.u > 1) { m.u -= 1; m.lane = (this.rnd() - 0.5) * 2; }
    }
    this.stepFx(dt);
  }

  // ---------------------------------------------------------------- the place's own light

  private strength() { return this.q(1); }

  private spawn(b: Partial<Bit> & Pick<Bit, 'x' | 'y'>) {
    if (this.bits.length > 90) return;
    this.bits.push({ vx: 0, vy: 0, life: 2, age: 0, r: 1, ...b });
  }

  private stepFx(dt: number) {
    const r = this.rnd, [ax, ay] = this.scene.at ?? this.scene.sign, s = this.strength(), open = 1 - this.now.gate;
    const chance = (perSecond: number) => r() < perSecond * dt;
    switch (this.scene.fx) {
      case 'spindrift':
        // torn off the cornice on the wind, whatever the gate: the snow is upstream of it
        if (chance(22)) this.spawn({ x: ax + r() * 60, y: ay + r() * 26 - 4, vx: 22 + r() * 30, vy: -4 + r() * 6, life: 2.5 + r() * 2.5, r: 0.4 + r() * 0.9 });
        break;
      case 'view':
        // the far sea glinting as the stream reaches it
        if (chance(3 * s + 0.4)) this.spawn({ x: ax + r() * 220, y: ay + r() * 6, vx: 1 + r() * 2, life: 1.2 + r() * 2, r: 0.5 + r() * 0.8 });
        break;
      case 'fall':
        if (chance(40 * s + 3)) this.spawn({ x: ax + (r() - 0.5) * 14, y: ay - 2, vx: (r() - 0.5) * 30, vy: -10 - r() * 26 * s, life: 0.9 + r() * 1.3, r: 0.5 + r() * 1.1 });
        break;
      case 'tarn':
        if (chance(0.25 + 0.25 * s)) this.spawn({ x: ax, y: ay + 4, life: 7, r: 0 });
        break;
      case 'embers': {
        // open, they rise from the fire; shut, the few there are sink back into the rock
        const up = open > 0.25;
        if (chance(3 + 12 * open * s)) this.spawn({ x: ax + (r() - 0.5) * 30, y: ay - (up ? 6 : 12), vx: (r() - 0.5) * 6, vy: up ? -9 - r() * 14 * open : 4 + r() * 4, life: 2 + r() * 2.5, r: 0.5 + r() * 1.1 });
        break;
      }
      case 'rings':
        if (chance(0.3 + 0.5 * s)) this.spawn({ x: ax + (r() - 0.5) * 6, y: ay + 6, life: 6, r: 0 });
        break;
      case 'fireflies': {
        const [x0, y0, x1, y1] = this.scene.keep ?? [20, 90, W - 20, 200];
        if (this.bits.length < 5 + 18 * s && chance(4)) {
          this.spawn({ x: x0 + r() * (x1 - x0), y: y0 + r() * (y1 - y0), vx: (r() - 0.5) * 8, vy: (r() - 0.5) * 6, life: 4 + r() * 6, r: 0.8 + r() * 0.9 });
        }
        break;
      }
    }
    for (const b of this.bits) {
      b.age += dt;
      if (this.scene.fx === 'fall') b.vy += 40 * dt;
      if (this.scene.fx === 'fireflies') { b.vx += (r() - 0.5) * 20 * dt; b.vy += (r() - 0.5) * 16 * dt; }
      if (this.scene.fx === 'embers') b.vx += Math.sin(this.t * 2 + b.y * 0.1) * 4 * dt;
      if (this.scene.fx === 'spindrift') b.vy -= 3 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    this.bits = this.bits.filter(b => b.age < b.life);
  }

  // ---------------------------------------------------------------- drawing

  private stamp(x: CanvasRenderingContext2D, img: HTMLCanvasElement | null, cx: number, cy: number, r: number, a: number) {
    if (!img || a <= 0.002 || r <= 0) return;
    x.globalAlpha = clamp01(a);
    x.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  }

  /** The soft band along one half of the course (0 above the sign, 1 below), drawn once at full strength. */
  private bandOf(half: 0 | 1): HTMLCanvasElement | null {
    if (this.band[half]) return this.band[half];
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const x = c.getContext('2d');
    if (!x || !this.glowDot) return null;
    x.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    x.globalCompositeOperation = 'lighter';
    const [u0, u1] = half ? [this.uSign, 1] : [0, this.uSign];
    const n = Math.max(2, Math.ceil(((u1 - u0) * this.len) / 3));
    for (let i = 0; i <= n; i++) {
      const u = u0 + ((u1 - u0) * i) / n;
      const [px, py] = this.at(u);
      const edge = Math.min(1, u / 0.05, (1 - u) / 0.05);
      this.stamp(x, this.glowDot, px, py, 26, 0.05 * edge);
      this.stamp(x, this.glowDot, px, py, 8, 0.1 * edge);
    }
    this.band[half] = c;
    return c;
  }

  private bandAt: [number, number] = [-1, -1];

  private draw(dt: number) {
    const x = this.ctx;
    if (!x) return;
    const z = this.scale;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, this.canvas.width, this.canvas.height);
    x.globalCompositeOperation = 'lighter';
    // the band along the water, as strong as it runs
    const qa = this.now.above, qb = this.q(1);
    for (const half of [0, 1] as const) {
      const want = half ? qb : qa;
      const at = Math.round(want / BAND_STEP) * BAND_STEP;
      this.bandAt[half] = at;
      const img = this.bandOf(half);
      if (img) { x.globalAlpha = clamp01(0.25 + 0.75 * at) * at; x.drawImage(img, 0, 0); }
    }
    x.setTransform(z, 0, 0, z, 0, 0);
    const open = 1 - this.now.gate, lit = this.tint * open;
    const hue = mix(this.glow, this.hueRGB, this.tint);
    const [sx, sy] = this.scene.sign;
    const size = this.scene.size;
    // the lantern: its bloom in its hue, breathing, as far as it is open; and the core it is lit from
    const br = this.stream > 0 ? breathAt(Date.now()) : 0.5;
    const on = 0.1 + 0.9 * open;
    this.stamp(x, this.hueDot, sx, sy, size * this.scene.glow * (0.95 + 0.1 * br), (0.2 + 0.08 * br) * lit);
    this.stamp(x, this.hueDot, sx, sy, size * (1.25 + 0.35 * br), (0.5 + 0.3 * br) * on * (this.tint ? 1 : 0.45));
    // the core it is lit from: a bright heart inside the sign, swelling on the in-breath
    this.stamp(x, this.hueDot, sx, sy, size * 0.72, (0.25 + 0.15 * br) * on * (this.tint ? 1 : 0.4));
    this.stamp(x, this.glowDot, sx, sy + size * 0.04, size * (0.3 + 0.08 * br), (0.1 + 0.12 * br) * open);
    this.drawWaterLight(x, hue, lit);
    this.drawMotes(x, hue, lit);
    this.drawFx(x, hue, lit);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    void dt;
  }

  /** The still water's own light: the sign held in the tarn, the pool's surface. */
  private drawWaterLight(x: CanvasRenderingContext2D, hue: RGB, lit: number) {
    const w = this.scene.water;
    if (!w) return;
    const [sx] = this.scene.sign;
    const s = this.strength();
    x.save();
    x.beginPath();
    x.ellipse(w.cx, w.cy, w.rx, w.ry, 0, 0, Math.PI * 2);
    x.clip();
    this.stamp(x, this.hueDot, sx, w.shore + w.ry * 0.6, w.rx * 0.5, 0.12 * lit + 0.05 * s);
    // the reflection's long glint, broken by the faintest stir
    x.lineWidth = 0.8;
    for (let i = 0; i < 8; i++) {
      const y = w.shore + 5 + i * 3.4, half = (w.rx * 0.3) * (1 - i / 10) * (0.6 + 0.4 * s);
      const wob = Math.sin(this.t * 0.7 + i * 1.3) * 2;
      x.globalAlpha = 1;
      x.strokeStyle = rgba(mix(this.glow, hue, 0.6), (0.2 - i * 0.02) * (0.4 + 0.6 * s));
      x.beginPath();
      x.moveTo(sx - half + wob, y);
      x.lineTo(sx + half * (0.6 + 0.4 * Math.sin(i * 2.1)) + wob, y);
      x.stroke();
    }
    x.restore();
  }

  private drawMotes(x: CanvasRenderingContext2D, hue: RGB, lit: number) {
    x.lineCap = 'round';
    const [sx, sy] = this.scene.sign, rin = this.scene.size * 0.5;
    for (const m of this.motes) {
      const q = this.q(m.u), st = stretch(q);
      if (m.k > st.share) continue;
      const pace = this.paceAt(m);
      // fast water a long dash, slow a bead; a still frame draws beads of the same length
      const trail = (0.8 + 7 * pace * m.jitter) / this.len;
      const [nx, ny] = this.normal(m.u);
      const spread = 1.6 + 3.4 * q;
      const [cx, cy] = this.at(m.u);
      const hx = cx + nx * m.lane * spread, hy = cy + ny * m.lane * spread;
      const [tcx, tcy] = this.at(Math.max(0, m.u - trail));
      const tx = tcx + nx * m.lane * spread, ty = tcy + ny * m.lane * spread;
      // below the sign the water carries its hue a short way, then pales; entering it, it brightens
      const past = m.u - this.uSign;
      const tinted = past > 0 && past < TINT_RUN ? (1 - past / TINT_RUN) * lit : 0;
      const c = mix(this.glow, hue, tinted * 0.85);
      const inSign = Math.hypot(hx - sx, hy - sy) < rin ? 1 : 0;
      // the ends of the course fade, so the water comes from somewhere and goes on; each mote glints on its own beat
      const edge = Math.min(1, m.u / 0.06, (1 - m.u) / 0.08);
      const twinkle = 0.6 + 0.4 * Math.sin(this.t * m.tw + m.ph);
      const a = (0.18 + 0.5 * q) * edge * twinkle * (1 + 0.6 * inSign);
      x.globalAlpha = 1;
      x.strokeStyle = rgba(c, a * 0.4);
      x.lineWidth = m.w * 0.6;
      x.beginPath(); x.moveTo(tx, ty); x.lineTo(hx, hy); x.stroke();
      this.stamp(x, tinted > 0.05 ? this.hueDot : this.glowDot, hx, hy, m.w * 4.5, a * 0.5);
      x.globalAlpha = 1;
      x.fillStyle = rgba(mix(c, [255, 255, 255], 0.2), Math.min(1, a * 1.2));
      x.beginPath(); x.arc(hx, hy, m.w * 0.55, 0, Math.PI * 2); x.fill();
      // now and then a glint: a short cross of light on the water
      if (m.glint && twinkle > 0.93) {
        const g = (twinkle - 0.93) / 0.07 * a, l = 2 + m.w * 3;
        x.strokeStyle = rgba(c, g * 0.7);
        x.lineWidth = 0.5;
        x.beginPath(); x.moveTo(hx - l, hy); x.lineTo(hx + l, hy); x.moveTo(hx, hy - l * 0.7); x.lineTo(hx, hy + l * 0.7); x.stroke();
      }
    }
  }

  private drawFx(x: CanvasRenderingContext2D, hue: RGB, lit: number) {
    const glow = this.glow;
    const [ax, ay] = this.scene.at ?? this.scene.sign;
    if (this.scene.fx === 'embers') {
      // the fire's own glow on the shelf and the alcove's back wall, flickering, as far as it is open
      const open = 1 - this.now.gate, f = 0.8 + 0.2 * Math.sin(this.t * 7.3) * Math.sin(this.t * 3.1 + 1);
      this.stamp(x, this.hueDot, ax, ay - 6, 70, (0.12 + 0.3 * open) * f);
      this.stamp(x, this.glowDot, ax, ay - 2, 14, (0.15 + 0.4 * open) * f);
      // the flames: tongues of the fire's light rising and flickering on their own beats, lower as the gate shuts
      for (let k = 0; k < 6; k++) {
        const ph = this.t * (2.3 + k * 0.7) + k * 1.9, rise = (ph % 1);
        const fx = ax + Math.sin(k * 2.4) * 7 + Math.sin(ph * 1.3) * 2, fy = ay - 2 - rise * (10 + 12 * open);
        this.stamp(x, this.hueDot, fx, fy, 5 + 4 * (1 - rise), (0.35 * (1 - rise)) * (0.2 + 0.8 * open) * f);
      }
    }
    if (this.scene.fx === 'fall') {
      // mist hanging in the gorge at the fall's foot, as strong as the water
      const s = this.strength();
      this.stamp(x, this.glowDot, ax, ay - 4, 40, 0.12 * s + 0.03);
    }
    for (const b of this.bits) {
      const life = b.age / b.life, fade = Math.sin(Math.PI * Math.min(1, life));
      switch (this.scene.fx) {
        case 'tarn':
        case 'rings': {
          const w = this.scene.water!;
          const grow = this.scene.fx === 'tarn' ? 0.5 : 0.9;
          const rx = 4 + life * w.rx * grow, ry = rx * (w.ry / w.rx);
          x.globalAlpha = 1;
          x.strokeStyle = rgba(mix(glow, hue, lit * 0.5), 0.3 * (1 - life));
          x.lineWidth = 0.8;
          x.beginPath(); x.ellipse(b.x, b.y, rx, ry, 0, 0, Math.PI * 2); x.stroke();
          break;
        }
        case 'embers': {
          const a = fade * (0.35 + 0.65 * (1 - this.now.gate));
          this.stamp(x, this.hueDot, b.x, b.y, b.r * 4, 0.6 * a);
          x.globalAlpha = 1;
          x.fillStyle = rgba(mix(glow, hue, 0.5 * this.tint), 0.9 * a);
          x.beginPath(); x.arc(b.x, b.y, b.r * 0.6, 0, Math.PI * 2); x.fill();
          break;
        }
        case 'fireflies': {
          const blink = Math.max(0, Math.sin(this.t * 1.4 + b.x * 0.7));
          this.stamp(x, lit > 0.2 ? this.hueDot : this.glowDot, b.x, b.y, b.r * 7, 0.55 * fade * blink);
          x.globalAlpha = 1;
          x.fillStyle = rgba(glow, 0.9 * fade * blink);
          x.beginPath(); x.arc(b.x, b.y, b.r * 0.5, 0, Math.PI * 2); x.fill();
          break;
        }
        default:
          this.stamp(x, this.glowDot, b.x, b.y, b.r * 3.5, (this.scene.fx === 'spindrift' ? 0.3 : 0.5) * fade);
          x.globalAlpha = 1;
          x.fillStyle = rgba(glow, (this.scene.fx === 'spindrift' ? 0.5 : 0.75) * fade);
          x.beginPath(); x.arc(b.x, b.y, b.r * 0.6, 0, Math.PI * 2); x.fill();
      }
    }
  }
}
