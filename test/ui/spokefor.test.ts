// PLAN-VALUES.md C4: the "Spoke for" chips (what a voice fights for, value before its shadow, in his order), the
// "+ value" offers, the word a confirmed line is printed for, and "For what?" on a new council's seats.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { store } from '../../src/db/fields';
import type { Value } from '../../src/db/schema';
import { aboutValue, notAboutValue, newCouncil, seat } from '../../src/model/council';
import { champion, createValue, placeValue, deleteValue } from '../../src/model/values';
import { spokeChips, offerChips, forWord, spokeLabel, valueList, reloadValues } from '../../src/ui/parts/SpokeFor';

const SELFLESS = 'value-px-selfless-selfish';
const THOUGHTFUL = 'value-px-thoughtful-reactive';
const T0 = new Date(2026, 10, 11, 9).getTime();
const W = { id: 'v-warrior', archived: false };

beforeEach(async () => { await freshDB(); await ensureSeeded(T0); });

describe('the chips on a line', () => {
  it('values and shadows the voice fights for, each value before its shadow, in list order; resting values leave', async () => {
    await champion(THOUGHTFUL, 'v-warrior', 'shadow', T0);
    await champion(SELFLESS, 'v-warrior', 'shadow', T0 + 1);
    await champion(SELFLESS, 'v-warrior', 'value', T0 + 2);
    await champion(SELFLESS, 'v-mystic', 'value', T0 + 3);
    await reloadValues();
    expect(spokeChips(valueList.value, W).map(c => [c.word, c.side])).toEqual([['selfless', 'value'], ['selfish', 'shadow'], ['reactive', 'shadow']]);
    expect(spokeChips(valueList.value, { ...W, archived: true })).toEqual([]);
    expect(offerChips(valueList.value, 'v-warrior').map(c => c.word)).toEqual(['thoughtful']);
    expect(offerChips(valueList.value, 'v-joker').map(c => c.word)).toEqual(['selfless', 'selfish', 'thoughtful', 'reactive']);
    await placeValue(THOUGHTFUL, 'resting', undefined, T0 + 4);
    await reloadValues();
    expect(spokeChips(valueList.value, W).map(c => c.word)).toEqual(['selfless', 'selfish']);
  });

  it('follow the tiers: First before Second before Third, whatever order they were made in (B1)', async () => {
    await champion(THOUGHTFUL, 'v-warrior', 'value', T0);
    await champion(SELFLESS, 'v-warrior', 'value', T0 + 1);
    const w = await createValue({ word: 'wonder' }, T0 + 2);
    await champion(w.id, 'v-warrior', 'value', T0 + 3);
    await placeValue(w.id, 1, undefined, T0 + 4);
    await placeValue(SELFLESS, 3, undefined, T0 + 5);
    await reloadValues();
    expect(spokeChips(valueList.value, W).map(c => c.word)).toEqual(['wonder', 'thoughtful', 'selfless']);
  });

  it('a value with no shadow offers its word only', async () => {
    await createValue({ word: 'wonder' }, T0);
    await reloadValues();
    expect(offerChips(valueList.value, 'v-joker').map(c => c.word)).toEqual(['selfless', 'selfish', 'thoughtful', 'reactive', 'wonder']);
  });
});

describe('the label', () => {
  it('prints the value or the shadow word; a resting value still prints; a deleted one prints nothing', async () => {
    const vs: Pick<Value, 'id' | 'word' | 'shadow'>[] = [{ id: 'a', word: 'honesty', shadow: 'discretion' }, { id: 'b', word: 'play' }];
    expect(forWord(vs, { valueId: 'a', side: 'value' })).toBe('honesty');
    expect(forWord(vs, { valueId: 'a', side: 'shadow' })).toBe('discretion');
    expect(forWord(vs, { valueId: 'b', side: 'shadow' })).toBeUndefined();
    expect(forWord(vs, { valueId: 'gone', side: 'value' })).toBeUndefined();
    expect(forWord(vs, undefined)).toBeUndefined();
    expect(spokeLabel({ id: 'm', for: { valueId: 'a', side: 'value' } }, vs)).toEqual({ word: 'honesty', state: undefined });
    expect(spokeLabel({ id: 'm' }, vs)).toBeUndefined();

    await placeValue(SELFLESS, 'resting', undefined, T0);
    await reloadValues();
    expect(forWord(valueList.value, { valueId: SELFLESS, side: 'shadow' })).toBe('selfish');
    // a Legacy value still prints too (B1): reloadValues loads Legacy, and its chips stay off every voice's line
    await placeValue(THOUGHTFUL, 'legacy', undefined, T0);
    await champion(THOUGHTFUL, 'v-warrior', 'value', T0);
    await reloadValues();
    expect(forWord(valueList.value, { valueId: THOUGHTFUL, side: 'value' })).toBe('thoughtful');
    expect(forWord(valueList.value, { valueId: THOUGHTFUL, side: 'shadow' })).toBe('reactive');
    expect(spokeChips(valueList.value, W).map(c => c.word)).toEqual([]);
    expect(offerChips(valueList.value, 'v-joker').map(c => c.word)).toEqual([]);
    await deleteValue(SELFLESS, T0 + 1);
    await reloadValues();
    expect(forWord(valueList.value, { valueId: SELFLESS, side: 'value' })).toBeUndefined();
  });
});

describe('For what?', () => {
  it('seats the champions not yet seated, value side first, and names the value; a second tap leaves the seats', async () => {
    await champion(SELFLESS, 'v-mystic', 'shadow', T0);
    await champion(SELFLESS, 'v-warrior', 'value', T0 + 1);
    await champion(SELFLESS, 'v-architect', 'value', T0 + 2);
    const c = await newCouncil({ now: T0 });
    await seat(c.id, 'v-architect', T0 + 3);
    const on = await aboutValue(c.id, SELFLESS, T0 + 4);
    expect(on.valueIds).toEqual([SELFLESS]);
    expect(on.seats).toEqual(['v-architect', 'v-warrior', 'v-mystic']);
    expect(await aboutValue(c.id, SELFLESS, T0 + 5)).toEqual(on);
    const off = await notAboutValue(c.id, SELFLESS, T0 + 6);
    expect(off.valueIds).toBeUndefined();
    expect(off.seats).toEqual(['v-architect', 'v-warrior', 'v-mystic']);
    expect((await store.get('pages', c.id))!.valueIds).toBeUndefined();
    // a value with nobody fighting for it is named and seats nobody
    const bare = await aboutValue(c.id, THOUGHTFUL, T0 + 7);
    expect(bare.valueIds).toEqual([THOUGHTFUL]);
    expect(bare.seats).toEqual(off.seats);
    await expect(aboutValue(c.id, 'nope')).rejects.toThrow('No such value');
  });
});
