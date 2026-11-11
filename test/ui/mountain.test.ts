// @vitest-environment jsdom
// The mountain (PLAN-MOUNTAIN.md R1): the river's course, the land drawn once, the water's motes, the arrival's clock,
// and the plate in a DOM with no canvas (the land and the signs, nothing else).
import { describe, it, expect } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { COURSE, STOPS, place, stretchAt, stretches, channelPaths, seaSlots, W, PEAK } from '../../src/ui/parts/cycle/river';
import { land, snowCap, half, SNOW_Y } from '../../src/ui/flow/mountain/land';
import { Water, STRIDE, TINTS } from '../../src/ui/flow/mountain/water';
import { headAt, seaIn, circlesIn, HEAD_FROM, HEAD_TO } from '../../src/ui/flow/mountain/arrival';
import { CHAKRA_IDS, reach, spring, stretch } from '../../src/model/mountain';
import { MountainPlate, signTravel } from '../../src/ui/flow/Mountain';

describe('the river', () => {
  it('runs from the spring through the seven signs in order, to the mouth and out to sea', () => {
    expect(COURSE.at).toHaveLength(10);
    for (let i = 1; i < COURSE.at.length; i++) expect(COURSE.at[i]).toBeGreaterThan(COURSE.at[i - 1]);
    CHAKRA_IDS.forEach((id, i) => {
      const p = place(COURSE.at[i + 1]);
      expect(p.x).toBeCloseTo(STOPS[id].x, 0);
      expect(p.y).toBeCloseTo(STOPS[id].y, 0);
    });
    expect(COURSE.mouth).toBe(COURSE.at[8]);
    expect(COURSE.total).toBe(COURSE.at[9]);
  });
  it('says which stretch a point is in, and what each stretch carries', () => {
    expect(stretchAt(0)).toBe(0);
    expect(stretchAt(COURSE.at[1] + 0.01)).toBe(1);
    expect(stretchAt(COURSE.total)).toBe(7);
    const gates = [0, 0, 0, 0, 0.7, 0, 0];
    const q = stretches(spring(0.3), reach(0.3, gates));
    expect(q).toHaveLength(8);
    expect(q[0]).toBeCloseTo(spring(0.3));
    expect(q[5]).toBeLessThan(q[4]);
  });
  it('draws a channel a stretch, and spaces up to five circles inside the sea', () => {
    expect(channelPaths().every(d => d.startsWith('M'))).toBe(true);
    expect(seaSlots(2)).toEqual([108, 220]);
    for (let n = 1; n <= 5; n++) {
      const s = seaSlots(n);
      expect(s).toHaveLength(n);
      for (const x of s) { expect(x).toBeGreaterThan(30); expect(x).toBeLessThan(W - 30); }
      for (let i = 1; i < n; i++) expect(s[i] - s[i - 1]).toBeGreaterThanOrEqual(56);
    }
    expect(seaSlots(9)).toHaveLength(5);
  });
});

describe('the land', () => {
  it('is the same mountain every time it is drawn', () => {
    const a = land(), b = land();
    expect(a.marks.map(m => m.d)).toEqual(b.marks.map(m => m.d));
    expect(a.stars).toEqual(b.stars);
  });
  it('holds every part of the picture, back to front, each with its place in the arrival', () => {
    const { marks, stars } = land();
    const classes = marks.map(m => m.cls);
    for (const c of ['far', 'horn', 'face', 'deep', 'hatch', 'tarn', 'trees', 'trees-back', 'cliff', 'snow-slot', 'bold', 'arete']) expect(classes).toContain(c);
    // the masses behind the horn come before its face
    expect(classes.indexOf('horn')).toBeLessThan(classes.indexOf('face'));
    for (const m of marks) { expect(m.at).toBeGreaterThanOrEqual(0); expect(m.at + m.len).toBeLessThanOrEqual(0.5); }
    // stars only in the sky, never on the horn
    for (const s of stars) expect(Math.abs(s.x - PEAK.x)).toBeGreaterThan(half(s.y));
    // nothing stands for nothing: no sun, no moon (no full circle in the land)
    expect(marks.some(m => /a\s*[\d.]+\s+[\d.]+\s+0\s+1\s+[01]/.test(m.d))).toBe(false);
  });
  it('lets the snow come down to any line', () => {
    const hi = snowCap(SNOW_Y), lo = snowCap(SNOW_Y + 50);
    expect(hi.lit).not.toBe(lo.lit);
    expect(hi.lit.endsWith('Z')).toBe(true);
  });
});

describe('the water', () => {
  it('shows fewer motes and runs slower where less water runs, and tints below each sign', () => {
    const open = new Water(), heavy = new Water();
    open.set([1, 1, 1, 1, 1, 1, 1, 1], [0, 0, 0, 0, 0, 0, 0], true);
    const q = stretches(spring(0.9), reach(0.9, [0, 0, 0, 0, 0, 0, 0]));
    heavy.set(q, [0, 0, 0, 0, 0, 0, 0], true);
    const before = Array.from(open.s), hb = Array.from(heavy.s);
    for (let i = 0; i < 120; i++) { open.step(1 / 60); heavy.step(1 / 60); }
    const moved = (w: Water, from: number[]) => w.s.reduce((a, s, i) => a + Math.abs(((s - from[i]) + COURSE.total) % COURSE.total), 0);
    expect(moved(heavy, hb)).toBeLessThan(moved(open, before));
    const shown = (w: Water) => Array.from(w.a).filter(a => a > 0.05).length;
    expect(shown(heavy)).toBeLessThan(shown(open));
    expect(stretch(q[7]).share).toBeLessThan(stretch(1).share);
    const buf = new Float32Array(open.n * STRIDE);
    open.draw(buf);
    for (let i = 0; i < open.n; i++) {
      const stop = buf[i * STRIDE + 6], tint = buf[i * STRIDE + 7];
      expect(stop).toBeGreaterThanOrEqual(-1); expect(stop).toBeLessThan(7);
      expect(tint).toBeGreaterThanOrEqual(0); expect(tint).toBeLessThan(TINTS);
    }
  });
  it('eases to what is set, and runs nothing at --stream 0', () => {
    const w = new Water();
    w.set([0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2], [1, 0, 0, 0, 0, 0, 0]);
    expect(w.easing).toBe(true);
    w.step(0.016);
    expect(w.q[0]).toBeGreaterThan(0.2);
    for (let i = 0; i < 600; i++) w.step(0.05);
    expect(w.easing).toBe(false);
    w.k = 0;
    const s = Array.from(w.s);
    w.step(0.05);
    expect(Array.from(w.s)).toEqual(s);
  });
  it('shows nothing past the arrival\'s head', () => {
    const w = new Water();
    w.reveal = COURSE.at[2];
    for (let i = 0; i < 200; i++) w.step(0.05);
    for (let i = 0; i < w.n; i++) if (w.s[i] > COURSE.at[2] + 60) expect(w.a[i]).toBeLessThan(0.02);
  });
});

describe('the arrival', () => {
  it('lets the head go late, runs it once to the end, and only then brings in the sea and the circles', () => {
    expect(headAt(HEAD_FROM - 0.01)).toBeNull();
    expect(headAt(HEAD_FROM)).toBe(0);
    expect(headAt(HEAD_TO)).toBeCloseTo(1);
    let last = -1;
    for (let f = HEAD_FROM; f <= HEAD_TO; f += 0.01) { const x = headAt(f)!; expect(x).toBeGreaterThanOrEqual(last); last = x; }
    expect(seaIn(0.5)).toBe(0); expect(seaIn(1)).toBeCloseTo(1, 1);
    expect(circlesIn(0.8)).toBe(0); expect(circlesIn(1)).toBeCloseTo(1, 1);
  });
});

describe('the plate, with no canvas', () => {
  it('draws the land, seven named signs that link to their pages and travel, and the circles', () => {
    const root = document.createElement('div');
    document.body.append(root);
    act(() => { render(h(MountainPlate, { d: 0.4, gates: [0, 0, 0, 0, 0.7, 0, 0], live: new Set(['heart'] as const) }), root); });
    const plate = root.querySelector<HTMLElement>('.mt-plate')!;
    expect(plate.classList.contains('on-plate')).toBe(true);
    expect(plate.dataset.d).toBe('0.400');
    expect(plate.dataset.gates).toBe('0.000,0.000,0.000,0.000,0.700,0.000,0.000');
    const stops = [...root.querySelectorAll<HTMLAnchorElement>('a.mt-stop')];
    expect(stops.map(a => a.textContent)).toEqual(['Crown', 'Third eye', 'Throat', 'Heart', 'Solar plexus', 'Sacral', 'Root']);
    expect(stops.map(a => a.getAttribute('href'))).toEqual(CHAKRA_IDS.map(id => `#/flow/c/${id}`));
    CHAKRA_IDS.forEach((id, i) => expect(stops[i].querySelector('[data-travel]')!.getAttribute('data-travel')).toBe(signTravel(id)));
    expect(stops[4].querySelector('.fs-sign')!.getAttribute('data-closed')).toBe('0.70');
    expect(stops[3].dataset.live).toBe('true');
    expect(stops[3].querySelector('.mt-dot')).not.toBeNull();
    expect(stops[0].querySelector('.mt-dot')).toBeNull();
    expect([...root.querySelectorAll('a.mt-circle')].map(a => a.getAttribute('href'))).toEqual(['#/flow/meditate', '#/flow/energize']);
    // no number anywhere on the plate (rule 15)
    expect(/\d/.test(plate.textContent ?? '')).toBe(false);
    act(() => { render(null, root); });
    root.remove();
  });
});
