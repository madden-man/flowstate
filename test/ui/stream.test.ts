// The stream (PLAN-MOTION.md M5 item 9): the pace function (eased between detents, wrapping on the ring, never below
// the floor), the steady-state fill (more motes where it is slow) and that it stays steady (no start-up wave), the
// fastest water, the fade behind the dot, the held breath, the light, and the paces table against the seeds.
import { describe, it, expect } from 'vitest';
import { SHAPES, shapeOf } from '../../src/ui/parts/cycle/index';
import {
  Water, paceAlong, steadyFill, breathAt, tickAt, BASE, FASTEST, SLOWEST, CALM_FLOOR, BEHIND, AT_REST,
} from '../../src/ui/parts/cycle/stream';
import { SEED_FLOWS } from '../../src/db/seed-flows';
import { pacesOf, STEP_PACE, REST_PACE } from '../../src/model/pace';
import type { DiagramName } from '../../src/db/schema';

/** A seeded random, so every run lays the same motes. */
function rng(seed = 7) {
  let a = seed;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const flow = (id: string) => SEED_FLOWS.find(f => f.id === id)!;
const ring = shapeOf('ring');
const panic = pacesOf(flow('panic'));
/** How many of the main lane's motes lie within w of t on the walk. */
const near = (w: Water, t: number, span = 0.06) => w.lanes[0].motes.filter(m => Math.min(Math.abs(m.t - t), 1 - Math.abs(m.t - t)) < span).length;

describe('the pace along the walk', () => {
  const v = paceAlong(ring, 4, panic);
  it('is each step\'s pace at its detent and the rest\'s at rest', () => {
    panic.steps.forEach((p, i) => expect(v(ring.slotT(i, 4))).toBeCloseTo(p, 5));
    expect(v(ring.restT(4))).toBeCloseTo(panic.rest, 5);
  });
  it('is eased between detents: it stays between the two, and flattens at each', () => {
    const a = ring.slotT(1, 4), b = ring.slotT(2, 4);
    for (let u = 0.05; u < 1; u += 0.05) {
      const x = v(a + (b - a) * u);
      expect(x).toBeLessThanOrEqual(Math.max(panic.steps[1], panic.steps[2]) + 1e-9);
      expect(x).toBeGreaterThanOrEqual(Math.min(panic.steps[1], panic.steps[2]) - 1e-9);
    }
    // eased: almost no change a hair either side of a detent
    expect(Math.abs(v(a + 0.002) - v(a))).toBeLessThan(0.01);
  });
  it('wraps on the ring: the seam at the top is seamless', () => {
    expect(Math.abs(v(0.9999) - v(0.0001))).toBeLessThan(0.01);
    expect(v(0)).toBeCloseTo(panic.steps[0], 5);
  });
  it('never runs below the floor, nor above the fastest', () => {
    const w = paceAlong(ring, 4, { rest: 0, steps: [0, 0.01, 9, 50] });
    for (let t = 0; t <= 1; t += 0.01) {
      expect(w(t)).toBeGreaterThanOrEqual(SLOWEST);
      expect(w(t) * BASE).toBeLessThanOrEqual(FASTEST + 1e-9);
    }
  });
  it('holds its end paces past the ends of an open walk', () => {
    const valley = shapeOf('valley'), d = pacesOf(flow('depress')), w = paceAlong(valley, 6, d);
    expect(w(0)).toBeCloseTo(d.rest, 5);
    expect(w(1)).toBeCloseTo(d.steps[5], 5);
  });
});

describe('the steady state', () => {
  it('lays more motes where it is slow: pooled under the skin, thin through the wave', () => {
    const w = new Water(ring, 4, panic, rng());
    const wave = near(w, ring.slotT(1, 4)), skin = near(w, ring.slotT(3, 4));
    expect(skin).toBeGreaterThan(wave * 3);
  });
  it('is the fill a stream that runs at v settles into: density goes as one over the pace', () => {
    const v = (t: number) => (t < 0.5 ? 2 : 0.5);
    const ts = steadyFill(v, 100, rng());
    const slow = ts.filter(t => t >= 0.5).length;
    expect(slow).toBeGreaterThanOrEqual(78);
    expect(slow).toBeLessThanOrEqual(82);
  });
  it('stays steady when it runs: no wave sweeps round after the page opens', () => {
    const w = new Water(ring, 4, panic, rng(3));
    const at = (ts: number[]) => ts.map(t => near(w, t, 0.08));
    const places = [0, 0.25, 0.5, 0.75];
    const before = at(places);
    const runs: number[][] = [];
    for (let s = 0; s < 40; s++) { for (let f = 0; f < 60; f++) w.step(1 / 60, 0); if (s % 4 === 3) runs.push(at(places)); }
    // averaged over the run, every place holds about what it held at the start
    places.forEach((_, i) => {
      const mean = runs.reduce((a, r) => a + r[i], 0) / runs.length;
      expect(Math.abs(mean - before[i])).toBeLessThanOrEqual(Math.max(2.5, before[i] * 0.4));
    });
  });
  it('moves at once: the first frame of a page is the steady state, not motes waiting to start', () => {
    const w = new Water(ring, 4, panic, rng());
    const t0 = w.lanes[0].motes.map(m => m.t);
    w.step(1 / 60, 0);
    expect(w.lanes[0].motes.every((m, i) => m.t !== t0[i])).toBe(true);
  });
});

describe('the fastest water', () => {
  it.each(SEED_FLOWS.map(f => [f.id, f] as const))('%s never runs faster than FASTEST, pushed or not', (_, f) => {
    const w = new Water(shapeOf(f.diagram), f.steps.length, pacesOf(f), rng());
    for (let k = 0; k <= f.steps.length; k++) {
      w.land(k, 0.8);
      w.step(0.1, 0);
      for (const lane of w.lanes) for (const m of lane.motes) for (let ms = 0; ms < 1000; ms += 50) expect(w.unitsAt(lane, m.t, ms)).toBeLessThanOrEqual(FASTEST);
    }
  });
  it('What if\'s drop is the fastest in the app, near a hundred drawing units a second', () => {
    const top = (id: string) => { const f = flow(id); const v = paceAlong(shapeOf(f.diagram), f.steps.length, pacesOf(f)); let m = 0; for (let t = 0; t <= 1; t += 0.002) m = Math.max(m, v(t)); return m * BASE; };
    const drop = top('whatif');
    expect(drop).toBeGreaterThan(90);
    expect(drop).toBeLessThanOrEqual(FASTEST);
    for (const f of SEED_FLOWS.filter(f => f.id !== 'whatif')) expect(top(f.id)).toBeLessThan(drop);
  });
});

describe('presence: one frame tells the jet from the pool', () => {
  it('Panic: long dashes in a narrow channel through the wave, dots in a wide pool under the skin', () => {
    const w = new Water(ring, 4, panic, rng());
    const out = new Float32Array(w.size * 5);
    w.draw(out, 0);
    const lane = w.lanes[0];
    const at = (t: number) => lane.motes.map((m, i) => ({ m, i })).filter(({ m }) => Math.min(Math.abs(m.t - t), 1 - Math.abs(m.t - t)) < 0.04);
    const dash = (i: number) => Math.hypot(out[i * 5 + 2] - out[i * 5], out[i * 5 + 3] - out[i * 5 + 1]);
    const off = (i: number) => { const p = lane.at(lane.motes[i].t); return Math.hypot(out[i * 5 + 2] - p.x, out[i * 5 + 3] - p.y); };
    const wave = at(ring.slotT(1, 4)), skin = at(ring.slotT(3, 4));
    expect(Math.min(...wave.map(x => dash(x.i)))).toBeGreaterThan(6);
    expect(Math.max(...skin.map(x => dash(x.i)))).toBeLessThan(0.5);
    // the pool spreads wider than the jet
    expect(Math.max(...skin.map(x => off(x.i)))).toBeGreaterThan(Math.max(...wave.map(x => off(x.i))));
    // and there is depth: the motes run from faint to near-ink
    const as = lane.motes.map(m => m.a);
    expect(Math.min(...as)).toBeLessThan(0.45);
    expect(Math.max(...as)).toBeGreaterThan(0.8);
  });
  it('Still shows about half, plainly: never three', () => {
    const w = new Water(ring, 4, panic, rng());
    w.k = 0.4;
    w.setAt(2);
    for (let f = 0; f < 600; f++) w.step(1 / 60, 0);
    const out = new Float32Array(w.size * 5);
    w.draw(out, 0);
    const ops = Array.from({ length: w.size }, (_, i) => out[i * 5 + 4]);
    expect(ops.filter(o => o > 0.01).length).toBeGreaterThan(w.size * 0.35);
    expect(ops.filter(o => o > 0.3).length).toBeGreaterThan(8);
  });
});

describe('the layer stays small', () => {
  it.each(Object.keys(SHAPES))('%s: at most about ninety lines, with the seeded steps or eight', name => {
    const shape = shapeOf(name as DiagramName);
    for (const n of [1, 4, 6, 8]) {
      const w = new Water(shape, n, { rest: 1, steps: Array(n).fill(1) }, rng());
      expect(w.size).toBeLessThanOrEqual(90);
      expect(w.size).toBeGreaterThanOrEqual(40);
    }
  });
});

describe('where I am', () => {
  it('at rest the whole stream shows, a little quieter', () => {
    const w = new Water(ring, 4, panic, rng());
    for (let t = 0; t < 1; t += 0.1) expect(w.ahead(t)).toBe(AT_REST);
  });
  it('with the dot on a step, what is behind fades and the water ahead runs on to rest', () => {
    const w = new Water(ring, 4, panic, rng());
    w.setAt(2); // the wave
    expect(w.ahead(ring.slotT(2, 4))).toBeCloseTo(1, 5); // settling, ahead
    expect(w.ahead(ring.slotT(0, 4))).toBeCloseTo(BEHIND, 5); // overstimulated, behind
    expect(w.ahead(0.95)).toBeCloseTo(BEHIND, 5); // past rest, on the way back round: behind
    // no edge anywhere but at the dot and at rest: the seam at the top has none
    expect(Math.abs(w.ahead(0.9999) - w.ahead(0.0001))).toBeLessThan(0.01);
  });
  it('the fade follows the dot along, the short way round', () => {
    const w = new Water(ring, 4, panic, rng());
    w.setAt(4);
    w.setAt(1); // under the skin to overstimulated: forward through the top, not back round
    for (let i = 0; i < 10; i++) w.step(1 / 60, 0);
    // on its way the fade's edge has passed forward over 0.8 (going back round, 0.8 would have stayed ahead)
    expect(w.ahead(0.8)).toBeLessThan(0.5);
    for (let i = 0; i < 120; i++) w.step(1 / 60, 0);
    expect(w.ahead(ring.slotT(1, 4))).toBeGreaterThan(0.99);
  });
  it('a landing pushes the water near it on for a moment, then lets it be', () => {
    const w = new Water(ring, 4, panic, rng());
    const lane = w.lanes[0], t = ring.slotT(2, 4);
    const before = w.unitsAt(lane, t, 0);
    w.land(3, 0.8);
    w.step(0.15, 0);
    expect(w.unitsAt(lane, t, 0)).toBeGreaterThan(before * 1.5);
    expect(w.unitsAt(lane, ring.slotT(0, 4), 0)).toBeCloseTo(w.lanes[0].v(ring.slotT(0, 4)) * BASE, 5);
    w.step(0.7, 0);
    expect(w.unitsAt(lane, t, 0)).toBeCloseTo(before, 5);
  });
});

describe('hold the ring', () => {
  it('slows on the out-breath and gathers on the in, on breath.ts\'s 4 in and 6 out', () => {
    expect(breathAt(0, 4000, 6000).speed).toBeLessThan(breathAt(4000, 4000, 6000).speed);
    expect(breathAt(10_000 - 1, 4000, 6000).speed).toBeLessThan(breathAt(4000, 4000, 6000).speed);
    expect(breathAt(4000, 4000, 6000).spread).toBeLessThan(breathAt(0, 4000, 6000).spread);
    expect(breathAt(25_000, 4000, 6000).breaths).toBe(2);
  });
  it('grows calmer with each breath, never below the floor, and comes back slowly after', () => {
    const w = new Water(ring, 4, panic, rng());
    let wall = 1_000_000;
    w.setHold(wall, 4000, 6000);
    const calm: number[] = [];
    for (let b = 0; b < 12; b++) { for (let f = 0; f < 600; f++) { wall += 1000 / 60; w.step(1 / 60, wall); } calm.push(w.calmNow); }
    expect(calm[1]).toBeLessThan(calm[0]);
    expect(calm[3]).toBeLessThan(calm[1]);
    expect(Math.min(...calm)).toBeGreaterThanOrEqual(CALM_FLOOR - 1e-9);
    w.setHold(null, 4000, 6000);
    const low = w.calmNow;
    for (let f = 0; f < 600; f++) w.step(1 / 60, wall);
    expect(w.calmNow).toBeGreaterThan(low);
    expect(w.calmNow).toBeLessThan(1);
  });
});

describe('the light and the clock', () => {
  it('under Reduce Motion (--stream 0) nothing moves', () => {
    const w = new Water(ring, 4, panic, rng());
    w.k = 0;
    const t0 = w.lanes[0].motes.map(m => m.t);
    w.step(1, 0);
    expect(w.lanes[0].motes.map(m => m.t)).toEqual(t0);
  });
  it('Still (.4) is slower and shows fewer', () => {
    const a = new Water(ring, 4, panic, rng()), b = new Water(ring, 4, panic, rng());
    b.k = 0.4;
    for (let f = 0; f < 240; f++) { a.step(1 / 60, 0); b.step(1 / 60, 0); }
    const moved = (w: Water) => w.lanes[0].motes.reduce((s, m) => s + m.t, 0);
    expect(moved(b)).toBeLessThan(moved(a));
    const out = new Float32Array(b.size * 5);
    b.draw(out, 0);
    const shown = Array.from({ length: b.size }, (_, i) => out[i * 5 + 4]).filter(o => o > 0.01).length;
    expect(shown).toBeLessThan(b.size * 0.7);
  });
  it('the clock moves in ticks, a second apart: a short run, then a long wait', () => {
    const xs = Array.from({ length: 100 }, (_, i) => tickAt(i * 10));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.5);
    expect(mean).toBeLessThan(0.9);
    expect(xs.filter(x => x < 0.2).length).toBeGreaterThan(50);
    expect(tickAt(250)).toBeCloseTo(tickAt(1250), 9);
  });
});

describe('the paces table', () => {
  it('has a pace for every seeded step and a rest for every seeded flow, and nothing else', () => {
    const ids = SEED_FLOWS.flatMap(f => f.steps.map(s => s.id));
    expect(Object.keys(STEP_PACE).sort()).toEqual([...ids].sort());
    expect(Object.keys(REST_PACE).sort()).toEqual(SEED_FLOWS.map(f => f.id).sort());
  });
  it('a flow he made himself, or a step he added, walks', () => {
    expect(pacesOf({ id: 'mine', steps: [{ id: 'a' }, { id: 'b' }] as never })).toEqual({ rest: 1, steps: [1, 1] });
    expect(pacesOf({ id: 'panic', steps: [{ id: 'panic-1' }, { id: 'new' }] as never }).steps).toEqual([STEP_PACE['panic-1'], 1]);
  });
  it('tells each flow\'s truth: the peak quicker than what settles after it', () => {
    const p = (id: string) => STEP_PACE[id];
    expect(p('panic-2')).toBeGreaterThan(p('panic-3'));
    expect(p('panic-3')).toBeGreaterThan(p('panic-4'));
    expect(p('fight-2')).toBeGreaterThan(p('fight-5'));
    expect(p('whatif-4')).toBeGreaterThan(p('whatif-3'));
    expect(p('whatif-5')).toBeLessThan(p('whatif-1'));
    expect(p('replay-3')).toBeGreaterThan(p('replay-2'));
    expect(p('replay-2')).toBeGreaterThan(p('replay-1'));
    expect(p('shutdown-2')).toBeLessThan(0.3);
    expect(p('depress-4')).toBe(Math.min(...['depress-1', 'depress-2', 'depress-3', 'depress-4', 'depress-5', 'depress-6'].map(p)));
  });
});
