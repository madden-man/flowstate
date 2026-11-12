// PLAN-TIERS.md B1: what Be's tiered list draws from the tiers (src/ui/be/tiers.ts): the run of slots (each tier's
// heading, its rows or its landing rule; then the shelves), the two dated lines, and what Still shows.
import { describe, it, expect } from 'vitest';
import type { Value } from '../../src/db/schema';
import type { Tiers } from '../../src/model/values';
import { PLACE_WORDS, legacyLine, placeWord, sinceLine, slots, stillValues } from '../../src/ui/be/tiers';

const D = (m: number, d: number) => new Date(2026, m - 1, d, 9).getTime();
const v = (id: string, over: Partial<Value> = {}): Value =>
  ({ id, createdAt: D(11, 7), updatedAt: D(11, 7), status: 'held', word: id, champions: [], revisions: [], ...over });
const T = (over: Partial<Tiers> = {}): Tiers => ({ first: [], second: [], third: [], resting: [], legacy: [], ...over });
const shape = (t: Tiers, open = { resting: false, legacy: false }) => slots(t, open).map(s => s.kind === 'row' ? `${s.place}:${s.value.id}` : s.key);

describe('the slots', () => {
  it('after the upgrade: First over its landing rule, Second over every value, Third over its landing rule', () => {
    expect(shape(T({ second: [v('a'), v('b')] }))).toEqual(['heading-1', 'land-1', 'heading-2', '2:a', '2:b', 'heading-3', 'land-3']);
  });

  it('nothing held: three headings, each over its landing rule, and no shelf words', () => {
    expect(shape(T())).toEqual(['heading-1', 'land-1', 'heading-2', 'land-2', 'heading-3', 'land-3']);
  });

  it('a shelf word shows only when something is on it, Resting before Legacy; its rows only while it is open', () => {
    const t = T({ first: [v('a', { tier: 1 })], resting: [v('r', { status: 'resting' })], legacy: [v('l', { status: 'legacy' })] });
    expect(shape(t)).toEqual(['heading-1', '1:a', 'heading-2', 'land-2', 'heading-3', 'land-3', 'shelf-resting', 'shelf-legacy']);
    expect(shape(t, { resting: false, legacy: true })).toEqual(['heading-1', '1:a', 'heading-2', 'land-2', 'heading-3', 'land-3', 'shelf-resting', 'shelf-legacy', 'legacy:l']);
    expect(shape(t, { resting: true, legacy: true }).slice(-4)).toEqual(['shelf-resting', 'resting:r', 'shelf-legacy', 'legacy:l']);
    expect(shape(T({ second: [v('a')] }), { resting: true, legacy: true })).not.toContain('shelf-resting');
  });

  it('every key is unique across the run', () => {
    const t = T({ first: [v('a')], second: [v('b')], third: [v('c')], resting: [v('r')], legacy: [v('l')] });
    const keys = slots(t, { resting: true, legacy: true }).map(s => s.key);
    expect(new Set(keys).size).toBe(keys.length);
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
  it("First's words alone; when First is empty, every held word in tier order; never a shelf", () => {
    const r = [v('r', { status: 'resting' })], l = [v('l', { status: 'legacy' })];
    expect(stillValues(T({ first: [v('a')], second: [v('b')], third: [v('c')], resting: r, legacy: l })).map(x => x.id)).toEqual(['a']);
    expect(stillValues(T({ second: [v('b')], third: [v('c')], resting: r, legacy: l })).map(x => x.id)).toEqual(['b', 'c']);
    expect(stillValues(T({ resting: r, legacy: l }))).toEqual([]);
  });
});
