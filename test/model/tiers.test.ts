// PLAN-TIERS.md section 7, B0: the tiers model. placeValue between every pair of places, index placement and the rows
// it writes, the return to the tier left, the one-a-day log, a sealed and a locked row, held() in tier order, a new
// value in Second, the dated lines, the backup both ways, and a Legacy value deleted.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import { PLACES, SCHEMA_VERSION, type FlowDB, type Value } from '../../src/db/schema';
import { ensureSeeded } from '../../src/db/seed';
import { store, setKey, lock, unlock, LockedError } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { exportData, importData, parseBackup } from '../../src/db/backup';
import {
  held, resting, legacy, tiers, createValue, saveValue, placeValue, deleteValue, champion, byVoice, returnsTo, placeOf,
  tierOf, tierSince, legacyDates, logged,
} from '../../src/model/values';

const SELFLESS = 'value-px-selfless-selfish';
const THOUGHTFUL = 'value-px-thoughtful-reactive';
const DAY = 86_400_000;
const T0 = new Date(2026, 10, 11, 9).getTime();

let db: FlowDB;
beforeEach(async () => { db = await freshDB(); await ensureSeeded(T0); });

const words = (vs: { word: string }[]) => vs.map(v => v.word);
const shape = async () => {
  const t = await tiers();
  return { first: words(t.first), second: words(t.second), third: words(t.third), resting: words(t.resting), legacy: words(t.legacy) };
};
const groupOf: Record<string, keyof Awaited<ReturnType<typeof tiers>>> = { 1: 'first', 2: 'second', 3: 'third', resting: 'resting', legacy: 'legacy' };

describe('placeValue', () => {
  it('moves a value between every pair of places: status and tier follow, and the lists show it there', async () => {
    for (const from of PLACES) for (const to of PLACES) {
      const v = await createValue({ word: `w-${from}-${to}` }, T0);
      await placeValue(v.id, from, undefined, T0 + DAY);
      await placeValue(v.id, to, undefined, T0 + 2 * DAY);
      const row = (await store.get('values', v.id))!;
      expect(placeOf(row), `${from} to ${to}`).toBe(to);
      expect(row.status).toBe(typeof to === 'number' ? 'held' : to);
      // a tier destination sets the tier; a shelf keeps the tier it left
      expect(tierOf(row)).toBe(typeof to === 'number' ? to : typeof from === 'number' ? from : 2);
      const t = await tiers();
      expect(t[groupOf[String(to)]].map(x => x.id)).toContain(v.id);
      for (const g of Object.values(groupOf)) if (g !== groupOf[String(to)]) expect(t[g].map(x => x.id)).not.toContain(v.id);
      await deleteValue(v.id, T0 + 3 * DAY);
    }
  });

  it('places at an index within the destination, the foot when omitted; order is one sequence, and only moved rows are written', async () => {
    for (const [i, w] of ['brave', 'calm', 'kind'].entries()) await createValue({ word: w }, T0 + i);
    expect(await shape()).toEqual({ first: [], second: ['selfless', 'thoughtful', 'brave', 'calm', 'kind'], third: [], resting: [], legacy: [] });
    // the first placing numbers every row once
    await placeValue(SELFLESS, 2, 0, T0 + 1);
    expect((await tiers()).second.map(v => v.order)).toEqual([0, 1, 2, 3, 4]);
    await placeValue((await held()).find(v => v.word === 'calm')!.id, 1, undefined, T0 + 2);
    await placeValue((await held()).find(v => v.word === 'kind')!.id, 1, 0, T0 + 3);
    expect(await shape()).toEqual({ first: ['kind', 'calm'], second: ['selfless', 'thoughtful', 'brave'], third: [], resting: [], legacy: [] });
    expect(words(await held())).toEqual(['kind', 'calm', 'selfless', 'thoughtful', 'brave']);
    expect((await held()).map(v => v.order)).toEqual([0, 1, 2, 3, 4]);
    // brave to the head of Second: selfless and thoughtful move down one, kind and calm are not touched
    const before = new Map((await store.all('values')).map(v => [v.id, v.updatedAt]));
    const brave = (await held()).find(v => v.word === 'brave')!;
    await placeValue(brave.id, 2, 0, T0 + 50);
    expect(words(await held())).toEqual(['kind', 'calm', 'brave', 'selfless', 'thoughtful']);
    const after = await store.all('values');
    const wrote = after.filter(v => v.updatedAt !== before.get(v.id)).map(v => v.word).sort();
    expect(wrote).toEqual(['brave', 'selfless', 'thoughtful']);
    // a reorder within a place writes no log line; an index past the end is the foot
    expect((await store.get('values', brave.id))!.tierLog).toBeUndefined();
    await placeValue(brave.id, 2, 99, T0 + 51);
    expect((await tiers()).second.map(v => v.word)).toEqual(['selfless', 'thoughtful', 'brave']);
    // placing where it already is writes nothing at all
    const still = new Map((await store.all('values')).map(v => [v.id, v.updatedAt]));
    await placeValue(brave.id, 2, 2, T0 + 52);
    expect((await store.all('values')).every(v => v.updatedAt === still.get(v.id))).toBe(true);
    await expect(placeValue('nope', 1)).rejects.toThrow('No such value');
  });

  it('no tier has a cap and nothing steps down', async () => {
    for (let i = 0; i < 6; i++) await createValue({ word: `v${i}` }, T0);
    for (const v of await held()) await placeValue(v.id, 1, undefined, T0 + 1);
    const t = await tiers();
    expect(t.first).toHaveLength(8);
    expect(t.second).toEqual([]);
  });

  it('a value back from Resting or Legacy goes to the tier asked; the tap path asks for the tier it left', async () => {
    const v = await createValue({ word: 'patient' }, T0);
    expect(returnsTo((await store.get('values', v.id))!)).toBe(2);
    await placeValue(v.id, 3, undefined, T0 + DAY);
    await placeValue(v.id, 'resting', undefined, T0 + 2 * DAY);
    const r = (await store.get('values', v.id))!;
    expect(returnsTo(r)).toBe(3);
    await placeValue(v.id, 'legacy', undefined, T0 + 3 * DAY);
    expect(returnsTo((await store.get('values', v.id))!)).toBe(3);
    await placeValue(v.id, returnsTo((await store.get('values', v.id))!), undefined, T0 + 4 * DAY);
    expect(placeOf((await store.get('values', v.id))!)).toBe(3);
    // and a tier named by the drag wins over the one it left
    await placeValue(v.id, 'resting', undefined, T0 + 5 * DAY);
    await placeValue(v.id, 1, 0, T0 + 6 * DAY);
    expect(placeOf((await store.get('values', v.id))!)).toBe(1);
    // a value resting from before the tiers has none: it comes back to Second
    expect(returnsTo({})).toBe(2);
  });
});

describe('the log', () => {
  it('keeps one entry a day, the day\'s last; a day that ends where it began leaves none; the first move records the start', async () => {
    const v = await createValue({ word: 'steady' }, T0 - 10 * DAY);
    await placeValue(v.id, 1, undefined, T0);
    expect((await store.get('values', v.id))!.tierLog).toEqual([{ at: T0 - 10 * DAY, to: 2 }, { at: T0, to: 1 }]);
    await placeValue(v.id, 3, undefined, T0 + 1000);
    await placeValue(v.id, 'resting', undefined, T0 + 2000);
    expect((await store.get('values', v.id))!.tierLog).toEqual([{ at: T0 - 10 * DAY, to: 2 }, { at: T0 + 2000, to: 'resting' }]);
    await placeValue(v.id, 2, undefined, T0 + 3000);
    expect((await store.get('values', v.id))!.tierLog).toEqual([{ at: T0 - 10 * DAY, to: 2 }]);
    await placeValue(v.id, 'legacy', undefined, T0 + DAY);
    expect((await store.get('values', v.id))!.tierLog).toEqual([{ at: T0 - 10 * DAY, to: 2 }, { at: T0 + DAY, to: 'legacy' }]);
  });

  it('logged is pure: a value made today and moved today has the move alone', () => {
    expect(logged(undefined, 2, T0, 1, T0 + 5)).toEqual([{ at: T0 + 5, to: 1 }]);
    expect(logged([{ at: T0, to: 1 }], 1, T0 - DAY, 3, T0 + DAY)).toEqual([{ at: T0, to: 1 }, { at: T0 + DAY, to: 3 }]);
  });
});

describe('the dated lines', () => {
  it('since: the day it came into its tier, its making with no log', async () => {
    const v = await createValue({ word: 'open' }, T0);
    const at = async () => tierSince((await store.get('values', v.id))!);
    expect(await at()).toBe(T0);
    await placeValue(v.id, 1, undefined, T0 + DAY);
    expect(await at()).toBe(T0 + DAY);
    await placeValue(v.id, 'resting', undefined, T0 + 2 * DAY);
    await placeValue(v.id, 1, undefined, T0 + 5 * DAY);
    expect(await at()).toBe(T0 + 5 * DAY);
    // a reorder within First is not a new start
    await placeValue(v.id, 1, 0, T0 + 6 * DAY);
    expect(await at()).toBe(T0 + 5 * DAY);
  });

  it('a Legacy value runs from its first day held to the day it went; time resting is not marked; no log has no end', async () => {
    const v = await createValue({ word: 'loud' }, T0);
    await placeValue(v.id, 1, undefined, T0 + DAY);
    await placeValue(v.id, 'resting', undefined, T0 + 3 * DAY);
    await placeValue(v.id, 'legacy', undefined, T0 + 9 * DAY);
    expect(legacyDates((await store.get('values', v.id))!)).toEqual({ from: T0, to: T0 + 9 * DAY });
    // a value that came in resting (its first entry is not a tier) starts on the day it was first held
    expect(legacyDates({ createdAt: T0, tierLog: [{ at: T0, to: 'resting' }, { at: T0 + 2 * DAY, to: 2 }, { at: T0 + 4 * DAY, to: 'legacy' }] }))
      .toEqual({ from: T0 + 2 * DAY, to: T0 + 4 * DAY });
    expect(legacyDates({ createdAt: T0 })).toEqual({ from: T0 });
  });
});

describe('the lists in tier order', () => {
  it('held is First, Second, Third; resting and legacy apart; Champions follow without knowing', async () => {
    await champion(SELFLESS, 'v-warrior', 'value', T0);
    await champion(THOUGHTFUL, 'v-warrior', 'value', T0);
    const third = await createValue({ word: 'brave' }, T0);
    await champion(third.id, 'v-warrior', 'value', T0);
    expect(words(await held())).toEqual(['selfless', 'thoughtful', 'brave']);
    await placeValue(third.id, 1, undefined, T0 + 1);
    await placeValue(SELFLESS, 3, undefined, T0 + 2);
    expect(words(await held())).toEqual(['brave', 'thoughtful', 'selfless']);
    const warrior = (await byVoice()).find(r => r.voice.id === 'v-warrior')!;
    expect(warrior.fights.map(f => f.value.word)).toEqual(['brave', 'thoughtful', 'selfless']);
    await placeValue(THOUGHTFUL, 'legacy', undefined, T0 + 3);
    await placeValue(SELFLESS, 'resting', undefined, T0 + 4);
    expect(words(await held())).toEqual(['brave']);
    expect(words(await resting())).toEqual(['selfless']);
    expect(words(await legacy())).toEqual(['thoughtful']);
    expect((await byVoice()).find(r => r.voice.id === 'v-warrior')!.fights.map(f => f.value.word)).toEqual(['brave']);
    // champions are kept on a Legacy value, not drawn
    expect((await store.get('values', THOUGHTFUL))!.champions.map(c => c.voiceId)).toEqual(['v-warrior']);
  });

  it('a new value lands at the foot of Second, whatever First holds', async () => {
    await placeValue(SELFLESS, 1, undefined, T0 + 1);
    const v = await createValue({ word: 'honest' }, T0 + 2);
    expect(v).toMatchObject({ status: 'held', tier: 2 });
    expect(await shape()).toEqual({ first: ['selfless'], second: ['thoughtful', 'honest'], third: [], resting: [], legacy: [] });
  });

  it('saveValue leaves the place alone', async () => {
    await placeValue(SELFLESS, 3, undefined, T0 + DAY);
    await saveValue({ id: SELFLESS }, { word: 'generous', shadow: 'selfish' }, T0 + 2 * DAY);
    expect((await store.get('values', SELFLESS))!).toMatchObject({ word: 'generous', status: 'held', tier: 3 });
  });
});

describe('sealed and locked', () => {
  it('a sealed row is placed by its clear fields and still opens whole; tier and tierLog stay clear; locked, placeValue refuses', async () => {
    const salt = randomSalt();
    const key = await deriveKey('1470', salt, 1000);
    await setKey(key, { salt, iterations: 1000 });
    const made = (await store.get('values', SELFLESS))!.createdAt;
    await placeValue(SELFLESS, 1, undefined, T0 + DAY);
    const raw = (await db.values.get(SELFLESS))!;
    expect(raw.sealed).toBeTruthy();
    expect(raw).toMatchObject({ word: '', status: 'held', tier: 1, tierLog: [{ at: made, to: 2 }, { at: T0 + DAY, to: 1 }] });
    expect((await store.get('values', SELFLESS))!).toMatchObject({ word: 'selfless', shadow: 'selfish', tier: 1 });
    lock();
    const shut = await tiers();
    expect(shut.first.map(v => [v.id, v.locked])).toEqual([[SELFLESS, true]]);
    await expect(placeValue(SELFLESS, 'legacy', undefined, T0 + 2 * DAY)).rejects.toBeInstanceOf(LockedError);
    await unlock(key);
    await placeValue(SELFLESS, 'legacy', undefined, T0 + 2 * DAY);
    expect((await store.get('values', SELFLESS))!).toMatchObject({ word: 'selfless', status: 'legacy', tier: 1 });
  });
});

describe('backup', () => {
  it('carries tier, tierLog and Legacy both ways, by replace and by merge, plain and locked', async () => {
    const brave = await createValue({ word: 'brave' }, T0);
    await placeValue(brave.id, 1, undefined, T0 + DAY);
    await placeValue(THOUGHTFUL, 3, undefined, T0 + DAY);
    await placeValue(THOUGHTFUL, 'legacy', undefined, T0 + 2 * DAY);
    const want = (await store.all('values')).sort((a, b) => a.id.localeCompare(b.id));
    const plain = parseBackup(JSON.stringify(await exportData(db, T0 + 3 * DAY)));
    const made = want.find(v => v.id === THOUGHTFUL)!.createdAt;
    expect((plain.tables.values as Value[]).find(v => v.id === THOUGHTFUL)).toMatchObject({ status: 'legacy', tier: 3, tierLog: [{ at: made, to: 2 }, { at: T0 + DAY, to: 3 }, { at: T0 + 2 * DAY, to: 'legacy' }] });
    for (const mode of ['replace', 'merge'] as const) {
      db = await freshDB();
      await importData(plain, mode, db);
      expect((await store.all('values')).sort((a, b) => a.id.localeCompare(b.id))).toEqual(want);
      expect(await shape()).toEqual({ first: ['brave'], second: ['selfless'], third: [], resting: [], legacy: ['thoughtful'] });
    }
    // under a lock: the file keeps the tiers clear and the words sealed, and opens whole with its PIN
    const salt = randomSalt();
    const key = await deriveKey('2580', salt, 1000);
    await setKey(key, { salt, iterations: 1000 });
    const sealed = parseBackup(JSON.stringify(await exportData(db, T0 + 4 * DAY)));
    const row = (sealed.tables.values as Value[]).find(v => v.id === THOUGHTFUL)!;
    expect(row).toMatchObject({ word: '', status: 'legacy', tier: 3 });
    expect(row.tierLog).toHaveLength(3);
    db = await freshDB();
    await importData(sealed, 'replace', db, key);
    expect(await shape()).toEqual({ first: ['brave'], second: ['selfless'], third: [], resting: [], legacy: ['thoughtful'] });
  });

  it(`a version ${SCHEMA_VERSION} file from before the tiers imports as all Second, its resting ones resting`, async () => {
    const extra = await createValue({ word: 'kind' }, T0);
    await placeValue(extra.id, 'resting', undefined, T0 + DAY);
    const f = await exportData(db, T0 + 2 * DAY);
    const bare = {
      ...f, schemaVersion: SCHEMA_VERSION,
      tables: { ...f.tables, values: (f.tables.values as Value[]).map(({ tier: _t, tierLog: _l, ...v }) => v) },
    };
    for (const mode of ['replace', 'merge'] as const) {
      db = await freshDB();
      await importData(parseBackup(JSON.stringify(bare)), mode, db);
      const all = await store.all('values');
      expect(all.every(v => v.tier === undefined && v.tierLog === undefined)).toBe(true);
      expect(await shape()).toEqual({ first: [], second: ['selfless', 'thoughtful'], third: [], resting: ['kind'], legacy: [] });
      expect(returnsTo(all.find(v => v.word === 'kind')!)).toBe(2);
    }
  });
});

describe('deleteValue', () => {
  it('takes a Legacy value away like any other, and a merge of an older file keeps it gone', async () => {
    await placeValue(THOUGHTFUL, 'legacy', undefined, T0 + DAY);
    const older = parseBackup(JSON.stringify(await exportData(db, T0 + 2 * DAY)));
    await deleteValue(THOUGHTFUL, T0 + 3 * DAY);
    expect(await legacy()).toEqual([]);
    expect((await store.get('settings', 'app'))!.deleted).toContain(THOUGHTFUL);
    await importData(older, 'merge', db);
    expect(await store.get('values', THOUGHTFUL)).toBeUndefined();
    expect(await shape()).toEqual({ first: [], second: ['selfless'], third: [], resting: [], legacy: [] });
  });
});
