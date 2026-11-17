// PLAN-TIERS.md B1: what Be's tiered list draws from the tiers (src/ui/be/tiers.ts): the run of slots (each tier's
// heading, its rows or its landing rule; then the shelves), the two dated lines, and what Still shows.
import { describe, it, expect } from 'vitest';
import type { Value } from '../../src/db/schema';
import type { Tiers } from '../../src/model/values';
import { PLACE_WORDS, isFolded, legacyLine, placeWord, runOf, sinceLine, slots, stillValues } from '../../src/ui/be/tiers';

const D = (m: number, d: number) => new Date(2026, m - 1, d, 9).getTime();
const v = (id: string, over: Partial<Value> = {}): Value =>
  ({ id, createdAt: D(11, 7), updatedAt: D(11, 7), status: 'held', word: id, champions: [], revisions: [], ...over });
const T = (over: Partial<Tiers> = {}): Tiers => ({ first: [], second: [], third: [], resting: [], legacy: [], ...over });
const shape = (t: Tiers, folded: Parameters<typeof slots>[1] = undefined) => slots(t, folded).map(s => s.kind === 'row' ? `${s.place}:${s.value.id}` : s.kind === 'heading' && s.folded ? `${s.key}~` : s.key);
const OPEN = { resting: false, legacy: false };

describe('the slots', () => {
  it('after the upgrade: First over its landing rule, Second over every value, Third over its landing rule', () => {
    expect(shape(T({ second: [v('a'), v('b')] }))).toEqual(['heading-1', 'land-1', 'heading-2', '2:a', '2:b', 'heading-3', 'land-3']);
  });

  it('nothing held: three headings, each over its landing rule, and no shelf', () => {
    expect(shape(T())).toEqual(['heading-1', 'land-1', 'heading-2', 'land-2', 'heading-3', 'land-3']);
    expect(shape(T(), OPEN)).toEqual(['heading-1', 'land-1', 'heading-2', 'land-2', 'heading-3', 'land-3']);
  });

  it('a shelf shows only when something is on it, Resting before Legacy, folded by default; its rows only while it is open', () => {
    const t = T({ first: [v('a', { tier: 1 })], resting: [v('r', { status: 'resting' })], legacy: [v('l', { status: 'legacy' })] });
    expect(shape(t)).toEqual(['heading-1', '1:a', 'heading-2', 'land-2', 'heading-3', 'land-3', 'heading-resting~', 'heading-legacy~']);
    expect(shape(t, { legacy: false })).toEqual(['heading-1', '1:a', 'heading-2', 'land-2', 'heading-3', 'land-3', 'heading-resting~', 'heading-legacy', 'legacy:l']);
    expect(shape(t, OPEN).slice(-4)).toEqual(['heading-resting', 'resting:r', 'heading-legacy', 'legacy:l']);
    expect(shape(T({ second: [v('a')] }), OPEN)).not.toContain('heading-resting');
  });

  it('a folded tier is its heading alone, rows or none: no rows, no landing rule', () => {
    const t = T({ first: [v('a')], second: [v('b'), v('c')] });
    expect(shape(t, { '1': true })).toEqual(['heading-1~', 'heading-2', '2:b', '2:c', 'heading-3', 'land-3']);
    expect(shape(t, { '2': true, '3': true })).toEqual(['heading-1', '1:a', 'heading-2~', 'heading-3~']);
  });

  it('every place folded: five lines, one heading each, nothing under them', () => {
    const t = T({ first: [v('a')], second: [v('b')], third: [v('c')], resting: [v('r')], legacy: [v('l')] });
    const all = { '1': true, '2': true, '3': true, resting: true, legacy: true };
    expect(shape(t, all)).toEqual(['heading-1~', 'heading-2~', 'heading-3~', 'heading-resting~', 'heading-legacy~']);
    // and every place open: each heading over its rows
    expect(shape(t, { resting: false, legacy: false })).toEqual(['heading-1', '1:a', 'heading-2', '2:b', 'heading-3', '3:c', 'heading-resting', 'resting:r', 'heading-legacy', 'legacy:l']);
  });

  it('every key is unique across the run', () => {
    const t = T({ first: [v('a')], second: [v('b')], third: [v('c')], resting: [v('r')], legacy: [v('l')] });
    const keys = slots(t, OPEN).map(s => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('the run', () => {
  it("a folded place's words in list order, nothing for an empty place, never a count", () => {
    expect(runOf([v('presence'), v('patience')])).toEqual(['presence', 'patience']);
    expect(runOf([])).toEqual([]);
    expect(runOf([v('a'), v('b'), v('c')]).join(' ')).not.toMatch(/\d/);
  });
});

describe('the kept fold (PLAN-FOLDS.md G0)', () => {
  it('absent: the three tiers open, Resting and Legacy folded', () => {
    const all = (f: Parameters<typeof isFolded>[0]) => PLACE_WORDS.map(p => isFolded(f, p.place));
    expect(all(undefined)).toEqual([false, false, false, true, true]);
    expect(all({})).toEqual([false, false, false, true, true]);
  });

  it('what he chose wins, place by place, and the rest stay at the default', () => {
    expect(PLACE_WORDS.map(p => isFolded({ '1': true, legacy: false }, p.place))).toEqual([true, false, false, true, false]);
    expect(isFolded({ resting: false }, 'resting')).toBe(false);
    expect(isFolded({ '3': true }, 3)).toBe(true);
  });
});

describe('the words', () => {
  it('the five, in list order', () => {
    expect(PLACE_WORDS.map(p => p.word)).toEqual(['First', 'Second', 'Third', 'Resting', 'Legacy']);
    expect([1, 2, 3, 'resting', 'legacy'].map(p => placeWord(p as 1))).toEqual(['First', 'Second', 'Third', 'Resting', 'Legacy']);
  });
});

describe('the dated lines', () => {
  it('a held value: its tier, since the day it came into it (its making when the log is empty)', () => {
    expect(sinceLine(v('a'))).toBe('Second since 11 / 7 / 26');
    expect(sinceLine(v('a', { tier: 1, tierLog: [{ at: D(11, 7), to: 2 }, { at: D(11, 12), to: 1 }] }))).toBe('First since 11 / 12 / 26');
  });

  it('nothing for a value resting or in Legacy', () => {
    expect(sinceLine(v('a', { status: 'resting' }))).toBeUndefined();
    expect(sinceLine(v('a', { status: 'legacy' }))).toBeUndefined();
  });

  it('a Legacy row: from its first day held to the day it went, or the from date alone', () => {
    expect(legacyLine(v('a', { status: 'legacy', tierLog: [{ at: D(11, 7), to: 2 }, { at: D(11, 12), to: 'legacy' }] }))).toBe('11 / 7 / 26 to 11 / 12 / 26');
    expect(legacyLine(v('a', { status: 'legacy' }))).toBe('11 / 7 / 26');
  });
});

describe('Still', () => {
  it("First's words alone, whatever is folded; when First is empty, every held word in tier order; never a shelf", () => {
    const r = [v('r', { status: 'resting' })], l = [v('l', { status: 'legacy' })];
    expect(stillValues(T({ first: [v('a')], second: [v('b')], third: [v('c')], resting: r, legacy: l })).map(x => x.id)).toEqual(['a']);
    expect(stillValues(T({ second: [v('b')], third: [v('c')], resting: r, legacy: l })).map(x => x.id)).toEqual(['b', 'c']);
    expect(stillValues(T({ resting: r, legacy: l }))).toEqual([]);
  });
});
