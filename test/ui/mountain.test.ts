// @vitest-environment jsdom
// The mountain (PLAN-MOUNTAIN.md R1): the river's course, the land drawn once, the water's motes, the arrival's clock,
// and the plate in a DOM with no canvas (the land and the signs, nothing else).
import { describe, it, expect } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { COURSE, STOPS, place, stretchAt, stretches, channelPaths, seaSlots, W, PEAK } from '../../src/ui/parts/cycle/river';
import { land, snowCap, half, SNOW_Y } from '../../src/ui/flow/mountain/land';
import { Water, STRIDE, TINTS } from '../../src/ui/flow/mountain/water';
import { seaIn, circlesIn, HEAD_FROM, HEAD_TO } from '../../src/ui/flow/mountain/arrival';
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
  it('is one steady stream: as much light at every moment, no mote brighter than itself, nothing let go runs bright', () => {
    const w = new Water();
    w.feed(0, [0, 0, 0, 0.8, 0, 0, 0], true);
    w.feed(0, [0, 0, 0, 0.8, 0, 0, 0]);
    for (let i = 0; i < 400; i++) w.step(1 / 60);
    const out = new Float32Array(w.n * STRIDE);
    const light = () => { w.draw(out); let sum = 0; for (let i = 0; i < w.n; i++) sum += out[i * STRIDE + 4]; return sum; };
    const sizes = () => { w.draw(out); return Array.from({ length: w.n }, (_, i) => out[i * STRIDE + 5]); };
    const size0 = sizes();
    // the gate opens: the pool is let go, and the stream fills below without a front
    w.feed(0, [0, 0, 0, 0, 0, 0, 0]);
    let prev = light();
    for (let f = 0; f < 300; f++) {
      w.step(1 / 30);
      const now = light();
      expect(Math.abs(now - prev)).toBeLessThan(prev * 0.04);
      prev = now;
      let top = 0;
      for (let i = 0; i < w.n; i++) top = Math.max(top, out[i * STRIDE + 4]);
      expect(top).toBeLessThanOrEqual(0.9 * 1.9 + 1e-6);
    }
    expect(sizes()).toEqual(size0);
  });
  it('shows nothing past reveal, where a part of the course is kept dark', () => {
    const w = new Water();
    w.reveal = COURSE.at[2];
    for (let i = 0; i < 200; i++) w.step(0.05);
    for (let i = 0; i < w.n; i++) if (w.s[i] > COURSE.at[2] + 60) expect(w.a[i]).toBeLessThan(0.02);
  });
});

describe('the arrival', () => {
  it('brings the stream\'s light up late, and only then brings in the sea and the circles', () => {
    expect(HEAD_FROM).toBeLessThan(HEAD_TO);
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
    // no ride open: no dot on the sea
    expect(root.querySelector('a.mt-circle .mt-dot')).toBeNull();
    act(() => { render(h(MountainPlate, { d: 0.4, gates: [0, 0, 0, 0, 0.7, 0, 0], liveFlows: new Set(['energize']) }), root); });
    // a ride open on Energize: the dot is on its circle, and on nothing else in the sea
    const circles = [...root.querySelectorAll<HTMLElement>('a.mt-circle')];
    expect(circles[1].dataset.live).toBe('true');
    expect(circles[1].querySelector('.mt-dot')).not.toBeNull();
    expect(circles[0].querySelector('.mt-dot')).toBeNull();
    // no number anywhere on the plate (rule 15)
    expect(/\d/.test(plate.textContent ?? '')).toBe(false);
    act(() => { render(null, root); });
    root.remove();
  });
});

// R2: the weather the meter sets, and the water carried down the mountain
import { capOf, SNOW_CLEAR, SNOW_HEAVY } from '../../src/ui/flow/mountain/weather';
import { TRAVEL, SURGES } from '../../src/ui/flow/mountain/water';
import { snapMeter, meterWords } from '../../src/ui/flow/mountain/Meter';

describe('the weather (R2)', () => {
  it('brings the snow down, gathers the mist and lets the snow fall as the meter rises', () => {
    const clear = capOf(0), heavy = capOf(1);
    expect(clear.snowline).toBe(SNOW_CLEAR);
    expect(heavy.snowline).toBeCloseTo(SNOW_HEAVY);
    expect(clear.cloud).toBe(0); expect(clear.flakes).toBe(0);
    expect(heavy.cloud).toBe(1); expect(heavy.flakes).toBe(1);
    // the crown is always in the snow; the heaviest line is still above the heart
    expect(SNOW_CLEAR).toBeGreaterThan(STOPS.crown.y);
    expect(SNOW_HEAVY).toBeLessThan(STOPS.heart.y);
    let last = capOf(0);
    for (let d = 0.05; d <= 1; d += 0.05) {
      const w = capOf(d);
      expect(w.snowline).toBeGreaterThan(last.snowline);
      expect(w.cloud).toBeGreaterThanOrEqual(last.cloud);
      expect(w.flakes).toBeGreaterThanOrEqual(last.flakes);
      last = w;
    }
    // nothing falls on a light day
    expect(capOf(0.2).flakes).toBe(0);
    expect(capOf(NaN)).toEqual(capOf(0));
  });
  it('keeps the snow\'s foot where the gullies are, so a lower line is the same snow grown', () => {
    expect(snowCap(120).rim).not.toBe(snowCap(160).rim);
    expect(snowCap(160).lit).toBe(snowCap(160).lit);
  });
});

describe('the water carried down the mountain (R2)', () => {
  const run = (w: Water, secs: number) => { for (let t = 0; t < secs; t += 1 / 60) w.step(1 / 60); };
  it('lands a gate closed on the stretch below it at once, and further down only as the water gets there', () => {
    const w = new Water();
    w.feed(0, [0, 0, 0, 0, 0, 0, 0], true);
    w.feed(0, [0, 0, 0, 0.9, 0, 0, 0]);
    run(w, 0.5);
    expect(w.q[4]).toBeLessThan(0.4);                 // just below the heart
    expect(w.q[6]).toBeGreaterThan(0.95);             // the sacral has not had it yet
    const toSacral = (COURSE.at[6] - COURSE.at[4]) / TRAVEL;
    run(w, toSacral + 0.3);
    expect(w.q[6]).toBeCloseTo(reach(0, [0, 0, 0, 0.9, 0, 0, 0])[5], 1);
    run(w, 6);
    const want = stretches(spring(0), reach(0, [0, 0, 0, 0.9, 0, 0, 0]));
    for (let j = 0; j < 8; j++) expect(w.q[j]).toBeCloseTo(want[j], 2);
  });
  it('carries the meter from the spring, and the gates themselves answer at once', () => {
    const w = new Water();
    w.feed(0, [0, 0, 0, 0, 0, 0, 0], true);
    w.feed(1, [0, 0, 0.5, 0, 0, 0, 0]);
    run(w, 0.4);
    expect(w.q[0]).toBeCloseTo(spring(1), 1);
    expect(w.q[7]).toBeGreaterThan(0.9);
    expect(w.b[2]).toBeCloseTo(0.5, 1);
  });
  it('fills a closed gate\'s pool, and lets it go as one surge when the gate opens, rekindling what is below', () => {
    const w = new Water();
    w.feed(0, [0, 0, 0, 0, 0, 0, 0], true);
    w.feed(0, [0, 0, 0, 0.8, 0, 0, 0]);
    run(w, 5);
    expect(w.pooled[3]).toBeGreaterThan(0.5);
    expect(Array.from(w.surgeAmp).every(a => a === 0)).toBe(true);
    w.feed(0, [0, 0, 0, 0.4, 0, 0, 0]);
    w.feed(0, [0, 0, 0, 0, 0, 0, 0]);
    // the two moves of one opening are one surge, from the heart
    expect(Array.from(w.surgeAmp).filter(a => a > 0)).toHaveLength(1);
    const k = Array.from(w.surgeAmp).findIndex(a => a > 0);
    expect(w.surgeFrom[k]).toBeCloseTo(COURSE.at[4]);
    expect(w.pooled[3]).toBeLessThan(0.1);
    run(w, (COURSE.at[5] - COURSE.at[4]) / TRAVEL + 0.1);
    expect(w.reached[4]).toBe(1);   // the solar plexus
    expect(w.reached[2]).toBe(0);   // nothing above the heart
    run(w, 8);
    expect(Array.from(w.surgeAmp).every(a => a === 0)).toBe(true);
    expect(SURGES).toBeGreaterThan(1);
  });
  it('lets the held snow go from the spring when the meter lifts, and sends nothing on a closing', () => {
    const w = new Water();
    w.feed(0.9, [0, 0, 0, 0, 0, 0, 0], true);
    w.feed(0.9, [0, 0, 0.9, 0, 0, 0, 0]);
    expect(Array.from(w.surgeAmp).every(a => a === 0)).toBe(true);
    w.feed(0.2, [0, 0, 0.9, 0, 0, 0, 0]);
    const k = Array.from(w.surgeAmp).findIndex(a => a > 0);
    expect(k).toBeGreaterThanOrEqual(0);
    expect(w.surgeFrom[k]).toBe(0);
  });
  it('puts the whole mountain as it is given at once, with no travel and no surge (Reduce Motion)', () => {
    const w = new Water();
    w.feed(0, [0, 0, 0, 0.8, 0, 0, 0], true);
    w.feed(0.5, [0, 0, 0, 0, 0, 0, 0], true);
    const want = stretches(spring(0.5), reach(0.5, [0, 0, 0, 0, 0, 0, 0]));
    for (let j = 0; j < 8; j++) expect(w.q[j]).toBeCloseTo(want[j], 5);
    expect(Array.from(w.surgeAmp).every(a => a === 0)).toBe(true);
  });
});

describe('the meter (R2)', () => {
  it('snaps near either end to the end, and says the weather in words, never a number', () => {
    expect(snapMeter(0.01)).toBe(0); expect(snapMeter(0.99)).toBe(1); expect(snapMeter(0.5)).toBe(0.5);
    expect(snapMeter(-3)).toBe(0); expect(snapMeter(NaN)).toBe(0);
    for (const v of [0, 0.2, 0.5, 0.8, 1]) expect(meterWords(v)).not.toMatch(/\d/);
    expect(meterWords(0)).toBe('clear');
  });
});

// R2 review fixes
import { Weather } from '../../src/ui/flow/mountain/weather';

describe('the review fixes (R2)', () => {
  const run = (w: Water, secs: number) => { for (let t = 0; t < secs; t += 1 / 60) w.step(1 / 60); };
  it('a slow lift of the meter still sends its melt', () => {
    const w = new Water();
    w.feed(0.8, [0, 0, 0, 0, 0, 0, 0], true);
    // a twentieth of a percent a frame: every move alone is too little to see
    for (let d = 0.8; d > 0.5; d -= 0.004) { w.feed(d, [0, 0, 0, 0, 0, 0, 0]); w.step(1 / 60); }
    expect(Array.from(w.surgeAmp).some(a => a > 0)).toBe(true);
  });
  it('a gate put back at once (a cancelled gesture) sends no surge', () => {
    const w = new Water();
    w.feed(0, [0, 0, 0, 0, 0, 0, 0], true);
    w.feed(0, [0, 0, 0, 0.9, 0, 0, 0]);
    run(w, 3);
    expect(w.pooled[3]).toBeGreaterThan(0.4);
    w.feed(0, [0, 0, 0, 0, 0, 0, 0], true);
    expect(Array.from(w.surgeAmp).every(a => a === 0)).toBe(true);
    expect(w.pooled[3]).toBe(0);
  });
  it('snow falls only while the meter rises, and the air is still a short while after', () => {
    const flakes = (w: Weather) => (w as unknown as { flakes: { ps: { age: number; life: number }[] } }).flakes.ps.filter(p => p.age < p.life).length;
    const q = new Float32Array(8).fill(1), b = new Float32Array(7);
    const still = new Weather(86);
    still.set(capOf(0.9), true);
    for (let k = 0; k < 120; k++) still.step(1 / 60, q, 1, b);
    expect(flakes(still)).toBe(0);                    // a heavy day already set: no snow
    const rising = new Weather(86);
    rising.set(capOf(0.2), true);
    for (let k = 0; k < 30; k++) { rising.set(capOf(0.2 + k * 0.02)); rising.step(1 / 60, q, 1, b); }
    expect(flakes(rising)).toBeGreaterThan(5);        // it snows while it rises
    for (let k = 0; k < 60 * 9; k++) rising.step(1 / 60, q, 1, b);
    expect(flakes(rising)).toBe(0);                   // and then the air is still
  });
});
