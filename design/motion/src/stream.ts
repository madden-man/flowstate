// The stream (motion proposal): a flow's drawing runs like water. Would ship as src/ui/parts/cycle/stream.ts, a layer
// behind parts/Cycle the way the ghost rings are, knowing no shape: it reads Shape.at, slotT and restT and nothing else.
//
// How it reads. Each mote moves along the walk at the pace of the step it is passing, so the same number of motes
// pass every point (one stream, never a count) and they spread out where it runs fast and pool where it runs slow.
// A fast mote is a short streak, a slow one a dot. The dotted parts carry it thin. With the dot on a step, what is
// behind it fades: the water runs on from where you are. A held thumb slows all of it on the out-breath.
//
// Pace is data, not drawing: a number per step (1 is a walk), kept here per seeded flow; in the app it would sit on
// the step (FlowStep.pace, editable on the step sheet), with 1 for a step that has none.
import { shapeOf } from '../../../src/ui/parts/cycle/index';
import { nearestT, walkDistance, type Pt, type Shape } from '../../../src/ui/parts/cycle/shape';
import type { DiagramName } from '../../../src/db/schema';

/** A side road drawn beside the walk (the crash, "say it", "one small thing"): the drawn paths it runs along. */
type Side = { paths: number[]; pace: number; n: number; alpha: number; dies?: boolean };
export type Pace = {
  /** At rest, on the way in. */
  rest: number;
  /** One per step. */
  steps: number[];
  /** The stream moves in ticks, a second apart (the clock). */
  ticks?: boolean;
  /** Slow water hangs below the line (the valley) or lifts off it (the arc), in drawing units. */
  sag?: number;
  sides?: Side[];
};

export const PACE: Record<string, Pace> = {
  // Overstimulated, The wave, Settling, Under the skin
  panic: { rest: 0.4, steps: [1.1, 2.3, 0.7, 0.42] },
  // Sliding, Pulling in, Head won't stop, The bottom, A little light, Climbing out
  depress: { rest: 0.45, steps: [0.5, 0.38, 0.6, 0.24, 0.34, 0.55], sag: 5, sides: [{ paths: [5], pace: 0.6, n: 5, alpha: 1 }] },
  // Spark, Build, Locked in, The tip, Landing or the crash
  energize: { rest: 0.45, steps: [1.0, 1.7, 2.3, 2.6, 0.8], sag: -3, sides: [{ paths: [4, 5], pace: 1.3, n: 6, alpha: 0.6 }] },
  // Trigger, Climb, Flooded, Said it or left, Cooling, Repair
  fight: { rest: 0.45, steps: [1.4, 2.4, 2.7, 1.5, 0.65, 0.36], sides: [{ paths: [4, 5], pace: 0.7, n: 7, alpha: 0.55 }] },
  // Something's coming, What if, Night before, The thing, It was fine
  whatif: { rest: 0.35, steps: [0.5, 0.9, 1.3, 3.2, 0.34] },
  // That stung, Why did I, Heavier, How not why
  replay: { rest: 0.45, steps: [0.9, 1.5, 2.2, 0.5] },
  // Awake again, What time is it, Lying there, Up, Same alarm
  night: { rest: 0.3, steps: [0.42, 0.42, 0.36, 0.6, 0.3], ticks: true },
  // Too much, Stuck, Far away, Thawing
  shutdown: { rest: 0.6, steps: [1.7, 0.26, 0.22, 0.5] },
  // Seen, I'm worthless, Hide or hit back, I did a thing
  shame: { rest: 0.5, steps: [1.4, 1.9, 0.6, 0.75], sides: [{ paths: [3], pace: 0.5, n: 4, alpha: 0.5, dies: true }, { paths: [4], pace: 0.5, n: 4, alpha: 0.5, dies: true }] },
};

/** Drawing units a second at pace 1: a walk. The fastest water in the app (the drop on What if) is about a hundred. */
const BASE = 30;
/** No water stands quite still, or the whole stream would end up waiting in one place. */
const SLOWEST = 0.22;
const NS = 'http://www.w3.org/2000/svg';

type Mote = { t: number; off: number; w: number; a: number; s: number; el: SVGLineElement };
type Lane = {
  at(t: number): Pt; len: number; closed: boolean; v(t: number): number; fade(t: number): number;
  motes: Mote[]; alpha: number; main: boolean;
  /** Where on the walk this lane leaves it (a side road), for the fade behind the dot. */
  from: number;
};

const smooth = (u: number) => { const x = Math.max(0, Math.min(1, u)); return x * x * (3 - 2 * x); };
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** The pace along the walk: each step's pace at its detent, eased between. */
function paceAlong(shape: Shape, n: number, pace: Pace): (t: number) => number {
  const knots = [{ t: shape.restT(n), v: pace.rest }, ...Array.from({ length: n }, (_, i) => ({ t: shape.slotT(i, n), v: pace.steps[i] ?? 1 }))]
    .sort((a, b) => a.t - b.t);
  return t => {
    let a = knots[0], b = knots[0];
    if (t <= knots[0].t || t >= knots.at(-1)!.t) {
      if (!shape.closed) return Math.max(SLOWEST, t <= knots[0].t ? knots[0].v : knots.at(-1)!.v);
      a = knots.at(-1)!; b = knots[0];
      const span = 1 - a.t + b.t, d = t >= a.t ? t - a.t : t + 1 - a.t;
      return Math.max(SLOWEST, lerp(a.v, b.v, smooth(span ? d / span : 0)));
    }
    for (let i = 1; i < knots.length; i++) if (t <= knots[i].t) { a = knots[i - 1]; b = knots[i]; break; }
    return Math.max(SLOWEST, lerp(a.v, b.v, smooth((t - a.t) / (b.t - a.t || 1))));
  };
}

function lengthOf(at: (t: number) => Pt, samples = 360) {
  let len = 0, p = at(0);
  for (let i = 1; i <= samples; i++) { const q = at(i / samples); len += Math.hypot(q.x - p.x, q.y - p.y); p = q; }
  return len;
}

export class Stream {
  private lanes: Lane[] = [];
  private raf = 0;
  private last = 0;
  private seen = false;
  private io?: IntersectionObserver;
  /** --stream: 1 by day, less at night, .4 in Still, 0 under Reduce Motion. */
  private k = 1;
  private frameNo = 0;
  private mult = 1;
  private calm = 1;
  private held = 0;
  private gather = 1;
  private dot: number | null = null;
  private mask = 0;
  private push: { t: number; at: number } | null = null;
  private shape: Shape;
  private n: number;
  private ticks: boolean;
  private sag: number;
  private g: SVGGElement;

  constructor(private svg: SVGSVGElement, diagram: DiagramName, n: number, pace: Pace) {
    const shape = this.shape = shapeOf(diagram);
    this.n = n;
    this.ticks = !!pace.ticks;
    this.sag = pace.sag ?? 0;
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${shape.w} ${shape.h}`);
    const defs = document.createElementNS(NS, 'defs');
    this.g = document.createElementNS(NS, 'g');
    svg.append(defs, this.g);

    const v = paceAlong(shape, n, pace);
    const len = lengthOf(shape.at);
    const lastStep = shape.slotT(n - 1, n);
    this.lanes.push({
      at: shape.at, len, closed: shape.closed, v, main: true, from: 0, alpha: 1, motes: [],
      // the ring's dotted way back carries the stream thin; an open walk fades in and out at its ends
      fade: t => (shape.closed ? lerp(1, 0.4, smooth((t - lastStep) / 0.04)) * lerp(0.4, 1, smooth(t / 0.03)) : smooth(t / 0.06) * smooth((1 - t) / 0.06)),
    });
    this.fill(this.lanes[0], Math.max(30, Math.min(64, Math.round(len / 8.5))));

    const drawn = shape.paths(n);
    for (const side of pace.sides ?? []) {
      const els = side.paths.map(i => drawn[i]).filter(d => d?.kind === 'path').map(d => {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', (d as { d: string }).d);
        defs.append(p);
        return p;
      });
      if (!els.length) continue;
      const lens = els.map(p => p.getTotalLength()), total = lens.reduce((a, b) => a + b, 0);
      const at = (t: number): Pt => {
        let d = Math.max(0, Math.min(1, t)) * total;
        for (let i = 0; i < els.length; i++) { if (d <= lens[i] || i === els.length - 1) { const p = els[i].getPointAtLength(d); return { x: p.x, y: p.y }; } d -= lens[i]; }
        return { x: 0, y: 0 };
      };
      const lane: Lane = {
        at, len: total, closed: false, v: () => side.pace, main: false, from: nearestT(shape, at(0)), alpha: side.alpha, motes: [],
        fade: t => smooth(t / 0.1) * (side.dies ? 1 - smooth((t - 0.35) / 0.65) : smooth((1 - t) / 0.1)),
      };
      this.lanes.push(lane);
      this.fill(lane, side.n);
    }
  }

  /** The motes, laid down already in their steady state: thick where it is slow, thin where it is fast. */
  private fill(lane: Lane, count: number) {
    const N = 200, cum = [0];
    for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + 1 / lane.v((i - 0.5) / N));
    for (let i = 0; i < count; i++) {
      const want = ((i + Math.random()) / count) * cum[N];
      let j = 1;
      while (j < N && cum[j] < want) j++;
      const el = document.createElementNS(NS, 'line');
      this.g.append(el);
      lane.motes.push({ t: (j - Math.random()) / N, off: Math.random() + Math.random() - 1, w: 1.1 + Math.random() * 1.1, a: 0.55 + Math.random() * 0.45, s: Math.random(), el });
      el.setAttribute('stroke-width', lane.motes.at(-1)!.w.toFixed(2));
    }
  }

  /** Runs only while it can be seen. */
  start() {
    this.io = new IntersectionObserver(seen => {
      this.seen = seen.some(e => e.isIntersecting);
      if (this.seen && !this.raf) { this.last = 0; this.raf = requestAnimationFrame(this.frame); }
    });
    this.io.observe(this.svg);
  }
  stop() { this.io?.disconnect(); cancelAnimationFrame(this.raf); this.raf = 0; this.seen = false; }

  /** Where the dot is: 0 at rest (the whole stream, a little quieter), else the step the water runs on from. */
  setAt(k: number, jump = false) {
    this.dot = k > 0 ? this.shape.slotT(k - 1, this.n) : null;
    if (jump || this.dot === null) this.mask = this.dot ?? 0;
  }
  /** A ring goes out where the dot lands, and the water near it is pushed on for a moment. */
  ripple(k: number) {
    const t = k > 0 ? this.shape.slotT(k - 1, this.n) : this.shape.restT(this.n), p = this.shape.at(t);
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('class', 'fl-ripple');
    c.setAttribute('cx', p.x.toFixed(1)); c.setAttribute('cy', p.y.toFixed(1)); c.setAttribute('r', '10');
    c.addEventListener('animationend', () => c.remove());
    this.svg.append(c);
    this.push = { t, at: performance.now() };
  }
  /** A thumb on the middle: the stream follows the breath, and runs a little slower after each one. */
  setHold(on: boolean) { this.held = on ? performance.now() : 0; }

  private frame = (now: number) => {
    this.raf = 0;
    if (!this.seen || !this.svg.isConnected) return;
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
    this.last = now;
    if (this.frameNo++ % 20 === 0) {
      const k = parseFloat(getComputedStyle(this.svg).getPropertyValue('--stream'));
      this.k = Number.isFinite(k) ? k : 1;
      this.g.style.display = this.k > 0 ? '' : 'none';
    }
    const k = this.k;
    if (k > 0) {
      // the breath: gathering through the four in, letting go through the six out, calmer after each
      let target = this.calm;
      if (this.held) {
        const s = (now - this.held) / 1000, b = s % 10;
        this.calm = Math.max(0.45, this.calm - dt * 0.014);
        target = this.calm * (b < 4 ? lerp(0.55, 1, smooth(b / 4)) : lerp(1, 0.3, smooth((b - 4) / 6)));
      } else this.calm = Math.min(1, this.calm + dt * 0.02);
      this.mult += (target - this.mult) * Math.min(1, dt * 4);
      this.gather += ((this.held ? 0.5 : 1) - this.gather) * Math.min(1, dt * 2);
      if (this.dot !== null) this.mask += (this.dot - this.mask) * Math.min(1, dt * 5);
      // the clock moves in ticks: a short run, a long wait
      const tk = this.ticks ? (u => 0.25 + 2.6 * smooth(u / 0.12) * (1 - smooth((u - 0.2) / 0.2)))((now / 1000) % 1) : 1;
      const pushAge = this.push ? (now - this.push.at) / 900 : 1;
      if (pushAge >= 1) this.push = null;
      const speed = this.mult * tk * k;
      const shown = 0.25 + 0.75 * k;
      for (const lane of this.lanes) {
        const count = lane.motes.length;
        lane.motes.forEach((m, i) => {
          let v = lane.v(m.t);
          if (this.push && lane.main) v *= 1 + 1.6 * (1 - pushAge) * Math.max(0, 1 - walkDistance(this.shape, m.t, this.push.t) / 0.1);
          m.t += (v * BASE * speed * dt) / lane.len;
          if (m.t >= 1) { m.t = lane.closed ? m.t - 1 : 0; m.off = Math.random() + Math.random() - 1; }
          // Still shows fewer of them
          if (i / count >= shown) { m.el.setAttribute('opacity', '0'); return; }
          const e = 0.004;
          const a = lane.at(lane.closed ? (m.t - e + 1) % 1 : Math.max(0, m.t - e)), b = lane.at(lane.closed ? (m.t + e) % 1 : Math.min(1, m.t + e));
          const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, tx = (b.x - a.x) / d, ty = (b.y - a.y) / d;
          const p = lane.at(m.t);
          const spread = Math.min(6, 1.5 + 2.6 / Math.max(v, 0.5)) * this.gather;
          const x = p.x - ty * m.off * spread, y = p.y + tx * m.off * spread + (lane.main ? this.sag * m.s * Math.min(1, 0.6 / v) : 0);
          const L = Math.max(0.01, Math.min(11, v * speed * 3.4));
          const where = lane.main ? m.t : lane.from;
          const behind = this.dot === null ? 0.7 : lerp(0.2, 1, smooth((where - this.mask + 0.02) / 0.04));
          m.el.setAttribute('x1', (x - tx * L).toFixed(1)); m.el.setAttribute('y1', (y - ty * L).toFixed(1));
          m.el.setAttribute('x2', x.toFixed(1)); m.el.setAttribute('y2', y.toFixed(1));
          m.el.setAttribute('opacity', (0.5 * lane.alpha * m.a * lane.fade(m.t) * behind * (0.6 + 0.4 * k)).toFixed(2));
        });
      }
    }
    this.raf = requestAnimationFrame(this.frame);
  };
}
