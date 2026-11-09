// parts/Stream (PLAN-MOTION.md M5, DESIGN.md rule 30): a flow's drawing runs like water. An SVG on the drawing's own
// viewBox, behind parts/Cycle and above the ghost rings in .fl-drawing, pointer-events none, so the step marks, the
// words, the dot and the halo stay crisp above it. The water is ./cycle/stream.ts; this file only draws it, one line
// per mote, and keeps the one loop honest.
//
// The loop. One requestAnimationFrame loop per open flow page, running only while the drawing is on screen
// (IntersectionObserver), the document is visible and --stream is above zero; it stops on unmount, taking its
// observers and listeners with it. Nothing is read from layout or style inside a frame: --stream and --t-page are read
// once at the start, when the light changes (light.ts's signal) and when Reduce Motion changes.
//
// The light. --stream (Day 1, Night .85, Still .4) scales the speed and how many motes show; under Reduce Motion it is
// 0 and nothing runs or shows (parts.css hides the layer too). It is a drawing, never a count (rule 15): no number is
// printed near it, and it stands for none.
//
// Where I am, a landing, hold the ring: the page passes the dot (at), each landing on a detent (landing, with a new
// seq each time) and the held breath (since, breath.ts's own clock). A landing sends one ring out from the dot over
// twice --t-page (parts.css, fl-ripple) and pushes the water near it on; the tick stays parts/Cycle's.
import { useEffect, useRef } from 'preact/hooks';
import { effect } from '@preact/signals';
import type { DiagramName } from '../../db/schema';
import { light } from '../light';
import { IN_MS, OUT_MS } from '../flow/breath';
import { shapeOf } from './cycle/index';
import { Water, type Paces } from './cycle/stream';

const NS = 'http://www.w3.org/2000/svg';
/** A frame longer than this (a stall, a tab coming back) moves the water no further than this, in seconds. */
const MAX_STEP = 0.05;

/** The loops running now, for tests (test/ui/stream-dom.test.ts and the e2e read none after leaving the page). */
export const running = { loops: 0 };

class Layer {
  readonly water: Water;
  private g: SVGGElement;
  private lines: SVGLineElement[] = [];
  private buf: Float32Array;
  private last: string[];
  private raf = 0;
  private prev = 0;
  private seen = typeof IntersectionObserver === 'undefined';
  private ripplesLife = 0.8;
  private io?: IntersectionObserver;
  private mq?: MediaQueryList;
  private unlight?: () => void;
  private live = false;

  constructor(private svg: SVGSVGElement, diagram: DiagramName, n: number, paces: Paces) {
    this.water = new Water(shapeOf(diagram), n, paces);
    this.g = document.createElementNS(NS, 'g');
    for (let i = 0; i < this.water.size; i++) {
      const el = document.createElementNS(NS, 'line');
      this.g.append(el);
      this.lines.push(el);
    }
    // each lane's widths, set once
    let i = 0;
    for (const lane of this.water.lanes) for (const m of lane.motes) this.lines[i++].setAttribute('stroke-width', m.w.toFixed(2));
    this.buf = new Float32Array(this.water.size * 5);
    this.last = new Array(this.water.size).fill('');
    svg.replaceChildren(this.g);
  }

  start() {
    this.live = true;
    this.read();
    // the first paint is the steady state: nothing sweeps in
    this.paint(Date.now());
    if (!this.seen) {
      this.io = new IntersectionObserver(es => { this.seen = es.some(e => e.isIntersecting); this.wake(); });
      this.io.observe(this.svg);
    }
    document.addEventListener('visibilitychange', this.wake);
    this.mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;
    this.mq?.addEventListener?.('change', this.reread);
    // the light changes data-light in its own effect; read after it has landed
    this.unlight = effect(() => { void light.value; queueMicrotask(this.reread); });
    this.wake();
  }

  stop() {
    this.live = false;
    this.halt();
    this.io?.disconnect();
    document.removeEventListener('visibilitychange', this.wake);
    this.mq?.removeEventListener?.('change', this.reread);
    this.unlight?.();
  }

  /** --stream and --t-page, read from the style: never inside a frame. */
  private read() {
    const cs = getComputedStyle(this.svg);
    const k = parseFloat(cs.getPropertyValue('--stream'));
    this.water.k = Number.isFinite(k) ? Math.max(0, k) : 1;
    const page = parseFloat(cs.getPropertyValue('--t-page'));
    // a landing's push lasts as long as its ring: twice --t-page
    this.ripplesLife = Number.isFinite(page) ? (2 * page) / 1000 : 0.8;
    this.g.style.display = this.water.k > 0 ? '' : 'none';
    this.svg.dataset.stream = String(this.water.k);
  }
  private reread = () => { if (!this.live) return; this.read(); this.wake(); };

  /** Runs the loop if it may run, stops it if not. */
  private wake = () => {
    const may = this.live && this.seen && document.visibilityState !== 'hidden' && this.water.k > 0 && this.svg.isConnected;
    if (may && !this.raf) { this.prev = 0; this.raf = requestAnimationFrame(this.frame); running.loops++; this.svg.dataset.running = ''; }
    else if (!may) this.halt();
  };
  private halt() {
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; running.loops--; }
    delete this.svg.dataset.running;
  }

  private frame = (now: number) => {
    this.raf = 0;
    const dt = this.prev ? Math.min(MAX_STEP, (now - this.prev) / 1000) : 0;
    this.prev = now;
    const wall = Date.now();
    this.water.step(dt, wall);
    this.paint(wall);
    this.raf = requestAnimationFrame(this.frame);
  };

  private paint(wall: number) {
    const b = this.buf;
    this.water.draw(b, wall);
    for (let i = 0; i < this.lines.length; i++) {
      const o = i * 5, el = this.lines[i];
      const op = b[o + 4];
      if (op < 0.005) { if (this.last[i] !== '0') { el.setAttribute('opacity', '0'); this.last[i] = '0'; } continue; }
      el.setAttribute('x1', b[o].toFixed(1)); el.setAttribute('y1', b[o + 1].toFixed(1));
      el.setAttribute('x2', b[o + 2].toFixed(1)); el.setAttribute('y2', b[o + 3].toFixed(1));
      const s = op.toFixed(2);
      if (s !== this.last[i]) { el.setAttribute('opacity', s); this.last[i] = s; }
    }
  }

  /** One ring goes out from where the dot landed (one at a time), and the water near it is pushed on. */
  land(k: number) {
    if (this.water.k <= 0) return;
    const p = this.water.land(k, this.ripplesLife);
    this.svg.querySelector('.fl-ripple')?.remove();
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('class', 'fl-ripple');
    c.setAttribute('cx', p.x.toFixed(1)); c.setAttribute('cy', p.y.toFixed(1)); c.setAttribute('r', '10');
    c.addEventListener('animationend', () => c.remove());
    this.svg.append(c);
  }
}

type Props = {
  diagram: DiagramName;
  /** The flow's paces (model/pace.ts pacesOf), one per step, and its rest's. */
  paces: Paces;
  /** Where the dot is: 0 at rest, 1 to n on a step. */
  at: number;
  /** The last landing on a detent: which (0 is rest), and a new seq for each. */
  landing?: { k: number; seq: number } | null;
  /** A thumb holds the middle: when it landed (breath.ts's since), or null. */
  since?: number | null;
};

export function Stream({ diagram, paces, at, landing, since = null }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const layer = useRef<Layer | null>(null);
  const n = paces.steps.length;
  const key = `${paces.rest},${paces.steps.join(',')}`;
  useEffect(() => {
    const l = new Layer(svg.current!, diagram, n, paces);
    l.water.setAt(at);
    l.water.setHold(since, IN_MS, OUT_MS);
    l.start();
    layer.current = l;
    return () => { l.stop(); layer.current = null; };
  }, [diagram, key]);
  useEffect(() => { layer.current?.water.setAt(at); }, [at]);
  useEffect(() => { if (landing) layer.current?.land(landing.k); }, [landing?.seq]);
  useEffect(() => { layer.current?.water.setHold(since, IN_MS, OUT_MS); }, [since]);
  const shape = shapeOf(diagram);
  return (
    <div class="fl-stream" aria-hidden="true">
      <svg ref={svg} viewBox={`0 0 ${shape.w} ${shape.h}`} preserveAspectRatio="xMidYMid meet" />
    </div>
  );
}
