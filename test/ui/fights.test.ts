// The champion screens' pure helpers (PLAN-VALUES.md C3, ui/be/fights.ts): which sides a value has, who fights on a
// side, when letting go takes two taps, and a voice's chips in list order with the shadows after.
import { describe, it, expect } from 'vitest';
import type { Value } from '../../src/db/schema';
import { fightsOn, linkKey, offersFor, sideWord, sidesOf, twoTaps, whyOf } from '../../src/ui/be/fights';

const val = (id: string, word: string, o: Partial<Value> = {}): Value => ({
  id, word, createdAt: 0, updatedAt: 0, status: 'held', champions: [], revisions: [], ...o,
});

describe('fights', () => {
  const honesty = val('h', 'honesty', {
    shadow: 'discretion',
    champions: [{ voiceId: 'w', side: 'value', at: 1, why: 'I say it.' }, { voiceId: 'm', side: 'shadow', at: 2 }, { voiceId: 'w', side: 'shadow', at: 3, why: '' }],
  });

  it('a value has its word as a side, and its shadow when it has one', () => {
    expect(sidesOf(honesty)).toEqual(['value', 'shadow']);
    expect(sidesOf(val('p', 'play'))).toEqual(['value']);
    expect(sideWord(honesty, 'shadow')).toBe('discretion');
    expect(sideWord(honesty, 'value')).toBe('honesty');
  });

  it('a voice fights on a side, and may be on both', () => {
    expect(fightsOn(honesty, 'w', 'value')).toBe(true);
    expect(fightsOn(honesty, 'w', 'shadow')).toBe(true);
    expect(fightsOn(honesty, 'm', 'value')).toBe(false);
  });

  it('letting go takes two taps only when a why is written', () => {
    expect(whyOf(honesty, 'w', 'value')).toBe('I say it.');
    expect(twoTaps(honesty, 'w', 'value')).toBe(true);
    expect(twoTaps(honesty, 'w', 'shadow')).toBe(false);
    expect(twoTaps(honesty, 'm', 'shadow')).toBe(false);
    expect(twoTaps(honesty, 'x', 'value')).toBe(false);
  });

  it("a voice's chips: held values in list order, then their shadows; resting, locked and wordless ones out", () => {
    const values = [
      honesty,
      val('r', 'rest', { status: 'resting', shadow: 'drive' }),
      val('p', 'play'),
      { ...val('l', '', { shadow: '' }), locked: true as const },
      val('c', 'courage', { shadow: 'safety', champions: [{ voiceId: 'm', side: 'shadow', at: 4 }] }),
    ];
    const m = offersFor(values, 'm');
    expect(m.values.map(o => [o.word, o.on])).toEqual([['honesty', false], ['play', false], ['courage', false]]);
    expect(m.shadows.map(o => [o.word, o.on])).toEqual([['discretion', true], ['safety', true]]);
    expect(offersFor(values, 'w').values[0].on).toBe(true);
  });

  it('a link is armed under its value, voice and side', () => {
    expect(linkKey('h', 'w', 'value')).not.toBe(linkKey('h', 'w', 'shadow'));
  });
});
