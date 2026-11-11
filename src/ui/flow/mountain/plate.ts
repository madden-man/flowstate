// The plate's light (PLAN-MOUNTAIN.md pass 6, R1): one canvas over the land, and the only light on the mountain is
// what runs down it. Drawn additively over the dim chalk of the SVG (mountain.css blends the canvas in screen), in this
// order each frame:
//   the lit rock    the land's own chalk lines again, in the water's light, only where the water reaches: a light
//                   field of soft discs along the course (as wide and as bright as the water in each stretch, a lantern
//                   at each open sign, the snow at the spring, the fan at the mouth) masks a copy of the lines, and the
//                   lines near a sign take its hue. Cached; rebuilt only while the water eases or the head runs.
//   the lanterns    a glow in each open sign's hue, gone cold as its gate closes
//   the water       the motes, each a bead or a dash with a halo, tinted under each sign and paling downstream
//   the weather     ./weather.ts, the places' own light
//   the sea         the waves swaying on the breath (4 s in, 6 s out), lit where the river fans out, and the rings the
//                   circles send out, faster the more water arrives
//   the arrival     the head of the first water and the ring each sign sends out as it kindles (./arrival.ts)
//
// One requestAnimationFrame loop, running only while the plate is on screen, the document visible and the water may
// move (--stream above zero); it stops on stop(). Nothing is read from layout or style in a frame: the box size comes
// from a ResizeObserver and the colours from ./palette.ts, read at the start and again when the light changes.
// devicePixelRatio is capped at 2 for the frame rate (the light is soft; the SVG keeps the lines sharp).
import { effect } from '@preact/signals';
import { light } from '../../light';
import { IN_MS, OUT_MS } from '../breath';
import { CHAKRA_IDS, reach, spring } from '../../../model/mountain';
import { COURSE, H, W, STOPS, SEA_Y, CIRCLE_R, PEAK, place, stretchAt, stretches, type Placed } from '../../parts/cycle/river';
import { Water, STRIDE, TINTS } from './water';
import { Weather, type CapWeather } from './weather';
import { readPalette, rgb, mix, type Palette } from './palette';
import { headAt, seaIn, circlesIn, HEAD_FROM } from './arrival';
import type { Land } from './land';
import { snowCap } from './land';

/** Loops running now, for tests. */
export const running = { loops: 0 };

const DPR_CAP = 2;
/** The light field is drawn small and scaled up: it is soft anyway. */
const FIELD = 0.25;
const MAX_STEP = 0.05;
const TAU = Math.PI * 2;
const ALPHAS = 6;

export type PlateParts = {
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  land: Land;
  /** The eight channel lines, one a stretch, so their widths say what runs there (Reduce Motion reads them). */
  channels: SVGPathElement[];
  /** The darkness below the signs: two gradient stops a sign (just above it, just below it) over the land. */
  shade: SVGStopElement[];
  /** The circles afloat, to ride the swell. */
  circles: HTMLElement[];
  /** The circles' x on the sea. */
  slots: number[];
  /** A sign has kindled (the arrival's head reached it, or the arrival was cut short). */
  kindle: (i: number) => void;
  /** The arrival is over (run out or cut short). */
  arrived: () => void;
};

export class Plate {
  readonly water = new Water();
  readonly weather: Weather;
  private pal!: Palette;
  private g: CanvasRenderingContext2D;
  private rock = document.createElement('canvas');
  private lit = document.createElement('canvas');
  private field = document.createElement('canvas');
  private buf = new Float32Array(this.water.n * STRIDE);
  private order = new Int32Array(this.water.n);
  private keys = new Int32Array(this.water.n);
  private w = 0; private h = 0; private dpr = 1; private scale = 1; private oy = 0;
  private raf = 0; private prev = 0; private seen = typeof IntersectionObserver === 'undefined'; private live = false;
  private io?: IntersectionObserver; private ro?: ResizeObserver; private mq?: MediaQueryList; private unlight?: () => void;
  private litDirty = true; private rockDirty = true;
  /** How much the plate shows state (--plate-state: 1, none in Still). */
  private state = 1;
  /** The arrival: when it began (performance.now), or null once over. */
  private t0: number | null = null;
  private kindled = new Uint8Array(7);
  private rings: { i: number; age: number }[] = [];
  private seaOn = 1; private circlesOn = 1;
  private p: Placed = { x: 0, y: 0, tx: 0, ty: 1 };
  private waves: { x: number; y: number; row: number }[] = [];
  private d = 0; private gates: number[] = [0, 0, 0, 0, 0, 0, 0];

  constructor(private parts: PlateParts, snowline: number) {
    this.g = parts.canvas.getContext('2d')!;
    this.weather = new Weather(snowline);
    // the sea's wave strokes, parted round the circles
    for (let row = 0; row < 6; row++) {
      const y = 406 + row * 11;
      for (let x = -8 + (row % 2) * 14; x < W + 8; x += 28) {
        if (parts.slots.some(c => Math.abs(x + 9 - c) < CIRCLE_R + 15 && Math.abs(y - SEA_Y) < CIRCLE_R + 6)) continue;
        this.waves.push({ x, y, row });
      }
    }
  }

  /** The meter and the gates (R2 calls this live, under the finger; the water eases to it). */
  setWater(d: number, gates: readonly number[], atOnce = false) {
    this.d = d; this.gates = CHAKRA_IDS.map((_, i) => gates[i] ?? 0);
    const st = this.state;
    const q = st ? stretches(spring(d), reach(d, this.gates)) : new Array(8).fill(1);
    this.water.set(q, st ? this.gates : [0, 0, 0, 0, 0, 0, 0], atOnce);
    this.litDirty = true;
    this.wake();
    if (!this.raf) this.paint(performance.now());
  }

  /** The cap's weather (R2: the snowline, flakes and cloud from the meter). */
  setWeather(w: Partial<CapWeather>) {
    const line = this.weather.cap.snowline;
    this.weather.set(w);
    if (w.snowline !== undefined && w.snowline !== line) { this.rockDirty = true; this.litDirty = true; }
  }

  start(arrive: boolean) {
    this.live = true;
    this.read();
    this.ro = new ResizeObserver(es => {
      const r = es[0].contentRect;
      this.size(r.width, r.height);
    });
    this.ro.observe(this.parts.host);
    const box = this.parts.host.getBoundingClientRect();
    this.size(box.width, box.height);
    if (!this.seen) {
      this.io = new IntersectionObserver(es => { this.seen = es.some(e => e.isIntersecting); this.wake(); });
      this.io.observe(this.parts.host);
    }
    document.addEventListener('visibilitychange', this.wake);
    this.mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;
    this.mq?.addEventListener?.('change', this.reread);
    this.unlight = effect(() => { void light.value; queueMicrotask(this.reread); });
    // Still has no arrival beyond a slow fade (rule 13)
    if (arrive && this.state === 0 && this.pal.light > 0) this.parts.host.dataset.fade = '';
    if (arrive && this.pal.stream > 0 && this.pal.arrive > 0 && this.state > 0) this.arrive();
    else this.finish();
    this.wake();
    this.paint(performance.now());
  }

  stop() {
    this.live = false;
    this.halt();
    this.io?.disconnect(); this.ro?.disconnect();
    document.removeEventListener('visibilitychange', this.wake);
    this.mq?.removeEventListener?.('change', this.reread);
    this.unlight?.();
  }

  /** Begins the arrival: dark, then the land, the snow, the first water, the sea, the circles. */
  arrive() {
    this.t0 = performance.now();
    this.kindled.fill(0);
    this.water.reveal = 0;
    this.seaOn = 0; this.circlesOn = 0;
    this.parts.host.dataset.arrive = 'run';
    this.wake();
  }

  /** Ends the arrival now (a tap, or it ran out): everything as it is when steady. */
  finish() {
    this.t0 = null;
    this.water.reveal = Infinity;
    this.seaOn = 1; this.circlesOn = 1;
    for (let i = 0; i < 7; i++) if (!this.kindled[i]) { this.kindled[i] = 1; this.parts.kindle(i); }
    for (const c of this.parts.circles) c.style.opacity = '';
    this.parts.host.dataset.arrive = 'done';
    this.litDirty = true;
    this.parts.arrived();
    if (!this.raf && this.live) this.paint(performance.now());
  }

  get arriving() { return this.t0 !== null; }

  private size(w: number, h: number) {
    if (!w || !h) return;
    this.w = w; this.h = h;
    this.dpr = Math.min(DPR_CAP, globalThis.devicePixelRatio || 1);
    this.scale = w / W; this.oy = h - H * this.scale;
    const cw = Math.round(w * this.dpr), ch = Math.round(h * this.dpr);
    for (const c of [this.parts.canvas, this.rock, this.lit]) { c.width = cw; c.height = ch; }
    this.field.width = Math.max(1, Math.round(w * FIELD)); this.field.height = Math.max(1, Math.round(h * FIELD));
    this.rockDirty = true; this.litDirty = true;
    if (this.live && !this.raf) this.paint(performance.now());
  }

  /** The tokens: colours, --stream, --plate-state, the arrival's length. Never inside a frame. */
  private read() {
    this.pal = readPalette(this.parts.host);
    const st = parseFloat(getComputedStyle(this.parts.host).getPropertyValue('--plate-state'));
    const was = this.state;
    this.state = Number.isFinite(st) ? Math.max(0, Math.min(1, st)) : 1;
    const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.water.k = calm ? 0 : this.pal.stream;
    this.water.plain = this.state === 0;
    this.parts.canvas.dataset.stream = String(this.water.k);
    if (was !== this.state) this.setWater(this.d, this.gates);
    this.rockDirty = true; this.litDirty = true;
  }
  private reread = () => {
    if (!this.live) return;
    this.read();
    if (this.water.k === 0 && this.t0 !== null) this.finish();
    this.wake();
    if (!this.raf) this.paint(performance.now());
  };

  private wake = () => {
    const may = this.live && this.seen && document.visibilityState !== 'hidden' && this.parts.canvas.isConnected
      && (this.water.k > 0 || this.t0 !== null);
    if (may && !this.raf) { this.prev = 0; this.raf = requestAnimationFrame(this.frame); running.loops++; this.parts.canvas.dataset.running = ''; }
    else if (!may) this.halt();
  };
  private halt() {
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; running.loops--; }
    delete this.parts.canvas.dataset.running;
  }

  private frame = (now: number) => {
    this.raf = 0;
    const dt = this.prev ? Math.min(MAX_STEP, (now - this.prev) / 1000) : 0;
    this.prev = now;
    const easing = this.water.easing;
    this.water.step(dt);
    if (easing) this.litDirty = true;
    this.weather.step(dt, this.water.q, this.water.k);
    for (const r of this.rings) r.age += dt;
    while (this.rings.length && this.rings[0].age > 1.6) this.rings.shift();
    this.paint(now);
    this.raf = requestAnimationFrame(this.frame);
  };

  // ---- the arrival's clock ----

  /** The arrival's time, 0 to 1, or 1 when over. Moves the head and kindles signs as it passes them. */
  private arrival(now: number): { f: number; head: number | null } {
    if (this.t0 === null) return { f: 1, head: null };
    const f = Math.min(1, (now - this.t0) / this.pal.arrive);
    const h = headAt(f), s = h === null ? null : h * COURSE.total;
    this.water.reveal = s === null ? 0 : s - 2;
    if (s !== null) {
      for (let i = 0; i < 7; i++) {
        if (!this.kindled[i] && s >= COURSE.at[i + 1]) {
          this.kindled[i] = 1; this.parts.kindle(i);
          if (this.state) this.rings.push({ i, age: 0 });
        }
      }
      this.litDirty = true;
    }
    this.seaOn = seaIn(f); this.circlesOn = circlesIn(f);
    for (const c of this.parts.circles) c.style.opacity = this.circlesOn < 1 ? this.circlesOn.toFixed(3) : '';
    if (f >= 1) { this.finish(); return { f: 1, head: null }; }
    return { f, head: s };
  }

  // ---- painting ----

  private toBox(g: CanvasRenderingContext2D, k = this.dpr) { g.setTransform(this.scale * k, 0, 0, this.scale * k, 0, this.oy * k); }

  /** The land's lines in the water's light, at full strength everywhere: masked by the field into the lit rock. */
  private buildRock() {
    const g = this.rock.getContext('2d')!, pal = this.pal;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.rock.width, this.rock.height);
    this.toBox(g);
    g.lineCap = 'round'; g.lineJoin = 'round';
    // the lit face and the snow take a little of the light too, so the rock reads as rock and not as wire
    for (const m of this.parts.land.marks) {
      if (m.kind !== 'fill' || (m.cls !== 'face' && m.cls !== 'horn')) continue;
      g.fillStyle = rgb(pal.glow, m.cls === 'face' ? 0.07 : 0.03);
      g.fill(new Path2D(m.d));
    }
    const cap = snowCap(this.weather.cap.snowline);
    g.fillStyle = rgb(pal.glow, 0.5); g.fill(new Path2D(cap.lit));
    g.fillStyle = rgb(pal.glow, 0.18); g.fill(new Path2D(cap.shade));
    for (const m of this.parts.land.marks) {
      if (m.kind !== 'pen' || m.lit <= 0) continue;
      g.strokeStyle = rgb(pal.glow, Math.min(1, m.lit));
      g.lineWidth = m.w * 1.05;
      g.stroke(new Path2D(m.d));
    }
    this.rockDirty = false;
  }

  /** The light field, small: soft discs along the course up to where the water has got, and the lanterns. */
  private buildField(head: number | null) {
    const f = this.field, g = f.getContext('2d')!, q = this.water.q, b = this.water.b;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, f.width, f.height);
    g.setTransform(this.scale * FIELD, 0, 0, this.scale * FIELD, 0, this.oy * FIELD);
    g.globalCompositeOperation = 'lighter';
    const disc = (x: number, y: number, r: number, a: number) => {
      if (a < 0.01) return;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      // only the field's alpha is used (it masks the rock), so its colour is the glow's
      grd.addColorStop(0, rgb(this.pal.glow, a));
      grd.addColorStop(0.45, rgb(this.pal.glow, a * 0.45));
      grd.addColorStop(1, rgb(this.pal.glow, 0));
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, 2 * r, 2 * r);
    };
    const reach = head ?? (this.water.reveal === Infinity ? COURSE.total : this.water.reveal);
    for (let s = 0; s < Math.min(reach, COURSE.total); s += 7) {
      const j = stretchAt(s), v = q[j];
      place(s, COURSE, this.p);
      const sea = s > COURSE.mouth ? 1.6 : 1;
      disc(this.p.x, this.p.y, (16 + 30 * v) * sea, 0.28 * Math.pow(v, 0.8));
    }
    // the snow lets the water go: the spring glows as much as there is to let go
    if (reach > 0) disc(PEAK.x, PEAK.y + 22, 46, 0.45 * (0.4 + 0.6 * q[0]));
    CHAKRA_IDS.forEach((id, i) => {
      if (!this.kindled[i]) return;
      const st = STOPS[id];
      disc(st.x, st.y, 40, 0.75 * (1 - b[i]) * q[i]);
    });
    if (reach >= COURSE.mouth) disc(PEAK.x, 410, 70, 0.5 * q[7]);
    // the head lights everything it passes, brightest where it is
    if (head !== null && head < COURSE.total) { place(head, COURSE, this.p); disc(this.p.x, this.p.y, 60, 0.9); }
    g.globalCompositeOperation = 'source-over';
  }

  /** The lit rock: the rock's lines masked by the field, the lines near each open sign taking its hue. */
  private buildLit(head: number | null) {
    if (this.rockDirty) this.buildRock();
    this.buildField(head);
    const g = this.lit.getContext('2d')!, pal = this.pal, b = this.water.b, q = this.water.q;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, this.lit.width, this.lit.height);
    g.drawImage(this.rock, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    g.imageSmoothingEnabled = true;
    g.drawImage(this.field, 0, 0, this.lit.width, this.lit.height);
    // each lantern throws a little of its hue on the rock round it
    g.globalCompositeOperation = 'source-atop';
    this.toBox(g);
    CHAKRA_IDS.forEach((id, i) => {
      const a = 0.85 * (1 - b[i]) * q[i] * this.kindled[i];
      if (a < 0.02) return;
      const st = STOPS[id], grd = g.createRadialGradient(st.x, st.y, 0, st.x, st.y, 46);
      grd.addColorStop(0, rgb(pal.hues[i], a));
      grd.addColorStop(1, rgb(pal.hues[i], 0));
      g.fillStyle = grd;
      g.fillRect(st.x - 46, st.y - 46, 92, 92);
    });
    g.globalCompositeOperation = 'source-over';
    // the SVG answers too: each channel as wide as what runs in it, and the dark coming down below a closed gate
    for (let i = 0; i < 8; i++) this.parts.channels[i]?.setAttribute('stroke-width', (1 + 2.5 * q[i]).toFixed(2));
    // two stops a sign: what runs above it, then a little below it what gets through
    for (let i = 0; i < this.parts.shade.length; i++) {
      const v = q[(i >> 1) + (i & 1)];
      this.parts.shade[i].setAttribute('stop-opacity', (0.7 * (1 - v) * this.state).toFixed(3));
    }
    this.parts.host.style.setProperty('--sea', q[7].toFixed(3));
    this.litDirty = false;
  }

  paint(now: number) {
    if (!this.w || !this.pal) return;
    const { head } = this.arrival(now);
    const g = this.g, pal = this.pal, q = this.water.q, b = this.water.b, st = this.state, k = this.water.k;
    if (st && (this.litDirty || this.rockDirty)) this.buildLit(head);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, this.parts.canvas.width, this.parts.canvas.height);
    g.globalCompositeOperation = 'lighter';
    if (st) g.drawImage(this.lit, 0, 0);
    this.toBox(g);
    g.lineCap = 'round';

    // the lanterns
    if (st) CHAKRA_IDS.forEach((id, i) => {
      const a = 0.55 * (1 - b[i]) * (0.35 + 0.65 * q[i]) * this.kindled[i];
      if (a < 0.02) return;
      const s = STOPS[id], grd = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, 24);
      grd.addColorStop(0, rgb(pal.hues[i], a));
      grd.addColorStop(0.4, rgb(pal.hues[i], a * 0.35));
      grd.addColorStop(1, rgb(pal.hues[i], 0));
      g.fillStyle = grd;
      g.fillRect(s.x - 24, s.y - 24, 48, 48);
    });

    // the water: sorted into colour and alpha buckets so each is one path, stroked as a halo and then a core
    if (k > 0 || this.t0 !== null) this.motes(g);

    if (st) this.weather.draw(g, pal, q, b, y => this.revealAt(y, head));

    this.sea(g, now);

    // the head of the first water: a bright bead with a long tail down the course behind it
    if (head !== null && head < COURSE.total) this.head(g, head);
    // each sign kindling sends a ring out in its hue
    for (const r of this.rings) {
      const s = STOPS[CHAKRA_IDS[r.i]], f = r.age / 1.6, rad = 8 + 30 * (1 - Math.pow(1 - f, 2));
      g.strokeStyle = rgb(mix(pal.hues[r.i], pal.glow, 0.2), 0.8 * (1 - f));
      g.lineWidth = 1.4 * (1 - f) + 0.3;
      g.beginPath(); g.arc(s.x, s.y, rad, 0, TAU); g.stroke();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  /** How much of a place at height y the arrival has let in (1 once the head has passed it). */
  private revealAt(y: number, head: number | null): number {
    if (this.t0 === null) return 1;
    if (head === null) return 0;
    place(head, COURSE, this.p);
    return this.p.y >= y ? 1 : 0;
  }

  private motes(g: CanvasRenderingContext2D) {
    const w = this.water, buf = this.buf, n = w.n, pal = this.pal;
    w.draw(buf);
    // bucket key: colour (stop + 1, tint) by alpha level
    const keys = this.keys, order = this.order;
    let m = 0;
    for (let i = 0; i < n; i++) {
      const o = i * STRIDE, a = buf[o + 4];
      if (a < 0.02) continue;
      const colour = (buf[o + 6] + 1) * TINTS + buf[o + 7];
      keys[i] = colour * ALPHAS + Math.min(ALPHAS - 1, Math.floor(a * ALPHAS));
      order[m++] = i;
    }
    const idx = Array.from(order.subarray(0, m)).sort((x, y) => keys[x] - keys[y]);
    let at = 0;
    while (at < idx.length) {
      const key = keys[idx[at]];
      let end = at;
      while (end < idx.length && keys[idx[end]] === key) end++;
      const colour = Math.floor(key / ALPHAS), level = key % ALPHAS, alpha = (level + 0.5) / ALPHAS;
      const style = pal.motes[Math.floor(colour / TINTS)]?.[colour % TINTS] ?? pal.motes[0][0];
      g.beginPath();
      for (let j = at; j < end; j++) {
        const o = idx[j] * STRIDE;
        g.moveTo(buf[o], buf[o + 1]); g.lineTo(buf[o + 2], buf[o + 3]);
      }
      g.strokeStyle = style;
      g.globalAlpha = alpha * 0.16; g.lineWidth = 3.6; g.stroke();
      g.globalAlpha = alpha; g.lineWidth = 1.15; g.stroke();
      at = end;
    }
    g.globalAlpha = 1;
  }

  private head(g: CanvasRenderingContext2D, s: number) {
    const pal = this.pal, p = this.p;
    // the tail: back up the course, thinning
    const tail = 70, steps = 24;
    let px = 0, py = 0;
    for (let k = 0; k <= steps; k++) {
      const at = s - (tail * k) / steps;
      if (at < 0) break;
      place(at, COURSE, p);
      if (k) {
        const f = 1 - k / steps, j = stretchAt(at);
        const c = j > 0 ? mix(pal.hues[j - 1], pal.glow, 0.5 + 0.5 * Math.min(1, (at - COURSE.at[j]) / 40)) : pal.glow;
        g.strokeStyle = rgb(c, 0.85 * f * f);
        g.lineWidth = 0.6 + 2.6 * f;
        g.beginPath(); g.moveTo(px, py); g.lineTo(p.x, p.y); g.stroke();
      }
      px = p.x; py = p.y;
    }
    place(s, COURSE, p);
    const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, 18);
    grd.addColorStop(0, rgb(pal.glow, 1));
    grd.addColorStop(0.15, rgb(pal.glow, 0.7));
    grd.addColorStop(1, rgb(pal.glow, 0));
    g.fillStyle = grd;
    g.fillRect(p.x - 18, p.y - 18, 36, 36);
  }

  /** The breath, 0 breathed out to 1 at the top of the in-breath, eased. */
  private breath(now: number): number {
    const per = IN_MS + OUT_MS, t = now % per, x = t < IN_MS ? t / IN_MS : 1 - (t - IN_MS) / OUT_MS;
    return x * x * (3 - 2 * x);
  }

  private sea(g: CanvasRenderingContext2D, now: number) {
    const pal = this.pal, k = this.water.k, q = this.water.q, st = this.state;
    const on = this.seaOn, br = k ? this.breath(now) : 0.5, sway = k ? (br - 0.5) * 7 * on : 0;
    const arrive = st ? q[7] : 0.6;
    g.lineWidth = 0.8;
    for (const wv of this.waves) {
      const x = wv.x + sway * (1 - wv.row * 0.08), y = wv.y + (k ? (0.5 - br) * 1.2 * on : 0);
      const near = Math.exp(-(((x + 9 - PEAK.x) / 64) ** 2)) * (1 - wv.row * 0.12);
      const base = (0.24 - wv.row * 0.025) * on;
      const litA = st ? 0.55 * arrive * near * on : 0;
      g.strokeStyle = rgb(mix(pal.line, pal.glow, Math.min(1, litA * 2)), Math.min(0.85, base + litA));
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 4.5, y - 4 * (0.7 + 0.3 * br), x + 9, y); g.quadraticCurveTo(x + 13.5, y + 4 * (0.7 + 0.3 * br), x + 18, y); g.stroke();
    }
    // the circles ride the swell, glow as much as the water reaching them, and send rings out faster with more
    const bob = k ? (0.5 - br) * 2.5 * this.scale : 0;
    const rise = (1 - this.circlesOn) * 10 * this.scale;
    for (const c of this.parts.circles) c.style.transform = `translateY(${(bob + rise).toFixed(2)}px)`;
    if (this.circlesOn <= 0) return;
    for (const cx of this.parts.slots) {
      const cy = SEA_Y + (k ? (0.5 - br) * 2.5 : 0) + (1 - this.circlesOn) * 10;
      const halo = g.createRadialGradient(cx, cy, CIRCLE_R * 0.6, cx, cy, CIRCLE_R * 2.4);
      halo.addColorStop(0, rgb(pal.glow, (0.06 + 0.22 * arrive) * this.circlesOn));
      halo.addColorStop(1, rgb(pal.glow, 0));
      g.fillStyle = halo;
      g.fillRect(cx - CIRCLE_R * 2.4, cy - CIRCLE_R * 2.4, CIRCLE_R * 4.8, CIRCLE_R * 4.8);
      if (!k || !st) continue;
      for (let r = 0; r < 2; r++) {
        const t = ((now / 1000) * (0.08 + 0.22 * arrive) + r / 2 + cx / 97) % 1;
        g.strokeStyle = rgb(pal.glow, (1 - t) * (0.12 + 0.4 * arrive) * this.circlesOn);
        g.lineWidth = 0.7;
        g.beginPath(); g.ellipse(cx, cy, CIRCLE_R + 3 + 18 * t, (CIRCLE_R + 3 + 18 * t) * 0.92, 0, 0, TAU); g.stroke();
      }
    }
  }
}

export { HEAD_FROM };
