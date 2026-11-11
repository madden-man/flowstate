// Be's pure drawing helpers (PLAN-VALUES.md C2): the rules on a list row and the struck versions in the value sheet.
import { describe, it, expect } from 'vitest';
import { ruleIds, struckLines } from '../../src/ui/be/lines';
import type { Champion, Voice } from '../../src/db/schema';

const voice = (id: string, archived = false): Voice =>
  ({ id, name: id, aka: [], colour: { hue: 25 }, shade: 'light', starred: false, order: 0, archived, revisions: [] });
const ch = (voiceId: string, side: Champion['side'], at: number): Champion => ({ voiceId, side, at });

describe('ruleIds', () => {
  const vs = [voice('a'), voice('b'), voice('c'), voice('gone', true)];
  it('puts the value side first, then the shadow side, each voice once, archived voices out', () => {
    const champions = [ch('c', 'shadow', 1), ch('b', 'value', 3), ch('a', 'value', 2), ch('gone', 'value', 0), ch('a', 'shadow', 4)];
    expect(ruleIds({ champions }, vs)).toEqual(['a', 'b', 'c']);
  });
  it('is empty when nobody fights for it, or only an archived voice does', () => {
    expect(ruleIds({ champions: [] }, vs)).toEqual([]);
    expect(ruleIds({ champions: [ch('gone', 'value', 1)] }, vs)).toEqual([]);
  });
});

describe('struckLines', () => {
  it('draws each earlier word and shadow, newest first', () => {
    expect(struckLines({ revisions: [{ at: 1, word: 'brave' }, { at: 5, word: 'courage', shadow: 'safety' }] }))
      .toEqual([{ at: 5, word: 'courage', shadow: 'safety' }, { at: 1, word: 'brave' }]);
  });
  it('from a paradox, strikes only what the value has no field for, never its own words', () => {
    const r = { at: 2, word: 'thoughtful', shadow: 'reactive', fromParadox: { overdone: 'obsessive', shadowLooks: 'Moving fast' } };
    expect(struckLines({ revisions: [r] })).toEqual([{ at: 2, text: 'obsessive' }, { at: 2, text: 'Moving fast' }]);
    expect(struckLines({ revisions: [{ at: 2, word: 'x', fromParadox: {} }] })).toEqual([]);
  });
});
