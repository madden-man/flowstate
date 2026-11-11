// The walk (DESIGN.md rule 33): the cards and the wise lines, the next card not yet done, the flow's short list at
// rest, and the one-time audit pass: the trimmed things are struck once on a journal that has them (never deleted),
// four rows gain their helper, his own edits stand, and a fresh journal only takes the mark.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import { store } from '../../src/db/fields';
import { ensureSeeded, walkOnce, WALK_PASS } from '../../src/db/seed';
import { WALK_HELPERS, WALK_TRIM } from '../../src/db/seed/walk';
import { PANIC, SEED_FLOWS } from '../../src/db/seed-flows';
import { flowById } from '../../src/model/flows';
import { earlierOf, shownTips } from '../../src/model/tips';
import { nextOpen, shortList, walkCards } from '../../src/model/walk';

beforeEach(async () => { await freshDB(); });

describe('the cards', () => {
  it('a step is its things as cards and its wise lines apart, in their order', () => {
    const { cards, wise } = walkCards(shownTips(PANIC.steps[0], false));
    expect(cards.map(t => t.id)).toEqual(['panic-1-less', 'panic-1-album', 'panic-1-out', 'panic-1-cold']);
    expect(wise.map(t => t.id)).toEqual(['panic-1-name']);
  });
  it('the next card is the next one not done, going round once', () => {
    const cards = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(nextOpen(cards, id => id === 'a', 0)).toBe(1);
    expect(nextOpen(cards, id => id !== 'a', 2)).toBe(0);
    expect(nextOpen(cards, () => true, 1)).toBe(-1);
    expect(nextOpen([{ id: 'a' }], () => false, 0)).toBe(-1);
  });
  it('no seed step asks for more than four things, and no flow keeps a thing the audit took', () => {
    for (const f of SEED_FLOWS) {
      for (const s of f.steps) {
        const { cards, wise } = walkCards(s.tips.filter(t => !t.print));
        expect(cards.length, s.id).toBeLessThanOrEqual(4);
        expect(wise.length, s.id).toBeLessThanOrEqual(2);
        for (const t of s.tips) expect(WALK_TRIM[t.id], t.id).toBeUndefined();
      }
    }
    const helper = (id: string) => SEED_FLOWS.flatMap(f => f.steps.flatMap(s => s.tips)).find(t => t.id === id)?.helper;
    for (const [id, h] of Object.entries(WALK_HELPERS)) expect(helper(id), id).toBe(h);
  });
});

describe('the short list', () => {
  it('is each step with the first thing to do there, in its short words', () => {
    expect(shortList(PANIC)).toEqual([
      { k: 1, stepId: 'panic-1', name: 'Overstimulated', text: 'Less coming in' },
      { k: 2, stepId: 'panic-2', name: 'The wave', text: 'Breathe with the ring' },
      { k: 3, stepId: 'panic-3', name: 'Settling', text: 'Five things you can see' },
      { k: 4, stepId: 'panic-4', name: 'Under the skin', text: 'Water, then food' },
    ]);
  });
  it('leaves out a step with nothing to do, and a struck or printed thing', () => {
    const flow = { steps: [
      { id: 'a', name: 'A', tips: [{ id: 'a1', text: 'gone', struck: true }, { id: 'a2', text: 'printed', print: true }, { id: 'a3', text: 'said', wise: true }] },
      { id: 'b', name: 'B', tips: [{ id: 'b1', text: 'gone', struck: true }, { id: 'b2', text: 'This one' }] },
    ] };
    expect(shortList(flow)).toEqual([{ k: 2, stepId: 'b', name: 'B', text: 'This one' }]);
  });
});

describe('the audit (one-time pass)', () => {
  /** A journal as it was before the walk: the trimmed things back in their steps, the four rows without a helper. */
  async function older() {
    await ensureSeeded();
    for (const seed of SEED_FLOWS) {
      const f = (await flowById(seed.id))!;
      const steps = f.steps.map(s => ({
        ...s,
        tips: [
          ...s.tips.map(t => { if (!WALK_HELPERS[t.id]) return t; const { helper: _h, ...rest } = t; return rest; }),
          ...Object.entries(WALK_TRIM).filter(([id]) => id.startsWith(`${s.id}-`)).map(([id, text]) => ({ id, text })),
        ],
      }));
      await store.put('flows', { ...f, steps, revisions: [{ at: f.createdAt, name: f.name, steps: structuredClone(steps) }] });
    }
    const s = (await store.get('settings', 'app'))!;
    await store.put('settings', { ...s, cleaned: (s.cleaned ?? []).filter(c => c !== WALK_PASS) });
  }
  const tip = async (flowId: string, id: string) => (await flowById(flowId))!.steps.flatMap(s => s.tips).find(t => t.id === id)!;

  it('strikes every trimmed thing once, never deletes it, and gives the four rows their helper', async () => {
    await older();
    const struck = (await walkOnce())!;
    expect(struck.sort()).toEqual(Object.keys(WALK_TRIM).sort());
    expect(await tip('panic', 'panic-3-tea')).toMatchObject({ text: 'Something small and ordinary: make tea', struck: true });
    expect((await tip('depress', 'depress-2-person')).helper).toBe('person');
    expect((await tip('shutdown', 'shutdown-3-voice')).helper).toBe('person');
    expect((await tip('depress', 'depress-1-look')).helper).toBe('calendar');
    // struck reads in the step sheet's Earlier (rule 10), and the page shows the seed's rows again
    const panic = (await flowById('panic'))!;
    expect(earlierOf(panic, 'panic-3').map(e => e.text)).toEqual(expect.arrayContaining(['Something small and ordinary: make tea', 'Shake out your hands; drop your shoulders']));
    expect(shownTips(panic.steps[2], false).map(t => t.id)).toEqual(shownTips(PANIC.steps[2], false).map(t => t.id));
    expect(panic.revisions).toHaveLength(2);
    expect((await store.get('settings', 'app'))!.cleaned).toContain(WALK_PASS);
    // a rerun writes nothing
    expect(await walkOnce()).toEqual([]);
    expect((await flowById('panic'))!.revisions).toHaveLength(2);
  });

  it('leaves his own words: a thing he rewrote stays, a row he gave a helper keeps it, a struck one is not counted', async () => {
    await older();
    const f = (await flowById('panic'))!;
    await store.put('flows', { ...f, steps: f.steps.map(s => ({ ...s, tips: s.tips.map(t => (
      t.id === 'panic-3-tea' ? { ...t, text: 'Make the oolong' } : t.id === 'panic-4-shower' ? { ...t, struck: true } : t)) })) });
    const d = (await flowById('depress'))!;
    await store.put('flows', { ...d, steps: d.steps.map(s => ({ ...s, tips: s.tips.map(t => (t.id === 'depress-2-person' ? { ...t, helper: 'journal' as const } : t)) })) });
    const struck = (await walkOnce())!;
    expect(struck).not.toContain('panic-3-tea');
    expect(struck).not.toContain('panic-4-shower');
    expect(await tip('panic', 'panic-3-tea')).toEqual({ id: 'panic-3-tea', text: 'Make the oolong' });
    expect((await tip('depress', 'depress-2-person')).helper).toBe('journal');
  });

  it('a fresh journal is seeded in this shape and already marked: the pass writes nothing', async () => {
    await ensureSeeded();
    const before = JSON.stringify([await store.all('flows'), await store.get('settings', 'app')]);
    expect((await store.get('settings', 'app'))!.cleaned).toContain(WALK_PASS);
    expect(await walkOnce()).toEqual([]);
    expect(JSON.stringify([await store.all('flows'), await store.get('settings', 'app')])).toBe(before);
  });
});
