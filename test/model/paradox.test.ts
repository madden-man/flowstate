import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB, writeSeedParadoxes } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { store } from '../../src/db/fields';
import type { Paradox } from '../../src/db/schema';
import {
  canSaveParadox, cleanPole, cleanMiddle, revise, sameVersion, createParadox, saveParadox, OnePoleError,
  antonymSuggestions, threeWords, threeWordLines,
} from '../../src/model/paradox';

beforeEach(async () => { await freshDB(); });

const pole = (value: string, aspect: string, shadow?: string) => ({ value, aspect, ...(shadow ? { shadow } : {}) });

describe('the paradox rule', () => {
  it('will not save with one pole: both values and both aspects are needed', () => {
    const full = { poleA: pole('selfless', 'vegetable chopping'), poleB: pole('selfish', 'breathing room') };
    expect(canSaveParadox(full)).toBe(true);
    expect(canSaveParadox({ ...full, poleB: pole('selfish', '  ') })).toBe(false);
    expect(canSaveParadox({ ...full, poleA: pole('', 'x') })).toBe(false);
    expect(canSaveParadox({ poleA: pole('a', 'b'), poleB: pole('', '') })).toBe(false);
  });

  it('tidies poles and middles: an empty shadow or middle is left out', () => {
    expect(cleanPole({ value: ' thoughtful ', aspect: ' x ', shadow: ' obsessive ' })).toEqual({ value: 'thoughtful', aspect: 'x', shadow: 'obsessive' });
    expect(cleanPole({ value: 'a', aspect: 'b', shadow: ' ' })).toEqual({ value: 'a', aspect: 'b' });
    expect(cleanMiddle({ word: ' ', scenario: '' })).toBeUndefined();
    expect(cleanMiddle({ scenario: ' a scene ' })).toEqual({ scenario: 'a scene' });
  });

  it('creates through the store and refuses one pole', async () => {
    await expect(createParadox({ poleA: pole('patient', 'x'), poleB: pole('urgent', '') })).rejects.toBeInstanceOf(OnePoleError);
    const p = await createParadox({ poleA: pole('patient', 'waiting it out'), poleB: pole('urgent', 'now'), middle: { word: 'ready' } }, 5);
    expect(await store.get('paradoxes', p.id)).toMatchObject({ status: 'active', middle: { word: 'ready' }, revisions: [], createdAt: 5 });
  });

  it('an edit pushes the old version onto revisions; an unchanged save pushes nothing', async () => {
    const p = await createParadox({ poleA: pole('a', 'x'), poleB: pole('b', 'y'), middle: { word: 'm1' } }, 1);
    expect(sameVersion(p, { poleA: pole('a ', 'x'), poleB: pole('b', 'y'), middle: { word: 'm1' } })).toBe(true);
    expect(revise(p, { poleA: pole('a', 'x'), poleB: pole('b', 'y'), middle: { word: 'm1' } })).toBe(p);
    const v2 = await saveParadox(p, { poleA: pole('a', 'x', 'obsessive'), poleB: pole('b', 'y') }, 'active', 2);
    expect(v2.revisions).toEqual([{ at: 1, poleA: pole('a', 'x'), poleB: pole('b', 'y'), middle: { word: 'm1' } }]);
    expect(v2.middle).toBeUndefined();
    expect(v2.poleA.shadow).toBe('obsessive');
    const v3 = await saveParadox(v2, { poleA: v2.poleA, poleB: v2.poleB }, 'resting', 3);
    expect(v3.revisions).toHaveLength(1); // status alone is not a new version
    expect((await store.get('paradoxes', p.id))!.status).toBe('resting');
    await expect(saveParadox(v3, { poleA: pole('a', ''), poleB: v3.poleB })).rejects.toBeInstanceOf(OnePoleError);
  });

  it('offers antonyms from the seed list, never the word already written', () => {
    expect(antonymSuggestions('Selfless')).toEqual(['selfish']);
    expect(antonymSuggestions('selfless', 'Selfish')).toEqual([]);
    expect(antonymSuggestions('nothing')).toEqual([]);
  });
});

describe('the three-word line', () => {
  it('reads pole A, the middle, pole B; the middle is left out when empty; shadows in brackets', () => {
    expect(threeWords({ poleA: pole('selfless', ''), poleB: pole('selfish', ''), middle: { word: 'compassionate self-awareness' } }))
      .toBe('selfless · compassionate self-awareness · selfish');
    expect(threeWords({ poleA: pole('thoughtful', '', 'obsessive'), poleB: pole('reactive', '') })).toBe('thoughtful (obsessive) · reactive');
    expect(threeWords({ poleA: pole('a', ''), poleB: pole('b', ''), middle: { scenario: 'a scene' } })).toBe('a · a scene · b');
  });

  it('is omitted with no middle and no revisions; earlier versions are struck beneath, oldest first', async () => {
    await ensureSeeded(); await writeSeedParadoxes();
    const p1 = { paradox: (await store.get('paradoxes', 'px-selfless-selfish'))! };
    const p2 = { paradox: (await store.get('paradoxes', 'px-thoughtful-reactive'))! };
    expect(threeWordLines(p2.paradox)).toBeNull();
    expect(threeWordLines(p1.paradox)).toEqual({
      current: 'selfless · selfish',
      struck: ['selfless · compassionate self-awareness · selfish', 'selfless · balance self with others, fill all needs · selfish'],
    });
    const v = await saveParadox(p1.paradox, { poleA: p1.paradox.poleA, poleB: p1.paradox.poleB, middle: { word: 'fill both' } });
    const lines = threeWordLines(v)!;
    expect(lines.current).toBe('selfless · fill both · selfish');
    expect(lines.struck).toHaveLength(3);
    expect(lines.struck[2]).toBe('selfless · selfish');
    // a version that reads the same as the one now in ink is not struck twice
    expect(threeWordLines({ ...v, middle: undefined })!.struck).not.toContain('selfless · selfish');
  });
});

describe('sealing', () => {
  it('aspects go through the fields layer', async () => {
    const p: Paradox = await createParadox({ poleA: pole('a', 'secret a'), poleB: pole('b', 'secret b') });
    expect((await store.get('paradoxes', p.id))!.poleA.aspect).toBe('secret a');
  });
});
