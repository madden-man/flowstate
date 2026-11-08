// The open shapes (F3, PLAN-FLOWS.md 3.2 to 3.4): each walk visits every step's place in order, each step's word sits
// beside its place, the dot rests before the first step, and the drawing holds eight rules and its own truths.
import { describe, it, expect } from 'vitest';
import { SHAPES, shapeOf } from '../../src/ui/parts/cycle/index';
import { slotPoint, restPoint, type Shape } from '../../src/ui/parts/cycle/shape';
import { DEPRESS } from '../../src/db/seed/depress';
import { ENERGIZE } from '../../src/db/seed/energize';
import { FIGHT } from '../../src/db/seed/fight';

const OPEN = { valley: DEPRESS, arc: ENERGIZE, mountain: FIGHT } as const;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const texts = (s: Shape, n: number) => s.paths(n).flatMap(d => (d.kind === 'text' ? [d] : []));

describe.each(Object.entries(OPEN))('%s', (name, seed) => {
  const shape = SHAPES[name as keyof typeof OPEN]!;
  const n = seed.steps.length;

  it('is registered, eight rules tall, and an open walk', () => {
    expect(shapeOf(seed.diagram)).toBe(shape);
    expect([shape.w, shape.h]).toEqual([328, 224]);
    expect(shape.closed).toBe(false);
  });

  it.each([1, 2, 3, n, 8])('the walk visits every place in order, the dot resting before the first (%i steps)', k => {
    const ts = Array.from({ length: k }, (_, i) => shape.slotT(i, k));
    for (let i = 1; i < k; i++) expect(ts[i]).toBeGreaterThan(ts[i - 1]);
    for (const t of ts) { expect(t).toBeGreaterThanOrEqual(0); expect(t).toBeLessThanOrEqual(1); }
    expect(shape.restT(k)).toBeLessThan(ts[0]);
    // every place is apart enough for the dot's detents to be told apart
    for (let i = 1; i < k; i++) expect(dist(slotPoint(shape, i, k), slotPoint(shape, i - 1, k))).toBeGreaterThan(14);
  });

  it('each step\'s word sits beside its place, inside the drawing', () => {
    for (let i = 0; i < n; i++) {
      const p = shape.at(shape.slotT(i, n)), l = shape.label(i, n);
      expect(dist(p, l)).toBeLessThan(24);
      expect(l.x).toBeGreaterThan(0); expect(l.x).toBeLessThan(shape.w);
      expect(l.y).toBeGreaterThan(0); expect(l.y).toBeLessThan(shape.h);
    }
  });

  it('the walk is continuous and stays in the drawing', () => {
    let last = shape.at(0);
    for (let i = 1; i <= 400; i++) {
      const p = shape.at(i / 400);
      expect(dist(p, last)).toBeLessThan(3);
      expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(shape.w);
      expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(shape.h);
      last = p;
    }
  });

  it('prints no percentage, and every word is in the hand or the print', () => {
    for (const t of texts(shape, n)) {
      expect(t.text).not.toMatch(/%|\u2014/);
      expect(t.cls).toMatch(/\b(hand|print)\b/);
    }
  });
});

describe('the truths', () => {
  it('the valley: the far slope is as long as the near one, and one dotted arrow says the next small thing', () => {
    const v = SHAPES.valley!, n = DEPRESS.steps.length;
    const bottom = slotPoint(v, 3, n);
    const near = slotPoint(v, 0, n), far = slotPoint(v, n - 1, n);
    expect(Math.abs((bottom.x - near.x) - (far.x - bottom.x))).toBeLessThan(2);
    expect(Math.abs(near.y - far.y)).toBeLessThan(2);
    // the floor is the lowest place, and the bottom is on it
    for (let i = 0; i < n; i++) expect(slotPoint(v, i, n).y).toBeLessThanOrEqual(bottom.y + 0.5);
    expect(texts(v, n).map(t => t.text)).toContain('one small thing');
    expect(v.paths(n).filter(d => d.kind === 'path' && d.cls === 'arrow')).toHaveLength(1);
  });

  it('the arc: rest and the end are on the same baseline; the crash goes below it and comes back to it', () => {
    const a = SHAPES.arc!, n = ENERGIZE.steps.length;
    const base = restPoint(a, n).y;
    expect(Math.abs(a.at(1).y - base)).toBeLessThan(0.5);
    // the tip is the highest step past the crest's near side; the crest is the walk's highest point
    const ys = Array.from({ length: n }, (_, i) => slotPoint(a, i, n).y);
    expect(Math.min(...ys)).toBe(ys[2]);
    const crash = a.paths(n).filter(d => d.kind === 'path' && d.cls === 'arc pass').map(d => (d as { d: string }).d).join(' ');
    const yNums = [...crash.matchAll(/[\d.]+ ([\d.]+)/g)].map(m => Number(m[1]));
    expect(Math.max(...yNums)).toBeGreaterThan(base + 20);
    expect(texts(a, n).map(t => t.text)).toEqual(expect.arrayContaining(['land', 'crash, and back']));
  });

  it('the mountain: coming down is many times longer than going up; leave and say it; the two time lines', () => {
    const m = SHAPES.mountain!, n = FIGHT.steps.length;
    const foot = slotPoint(m, 0, n), summit = slotPoint(m, 2, n), repair = slotPoint(m, n - 1, n);
    expect(repair.x - summit.x).toBeGreaterThan(2.5 * (summit.x - foot.x));
    expect(Math.abs(repair.y - foot.y)).toBeLessThan(4);
    const words = texts(m, n).map(t => t.text);
    expect(words).toEqual(expect.arrayContaining(['say it', 'leave', 'shame', 'replay', '20 min', 'about an hour']));
    // the number goes in Still (class num); the words stay
    expect(texts(m, n).filter(t => /\d/.test(t.text)).every(t => /\bnum\b/.test(t.cls))).toBe(true);
  });
});
