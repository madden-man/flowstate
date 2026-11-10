// What stuck's axis (PLAN-ENERGIZE.md X4, model/stuck.ts): the axis starts at the first stint's month, months are
// labelled at their true places, a stint across a year end runs on one line, a same-day stint keeps its place with no
// length (the page draws it as a dot), and labels are thinned so none collides, years past three years of history.
import { describe, it, expect } from 'vitest';
import { axisOf, labelsOf, monthStart, place, runOf, LABEL_GAP } from '../../src/model/stuck';

const at = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h).getTime();
const NOW = at(2026, 11, 10, 9);

describe('the axis', () => {
  it('runs from the start of the first stint\'s month to now', () => {
    const a = axisOf([{ from: at(2026, 10, 28) }, { from: at(2026, 8, 20) }], NOW);
    expect(a).toEqual({ start: at(2026, 8, 1), now: NOW });
    expect(monthStart(at(2026, 8, 20, 15))).toBe(at(2026, 8, 1));
    expect(place(a, a.start)).toBe(0);
    expect(place(a, NOW)).toBe(1);
    expect(place(a, NOW + 1e9)).toBe(1);
  });

  it('labels months at their true places, not evenly, and drops one too close to now', () => {
    const a = axisOf([{ from: at(2026, 8, 20) }], NOW);
    const ls = labelsOf(a);
    expect(ls.map(l => l.text)).toEqual(['Aug', 'Sep', 'Oct']);
    const span = NOW - at(2026, 8, 1);
    expect(ls[1].at).toBeCloseTo((at(2026, 9, 1) - at(2026, 8, 1)) / span, 6);
    expect(ls[2].at).toBeCloseTo((at(2026, 10, 1) - at(2026, 8, 1)) / span, 6);
    // Nov starts nine days before now: it would run into "now", so it is left out
    expect(1 - (at(2026, 11, 1) - at(2026, 8, 1)) / span).toBeLessThan(LABEL_GAP);
  });

  it('runs a stint across a year end on one line, and labels Dec then Jan', () => {
    const now = at(2027, 3, 20);
    const a = axisOf([{ from: at(2026, 12, 20) }], now);
    expect(a.start).toBe(at(2026, 12, 1));
    const r = runOf(a, { from: at(2026, 12, 20), to: at(2027, 1, 10), slot: 0 });
    expect(r.open).toBe(false);
    expect(r.at).toBeCloseTo(19 * 86_400_000 / (now - a.start), 6);
    expect(r.at + r.length).toBeCloseTo((at(2027, 1, 10) - a.start) / (now - a.start), 6);
    expect(labelsOf(a).map(l => l.text)).toEqual(['Dec', 'Jan', 'Feb', 'Mar']);
  });

  it('a same-day stint keeps its place with no length; an open one runs to now', () => {
    const a = axisOf([{ from: at(2026, 9, 1) }], NOW);
    const dot = runOf(a, { from: at(2026, 10, 3, 10), to: at(2026, 10, 3, 11), slot: 1 });
    expect(dot.length).toBeLessThan(0.001);
    expect(dot.at).toBeGreaterThan(0.3);
    const on = runOf(a, { from: at(2026, 10, 28), slot: 2 });
    expect(on.open).toBe(true);
    expect(on.at + on.length).toBeCloseTo(1, 9);
  });

  it('thins months past about eight, so no two labels sit closer than the gap', () => {
    for (const months of [4, 8, 9, 14, 24, 36]) {
      const start = at(2026, 11, 1) - months * 30.44 * 86_400_000;
      const ls = labelsOf(axisOf([{ from: start }], NOW));
      expect(ls.length).toBeGreaterThan(1);
      for (let i = 1; i < ls.length; i++) expect(ls[i].at - ls[i - 1].at).toBeGreaterThanOrEqual(LABEL_GAP);
      expect(1 - ls.at(-1)!.at).toBeGreaterThanOrEqual(LABEL_GAP);
      expect(ls.every(l => /^[A-Z][a-z]{2}$/.test(l.text))).toBe(true);
      if (months <= 6) expect(ls.length).toBe(months);
    }
    // a year and more names every second or third month, from the first
    const year = labelsOf(axisOf([{ from: at(2025, 10, 5) }], NOW)).map(l => l.text);
    expect(year[0]).toBe('Oct');
    expect(year.length).toBeLessThanOrEqual(7);
  });

  it('past three years names the years at their Januaries, thinned the same way', () => {
    const ls = labelsOf(axisOf([{ from: at(2021, 5, 3) }], NOW));
    expect(ls.map(l => l.text)).toEqual(['2022', '2023', '2024', '2025', '2026']);
    for (let i = 1; i < ls.length; i++) expect(ls[i].at - ls[i - 1].at).toBeGreaterThanOrEqual(LABEL_GAP);
    const long = labelsOf(axisOf([{ from: at(2006, 2, 1) }], NOW));
    expect(long.length).toBeGreaterThan(2);
    for (let i = 1; i < long.length; i++) expect(long[i].at - long[i - 1].at).toBeGreaterThanOrEqual(LABEL_GAP);
  });
});
