// The light on a stop's plate (PLAN-MOUNTAIN.md pass 6, R3): one canvas over the drawn place, the only light on it.
// Motes run the course as points of light with short trails (fast water a dash, slow a bead), by the mountain's own
// maths (model/mountain.ts stretch and pool): above the sign they carry what reaches it, below it what the gate lets
// through, and above a part-shut gate they slow and pool. The sign is a lantern: its hue is thrown on the rock round it
// and carried a short way into the water below before it pales. Then the place's own light (scenes.ts Fx).
//
// The loop: one requestAnimationFrame loop, only while the plate is on screen (IntersectionObserver) and the document
// is visible, and only while --stream is above zero. Colours and --stream are read from the tokens at start and on a
// light change (the caller calls read()); nothing is read from layout or style inside a frame. Under Reduce Motion
// --stream is 0: one still frame is drawn, and nothing runs. Additive light ('lighter'), no blur filters.
import { pool, stretch, POOL_UNITS } from '../../../model/mountain';
import { H, W, type Scene } from './scenes';

type RGB = [number, number, number];

/** How fast the water runs at full strength, in box units a second. Slower than a finger (rule 30). */
const BASE = 34;
/** The close view is about three times the mountain's scale, so the pool reaches three times as far. */
const POOL_REACH = POOL_UNITS * 3;
/** How far the sign's hue is carried down the water, as a share of the course. */
const TINT_RUN = 0.2;
const MOTES = 52;
const MAX_STEP = 0.05;

const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
const ease = (from: number, to: number, dt: number, rate = 3) => from + (to - from) * Math.min(1, dt * rate);

/** A seeded random, so the same place draws the same way each time it opens. */
function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Any CSS colour the page knows, as numbers for the canvas: painted on one pixel and read back. */
export function toRGB(css: string, fallback: RGB): RGB {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const x = c.getContext('2d', { willReadFrequently: true });
    if (!x) return fallback;
    x.clearRect(0, 0, 1, 1);
    x.fillStyle = css;
    x.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = x.getImageData(0, 0, 1, 1).data;
    return a ? [r, g, b] : fallback;
  } catch { return fallback; }
}

type Mote = { u: number; jitter: number; w: number; k: number };
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

  constructor(private canvas: HTMLCanvasElement, private course: SVGPathElement, private scene: Scene, private hue: number) {
    this.ctx = canvas.getContext('2d');
    this.sample();
    const r = rand(11);
    this.motes = Array.from({ length: MOTES }, (_, k) => ({ u: r(), jitter: 0.75 + r() * 0.5, w: 0.7 + r() * 1.1, k: k / MOTES }));
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
    const f = Math.max(0, Math.min(1, u)) * n, i = Math.floor(f), k = f - i;
    const j = Math.min(n, i + 1);
    return [this.xs[i] + (this.xs[j] - this.xs[i]) * k, this.ys[i] + (this.ys[j] - this.ys[i]) * k];
  }

  /** Reads the tokens again: at start, and when the light changes or Reduce Motion does. */
  read() {
    const cs = getComputedStyle(this.canvas);
    this.glow = toRGB(cs.getPropertyValue('--glow').trim() || 'white', this.glow);
    const probe = document.createElement('i');
    probe.style.color = `oklch(var(--plate-voice-l) var(--plate-voice-c) ${this.hue})`;
    probe.style.display = 'none';
    this.canvas.parentElement?.append(probe);
    this.hueRGB = toRGB(getComputedStyle(probe).color, this.glow);
    probe.remove();
    const s = parseFloat(cs.getPropertyValue('--stream'));
    this.stream = Number.isFinite(s) ? Math.max(0, s) : 1;
    // Still puts the hue out of the light (chakra.css --ck-tint 0): the water and the sign are the line colour only
    const tint = parseFloat(cs.getPropertyValue('--ck-tint'));
    this.tint = Number.isFinite(tint) ? tint : 1;
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

  private step(dt: number) {
    if (dt <= 0) return;
    this.t += dt;
    for (const m of this.motes) {
      const q = this.q(m.u), st = stretch(q);
      const above = m.u < this.uSign ? (this.uSign - m.u) * this.len : Infinity;
      const pace = st.pace * (above === Infinity ? 1 : pool(this.now.gate, above / (POOL_REACH / POOL_UNITS)));
      m.u += (dt * BASE * pace * m.jitter) / this.len;
      if (m.u > 1) m.u -= 1;
    }
    this.stepFx(dt);
  }

  // ---------------------------------------------------------------- the place's own light

  private strength() { return this.q(1); }

  private spawn(b: Partial<Bit> & Pick<Bit, 'x' | 'y'>) {
    if (this.bits.length > 80) return;
    this.bits.push({ vx: 0, vy: 0, life: 2, age: 0, r: 1, ...b });
  }

  private stepFx(dt: number) {
    const r = this.rnd, [ax, ay] = this.scene.at ?? this.scene.sign, s = this.strength(), open = 1 - this.now.gate;
    const chance = (perSecond: number) => r() < perSecond * dt;
    switch (this.scene.fx) {
      case 'spindrift':
        // torn off the summit on the wind, whatever the gate: the snow is upstream of it
        if (chance(14)) this.spawn({ x: ax + r() * 6, y: ay + r() * 8, vx: 18 + r() * 26, vy: -2 + r() * 8, life: 2.5 + r() * 2, r: 0.5 + r() * 0.9 });
        break;
      case 'view':
        // far water in the valley, glinting as the stream reaches it
        if (chance(1.4 * s + 0.2)) this.spawn({ x: ax + r() * 190, y: ay - 2 + r() * 6, vx: 3 + r() * 3, life: 2 + r() * 2, r: 0.6 + r() * 0.6 });
        break;
      case 'fall':
        if (chance(30 * s + 2)) this.spawn({ x: ax + (r() - 0.5) * 8, y: ay - 2, vx: (r() - 0.5) * 22, vy: -10 - r() * 18 * s, life: 0.9 + r() * 1.1, r: 0.6 + r() * 1 });
        break;
      case 'tarn':
        if (chance(0.25 + 0.25 * s)) this.spawn({ x: ax, y: ay + 4, life: 7, r: 0 });
        break;
      case 'embers': {
        // open, they rise from the fire; shut, the few there are sink back into the rock
        const up = open > 0.25;
        if (chance(2 + 9 * open * s)) this.spawn({ x: ax + (r() - 0.5) * 26, y: ay - (up ? 4 : 10), vx: (r() - 0.5) * 6, vy: up ? -8 - r() * 12 * open : 4 + r() * 4, life: 2 + r() * 2.5, r: 0.6 + r() * 1.1 });
        break;
      }
      case 'rings':
        if (chance(0.3 + 0.5 * s)) this.spawn({ x: ax, y: ay + 6, life: 6, r: 0 });
        break;
      case 'fireflies':
        if (this.bits.length < 4 + 14 * s && chance(3)) {
          this.spawn({ x: 20 + r() * (W - 40), y: 90 + r() * 110, vx: (r() - 0.5) * 8, vy: (r() - 0.5) * 6, life: 4 + r() * 5, r: 0.8 + r() * 0.8 });
        }
        break;
    }
    for (const b of this.bits) {
      b.age += dt;
      if (this.scene.fx === 'fall') b.vy += 40 * dt;
      if (this.scene.fx === 'fireflies') { b.vx += (r() - 0.5) * 20 * dt; b.vy += (r() - 0.5) * 16 * dt; }
      if (this.scene.fx === 'embers') b.vx += Math.sin(this.t * 2 + b.y * 0.1) * 4 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    this.bits = this.bits.filter(b => b.age < b.life);
  }

  // ---------------------------------------------------------------- drawing

  private draw(dt: number) {
    const x = this.ctx;
    if (!x) return;
    const z = this.scale;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, this.canvas.width, this.canvas.height);
    x.setTransform(z, 0, 0, z, 0, 0);
    x.globalCompositeOperation = 'lighter';
    const open = 1 - this.now.gate, lit = this.tint * open;
    const hue = mix(this.glow, this.hueRGB, this.tint);
    const [sx, sy] = this.scene.sign;

    // the lantern: its hue on the rock round it, as far as it is open
    const g = x.createRadialGradient(sx, sy, 2, sx, sy, this.scene.size * 1.9);
    g.addColorStop(0, rgba(hue, 0.42 * lit + 0.06));
    g.addColorStop(0.45, rgba(hue, 0.12 * lit + 0.02));
    g.addColorStop(1, rgba(hue, 0));
    x.fillStyle = g;
    x.fillRect(sx - this.scene.size * 2, sy - this.scene.size * 2, this.scene.size * 4, this.scene.size * 4);

    this.drawWaterLight(x, hue, lit);
    this.drawMotes(x, hue, lit, dt);
    this.drawFx(x, hue, lit);
    x.globalCompositeOperation = 'source-over';
  }

  /** The still water's own light: the sign held in the tarn, the pool's surface. */
  private drawWaterLight(x: CanvasRenderingContext2D, hue: RGB, lit: number) {
    const w = this.scene.water;
    if (!w) return;
    const [sx] = this.scene.sign;
    const s = this.strength();
    const g = x.createRadialGradient(sx, w.cy, 2, sx, w.cy, w.rx * 0.7);
    g.addColorStop(0, rgba(hue, 0.16 * lit + 0.05 * s));
    g.addColorStop(1, rgba(hue, 0));
    x.save();
    x.beginPath();
    x.ellipse(w.cx, w.cy, w.rx, w.ry, 0, 0, Math.PI * 2);
    x.clip();
    x.fillStyle = g;
    x.fillRect(w.cx - w.rx, w.cy - w.ry, w.rx * 2, w.ry * 2);
    // the reflection's long glint, broken by the faintest stir
    for (let i = 0; i < 7; i++) {
      const y = w.shore + 6 + i * 3.2, half = (w.rx * 0.32) * (1 - i / 9) * (0.6 + 0.4 * s);
      const wob = Math.sin(this.t * 0.7 + i * 1.3) * 2;
      x.strokeStyle = rgba(mix(this.glow, hue, 0.6), (0.18 - i * 0.02) * (0.4 + 0.6 * s));
      x.lineWidth = 0.8;
      x.beginPath();
      x.moveTo(sx - half + wob, y);
      x.lineTo(sx + half + wob, y);
      x.stroke();
    }
    x.restore();
  }

  private drawMotes(x: CanvasRenderingContext2D, hue: RGB, lit: number, dt: number) {
    x.lineCap = 'round';
    for (const m of this.motes) {
      const q = this.q(m.u), st = stretch(q);
      if (m.k > st.share) continue;
      const above = m.u < this.uSign ? (this.uSign - m.u) * this.len : Infinity;
      const pace = st.pace * (above === Infinity ? 1 : pool(this.now.gate, above / (POOL_REACH / POOL_UNITS)));
      // fast water a dash, slow a bead; a still frame draws beads of the same length
      const trail = (0.8 + 6 * pace * m.jitter) / this.len;
      const [hx, hy] = this.at(m.u);
      const [tx, ty] = this.at(Math.max(0, m.u - trail));
      // below the sign the water carries its hue a short way, then pales
      const past = m.u - this.uSign;
      const tinted = past > 0 && past < TINT_RUN ? (1 - past / TINT_RUN) * lit : 0;
      const c = mix(this.glow, hue, tinted * 0.85);
      // the ends of the course fade, so the water comes from somewhere and goes on
      const edge = Math.min(1, m.u / 0.06, (1 - m.u) / 0.08);
      const a = (0.3 + 0.6 * q) * edge;
      // a soft halo, the trail, and a brighter bead at its head: a point of light, not a pipe
      const halo = x.createRadialGradient(hx, hy, 0, hx, hy, m.w * 4);
      halo.addColorStop(0, rgba(c, a * 0.35));
      halo.addColorStop(1, rgba(c, 0));
      x.fillStyle = halo;
      x.fillRect(hx - m.w * 4, hy - m.w * 4, m.w * 8, m.w * 8);
      x.strokeStyle = rgba(c, a * 0.55);
      x.lineWidth = m.w * 0.8;
      x.beginPath(); x.moveTo(tx, ty); x.lineTo(hx, hy); x.stroke();
      x.fillStyle = rgba(c, Math.min(1, a * 1.2));
      x.beginPath(); x.arc(hx, hy, m.w * 0.7, 0, Math.PI * 2); x.fill();
    }
    void dt;
  }

  private drawFx(x: CanvasRenderingContext2D, hue: RGB, lit: number) {
    const glow = this.glow;
    for (const b of this.bits) {
      const life = b.age / b.life, fade = Math.sin(Math.PI * Math.min(1, life));
      switch (this.scene.fx) {
        case 'tarn':
        case 'rings': {
          const w = this.scene.water!;
          const grow = this.scene.fx === 'tarn' ? 0.5 : 0.9;
          const rx = 4 + life * w.rx * grow, ry = rx * (w.ry / w.rx);
          x.strokeStyle = rgba(mix(glow, hue, lit * 0.5), 0.26 * (1 - life));
          x.lineWidth = 0.8;
          x.beginPath(); x.ellipse(b.x, b.y, rx, ry, 0, 0, Math.PI * 2); x.stroke();
          break;
        }
        case 'embers': {
          const c = mix(glow, hue, 0.4 + 0.6 * this.tint);
          const a = fade * (0.35 + 0.65 * (1 - this.now.gate));
          const g = x.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 4);
          g.addColorStop(0, rgba(c, 0.5 * a));
          g.addColorStop(1, rgba(c, 0));
          x.fillStyle = g;
          x.fillRect(b.x - b.r * 4, b.y - b.r * 4, b.r * 8, b.r * 8);
          x.fillStyle = rgba(c, 0.9 * a);
          x.beginPath(); x.arc(b.x, b.y, b.r * 0.7, 0, Math.PI * 2); x.fill();
          break;
        }
        case 'fireflies': {
          const blink = 0.5 + 0.5 * Math.sin(this.t * 1.6 + b.x);
          const c = mix(glow, hue, lit * 0.35);
          const g = x.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 5);
          g.addColorStop(0, rgba(c, 0.7 * fade * blink));
          g.addColorStop(1, rgba(c, 0));
          x.fillStyle = g;
          x.fillRect(b.x - b.r * 5, b.y - b.r * 5, b.r * 10, b.r * 10);
          break;
        }
        default:
          x.fillStyle = rgba(glow, (this.scene.fx === 'spindrift' ? 0.45 : 0.7) * fade);
          x.beginPath(); x.arc(b.x, b.y, b.r, 0, Math.PI * 2); x.fill();
      }
    }
  }
}
