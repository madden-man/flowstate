import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { store } from '../../src/db/fields';
import type { Item, Paradox } from '../../src/db/schema';
import {
  canSaveParadox, cleanPole, cleanMiddle, revise, sameVersion, createParadox, saveParadox, OnePoleError,
  antonymSuggestions, threeWords, threeWordLines, spreads, goalsOf, pairOf, openSlots, slotLine, leanToY, yToLean, clampLean,
  layoutColumn, rowsOf, rowOf, nextFreeLean, moveGoal, riders, dropGoal, addGoals, saveGoal, archiveGoal, followable, arrows, moveParadox,
} from '../../src/model/paradox';

beforeEach(async () => { await freshDB(); });

const pole = (value: string, aspect: string, shadow?: string) => ({ value, aspect, ...(shadow ? { shadow } : {}) });
const goal = (id: string, pole: 'a' | 'b', lean: number, extra: Partial<Item> = {}): Item =>
  ({ id, paradoxId: 'p', pole, text: id, lean, doneLog: [], order: 0, ...extra });

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
    await ensureSeeded();
    const [p1, p2] = await spreads();
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

describe('the seed spreads', () => {
  it('both seed paradoxes read back with their goals in the notebook order, top to bottom', async () => {
    await ensureSeeded();
    const all = await spreads();
    expect(all.map(s => s.paradox.poleA.value)).toEqual(['selfless', 'thoughtful']);
    for (const { items } of all) {
      const leans = items.map(i => i.lean);
      expect(leans).toEqual([...leans].sort((a, b) => a - b));
    }
    const [p1, p2] = all;
    expect(openSlots(p1.items)).toEqual([]);
    expect(openSlots(p2.items).map(s => s.pole)).toEqual(['b', 'b', 'a', 'a']);
    expect(arrows(p1.items)).toEqual([{ from: 'it-volunteer', to: 'it-share' }]);
    expect(arrows(p2.items)).toHaveLength(3);
  });
});

describe('the order of the paradoxes (V13)', () => {
  it('a dragged paradox keeps its new place on Be and Flow; a new one goes after the placed ones', async () => {
    await ensureSeeded();
    const poles = async () => (await spreads()).map(s => s.paradox.poleA.value);
    expect(await poles()).toEqual(['selfless', 'thoughtful']);
    const ids = (await spreads()).map(s => s.paradox.id);
    await moveParadox(ids, ids[1], 0);
    expect(await poles()).toEqual(['thoughtful', 'selfless']);
    const flow = await import('../../src/model/flow');
    expect((await flow.today()).map(g => g.paradox.poleA.value)).toEqual(['thoughtful', 'selfless']);
    await createParadox({ poleA: pole('brave', 'facing it'), poleB: pole('careful', 'looking first') });
    expect(await poles()).toEqual(['thoughtful', 'selfless', 'brave']);
    // a drag among the shown rows leaves a resting one (not shown) after them, in its place
    const all = (await spreads()).map(s => s.paradox.id);
    await moveParadox([all[0], all[2]], all[2], 0);
    expect(await poles()).toEqual(['brave', 'thoughtful', 'selfless']);
  });
});

describe('pairs and slots', () => {
  it('a goal without its balance leaves a slot at its height on the other page', () => {
    const items = [goal('x', 'a', -0.3, { pairId: 'y' }), goal('y', 'b', -0.3, { pairId: 'x' }), goal('z', 'a', 0.4)];
    expect(pairOf(items[0], items)?.id).toBe('y');
    expect(openSlots(items)).toEqual([{ forId: 'z', pole: 'b', lean: 0.4 }]);
    // an archived balance opens the slot again
    items[1] = { ...items[1], archived: true };
    expect(openSlots(items).map(s => s.forId)).toEqual(['x', 'z']);
    expect(slotLine('selfish')).toBe('and on the selfish side?');
  });

  it('a pair on the same page is not a balance', () => {
    const items = [goal('x', 'a', 0, { pairId: 'y' }), goal('y', 'a', 0, { pairId: 'x' })];
    expect(pairOf(items[0], items)).toBeUndefined();
  });
});

describe('rows on the upright spread', () => {
  it('two paired goals land on one row; an unpaired goal shares its row with a slot on the other side', () => {
    const items = [goal('y', 'b', 0.3, { pairId: 'x' }), goal('x', 'a', -0.3, { pairId: 'y' }), goal('z', 'b', 0.4)];
    const rows = rowsOf(items);
    expect(rows).toEqual([
      { id: 'x', lean: -0.3, a: 'x', b: 'y' }, // a pair's row sits at pole A's lean
      { id: 'z', lean: 0.4, b: 'z', slot: { forId: 'z', pole: 'a', lean: 0.4 } },
    ]);
    expect(rowOf(rows, 'y')?.id).toBe('x');
    // laid out, the pair's two goals share one top and the slot shares its goal's
    const { tops } = layoutColumn(rows.map(r => ({ id: r.id, lean: r.lean, h: 40 })), 0, 300, 8);
    expect(tops[rowOf(rows, 'x')!.id]).toBe(tops[rowOf(rows, 'y')!.id]);
    expect(Object.keys(tops)).toEqual(['x', 'z']);
  });

  it('the slots on the rows are the open slots; archived goals leave no row', () => {
    const items = [goal('x', 'a', 0, { pairId: 'y' }), goal('y', 'b', 0, { pairId: 'x', archived: true }), goal('w', 'a', 0.5, { archived: true })];
    const rows = rowsOf(items);
    expect(rows).toEqual([{ id: 'x', lean: 0, a: 'x', slot: { forId: 'x', pole: 'b', lean: 0 } }]);
    expect(rows.map(r => r.slot)).toEqual(openSlots(items));
  });

  it('never drops a goal whose balance already sits on another row', () => {
    const items = [goal('x', 'a', 0, { pairId: 'y' }), goal('y', 'b', 0, { pairId: 'x' }), goal('z', 'a', 0.5, { pairId: 'y' })];
    const rows = rowsOf(items);
    expect(rows.map(r => r.id)).toEqual(['x', 'z']);
    expect(rows[1].slot).toBeUndefined();
  });

  it('the seed spread reads as two rows, its pairs level with each other, in the notebook order', async () => {
    await ensureSeeded();
    const [p1, p2] = await spreads();
    expect(rowsOf(p1.items).map(r => [r.a, r.b])).toEqual([['it-volunteer', 'it-breathing-room'], ['it-share', 'it-own-sake']]);
    expect(rowsOf(p2.items).map(r => r.slot?.pole)).toEqual(['b', 'b', 'a', 'a']);
  });
});

describe('lean maths', () => {
  it('maps lean to height in the usable band and back', () => {
    expect(leanToY(-1, 100, 300)).toBe(100);
    expect(leanToY(0, 100, 300)).toBe(200);
    expect(leanToY(1, 100, 300)).toBe(300);
    expect(leanToY(5, 100, 300)).toBe(300);
    expect(yToLean(250, 100, 300)).toBe(0.5);
    expect(yToLean(0, 100, 300)).toBe(-1);
    expect(yToLean(10, 5, 5)).toBe(0);
    expect(clampLean(NaN)).toBe(0);
  });

  it('centres each box on its lean, inside the band', () => {
    const { tops, overflow } = layoutColumn([{ id: 'a', lean: 0, h: 20 }, { id: 'b', lean: -1, h: 20 }, { id: 'c', lean: 1, h: 20 }], 0, 200);
    expect(tops).toEqual({ a: 90, b: 0, c: 180 });
    expect(overflow).toBe(0);
  });

  it('stacks goals at the same lean with a small gap instead of overlapping', () => {
    const { tops } = layoutColumn([{ id: 'a', lean: 0, h: 20 }, { id: 'b', lean: 0, h: 20 }], 0, 200, 6);
    expect(tops.b - tops.a).toBe(26);
  });

  it('pushes a stack back up from the bottom, and says how much taller the band must be', () => {
    const r = layoutColumn([{ id: 'a', lean: 1, h: 40 }, { id: 'b', lean: 1, h: 40 }], 0, 200, 0);
    expect(r.tops).toEqual({ a: 120, b: 160 });
    const tight = layoutColumn([{ id: 'a', lean: 0, h: 80 }, { id: 'b', lean: 0, h: 80 }], 0, 100, 0);
    expect(tight.overflow).toBe(60);
  });

  it('keeps the box under the finger where it is and flows the rest around it', () => {
    const { tops } = layoutColumn([{ id: 'a', lean: 0, h: 20 }, { id: 'd', lean: 0, h: 20 }], 0, 200, 6, { id: 'd', top: 92 });
    expect(tops.d).toBe(92);
    expect(tops.a + 20 <= 92 - 6 || tops.a >= 92 + 20 + 6).toBe(true);
  });

  it('keeps every pin (the row under the finger, the middle word) and flows the rest around them', () => {
    const boxes = [{ id: 'a', lean: -0.1, h: 20 }, { id: 'b', lean: 0.1, h: 20 }, { id: 'c', lean: 0.5, h: 20 }, { id: 'd', lean: -0.8, h: 20 }];
    const { tops, overflow } = layoutColumn(boxes, 0, 300, 6, [{ id: 'mid', top: 140, h: 20 }, { id: 'd', top: 200 }]);
    expect(tops.mid).toBe(140);
    expect(tops.d).toBe(200);
    expect(overflow).toBe(0);
    const spans = Object.entries(tops).map(([id, t]) => [t, t + 20, id] as const).sort((x, y) => x[0] - y[0]);
    for (let k = 1; k < spans.length; k++) expect(spans[k][0]).toBeGreaterThanOrEqual(spans[k - 1][1]);
    // a wants to sit above the middle word and does; b below it
    expect(tops.a + 20).toBeLessThanOrEqual(140);
    expect(tops.b).toBeGreaterThanOrEqual(160);
  });

  it('lands a new goal below the lowest one', () => {
    expect(nextFreeLean([])).toBe(-0.5);
    expect(nextFreeLean([goal('x', 'a', 0.2)])).toBe(0.5);
    expect(nextFreeLean([goal('x', 'a', 0.8)])).toBe(0.9);
    expect(nextFreeLean([goal('x', 'a', 0.8, { archived: true })])).toBe(-0.5);
  });
});

describe('moving goals', () => {
  it('a pair moves as one row: its balance follows, and a pair set at two heights lands level', () => {
    const level = [goal('x', 'a', 0, { pairId: 'y' }), goal('y', 'b', 0, { pairId: 'x' })];
    expect(moveGoal(level, 'x', 0.5).map(i => [i.id, i.lean])).toEqual([['x', 0.5], ['y', 0.5]]);
    expect(riders(level, 'x')).toEqual(['x', 'y']);
    const apart = [goal('x', 'a', 0, { pairId: 'y' }), goal('y', 'b', 0.4, { pairId: 'x' })];
    expect(moveGoal(apart, 'x', -0.5).map(i => [i.id, i.lean])).toEqual([['x', -0.5], ['y', -0.5]]);
    expect(moveGoal(apart, 'y', 0).map(i => [i.id, i.lean])).toEqual([['y', 0]]); // x is already there
    expect(riders(apart, 'y')).toEqual(['y', 'x']);
    expect(riders([goal('z', 'a', 0)], 'z')).toEqual(['z']);
    expect(moveGoal(level, 'x', 0)).toEqual([]);
    expect(moveGoal(level, 'nope', 0)).toEqual([]);
    expect(moveGoal(level, 'x', 7)[0].lean).toBe(1);
  });

  it('a drop writes the new lean through the store', async () => {
    const [a, b] = await addGoals('p', { a: 'one', b: 'two', lean: 0 });
    await dropGoal(await goalsOf('p'), a.id, -0.4);
    expect((await store.get('items', a.id))!.lean).toBe(-0.4);
    expect((await store.get('items', b.id))!.lean).toBe(-0.4);
  });
});

describe('adding and editing goals', () => {
  it('saving both lands the pair linked at the same height', async () => {
    const rows = await addGoals('p', { a: ' share it ', b: 'for its own sake', cadence: 'monthly', nextTo: 'q' });
    expect(rows).toHaveLength(2);
    const [a, b] = rows;
    expect([a.pole, b.pole]).toEqual(['a', 'b']);
    expect(a.pairId).toBe(b.id);
    expect(b.pairId).toBe(a.id);
    expect(a.lean).toBe(b.lean);
    expect(a.text).toBe('share it');
    expect(a.nextTo).toBe('q');
    expect(b.cadence).toBe('monthly');
    expect(openSlots(await goalsOf('p'))).toEqual([]);
  });

  it('saving one side opens a slot, and filling the slot links them at that height', async () => {
    expect(await addGoals('p', { a: ' ', b: '' })).toEqual([]);
    const [a] = await addGoals('p', { a: 'volunteer', lean: -0.3 });
    expect(openSlots(await goalsOf('p'))).toEqual([{ forId: a.id, pole: 'b', lean: -0.3 }]);
    const out = await saveGoal(a.id, { text: 'volunteer', other: 'breathing room' });
    const fill = out.find(i => i.id !== a.id)!;
    expect(fill).toMatchObject({ pole: 'b', lean: -0.3, pairId: a.id, text: 'breathing room' });
    expect((await store.get('items', a.id))!.pairId).toBe(fill.id);
    expect(openSlots(await goalsOf('p'))).toEqual([]);
  });

  it('edits text, cadence and follows; edits the balance; never empties a goal', async () => {
    const [a, b] = await addGoals('p', { a: 'one', b: 'two' });
    await saveGoal(a.id, { text: 'one, better', other: 'two, better', cadence: 'weekly', nextTo: a.id });
    const [a2, b2] = [await store.get('items', a.id), await store.get('items', b.id)];
    expect(a2).toMatchObject({ text: 'one, better', cadence: 'weekly' });
    expect(a2!.nextTo).toBeUndefined(); // a goal does not follow itself
    expect(b2!.text).toBe('two, better');
    await saveGoal(a.id, { text: '  ' });
    expect((await store.get('items', a.id))!.text).toBe('one, better');
    expect((await store.get('items', a.id))!.cadence).toBeUndefined();
    expect(await saveGoal('missing', { text: 'x' })).toEqual([]);
  });

  it('archives instead of deleting; the balance shows its slot again', async () => {
    const [a, b] = await addGoals('p', { a: 'one', b: 'two' });
    await archiveGoal(b.id);
    expect((await store.get('items', b.id))!.archived).toBe(true);
    const live = await goalsOf('p');
    expect(live.map(i => i.id)).toEqual([a.id]);
    expect(openSlots(live)).toEqual([{ forId: a.id, pole: 'b', lean: a.lean }]);
    await archiveGoal('missing');
  });

  it('the follows picker offers every other live goal; arrows skip archived targets', () => {
    const items = [goal('x', 'a', 0, { nextTo: 'y' }), goal('y', 'a', 0.5, { nextTo: 'z' }), goal('z', 'b', 1, { archived: true })];
    expect(followable(items, 'x').map(i => i.id)).toEqual(['y']);
    expect(arrows(items)).toEqual([{ from: 'x', to: 'y' }]);
  });
});

describe('sealing', () => {
  it('goal text and aspects go through the fields layer', async () => {
    const p: Paradox = await createParadox({ poleA: pole('a', 'secret a'), poleB: pole('b', 'secret b') });
    expect((await store.get('paradoxes', p.id))!.poleA.aspect).toBe('secret a');
  });
});
