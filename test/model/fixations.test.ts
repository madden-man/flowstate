// The fixations (PLAN-ENERGIZE.md sections 2 and 5, X1): the three in slot order, the deck longest waiting first, the
// swap in one write (a trade when the one tapped is already on), Finished instead, Deal me one never dealing an excluded
// one, the span words by the calendar across a month end and for today, the ribbons longest held first, the name and
// the next line sealed, and the seed pass that runs once and never brings a row back.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import type { FlowDB, Fixation } from '../../src/db/schema';
import { store, setKey, lock, unlock } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { ensureSeeded, seedFixationsOnce, FIXATIONS_PASS, SEED_FIXATIONS_ON, SEED_FIXATIONS_DECK } from '../../src/db/seed';
import { flowById } from '../../src/model/flows';
import {
  FIXATION_FLOW, three, deck, swap, finish, add, rename, recolour, setSince, setNext, deal, ribbons,
  stintWords, spanOfStint, openStint, lastOn, isOn, onDeck,
} from '../../src/model/fixations';

let db: FlowDB;
beforeEach(async () => { db = await freshDB(); });

const day = (m: number, d: number, h = 0, min = 0) => new Date(2026, m - 1, d, h, min).getTime();
const NOW = day(11, 10, 9, 30);
const fx = (id: string, extra: Partial<Fixation> = {}): Fixation => ({ id, name: id, hue: 250, createdAt: day(1, 1), stints: [], ...extra });
const ids = (rows: ({ id: string } | undefined)[]) => rows.map(r => r?.id);

/** A, B and C on in slots 0, 1 and 2; D and E on deck. */
async function board() {
  await store.bulkPut('fixations', [
    fx('A', { stints: [{ from: day(11, 7), slot: 0 }] }),
    fx('B', { stints: [{ from: day(8, 20), slot: 1 }] }),
    fx('C', { stints: [{ from: day(10, 28), slot: 2 }] }),
    fx('D', { createdAt: day(11, 1) }),
    fx('E', { createdAt: day(11, 2) }),
  ]);
}

describe('the three', () => {
  it('are in slot order, an empty slot undefined', async () => {
    expect(FIXATION_FLOW).toBe('energize');
    expect(await three()).toEqual([undefined, undefined, undefined]);
    await board();
    expect(ids(await three())).toEqual(['A', 'B', 'C']);
    await finish('B', NOW);
    expect(ids(await three())).toEqual(['A', undefined, 'C']);
  });
});

describe('the swap', () => {
  beforeEach(board);

  it('a deck one into a slot: the one there comes off and goes back on deck, in one write', async () => {
    const written = await swap(2, 'D', NOW);
    expect(ids(written!).sort()).toEqual(['C', 'D']);
    expect(ids(await three())).toEqual(['A', 'B', 'D']);
    const c = (await store.get('fixations', 'C'))!;
    expect(c.stints).toEqual([{ from: day(10, 28), to: NOW, slot: 2 }]);
    expect(onDeck(c)).toBe(true);
    expect(lastOn(c)).toBe(NOW);
    expect(openStint((await store.get('fixations', 'D'))!)).toEqual({ from: NOW, slot: 2 });
  });

  it('one already on in another slot trades places; both keep their since date', async () => {
    await swap(0, 'C', NOW);
    expect(ids(await three())).toEqual(['C', 'B', 'A']);
    expect((await store.get('fixations', 'C'))!.stints).toEqual([{ from: day(10, 28), slot: 0 }]);
    expect((await store.get('fixations', 'A'))!.stints).toEqual([{ from: day(11, 7), slot: 2 }]);
    expect(ids(await deck())).toEqual(['D', 'E']);
  });

  it('into an empty slot it moves, or goes on, with nothing coming off', async () => {
    await finish('B', NOW);
    await swap(1, 'A', NOW + 1);
    expect(ids(await three())).toEqual([undefined, 'A', 'C']);
    await swap(0, 'E', NOW + 2);
    expect(ids(await three())).toEqual(['E', 'A', 'C']);
  });

  it('a came-back one gets a new stint', async () => {
    await swap(2, 'D', NOW);
    await swap(2, 'C', NOW + 1000);
    expect((await store.get('fixations', 'C'))!.stints).toEqual([{ from: day(10, 28), to: NOW, slot: 2 }, { from: NOW + 1000, slot: 2 }]);
  });

  it('writes nothing for the one already there, a finished one, an unknown id or a slot that is not one of the three', async () => {
    await finish('E', NOW);
    const before = await db.fixations.toArray();
    expect(await swap(0, 'A', NOW)).toBeUndefined();
    expect(await swap(0, 'E', NOW)).toBeUndefined();
    expect(await swap(0, 'nope', NOW)).toBeUndefined();
    expect(await swap(3, 'D', NOW)).toBeUndefined();
    expect(await swap(-1, 'D', NOW)).toBeUndefined();
    expect(await db.fixations.toArray()).toEqual(before);
  });
});

describe('finished instead', () => {
  beforeEach(board);
  it('closes its stint, leaves the slot empty, keeps it off the deck, and never deletes it', async () => {
    const f = (await finish('A', NOW))!;
    expect(f.finishedAt).toBe(NOW);
    expect(f.stints).toEqual([{ from: day(11, 7), to: NOW, slot: 0 }]);
    expect((await three())[0]).toBeUndefined();
    expect(ids(await deck())).not.toContain('A');
    expect(await store.get('fixations', 'A')).toBeTruthy();
    expect(await finish('A', NOW + 1)).toBeUndefined();
  });
  it('a deck one can be finished too, with no stint to close', async () => {
    expect((await finish('D', NOW))!.stints).toEqual([]);
    expect(ids(await deck())).toEqual(['E']);
  });
});

describe('the deck', () => {
  it('is neither on nor finished, longest waiting first: off since, or made since for one never on', async () => {
    await store.bulkPut('fixations', [
      fx('never-old', { createdAt: day(9, 1) }),
      fx('off-oct', { createdAt: day(1, 1), stints: [{ from: day(8, 1), to: day(10, 22), slot: 0 }] }),
      fx('off-aug', { createdAt: day(1, 2), stints: [{ from: day(7, 1), to: day(8, 24), slot: 1 }] }),
      fx('never-new', { createdAt: day(11, 9) }),
      fx('on', { stints: [{ from: day(11, 1), slot: 0 }] }),
      fx('done', { stints: [{ from: day(6, 1), to: day(6, 2), slot: 0 }], finishedAt: day(6, 2) }),
    ]);
    expect(ids(await deck())).toEqual(['off-aug', 'never-old', 'off-oct', 'never-new']);
    expect(isOn((await store.get('fixations', 'on'))!)).toBe(true);
  });
});

describe('deal me one', () => {
  beforeEach(board);
  it('picks from the deck by the random it is given', async () => {
    expect((await deal([], () => 0))!.id).toBe('D');
    expect((await deal([], () => 0.99))!.id).toBe('E');
  });
  it('never deals an excluded one, whatever the random says', async () => {
    for (const r of [0, 0.3, 0.5, 0.99]) expect((await deal(['D'], () => r))!.id).toBe('E');
    expect(await deal(['D', 'E'])).toBeUndefined();
    // never one on or finished
    await finish('E', NOW);
    for (let i = 0; i < 20; i++) expect((await deal())!.id).toBe('D');
  });
  it('writes nothing', async () => {
    const before = await db.fixations.toArray();
    await deal();
    expect(await db.fixations.toArray()).toEqual(before);
  });
});

describe('the span in words', () => {
  it('is today on the day it went on, then days, then weeks', () => {
    expect(stintWords(day(11, 10), NOW)).toBe('today');
    expect(stintWords(day(11, 9, 23, 59), day(11, 10, 0, 1))).toBe('1 day');
    expect(stintWords(day(11, 7), NOW)).toBe('3 days');
    expect(stintWords(day(10, 28), day(11, 10))).toBe('13 days');
    expect(stintWords(day(10, 28), day(11, 11))).toBe('2 weeks');
    expect(stintWords(day(8, 20), day(11, 11))).toBe('12 weeks');
    expect(stintWords(day(1, 1), day(11, 10))).toBe('about 10 months');
    expect(stintWords(day(1, 1), new Date(2029, 0, 1).getTime())).toBe('about 3 years');
  });
  it('counts calendar days across a month end and a year end', () => {
    expect(stintWords(day(10, 30, 22), day(11, 2, 1))).toBe('3 days');
    expect(stintWords(day(1, 31), day(3, 1))).toBe('4 weeks');
    expect(stintWords(day(2, 27), day(3, 2))).toBe('3 days');
    expect(stintWords(new Date(2026, 11, 30).getTime(), new Date(2027, 0, 2).getTime())).toBe('3 days');
  });
  it('a closed stint inside one day reads in minutes or hours, never under a minute', () => {
    expect(stintWords(day(11, 10, 9), day(11, 10, 9, 40), false)).toBe('40 minutes');
    expect(stintWords(day(11, 10, 9), day(11, 10, 9), false)).toBe('1 minute');
    expect(stintWords(day(11, 10, 9), day(11, 10, 14), false)).toBe('about 5 hours');
    expect(spanOfStint({ from: day(11, 10, 9), to: day(11, 10, 9, 40), slot: 0 })).toBe('40 minutes');
    expect(spanOfStint({ from: day(11, 10, 8), slot: 0 }, NOW)).toBe('today');
  });
});

describe('the ribbons', () => {
  it('every fixation ever on, finished ones too, longest held first; one never on is left out', async () => {
    await store.bulkPut('fixations', [
      fx('short', { stints: [{ from: day(11, 1), to: day(11, 3), slot: 0 }] }),
      fx('two', { stints: [{ from: day(10, 20), to: day(10, 22), slot: 1 }, { from: day(9, 1), to: day(9, 10), slot: 2 }] }),
      fx('long-on', { stints: [{ from: day(8, 20), slot: 1 }] }),
      fx('done', { stints: [{ from: day(7, 1), to: day(7, 30), slot: 0 }], finishedAt: day(7, 30) }),
      fx('never'),
    ]);
    const r = await ribbons(NOW);
    expect(r.map(x => x.fixation.id)).toEqual(['long-on', 'done', 'two', 'short']);
    // stints oldest first, and no total anywhere in what comes back
    expect(r[2].stints.map(s => s.from)).toEqual([day(9, 1), day(10, 20)]);
    expect(Object.keys(r[0]).sort()).toEqual(['fixation', 'stints']);
  });
});

describe('add and edit', () => {
  it('+ fixation goes on deck, never on; an empty name writes nothing', async () => {
    const f = (await add('  Woodshed ', 410, NOW))!;
    expect(f).toMatchObject({ name: 'Woodshed', hue: 50, createdAt: NOW, stints: [] });
    expect(ids(await deck())).toEqual([f.id]);
    expect(await add('   ', 10)).toBeUndefined();
    expect(await db.fixations.count()).toBe(1);
  });
  it('rename, recolour, the next line and the since date', async () => {
    await board();
    await rename('A', 'FlowState v4', NOW);
    await recolour('A', -10, NOW);
    await setNext('A', ' the deck sheet ', NOW);
    let a = (await store.get('fixations', 'A'))!;
    expect(a).toMatchObject({ name: 'FlowState v4', hue: 350, next: 'the deck sheet', updatedAt: NOW });
    expect(await rename('A', ' ')).toBeUndefined();
    await setNext('A', '', NOW);
    a = (await store.get('fixations', 'A'))!;
    expect(a).not.toHaveProperty('next');
    await setSince('A', day(11, 5), NOW);
    expect(openStint((await store.get('fixations', 'A'))!)!.from).toBe(day(11, 5));
    // never after now, never before the stint before it ended, nothing when not on
    await setSince('A', NOW + 10 * 86_400_000, NOW);
    expect(openStint((await store.get('fixations', 'A'))!)!.from).toBe(NOW);
    await swap(2, 'D', day(11, 8));
    await swap(2, 'C', day(11, 9));
    await setSince('C', day(1, 1), NOW);
    expect(openStint((await store.get('fixations', 'C'))!)!.from).toBe(day(11, 8));
    expect(await setSince('E', day(1, 1), NOW)).toBeUndefined();
  });
});

describe('sealing', () => {
  const FAST = 1000;
  const raw = async () => JSON.stringify(await db.fixations.toArray());

  it('the name and the next line are not readable in the stored row; the hue, stints and dates are', async () => {
    await ensureSeeded();
    await board();
    await setNext('A', 'write the deck sheet', NOW);
    const salt = randomSalt();
    const key = await deriveKey('2580', salt, FAST);
    await setKey(key, { salt, iterations: FAST });
    await rename('B', 'East Winds, the book', NOW);
    const text = await raw();
    for (const s of ['write the deck sheet', 'East Winds', '"name":"A"']) expect(text).not.toContain(s);
    const stored = (await db.fixations.get('A'))!;
    expect(stored.name).toBe('');
    expect(stored.sealed).toBeTruthy();
    expect(stored).toMatchObject({ hue: 250, stints: [{ from: day(11, 7), slot: 0 }] });
    expect((await store.get('fixations', 'A'))!).toMatchObject({ name: 'A', next: 'write the deck sheet' });
    // locked: the clear copy still orders the three and the deck, nothing is written
    lock();
    expect(ids(await three())).toEqual(['A', 'B', 'C']);
    expect((await three())[0]!.locked).toBe(true);
    expect(ids(await deck())).toEqual(['D', 'E']);
    expect(await swap(0, 'D', NOW)).toBeUndefined();
    expect(await unlock(key)).toBe(true);
    expect((await store.get('fixations', 'B'))!.name).toBe('East Winds, the book');
  });
});

describe('the seed pass', () => {
  it('writes the first three on their days and the deck in his order, once, and leaves Energize alone', async () => {
    await ensureSeeded();
    const energize = await flowById('energize');
    const written = (await seedFixationsOnce(NOW))!;
    expect(written).toEqual([...SEED_FIXATIONS_ON, ...SEED_FIXATIONS_DECK].map(f => f.id));
    const [a, b, c] = await three();
    expect([a, b, c].map(f => [f!.name, f!.hue, openStint(f!)!.from])).toEqual([
      ['FlowState', 250, day(11, 7)], ['East Winds', 150, day(8, 20)], ['Japan Trip', 25, day(10, 28)],
    ]);
    expect((await deck()).map(f => [f.name, f.hue, f.stints.length])).toEqual([
      ['Jazz piano', 305, 0], ['Conduit', 55, 0], ['Learning Chinese', 350, 0], ['Studying philosophy', 95, 0],
    ]);
    expect((await store.get('settings', 'app'))!.cleaned).toContain(FIXATIONS_PASS);
    expect(await flowById('energize')).toEqual(energize);
    expect(await seedFixationsOnce(NOW)).toEqual([]);
    expect(await db.fixations.count()).toBe(7);
  });

  it('a deleted or finished one never comes back', async () => {
    await ensureSeeded();
    await seedFixationsOnce(NOW);
    await finish('fx-japan-trip', NOW);
    await db.fixations.delete('fx-conduit');
    expect(await seedFixationsOnce(NOW + 1)).toEqual([]);
    expect(await store.get('fixations', 'fx-conduit')).toBeUndefined();
    expect((await store.get('fixations', 'fx-japan-trip'))!.finishedAt).toBe(NOW);
    expect(ids(await three())).toEqual(['fx-flowstate', 'fx-east-winds', undefined]);
  });

  it('a seed row already there (an import) is left as it is', async () => {
    await ensureSeeded();
    await store.put('fixations', fx('fx-flowstate', { name: 'mine', hue: 1 }));
    const written = (await seedFixationsOnce(NOW))!;
    expect(written).not.toContain('fx-flowstate');
    expect((await store.get('fixations', 'fx-flowstate'))!).toMatchObject({ name: 'mine', hue: 1 });
  });

  it('a locked journal waits for the PIN, then seals what it writes', async () => {
    await ensureSeeded();
    const salt = randomSalt();
    const key = await deriveKey('2580', salt, 1000);
    await setKey(key, { salt, iterations: 1000 });
    lock();
    expect(await seedFixationsOnce(NOW)).toBeNull();
    expect(await db.fixations.count()).toBe(0);
    await unlock(key);
    expect(await seedFixationsOnce(NOW)).toHaveLength(7);
    expect(JSON.stringify(await db.fixations.toArray())).not.toContain('Japan Trip');
  });
});
