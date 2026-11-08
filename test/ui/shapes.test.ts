// The open shapes (F3, PLAN-FLOWS.md 3.2 to 3.4; F4, 3.5): each walk visits every step's place in order, each step's word sits
// beside its place, the dot rests before the first step, and the drawing holds eight rules and its own truths.
import { describe, it, expect } from 'vitest';
import { SHAPES, shapeOf } from '../../src/ui/parts/cycle/index';
import { slotPoint, restPoint, type Shape } from '../../src/ui/parts/cycle/shape';
import { DEPRESS } from '../../src/db/seed/depress';
import { ENERGIZE } from '../../src/db/seed/energize';
import { FIGHT } from '../../src/db/seed/fight';
import { WHATIF } from '../../src/db/seed/whatif';
import { REPLAY } from '../../src/db/seed/replay';
import { NIGHT } from '../../src/db/seed/night';
import { SHUTDOWN } from '../../src/db/seed/shutdown';
import { SHAME } from '../../src/db/seed/shame';
import { curveWith, SEEDED } from '../../src/ui/parts/cycle/curve';

const OPEN = {
  valley: DEPRESS, arc: ENERGIZE, mountain: FIGHT, curve: WHATIF, coil: REPLAY, clock: NIGHT, stairs: SHUTDOWN, fork: SHAME,
} as const;
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

  // F4 (PLAN-FLOWS.md 3.5)
  const paths = (s: Shape, n: number, cls: RegExp) => s.paths(n).filter(d => d.kind === 'path' && cls.test(d.cls)) as { d: string; cls: string }[];
  const ys = (d: string) => [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(m => Number(m[2]));
  const xs = (d: string) => [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(m => Number(m[1]));

  it('the curve: the worry peaks the night before, drops straight at the thing, and the record says nine in ten were fine', () => {
    const c = SHAPES.curve!, n = WHATIF.steps.length;
    const pts = Array.from({ length: n }, (_, i) => slotPoint(c, i, n));
    // the night before is the highest step, and the walk's top is there, before the thing
    expect(Math.min(...pts.map(p => p.y))).toBe(pts[2].y);
    let top = 0;
    for (let i = 1; i <= 400; i++) if (c.at(i / 400).y < c.at(top / 400).y) top = i;
    expect(top / 400).toBeLessThan(c.slotT(3, n));
    // the drop is straight down: from the peak to the flat it barely moves across
    const foot = pts[4];
    expect(Math.abs(c.at(top / 400).x - pts[3].x)).toBeLessThan(8);
    expect(Math.abs(foot.y - restPoint(c, n).y)).toBeLessThan(0.5);
    // the seeded record: ten faint marks, nine checks and a cross, and the words carry no digit
    const marks = paths(c, n, /\bstamp\b/);
    expect(marks).toHaveLength(10);
    expect(marks.every(m => /faint-stamp/.test(m.cls))).toBe(true);
    expect(SEEDED.filter(o => o === 'didnt')).toHaveLength(9);
    expect(texts(c, n).map(t => t.text).join(' ')).toMatch(/didn't happen, nine in ten/);
    expect(texts(c, n).every(t => !/\d/.test(t.text))).toBe(true);
    // marks sit on the flat after the thing, above its line
    for (const m of marks) { expect(Math.min(...xs(m.d))).toBeGreaterThan(pts[3].x); expect(Math.max(...ys(m.d))).toBeLessThan(foot.y); }
  });

  it('the curve with his own stamps (F6): his marks, oldest leftmost, not faint, and the seeded words go', () => {
    const c = curveWith(['didnt', 'happened', 'didnt']), n = WHATIF.steps.length;
    const marks = paths(c, n, /\bstamp\b/);
    expect(marks).toHaveLength(3);
    expect(marks.some(m => /faint/.test(m.cls))).toBe(false);
    expect(Math.min(...xs(marks[0].d))).toBeLessThan(Math.min(...xs(marks[1].d)));
    expect(texts(c, n)).toHaveLength(0);
    // the walk is the same curve
    expect(c.at(0.5)).toEqual(SHAPES.curve!.at(0.5));
    expect(curveWith(Array(14).fill('didnt')).paths(n).filter(d => d.kind === 'path' && /stamp/.test(d.cls))).toHaveLength(12);
    // his marks are 'own' (Still hides them); the seeded record is 'seedstamp' (F6's CSS hides it once he has any)
    expect(marks.every(m => /\bown\b/.test(m.cls))).toBe(true);
    expect(paths(SHAPES.curve!, n, /\bseedstamp\b/)).toHaveLength(10);
    // the curve gives its stamped self through shapeOf, which Cycle uses
    expect(shapeOf('curve', ['happened']).paths(n).filter(d => d.kind === 'path' && /\bown\b/.test(d.cls))).toHaveLength(1);
    expect(shapeOf('valley', ['happened'])).toBe(SHAPES.valley);
  });

  it('the coil: each step is tighter in than the last, and one straight exit leaves at how', () => {
    const c = SHAPES.coil!, n = REPLAY.steps.length;
    const pts = Array.from({ length: n }, (_, i) => slotPoint(c, i, n));
    const centre = { x: 150, y: 118 };
    const r = pts.map(p => dist(p, centre));
    expect(r[1]).toBeLessThan(r[0] + 0.5);
    expect(r[2]).toBeLessThan(r[1]);
    // the exit: straight (one level line out of the middle), well outside the coil, with its arrowhead
    const exitFrom = c.at(c.slotT(n - 1, n) - 0.05);
    expect(Math.abs(exitFrom.y - pts[n - 1].y)).toBeLessThan(0.5);
    expect(r[n - 1]).toBeGreaterThan(r[0]);
    expect(paths(c, n, /^arrow$/)).toHaveLength(1);
    expect(texts(c, n).filter(t => t.text === 'why').length).toBeGreaterThanOrEqual(2);
  });

  it('the clock: the awake stretch from three, out of bed, back, and seven fixed; no numeral in Still', () => {
    const c = SHAPES.clock!, n = NIGHT.steps.length;
    const centre = { x: 150, y: 112 }, R = 82;
    const pts = Array.from({ length: n }, (_, i) => slotPoint(c, i, n));
    // awake again at three: level with the centre, on the right of the face
    expect(Math.abs(pts[0].y - centre.y)).toBeLessThan(1);
    expect(pts[0].x).toBeGreaterThan(centre.x);
    // up is out of bed: off the face
    expect(dist(pts[3], centre)).toBeGreaterThan(R + 20);
    // the alarm at seven: on the face, at seven o'clock, and pinned
    const seven = { x: centre.x + R * Math.cos((120 * Math.PI) / 180), y: centre.y + R * Math.sin((120 * Math.PI) / 180) };
    expect(dist(pts[n - 1], seven)).toBeLessThan(1);
    expect(paths(c, n, /(^| )pin( |$)/)).toHaveLength(1);
    expect(paths(c, n, /pin-stake/)).toHaveLength(1);
    // "7" in the hand beside the pin, a num so Still drops the digit and keeps the pin
    expect(texts(c, n).find(t => t.text === '7')!.cls).toMatch(/\bhand\b.*\bnum\b/);
    expect(paths(c, n, /\bthick\b/)).toHaveLength(1);
    // the dot rests asleep, before three
    expect(restPoint(c, n).y).toBeLessThan(centre.y);
    expect(texts(c, n).filter(t => /\d/.test(t.text)).every(t => /\bnum\b/.test(t.cls))).toBe(true);
  });

  it('the stairs: three even steps down, then a ramp back up that is gentler than the stairs', () => {
    const s = SHAPES.stairs!, n = SHUTDOWN.steps.length;
    const pts = Array.from({ length: n }, (_, i) => slotPoint(s, i, n));
    const drop1 = pts[1].y - pts[0].y, drop2 = pts[2].y - pts[1].y;
    expect(drop1).toBeGreaterThan(20);
    expect(Math.abs(drop1 - drop2)).toBeLessThan(1);
    expect(pts[3].y).toBeLessThan(pts[2].y);
    const end = s.at(1);
    const stairsSlope = (pts[2].y - pts[0].y) / (pts[2].x - pts[0].x);
    const rampSlope = (pts[2].y - end.y) / (end.x - pts[2].x);
    expect(rampSlope).toBeLessThan(stairsSlope);
    expect(texts(s, n).map(t => t.text)).toEqual(['alert', 'frozen', 'thaw']);
  });

  it('the fork: hide and hit back lead away and down; the third path curves back up past where it fell from', () => {
    const f = SHAPES.fork!, n = SHAME.steps.length;
    const pts = Array.from({ length: n }, (_, i) => slotPoint(f, i, n));
    const forkPt = pts[2];
    const away = paths(f, n, /pass/).filter(d => ys(d.d)[0] === forkPt.y);
    expect(away).toHaveLength(2);
    for (const a of away) expect(ys(a.d).at(-1)!).toBeGreaterThan(forkPt.y + 40);
    // the dot's road climbs back above where the drop began
    expect(f.at(1).y).toBeLessThan(pts[0].y);
    expect(pts[3].y).toBeLessThan(forkPt.y);
    expect(paths(f, n, /^arrow$/)).toHaveLength(1);
    expect(texts(f, n).map(t => t.text)).toEqual(['hide', 'hit back', 'I can fix it']);
  });
});
