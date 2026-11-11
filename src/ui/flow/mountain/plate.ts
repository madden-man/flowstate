// The plate's light (PLAN-MOUNTAIN.md pass 6, R1): one canvas over the land, and the only light on the mountain is
// what runs down it. Drawn additively over the dim chalk of the SVG (mountain.css blends the canvas in screen), in this
// order each frame:
//   the lit rock    the land's own chalk lines again, in the water's light, only where the water reaches. Built once
//                   (on a resize or a light change) as small layers, each the rock's lines masked by the light one
//                   stretch of water throws (a narrow core and a wide spill), and one a sign masked by its lantern and
//                   coloured by its hue. A frame only lays them on, each as bright as the water in its stretch, so a
//                   gate dragged or the meter moved costs a few image draws and no rebuild.
//   the snow        the cap's held snow glowing as much as there is to let go, the cornice with it
//   the lanterns    a glow in each open sign's hue, gone cold as its gate closes
//   the water       the motes, each a point of light with a soft glow of its own (together they are the river's body,
//                   uneven and alive) and a short tail where it runs fast; tinted under each sign, paling downstream
//   the weather     ./weather.ts, the places' own light
//   the sea         long uneven swells rising and falling on the breath (4 s in, 6 s out), lit only where the river's
//                   light spreads into it; the circles afloat as rings of light, empty inside, riding the swell with
//                   their reflections under them and rings going out over the water, faster the more water arrives
//   the arrival     the head of the first melt and the ring each sign sends out as it kindles (./arrival.ts)
// And the weather and the gates (R2): the meter's weather (./weather.ts capOf) and the water carried down the mountain
// (./water.ts feed), so a change travels down stop by stop. Over the land, under the light, a second canvas holds what
// stands in front of the rock, in its ordinary blending: the snow down to its line and the mist with its veil over the
// stars (Weather.drawAir); it is painted only when the snow or the mist has moved. On the light canvas R2 adds the cap's
// held snow glowing as much as it holds back, the slow snow, the mist lit from under, each closing gate's pool
// brightening as the water backs up (the rock round it lit with it) and what it turns back sinking as embers, and the
// surges: a gate opened (or the meter lifted) lets the pool go as a bright front that runs down, lights the rock as it
// passes and rekindles each sign it reaches with a ring in its hue and a flare of its lantern.
//
// One requestAnimationFrame loop, running only while the plate is on screen, the document visible and the water may
// move (--stream above zero); it stops on stop(). Nothing is read from layout or style in a frame, and a frame makes
// no garbage: the box size comes from a ResizeObserver, the colours from ./palette.ts (read at the start and again
// when the light changes), every gradient is a sprite drawn once, and the buffers are kept. A light change cross-fades
// the canvas from the old light to the new over --t-light, as the page around it breathes (rule 12).
// devicePixelRatio is capped at 2 for the frame rate (the light is soft; the SVG keeps the lines sharp).
import { IN_MS, OUT_MS } from '../breath';
import { CHAKRA_IDS } from '../../../model/mountain';
import { COURSE, H, W, STOPS, SEA_Y, CIRCLE_R, PEAK, SHORE, place, type Placed } from '../../parts/cycle/river';
import { Water, STRIDE, TINTS } from './water';
import { Weather, capOf, capPaths, SNOW_HEAVY, SNOW_CLEAR, type CapWeather } from './weather';
import { readPalette, rgb, mix, type Palette, type RGB } from './palette';
import { headAt, seaIn, circlesIn, snowIn, HEAD_FROM } from './arrival';
import { snowFoot, GULLIES, type Land } from './land';
import { SURGES } from './water';

/** Loops running now, for tests. */
export const running = { loops: 0 };

const DPR_CAP = 2;
const MAX_STEP = 0.05;
const TAU = Math.PI * 2;
/** Alpha levels the motes' tails are bucketed into (one path a colour a level). */
const LEVELS = 3;
/** The light one stretch throws on the rock: the narrow core and the wide spill, in box units. */
const CORE_R = 15, WIDE_R = 40, LANTERN_R = 46, HEAD_R = 60, POOL_R = 26;
/** How long a cancelled gesture's snap waits for the water it puts back (one render, in practice). */
const SNAP_MS = 250;
/** The snow is drawn at this many lines down the horn, and nothing of it reaches below SNOW_BOTTOM (box units). */
const SNOW_LEVELS = 12, SNOW_BOTTOM = 270;
/** How many rings can be going out at once (the arrival's kindling, a surge's rekindling). */
const RINGS = 12;

export type PlateParts = {
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  /** The air: the snow and the mist, in front of the land and under the light (R2). */
  air?: HTMLCanvasElement;
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

/** A piece of lit rock: the rock's lines inside a box (box units), masked by one light. */
type Layer = { c: HTMLCanvasElement; x: number; y: number; w: number; h: number; kind: 'core' | 'wide' | 'lantern' | 'pool'; j: number };

/** A swell on the sea: a row, its span, and how it moves. */
type Swell = { y: number; x0: number; x1: number; amp: number; wave: number; ph: number; w: number; far: number };

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
};

/** A soft round light, drawn once: stops are [radius 0..1, alpha 0..1]. Inside an empty ring the first stops are 0. */
function sprite(c: RGB, stops: readonly (readonly [number, number])[], px = 64): HTMLCanvasElement {
  const s = canvas(px, px), g = s.getContext('2d')!, r = px / 2;
  const grd = g.createRadialGradient(r, r, 0, r, r, r);
  for (const [at, a] of stops) grd.addColorStop(at, rgb(c, a));
  g.fillStyle = grd;
  g.fillRect(0, 0, px, px);
  return s;
}
const MOTE: readonly (readonly [number, number])[] = [[0, 1], [0.12, 0.92], [0.24, 0.5], [0.45, 0.16], [0.7, 0.04], [1, 0]];
const SOFT: readonly (readonly [number, number])[] = [[0, 1], [0.25, 0.55], [0.6, 0.15], [1, 0]];
// a ring of light: nothing inside it, brightest on the ring (at 15 of 36), going out softly
const RING: readonly (readonly [number, number])[] = [[0, 0], [0.33, 0], [0.4, 0.35], [0.42, 0.7], [0.45, 0.35], [0.6, 0.1], [1, 0]];

const STILL_Q = [1, 1, 1, 1, 1, 1, 1, 1], STILL_B = [0, 0, 0, 0, 0, 0, 0];

export class Plate {
  readonly water = new Water();
  readonly weather: Weather;
  private pal!: Palette;
  private g: CanvasRenderingContext2D;
  private rock = document.createElement('canvas');
  private scratch = document.createElement('canvas');
  private headLayer = document.createElement('canvas');
  /** The snow at its heaviest, drawn once: a pale mass with the rock's lines showing dark through it. The air canvas
   *  lays on as much of it as the meter's line takes. */
  private snowTex = document.createElement('canvas');
  private snowLevels: HTMLCanvasElement[] = [];
  /** The horn's crests (its two edges and the arete), where the snow lies thin. */
  private crests: Path2D[] = [];
  private fadeFrom = document.createElement('canvas');
  private layers: Layer[] = [];
  private paths: (Path2D | null)[] = [];
  private body: Path2D[] = [];
  private cornice: Path2D | null = null;
  private airG: CanvasRenderingContext2D | null = null;
  // sprites, read with the palette: a mote's glow by colour, the white disc that masks, the lanterns, the circles' ring
  private spr: HTMLCanvasElement[] = [];
  private disc!: HTMLCanvasElement;
  private lanterns: HTMLCanvasElement[] = [];
  private ring!: HTMLCanvasElement;
  private snowGlow!: HTMLCanvasElement;
  private lineStyle = ''; private glowStyle = ''; private hueStyles: string[] = []; private tintStyles: string[] = [];
  private buf = new Float32Array(this.water.n * STRIDE);
  private counts = new Int32Array(8 * TINTS * LEVELS + 1);
  private starts = new Int32Array(8 * TINTS * LEVELS + 1);
  private sorted = new Int32Array(this.water.n);
  private keys = new Int32Array(this.water.n);
  private w = 0; private dpr = 1; private litK = 1; private scale = 1; private oy = 0;
  private raf = 0; private prev = 0; private seen = typeof IntersectionObserver === 'undefined'; private live = false;
  private io?: IntersectionObserver; private ro?: ResizeObserver; private mq?: MediaQueryList; private unlight?: () => void;
  private layersDirty = true; private answerDirty = true;
  /** How much the plate shows state (--plate-state: 1, none in Still). */
  private state = 1;
  /** The arrival: when it began (performance.now), or null once over; f and the head, as this frame has them. */
  private t0: number | null = null;
  private f = 1; private headS: number | null = null;
  private kindled = new Uint8Array(7);
  private rings = Array.from({ length: RINGS }, () => ({ i: 0, age: -1 }));
  /** A lantern rekindled by a surge flares, and goes back to its own light (0 to 1, per sign). */
  private flare = new Float32Array(7);
  private seaOn = 1; private circlesOn = 1;
  /** A light change: when it began, or null. */
  private fadeT0: number | null = null;
  private p: Placed = { x: 0, y: 0, tx: 0, ty: 1 };
  private swells: Swell[] = [];
  private d = 0; private gates: number[] = [0, 0, 0, 0, 0, 0, 0];
  private override: Partial<CapWeather> | null = null;
  private wasHidden = false;
  private reveal = (y: number) => this.revealAt(y);

  constructor(private parts: PlateParts, snowline: number) {
    this.g = parts.canvas.getContext('2d')!;
    this.airG = parts.air?.getContext('2d') ?? null;
    this.weather = new Weather(snowline);
    // the mist can lie behind the horn: everything but the horn's face, as a clip
    const face = parts.land.marks.find(m => m.kind === 'fill' && m.cls === 'face');
    if (face && typeof Path2D !== 'undefined') {
      const out = new Path2D();
      out.rect(-60, -300, W + 120, H + 360);
      out.addPath(new Path2D(face.d));
      this.weather.behind = out;
    }
    // the sea's swells: rows close together out by the shore and further apart toward us, each row broken into a few
    // long swells of uneven length, thinner and fainter far off
    let sd = 41;
    const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    const ROWS = 9;
    for (let k = 0; k < ROWS; k++) {
      const near = k / (ROWS - 1), y = SHORE + 7 + 74 * Math.pow(near, 1.35);
      let x = -20 + r() * 40;
      while (x < W + 10) {
        const len = 40 + r() * (60 + 110 * near);
        // the swells come and go: not every place on a row has one
        if (r() < 0.3) { x += len * 0.6; continue; }
        this.swells.push({ y: y + (r() - 0.5) * 2, x0: x, x1: x + len, amp: 0.5 + 1.4 * near, wave: 16 + 26 * near + r() * 10, ph: r() * TAU, w: 0.45 + 0.6 * near, far: 1 - near });
        x += len + 8 + r() * (30 + 30 * near);
      }
    }
  }

  /** The meter and the gates (R2 calls this live, under the finger; the water eases to it). */
  /** The next water given is put at once (a cancelled gesture: the plate goes back exactly as it was). */
  snapNext() { this.snapAt = performance.now(); }
  private snapAt = -Infinity;

  setWater(d: number, gates: readonly number[], atOnce = false) {
    this.d = d;
    for (let i = 0; i < 7; i++) this.gates[i] = gates[i] ?? 0;
    // with no loop to ease it (Reduce Motion, hidden) the water is simply as it was set, and nothing travels
    const snap = performance.now() - this.snapAt < SNAP_MS;
    this.snapAt = -Infinity;
    const now = atOnce || !this.raf || snap;
    if (this.state) this.water.feed(d, this.gates, now);
    else this.water.set(STILL_Q, STILL_B, now);
    this.weather.set({ ...capOf(this.state ? d : 0), ...(this.state ? this.override : null) }, now);
    this.answerDirty = true;
    this.wake();
    if (!this.raf) this.paint(performance.now());
  }

  /** The weather over what the meter sets (capLive, for tests and walkthroughs); null gives it back to the meter. In
   *  Still nothing of it shows. */
  setWeather(w: Partial<CapWeather> | null) { this.override = w; this.setWater(this.d, this.gates); }

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
    // the light changes data-light on <html> (the sky, the pin, the moon): read the tokens again once it has landed,
    // and cross-fade from the light it was
    const mo = new MutationObserver(() => { this.beginFade(); queueMicrotask(this.reread); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-light'] });
    this.unlight = () => mo.disconnect();
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
    for (const r of this.rings) r.age = -1;
    this.weather.airDirty = true;
    this.parts.host.dataset.arrive = 'run';
    this.wake();
  }

  /** Ends the arrival now (a tap, or it ran out): everything as it is when steady. */
  finish() {
    this.t0 = null; this.f = 1; this.headS = null;
    this.water.reveal = Infinity;
    this.seaOn = 1; this.circlesOn = 1;
    for (let i = 0; i < 7; i++) if (!this.kindled[i]) { this.kindled[i] = 1; this.parts.kindle(i); }
    for (const c of this.parts.circles) c.style.opacity = '';
    for (const el of this.parts.channels) { el.style.strokeDasharray = ''; el.style.strokeDashoffset = ''; }
    this.parts.host.dataset.arrive = 'done';
    this.answerDirty = true; this.weather.airDirty = true;
    this.parts.arrived();
    if (!this.raf && this.live) this.paint(performance.now());
  }

  /** A touch done on sign i, run on the mountain (PLAN-TASKS.md section 5, T2): a share of its pool runs from the sign
   *  to the sea. Nothing in Still, under Reduce Motion, or while the arrival is still running. */
  release(i: number, share: number): number {
    if (!this.state || this.water.k <= 0 || this.t0 !== null) return 0;
    const out = this.water.release(i, share);
    if (out) { this.answerDirty = true; this.wake(); }
    return out;
  }

  get arriving() { return this.t0 !== null; }
  /** How long the arrival has been running, in ms (0 when there is none). */
  get arrivingFor() { return this.t0 === null ? 0 : performance.now() - this.t0; }

  private size(w: number, h: number) {
    if (!w || !h) return;
    this.w = w;
    this.dpr = Math.min(DPR_CAP, globalThis.devicePixelRatio || 1);
    this.scale = w / W; this.oy = h - H * this.scale;
    const cw = Math.round(w * this.dpr), ch = Math.round(h * this.dpr);
    for (const c of [this.parts.canvas, this.fadeFrom, this.parts.air]) if (c) { c.width = cw; c.height = ch; }
    this.weather.airDirty = true;
    // the lit rock is soft light over sharp SVG lines: it is kept at a little over the CSS pixel
    this.litK = Math.max(1, this.dpr * 0.6);
    this.layersDirty = true;
    if (this.live && !this.raf) this.paint(performance.now());
  }

  /** The tokens: colours, --stream, --plate-state, the arrival's length; the sprites made from them. Never inside a frame. */
  private read() {
    this.pal = readPalette(this.parts.host);
    const st = parseFloat(getComputedStyle(this.parts.host).getPropertyValue('--plate-state'));
    const was = this.state;
    this.state = Number.isFinite(st) ? Math.max(0, Math.min(1, st)) : 1;
    const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.water.k = calm ? 0 : this.pal.stream;
    this.water.plain = this.state === 0;
    this.parts.canvas.dataset.stream = String(this.water.k);
    const pal = this.pal;
    // a mote's glow in every colour it can take, (stop + 1) * TINTS + tint
    this.spr = [];
    for (let stop = -1; stop < 7; stop++) for (let t = 0; t < TINTS; t++) this.spr.push(sprite(this.moteColour(stop, t), MOTE, 48));
    this.disc = sprite([255, 255, 255], SOFT, 64);
    this.lanterns = pal.hues.map(h => sprite(h, [[0, 1], [0.4, 0.35], [1, 0]], 64));
    this.ring = sprite(pal.glow, RING, 96);
    this.snowGlow = sprite(pal.glow, [[0, 1], [0.5, 0.5], [1, 0]], 64);
    this.lineStyle = rgb(pal.line); this.glowStyle = rgb(pal.glow);
    this.hueStyles = pal.hues.map(h => rgb(mix(h, pal.glow, 0.2)));
    this.tintStyles = [];
    for (let stop = -1; stop < 7; stop++) for (let t = 0; t < TINTS; t++) this.tintStyles.push(rgb(this.moteColour(stop, t)));
    if (was !== this.state) {
      // into Still nothing of a state may finish: no ring going out in its hue, no flare
      if (!this.state) { for (const r of this.rings) r.age = -1; this.flare.fill(0); }
      this.setWater(this.d, this.gates, true);
    }
    this.layersDirty = true; this.answerDirty = true; this.weather.airDirty = true;
  }
  private moteColour(stop: number, t: number): RGB {
    if (stop < 0) return this.pal.glow;
    const f = t / (TINTS - 1);
    return mix(this.pal.hues[stop], this.pal.glow, Math.pow(f, 0.8) * 0.9 + 0.1 * f);
  }
  private reread = () => {
    if (!this.live) return;
    this.read();
    if (this.water.k === 0 && this.t0 !== null) this.finish();
    this.wake();
    if (!this.raf) this.paint(performance.now());
  };

  /** Keeps the frame as it is in the old light, to fade out of while the new one fades in. */
  private beginFade() {
    if (!this.live || !this.w || !this.pal || !(this.pal.light > 0) || !this.raf) return;
    const c = this.fadeFrom, g = c.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'copy';
    g.drawImage(this.parts.canvas, 0, 0);
    g.globalCompositeOperation = 'source-over';
    this.fadeT0 = performance.now();
  }

  private wake = () => {
    if (document.visibilityState === 'hidden') this.wasHidden = true;
    const may = this.live && this.seen && document.visibilityState !== 'hidden' && this.parts.canvas.isConnected
      && (this.water.k > 0 || this.t0 !== null);
    // back from another app: whatever was on its way down has long since got there, so it is drawn arrived, not
    // replayed late
    if (may && !this.raf && this.wasHidden) { this.wasHidden = false; this.setWater(this.d, this.gates, true); }
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
    if (this.water.easing) this.answerDirty = true;
    this.water.step(dt);
    this.weather.step(dt, this.water.q, this.water.k, this.water.b);
    for (const r of this.rings) if (r.age >= 0) { r.age += dt; if (r.age > 1.6) r.age = -1; }
    // a surge has reached a sign: it rekindles, a ring in its hue going out and its lantern flaring
    const reached = this.water.reached;
    for (let i = 0; i < 7; i++) {
      this.flare[i] = Math.max(0, this.flare[i] - dt * 0.7);
      if (!reached[i]) continue;
      reached[i] = 0;
      if (this.state && this.t0 === null) { this.sendRing(i); this.flare[i] = 1; }
    }
    this.paint(now);
    this.raf = requestAnimationFrame(this.frame);
  };

  // ---- the arrival's clock ----

  /** Moves the arrival on to now: f (0 to 1, 1 when over) and the head; kindles signs as the head passes them. */
  private arrival(now: number) {
    if (this.t0 === null) { this.f = 1; this.headS = null; return; }
    const f = Math.min(1, (now - this.t0) / this.pal.arrive);
    const h = headAt(f), s = h === null ? null : h * COURSE.total;
    this.water.reveal = s === null ? 0 : s - 2;
    if (s !== null) {
      for (let i = 0; i < 7; i++) {
        if (!this.kindled[i] && s >= COURSE.at[i + 1]) {
          this.kindled[i] = 1; this.parts.kindle(i);
          if (this.state) this.sendRing(i);
        }
      }
    }
    // the channel is drawn by the head itself, as far as it has run (here, not in the CSS, so the two never part)
    for (let i = 0; i < 8; i++) {
      const el = this.parts.channels[i];
      if (!el) continue;
      const from = COURSE.at[i], to = i === 7 ? COURSE.mouth : COURSE.at[i + 1];
      const got = s === null ? 0 : Math.max(0, Math.min(1, (s - from) / (to - from)));
      el.style.strokeDasharray = '1';
      el.style.strokeDashoffset = (1 - got).toFixed(3);
    }
    this.seaOn = seaIn(f); this.circlesOn = circlesIn(f);
    for (const c of this.parts.circles) c.style.opacity = this.circlesOn < 1 ? this.circlesOn.toFixed(3) : '';
    if (f >= 1) { this.finish(); return; }
    this.f = f; this.headS = s;
  }

  /** Sends a ring out from sign i (the oldest going is taken if all are). */
  private sendRing(i: number) {
    let r = this.rings[0];
    for (const x of this.rings) { if (x.age < 0) { r = x; break; } if (x.age > r.age) r = x; }
    r.i = i; r.age = 0;
  }

  // ---- the lit rock, built once ----

  private toBox(g: CanvasRenderingContext2D, k = this.dpr) { g.setTransform(this.scale * k, 0, 0, this.scale * k, 0, this.oy * k); }

  /** The land's lines in the water's light, at full strength everywhere, in box units times K (no offset). */
  private buildRock(K: number) {
    const g = this.rock.getContext('2d')!, pal = this.pal;
    this.rock.width = Math.ceil(W * K); this.rock.height = Math.ceil(H * K);
    g.setTransform(K, 0, 0, K, 0, 0);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const marks = this.parts.land.marks;
    if (this.paths.length !== marks.length) this.paths = marks.map(m => (m.d ? new Path2D(m.d) : null));
    this.crests = marks.flatMap((m, i) => (m.kind === 'pen' && (m.cls === 'bold' || m.cls === 'arete') && this.paths[i] ? [this.paths[i]!] : []));
    // the lit face takes a little of the light too, so the rock reads as rock and not as wire
    marks.forEach((m, i) => {
      const path = this.paths[i];
      if (!path || m.kind !== 'fill' || (m.cls !== 'face' && m.cls !== 'horn')) return;
      g.fillStyle = rgb(pal.glow, m.cls === 'face' ? 0.06 : 0.02);
      g.fill(path);
    });
    marks.forEach((m, i) => {
      const path = this.paths[i];
      if (!path || m.kind !== 'pen' || m.lit <= 0) return;
      g.strokeStyle = rgb(pal.glow, Math.min(1, m.lit));
      g.lineWidth = m.w * 1.05;
      g.stroke(path);
    });
  }

  /** The snow, drawn once a light and a size at SNOW_LEVELS lines down the horn: a pale mass graded from the summit
   *  down into the night, the shadow side hatched, the rock under it showing through as dark lines (the horn's edges,
   *  the arete, the crags), a dark bed where the stream's first run goes through it, and no hard edge anywhere: the
   *  foot is feathered and broken, drifts lie down the gullies, and the snow thins on the crests. A frame lays on the
   *  two levels either side of the meter's line, cross-faded (drawSnow). */
  private buildSnow(K: number) {
    const pal = this.pal, tex = this.snowTex, c = COURSE;
    tex.width = Math.ceil(W * K); tex.height = Math.ceil(SNOW_BOTTOM * K);
    const g = tex.getContext('2d')!;
    g.setTransform(K, 0, 0, K, 0, 0);
    const big = capPaths(SNOW_HEAVY + 40);
    const lit = g.createLinearGradient(0, PEAK.y, 0, SNOW_HEAVY + 30);
    lit.addColorStop(0, rgb(mix(pal.plate, pal.line, 0.66)));
    lit.addColorStop(0.35, rgb(mix(pal.plate, pal.line, 0.46)));
    lit.addColorStop(1, rgb(mix(pal.plate, pal.line, 0.22)));
    g.fillStyle = lit; g.fill(big.lit);
    const shade = g.createLinearGradient(0, PEAK.y, 0, SNOW_HEAVY + 30);
    shade.addColorStop(0, rgb(mix(pal.deep, pal.line, 0.26)));
    shade.addColorStop(1, rgb(mix(pal.deep, pal.line, 0.08)));
    g.fillStyle = shade; g.fill(big.shade);
    g.lineCap = 'round'; g.lineJoin = 'round';
    let sd = 53;
    const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    // engraved: soft streaks down the lit snow along the fall line, close hatching across the shadow side
    g.save(); g.clip(big.lit);
    g.strokeStyle = rgb(pal.deep, 0.2); g.lineWidth = 0.5;
    g.beginPath();
    for (let k = 0; k < 140; k++) {
      const y = PEAK.y + 10 + r() * (SNOW_HEAVY - PEAK.y), x = PEAK.x - 70 + r() * 92, len = 4 + r() * 10;
      g.moveTo(x, y); g.lineTo(x - len * 0.35, y + len);
    }
    g.stroke();
    g.restore();
    g.save(); g.clip(big.shade);
    g.strokeStyle = rgb(pal.deep, 0.6); g.lineWidth = 0.5;
    g.beginPath();
    for (let y = PEAK.y; y < SNOW_HEAVY + 40; y += 2.4) { g.moveTo(PEAK.x - 10, y + 8); g.lineTo(PEAK.x + 90, y - 22 + (r() - 0.5) * 2); }
    g.stroke();
    g.restore();
    // rock through snow: the heavy lines darkest, the hatching barely
    this.parts.land.marks.forEach((m, i) => {
      const path = this.paths[i];
      if (!path || m.kind !== 'pen' || m.cls === 'tree' || m.cls === 'scree' || m.cls === 'ridge' || m.cls === 'ridge-far' || m.cls.startsWith('horn')) return;
      g.strokeStyle = rgb(pal.deep, m.cls === 'bold' || m.cls === 'arete' ? 0.9 : m.cls === 'hatch' ? 0.35 : 0.75);
      g.lineWidth = m.w * (m.cls === 'bold' || m.cls === 'arete' ? 1.5 : 1.15);
      g.stroke(path);
    });
    // the stream's bed: the water runs through the snow in a dark cut, so its light shows on it
    const bed = new Path2D();
    for (let s = 0; s <= c.at[3] + 30; s += 2) { place(s, c, this.p); if (s) bed.lineTo(this.p.x, this.p.y); else bed.moveTo(this.p.x, this.p.y); }
    g.strokeStyle = rgb(pal.deep, 0.35); g.lineWidth = 9; g.stroke(bed);
    g.strokeStyle = rgb(pal.deep, 0.6); g.lineWidth = 4; g.stroke(bed);

    // the levels: the texture kept only where the snow lies at that line
    const disc = this.disc;
    this.snowLevels = [];
    for (let k = 0; k < SNOW_LEVELS; k++) {
      const line = SNOW_CLEAR + ((SNOW_HEAVY - SNOW_CLEAR) * k) / (SNOW_LEVELS - 1);
      const lc = canvas(tex.width, Math.ceil(Math.min(SNOW_BOTTOM, line + 40) * K)), lg = lc.getContext('2d')!;
      lg.setTransform(K, 0, 0, K, 0, 0);
      const foot = snowFoot(line);
      // the body, held back from the foot
      lg.fillStyle = rgb([255, 255, 255]);
      lg.fill(capPaths(line - 7).all);
      // the foot, feathered and broken: soft stamps along it, each its own size, some reaching on down
      for (const run of foot.rim) for (let i = 0; i < run.length; i++) {
        const [x, y] = run[i], rr = 4 + r() * 5;
        lg.globalAlpha = 0.55 + 0.45 * r();
        lg.drawImage(disc, x - rr, y - rr * 1.4 - 2, rr * 2, rr * 2);
        if (r() < 0.18) { const d2 = 2 + r() * 4; lg.globalAlpha = 0.35 * r(); lg.drawImage(disc, x - d2, y + 1 + r() * 5, d2 * 2, d2 * 2); }
      }
      // drifts down the gullies the foot reaches into
      const reach = Math.min(1, (line - PEAK.y) / 90);
      for (const [gx, gw, gl] of GULLIES) {
        for (let t = 0; t < 1; t += 0.2) {
          const y = line + gl * reach * t, w2 = gw * (1 - 0.6 * t);
          lg.globalAlpha = 0.5 * (1 - t);
          lg.drawImage(disc, gx - w2, y - w2 * 0.8, w2 * 2, w2 * 2.4);
        }
      }
      // thinner on the crests: the arete and the horn's edges let the rock through
      lg.globalAlpha = 1;
      lg.globalCompositeOperation = 'destination-out';
      lg.strokeStyle = rgb([0, 0, 0], 0.35); lg.lineWidth = 3;
      for (const m of this.crests) lg.stroke(m);
      lg.globalCompositeOperation = 'source-in';
      lg.drawImage(tex, 0, 0, tex.width, lc.height, 0, 0, W, lc.height / K);
      lg.globalCompositeOperation = 'source-over';
      this.snowLevels.push(lc);
    }
  }

  /** Lays the snow on at the meter's line: the two levels either side of it, cross-faded (a = how much). */
  private drawSnow = (g: CanvasRenderingContext2D, a: number) => {
    const L = this.snowLevels;
    if (!L.length || a <= 0) return;
    const f = Math.max(0, Math.min(SNOW_LEVELS - 1, ((this.weather.cap.snowline - SNOW_CLEAR) / (SNOW_HEAVY - SNOW_CLEAR)) * (SNOW_LEVELS - 1)));
    const k0 = Math.floor(f), k1 = Math.min(SNOW_LEVELS - 1, k0 + 1), t = f - k0, K = this.snowTex.width / W;
    const was = g.globalAlpha;
    g.globalAlpha = was * a * (1 - t);
    g.drawImage(L[k0], 0, 0, W, L[k0].height / K);
    if (t > 0.01) { g.globalAlpha = was * a * t; g.drawImage(L[k1], 0, 0, W, L[k1].height / K); }
    g.globalAlpha = was;
  };

  /** The layers: per stretch the rock lit by a narrow core and a wide spill of its water, per sign by its lantern. */
  private buildLayers() {
    const K = this.scale * this.litK;
    this.buildRock(K);
    // the snow is soft: a little over half the device pixel is enough (twelve levels of it are kept)
    this.buildSnow(this.scale * this.dpr * 0.6);
    this.weather.airDirty = true;
    this.layers = [];
    const c = COURSE;
    const field = (x: number, y: number, w: number, h: number, kind: Layer['kind'], j: number, discs: (put: (x: number, y: number, r: number, a: number) => void) => void) => {
      const lc = canvas(w * K, h * K), lg = lc.getContext('2d')!;
      lg.drawImage(this.rock, x * K, y * K, w * K, h * K, 0, 0, lc.width, lc.height);
      // the light field, in its own canvas, then the rock kept only where it falls
      const sc = this.scratch;
      sc.width = lc.width; sc.height = lc.height;
      const sg = sc.getContext('2d')!;
      sg.setTransform(K, 0, 0, K, -x * K, -y * K);
      sg.globalCompositeOperation = 'lighter';
      discs((dx, dy, r, a) => { sg.globalAlpha = Math.min(1, a); sg.drawImage(this.disc, dx - r, dy - r, 2 * r, 2 * r); });
      lg.globalCompositeOperation = 'destination-in';
      lg.drawImage(sc, 0, 0);
      if (kind === 'lantern') {
        lg.globalCompositeOperation = 'source-in';
        lg.fillStyle = this.hueStyles[j];
        lg.fillRect(0, 0, lc.width, lc.height);
      }
      this.layers.push({ c: lc, x, y, w, h, kind, j });
    };
    for (let j = 0; j < 8; j++) {
      const from = c.at[j], to = j === 7 ? c.total : c.at[j + 1];
      for (const kind of ['core', 'wide'] as const) {
        const R = (kind === 'core' ? CORE_R : WIDE_R) * (j === 7 ? 1.4 : 1);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let s = from; s <= to; s += 3) { place(s, c, this.p); x0 = Math.min(x0, this.p.x); y0 = Math.min(y0, this.p.y); x1 = Math.max(x1, this.p.x); y1 = Math.max(y1, this.p.y); }
        if (j === 0) y0 = Math.min(y0, PEAK.y - 10);
        x0 = Math.max(0, x0 - R * 1.8); y0 = Math.max(0, y0 - R); x1 = Math.min(W, x1 + R * 1.8); y1 = Math.min(H, y1 + R);
        field(x0, y0, x1 - x0, y1 - y0, kind, j, put => {
          for (let s = from; s <= to; s += 5) {
            place(s, c, this.p);
            const sea = s > c.mouth ? 1.5 : 1;
            put(this.p.x, this.p.y, R * sea, kind === 'core' ? 0.3 : 0.12);
          }
          // the snow lets the water go: the spring glows with the first stretch
          if (j === 0 && kind === 'wide') put(PEAK.x, PEAK.y + 24, 40, 0.4);
          // the river fans into the sea
          if (j === 7 && kind === 'wide') put(PEAK.x, SHORE + 14, 74, 0.6);
        });
      }
    }
    CHAKRA_IDS.forEach((id, i) => {
      const st = STOPS[id];
      field(st.x - LANTERN_R, st.y - LANTERN_R, 2 * LANTERN_R, 2 * LANTERN_R, 'lantern', i, put => put(st.x, st.y, LANTERN_R, 1));
      // the pool a closing gate backs up: the rock round the last of the water above the sign
      const at = c.at[i + 1];
      place(at - 12, c, this.p);
      const px = this.p.x, py = this.p.y;
      field(px - POOL_R * 1.4, py - POOL_R * 1.4, POOL_R * 2.8, POOL_R * 2.8, 'pool', i, put => {
        for (let s = at - 24; s <= at; s += 4) { place(s, c, this.p); put(this.p.x, this.p.y, POOL_R, 0.35); }
      });
    });
    this.headLayer.width = Math.ceil(2 * HEAD_R * K); this.headLayer.height = this.headLayer.width;
    // the course's body, a path a stretch
    this.body = [];
    for (let j = 0; j < 8; j++) {
      const from = c.at[j], to = j === 7 ? c.mouth + 6 : c.at[j + 1], p = new Path2D();
      let first = true;
      for (let k = 0; k < c.ls.length; k++) {
        if (c.ls[k] < from - 0.01 || c.ls[k] > to + 0.01) continue;
        if (first) { p.moveTo(c.xs[k], c.ys[k]); first = false; } else p.lineTo(c.xs[k], c.ys[k]);
      }
      this.body.push(p);
    }
    this.layersDirty = false;
  }

  /** The SVG answers the water too: each channel as wide as what runs in it, the dark coming down below a closed gate,
   *  and the circles standing out with what reaches the sea. In Still every stretch is the same and nothing is dark. */
  private answer() {
    const q = this.water.q;
    for (let i = 0; i < 8; i++) this.parts.channels[i]?.setAttribute('stroke-width', (1 + 2.5 * q[i]).toFixed(2));
    // two stops a sign: what runs above it, then a little below it what gets through. The dark is steep: a gate half
    // shut already puts the mountain under it in the dark, so a closed gate reads at a glance
    for (let i = 0; i < this.parts.shade.length; i++) {
      const v = q[(i >> 1) + (i & 1)];
      this.parts.shade[i].setAttribute('stop-opacity', (0.94 * Math.pow(1 - v, 0.7) * this.state).toFixed(3));
    }
    this.parts.host.style.setProperty('--sea', q[7].toFixed(3));
    this.answerDirty = false;
  }

  // ---- a frame ----

  paint(now: number) {
    if (!this.w || !this.pal) return;
    this.arrival(now);
    if (this.layersDirty) this.buildLayers();
    if (this.weather.airDirty || this.t0 !== null) this.paintAir();
    const head = this.headS;
    const g = this.g, st = this.state, k = this.water.k;
    if (this.answerDirty) this.answer();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, this.parts.canvas.width, this.parts.canvas.height);
    g.globalCompositeOperation = 'lighter';
    this.toBox(g);
    g.lineCap = 'round'; g.lineJoin = 'round';

    if (st) { this.litRock(g, head); this.snow(g); this.pools(g); this.lanternGlow(g); }
    if (k > 0 || this.t0 !== null) this.motes(g);
    if (st) this.weather.draw(g, this.pal, this.water.q, this.water.b, this.reveal);
    this.sea(g, now);
    if (head !== null && head < COURSE.total) this.head(g, head, now, 1);
    if (st && k > 0) this.surges(g, now);
    // each sign kindling sends a ring out in its hue
    for (const r of this.rings) {
      if (r.age < 0) continue;
      const s = STOPS[CHAKRA_IDS[r.i]], f = r.age / 1.6, rad = 8 + 30 * (1 - Math.pow(1 - f, 2));
      g.strokeStyle = this.hueStyles[r.i];
      g.globalAlpha = 0.55 * (1 - f) * (1 - f);
      g.lineWidth = 0.9 * (1 - f) + 0.2;
      g.beginPath(); g.arc(s.x, s.y, rad, 0, TAU); g.stroke();
    }
    // a light change: the old light fades out as the new fades in
    if (this.fadeT0 !== null) {
      const t = (now - this.fadeT0) / this.pal.light;
      if (t >= 1 || !(t >= 0)) this.fadeT0 = null;
      else {
        const e = t * t * (3 - 2 * t);
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'destination-out';
        g.globalAlpha = 1 - e;
        g.fillStyle = this.glowStyle;
        g.fillRect(0, 0, this.parts.canvas.width, this.parts.canvas.height);
        g.globalCompositeOperation = 'lighter';
        g.drawImage(this.fadeFrom, 0, 0);
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  /** Lays the lit rock on: each stretch's layers as bright as its water, each lantern as open as its gate, and while
   *  the arrival runs only as far as the head has got, with the head lighting what it passes. */
  private litRock(g: CanvasRenderingContext2D, head: number | null) {
    const q = this.water.q, b = this.water.b, c = COURSE;
    const upto = this.t0 === null ? Infinity : head ?? -1;
    for (const L of this.layers) {
      let a: number;
      if (L.kind === 'lantern') a = (0.85 * (1 - b[L.j]) * q[L.j] + 0.5 * this.flare[L.j]) * this.kindled[L.j];
      else if (L.kind === 'pool') a = 0.75 * this.poolLight(L.j);
      else if (L.kind === 'core') a = 0.5 * Math.pow(q[L.j], 0.8);
      else a = 0.55 * Math.pow(q[L.j], 1.5);
      if (a < 0.01) continue;
      if (L.kind !== 'lantern' && L.kind !== 'pool' && upto < Infinity) {
        const from = c.at[L.j], to = L.j === 7 ? c.total : c.at[L.j + 1];
        if (upto <= from) continue;
        if (upto < to) {
          // the stretch the head is in: lit only along the water behind it
          const R = (L.kind === 'core' ? CORE_R : WIDE_R);
          g.save();
          g.beginPath();
          for (let s = from; s <= upto; s += 6) { place(s, c, this.p); g.moveTo(this.p.x + R, this.p.y); g.arc(this.p.x, this.p.y, R, 0, TAU); }
          g.clip();
          g.globalAlpha = a;
          g.drawImage(L.c, L.x, L.y, L.w, L.h);
          g.restore();
          continue;
        }
      }
      g.globalAlpha = a;
      g.drawImage(L.c, L.x, L.y, L.w, L.h);
    }
    // the head lights the rock it passes, brightest where it is
    if (head !== null && head < c.total) this.headLight(g, head, 0.9);
    // the river's body: a faint thread a stretch, so the course reads even where the motes are few
    g.globalAlpha = 1;
    for (let j = 0; j < 8; j++) {
      if (upto < Infinity && upto < c.at[j] + 1) break;
      const v = q[j];
      g.strokeStyle = j > 0 && this.kindled[j - 1] ? this.tintStyles[j * TINTS + 2] : this.glowStyle;
      g.globalAlpha = 0.08 * (0.3 + 0.7 * v) * (upto < Infinity ? 0 : 1);
      g.lineWidth = 4.5 * (0.4 + 0.6 * v);
      g.stroke(this.body[j]);
    }
    g.globalAlpha = 1;
  }

  /** The air canvas: the snow and the mist (Weather.drawAir), in the box's units, only when they have moved. */
  private paintAir() {
    const ag = this.airG;
    if (!ag || !this.parts.air) { this.weather.airDirty = false; return; }
    ag.setTransform(1, 0, 0, 1, 0, 0);
    ag.globalAlpha = 1; ag.globalCompositeOperation = 'source-over';
    ag.clearRect(0, 0, this.parts.air.width, this.parts.air.height);
    this.toBox(ag);
    this.weather.drawAir(ag, this.pal, this.t0 === null ? 1 : snowIn(this.f), this.drawSnow);
  }

  /** The cap's held snow and its cornice, glowing with what it holds back: brighter the heavier the day, so a heavy
   *  day is a dark mountain with a bright cap. */
  private snow(g: CanvasRenderingContext2D) {
    if (!this.cornice) {
      const m = this.parts.land.marks.find(x => x.kind === 'fill' && x.cls === 'cornice');
      this.cornice = new Path2D(m?.d ?? '');
    }
    const on = this.t0 === null ? 1 : snowIn(this.f);
    if (on <= 0) return;
    const held = this.weather.cap.held, q0 = this.water.q[0];
    // lit from within: the snow itself again, added in light, the more the heavier the day (it is brightest high on
    // the horn, where the texture is), and the cornice with it
    this.drawSnow(g, (0.18 + 0.5 * held) * on);
    g.fillStyle = this.glowStyle;
    g.globalAlpha = (0.04 + 0.08 * held) * on;
    g.fill(this.cornice);
    // where the water leaves the snow, it glows
    g.globalAlpha = 0.28 * (0.35 + 0.65 * q0) * on;
    g.drawImage(this.snowGlow, PEAK.x - 22, PEAK.y + 6, 44, 44);
    g.globalAlpha = 1;
  }

  /** How bright the pool above sign i is: the water backed up by its gate, more the longer it has been held. */
  private poolLight(i: number): number {
    const w = this.water;
    return w.b[i] * w.q[i] * (0.45 + 0.55 * Math.min(1, w.pooled[i] * 1.6)) * this.kindled[i];
  }

  /** The pools above the closing gates: the backed-up water glowing over the last of the stretch above each sign. */
  private pools(g: CanvasRenderingContext2D) {
    const c = COURSE;
    for (let i = 0; i < 7; i++) {
      const a = this.poolLight(i);
      if (a < 0.01) continue;
      for (let k = 0; k < 3; k++) {
        place(c.at[i + 1] - 5 - k * 7, c, this.p);
        const r = 9 + 5 * a + k * 2;
        g.globalAlpha = Math.min(1, a * (0.55 - k * 0.12));
        g.drawImage(this.spr[i * TINTS + TINTS - 1], this.p.x - r, this.p.y - r, 2 * r, 2 * r);
      }
    }
    g.globalAlpha = 1;
  }

  /** The surges let go by an opened gate or a lifted meter: a bright front, lighting the rock as it goes. */
  private surges(g: CanvasRenderingContext2D, now: number) {
    const w = this.water;
    for (let k = 0; k < SURGES; k++) {
      const amp = w.surgeAmp[k];
      if (amp <= 0) continue;
      const s = w.surgeHead(k);
      if (s >= COURSE.total) continue;
      this.headLight(g, s, 0.75 * Math.min(1, amp * 1.4));
      this.head(g, s, now, Math.min(1, 0.35 + amp), w.surgeFrom[k]);
    }
  }

  private lanternGlow(g: CanvasRenderingContext2D) {
    const q = this.water.q, b = this.water.b;
    for (let i = 0; i < 7; i++) {
      const a = (0.6 * (1 - b[i]) * (0.35 + 0.65 * q[i]) + 0.55 * this.flare[i]) * this.kindled[i];
      if (a < 0.02) continue;
      const s = STOPS[CHAKRA_IDS[i]];
      g.globalAlpha = a;
      g.drawImage(this.lanterns[i], s.x - 24, s.y - 24, 48, 48);
    }
    g.globalAlpha = 1;
  }

  private motes(g: CanvasRenderingContext2D) {
    const w = this.water, buf = this.buf, n = w.n;
    w.draw(buf);
    // tails first, a path a colour and a level: a counting sort, no garbage
    const keys = this.keys, counts = this.counts, starts = this.starts, sorted = this.sorted, NK = 8 * TINTS * LEVELS;
    counts.fill(0);
    for (let i = 0; i < n; i++) {
      const o = i * STRIDE, a = buf[o + 4];
      if (a < 0.03 || Math.abs(buf[o] - buf[o + 2]) + Math.abs(buf[o + 1] - buf[o + 3]) < 0.8) { keys[i] = NK; continue; }
      const colour = (buf[o + 6] + 1) * TINTS + buf[o + 7];
      keys[i] = colour * LEVELS + Math.min(LEVELS - 1, Math.floor(Math.min(1, a) * LEVELS));
      counts[keys[i]]++;
    }
    let acc = 0;
    for (let k = 0; k < NK; k++) { starts[k] = acc; acc += counts[k]; }
    const total = acc;
    counts.fill(0);
    for (let i = 0; i < n; i++) { const kk = keys[i]; if (kk < NK) sorted[starts[kk] + counts[kk]++] = i; }
    g.lineWidth = 0.7;
    for (let at = 0; at < total;) {
      const key = keys[sorted[at]];
      let end = at;
      g.beginPath();
      while (end < total && keys[sorted[end]] === key) {
        const o = sorted[end] * STRIDE;
        g.moveTo(buf[o], buf[o + 1]); g.lineTo(buf[o + 2], buf[o + 3]);
        end++;
      }
      g.strokeStyle = this.tintStyles[Math.floor(key / LEVELS)];
      g.globalAlpha = 0.5 * ((key % LEVELS) + 0.5) / LEVELS;
      g.stroke();
      at = end;
    }
    // then each mote's own light; every third throws a wide soft glow, and together they are the river's body
    for (let i = 0; i < n; i++) {
      const o = i * STRIDE, a = buf[o + 4];
      if (a < 0.02) continue;
      const spr = this.spr[(buf[o + 6] + 1) * TINTS + buf[o + 7]], r = buf[o + 5], x = buf[o], y = buf[o + 1];
      if (i & 1) { g.globalAlpha = Math.min(1, a) * 0.07; g.drawImage(spr, x - r * 3.6, y - r * 3.6, r * 7.2, r * 7.2); }
      g.globalAlpha = Math.min(1, a);
      g.drawImage(spr, x - r, y - r, 2 * r, 2 * r);
      // a glint: it flares past its own size for a moment
      if (a > 1) { g.globalAlpha = Math.min(1, (a - 1) * 0.6); g.drawImage(spr, x - r * 1.7, y - r * 1.7, r * 3.4, r * 3.4); }
    }
    g.globalAlpha = 1;
  }

  /** The rock round a running head, lit by it (a = how bright). */
  private headLight(g: CanvasRenderingContext2D, s: number, a: number) {
    place(s, COURSE, this.p);
    const K = this.scale * this.litK, hl = this.headLayer, hg = hl.getContext('2d')!, x = this.p.x - HEAD_R, y = this.p.y - HEAD_R;
    hg.globalCompositeOperation = 'copy';
    hg.drawImage(this.rock, x * K, y * K, 2 * HEAD_R * K, 2 * HEAD_R * K, 0, 0, hl.width, hl.height);
    hg.globalCompositeOperation = 'destination-in';
    hg.drawImage(this.disc, 0, 0, hl.width, hl.height);
    g.globalAlpha = a;
    g.drawImage(hl, x, y, 2 * HEAD_R, 2 * HEAD_R);
    g.globalAlpha = 1;
  }

  /** The first melt let go, or a surge: a bright head with spray thrown round it and a long tail down the course
   *  behind it, back no further than where it was let go (from). a: how bright. */
  private head(g: CanvasRenderingContext2D, s: number, now: number, a: number, from = 0) {
    const p = this.p, tail = 80, steps = 26;
    let px = 0, py = 0;
    g.strokeStyle = this.glowStyle;
    for (let k = 0; k <= steps; k++) {
      const at = s - (tail * k) / steps;
      if (at < from) break;
      place(at, COURSE, p);
      if (k) {
        const f = 1 - k / steps;
        g.globalAlpha = 0.8 * f * f * a;
        g.lineWidth = 0.5 + 3 * f;
        g.beginPath(); g.moveTo(px, py); g.lineTo(p.x, p.y); g.stroke();
      }
      px = p.x; py = p.y;
    }
    place(s, COURSE, p);
    const spr = this.spr[0];
    g.globalAlpha = 0.35 * a; g.drawImage(spr, p.x - 22, p.y - 22, 44, 44);
    g.globalAlpha = a; g.drawImage(spr, p.x - 6, p.y - 6, 12, 12);
    // spray thrown off the head as it goes, flickering
    const t = now / 1000;
    for (let k = 0; k < 14; k++) {
      const back = (k * 3.7) % 18, sp = Math.sin(t * 7 + k * 2.3), off = Math.sin(t * 3.1 + k * 1.7) * (2 + back * 0.4);
      place(Math.max(from, s - back), COURSE, p);
      g.globalAlpha = Math.max(0, 0.55 * a * sp) * (1 - back / 18);
      const r = 1 + (k % 3) * 0.6;
      g.drawImage(spr, p.x - p.ty * off - r, p.y + p.tx * off - r, 2 * r, 2 * r);
    }
    g.globalAlpha = 1;
  }

  /** How much of a place at height y the arrival has let in (1 once the head has passed it). */
  private revealAt(y: number): number {
    if (this.t0 === null) return 1;
    if (this.headS === null) return 0;
    place(this.headS, COURSE, this.p);
    return this.p.y >= y ? 1 : 0;
  }

  /** The breath, 0 breathed out to 1 at the top of the in-breath, eased. */
  private breath(now: number): number {
    const per = IN_MS + OUT_MS, t = now % per, x = t < IN_MS ? t / IN_MS : 1 - (t - IN_MS) / OUT_MS;
    return x * x * (3 - 2 * x);
  }

  private sea(g: CanvasRenderingContext2D, now: number) {
    const k = this.water.k, q = this.water.q, st = this.state, on = this.seaOn;
    const br = k ? this.breath(now) : 0.5, t = k ? now / 1000 : 0;
    const arrive = st ? q[7] : 0.6;
    // the swells: rising and falling together on the breath, each moving on its own, lit where the river spreads
    const rise = (0.5 - br) * 2.2 * on, sway = (br - 0.5) * 6 * on;
    g.lineCap = 'butt';
    for (const sw of this.swells) {
      const y0 = sw.y + rise * (1 - 0.6 * sw.far), len = sw.x1 - sw.x0, n = Math.max(3, Math.round(len / 4));
      const om = 0.5 + 0.4 * sw.far;
      let px = 0, py = 0;
      g.lineWidth = sw.w;
      for (let i = 0; i <= n; i++) {
        const f = i / n, x = sw.x0 + len * f + sway * (1 - sw.far * 0.5);
        const y = y0 + sw.amp * Math.sin((x / sw.wave) * TAU + sw.ph + t * om) - sw.amp * 0.6 * Math.sin(f * Math.PI);
        if (i) {
          // the swell rises out of the dark and goes back into it at its ends
          const taper = Math.sin(f * Math.PI);
          const spread = 26 + 70 * Math.max(0, (y - SHORE) / 80);
          const lit = st ? Math.exp(-(((x - PEAK.x) / spread) ** 2)) * Math.exp(-Math.max(0, y - SHORE) / 70) * arrive : 0;
          const base = (0.07 + 0.16 * (1 - sw.far)) * taper * on;
          g.strokeStyle = this.lineStyle; g.globalAlpha = base;
          g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
          if (lit > 0.02) {
            g.strokeStyle = this.glowStyle; g.globalAlpha = Math.min(0.9, 0.8 * lit * taper * on);
            g.stroke();
          }
        }
        px = x; py = y;
      }
    }
    g.globalAlpha = 1;
    g.lineCap = 'round';
    // the circles ride the swell, glow as much as the water reaching them, and send rings out faster with more
    const rise2 = (1 - this.circlesOn) * 10;
    const slots = this.parts.slots, circles = this.parts.circles;
    for (let c = 0; c < slots.length; c++) {
      const cx = slots[c], bob = k ? (0.5 - br) * 2.4 + Math.sin(t * 0.7 + cx) * 0.8 : 0;
      if (circles[c]) circles[c].style.transform = `translateY(${((bob + rise2) * this.scale).toFixed(2)}px)`;
      if (this.circlesOn <= 0) continue;
      const cy = SEA_Y + bob + rise2, on2 = this.circlesOn;
      // the ring's own light: nothing inside it
      g.globalAlpha = (0.3 + 0.55 * arrive) * on2;
      g.drawImage(this.ring, cx - 36, cy - 36, 72, 72);
      // its reflection on the water under it, broken by the swell
      g.strokeStyle = this.glowStyle; g.lineWidth = 0.7;
      for (let r = 0; r < 4; r++) {
        const ry = cy + CIRCLE_R + 3 + r * 3.2, wob = Math.sin(t * 1.3 + r * 1.9 + cx) * 2, hw = (CIRCLE_R * 0.7) * (1 - r * 0.18);
        g.globalAlpha = (0.32 - r * 0.07) * (0.3 + 0.7 * arrive) * on2;
        g.beginPath(); g.moveTo(cx - hw + wob, ry); g.lineTo(cx + hw + wob, ry); g.stroke();
      }
      if (!k || !st) continue;
      // rings going out over the water from where it floats
      for (let r = 0; r < 2; r++) {
        const f = ((t * (0.07 + 0.2 * arrive)) + r / 2 + cx / 97) % 1, rr = CIRCLE_R + 2 + 30 * f;
        g.globalAlpha = (1 - f) * (1 - f) * (0.1 + 0.45 * arrive) * on2;
        g.lineWidth = 0.8 * (1 - f) + 0.3;
        g.beginPath(); g.ellipse(cx, cy + CIRCLE_R * 0.7, rr, rr * 0.28, 0, 0, TAU); g.stroke();
      }
    }
    g.globalAlpha = 1;
  }
}

export { HEAD_FROM };
