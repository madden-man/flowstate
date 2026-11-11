// PLAN-VALUES.md section 7, the unit part for C1's data: the one-time pass over a version 5 journal, a version 5
// database and a version 5 backup file, and a value sealed under a key with its clear copy holding no words.
import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import { freshDB, writeSeedParadoxes } from './helpers';
import { openDB, SCHEMA_VERSION, STORES_V1, STORES_V2, STORES_V3, STORES_V4, STORES_V5, valueIdOf, type FlowDB, type Paradox, type Value } from '../../src/db/schema';
import { ensureSeeded, seedParadoxes, valuesFromParadoxesOnce, VALUES_PASS, defaultSettings } from '../../src/db/seed';
import { store, setKey, lock, unlock, init, tombstone } from '../../src/db/fields';
import { exportData, importData, parseBackup } from '../../src/db/backup';
import { deriveKey, randomSalt } from '../../src/db/crypto';

let db: FlowDB;
beforeEach(async () => { db = await freshDB(); });

/** A journal as version 5 left it: the two seed paradoxes (one resting here), their goals, no values, no pass. */
async function v5Journal() {
  await ensureSeeded();
  await db.values.clear();
  await db.settings.update('app', { cleaned: ['seed-pages', 'fixations'] });
  await writeSeedParadoxes();
  const p2 = (await store.get('paradoxes', 'px-thoughtful-reactive'))!;
  await store.put('paradoxes', { ...p2, status: 'resting', order: 0 });
  const p1 = (await store.get('paradoxes', 'px-selfless-selfish'))!;
  await store.put('paradoxes', { ...p1, order: 1 });
}

describe('valuesFromParadoxesOnce', () => {
  it('makes each paradox one value with nothing lost, marks the pass, and leaves paradoxes, items and leans alone', async () => {
    await v5Journal();
    await store.put('leans', { id: 'l1', paradoxId: 'px-selfless-selfish', at: 5, lean: 0.2, note: 'n' });
    const before = { p: await db.paradoxes.toArray(), i: await db.items.toArray(), l: await db.leans.toArray() };
    expect((await valuesFromParadoxesOnce())!.sort()).toEqual([valueIdOf('px-selfless-selfish'), valueIdOf('px-thoughtful-reactive')].sort());
    const [p1, p2] = seedParadoxes().paradoxes;
    const a = (await store.get('values', valueIdOf(p1.id)))!;
    const b = (await store.get('values', valueIdOf(p2.id)))!;
    expect(a).toEqual({
      id: valueIdOf(p1.id), createdAt: p1.createdAt, updatedAt: p1.updatedAt, status: 'held', word: 'selfless', shadow: 'selfish',
      looks: 'vegetable chopping in Evergreen', order: 1, fromParadoxId: p1.id, champions: [],
      revisions: [{ at: p1.updatedAt, word: 'selfless', shadow: 'selfish', fromParadox: { shadowLooks: 'something that gives breathing room' } }],
    } satisfies Value);
    // the bracket word (the pole overdone) is not a shadow: it is kept in the first revision; the empty aspects are omitted
    expect(b).toEqual({
      id: valueIdOf(p2.id), createdAt: p2.createdAt, updatedAt: p2.updatedAt, status: 'resting', word: 'thoughtful', shadow: 'reactive',
      order: 0, fromParadoxId: p2.id, champions: [],
      revisions: [{ at: p2.updatedAt, word: 'thoughtful', shadow: 'reactive', fromParadox: { overdone: 'obsessive' } }],
    } satisfies Value);
    expect((await store.get('settings', 'app'))!.cleaned).toEqual(['seed-pages', 'fixations', VALUES_PASS]);
    expect({ p: await db.paradoxes.toArray(), i: await db.items.toArray(), l: await db.leans.toArray() }).toEqual(before);
  });

  it('runs once: a second run writes nothing, and a value he deletes stays gone', async () => {
    await v5Journal();
    expect(await valuesFromParadoxesOnce()).toHaveLength(2);
    const after = await db.values.toArray();
    expect(await valuesFromParadoxesOnce()).toEqual([]);
    expect(await db.values.toArray()).toEqual(after);
    await db.values.delete(valueIdOf('px-selfless-selfish'));
    expect(await valuesFromParadoxesOnce()).toEqual([]);
    expect(await db.values.count()).toBe(1);
  });

  it('a paradox whose value is already there (an import) is not written again', async () => {
    await v5Journal();
    await store.put('values', { id: 'mine', createdAt: 1, updatedAt: 1, status: 'held', word: 'kind', champions: [], revisions: [], fromParadoxId: 'px-selfless-selfish' });
    expect(await valuesFromParadoxesOnce()).toEqual([valueIdOf('px-thoughtful-reactive')]);
    expect(await db.values.count()).toBe(2);
  });

  it('locked, it returns without writing; opened, it seals what it writes', async () => {
    await v5Journal();
    const salt = randomSalt();
    const key = await deriveKey('2580', salt, 1000);
    await setKey(key, { salt, iterations: 1000 });
    lock();
    expect(await valuesFromParadoxesOnce()).toBeNull();
    expect(await db.values.count()).toBe(0);
    expect((await db.settings.get('app'))!.cleaned).not.toContain(VALUES_PASS);
    await unlock(key);
    expect(await valuesFromParadoxesOnce()).toHaveLength(2);
    // the seed's ids name its words (px-selfless-selfish); every field but the ids holds none
    const rows = await db.values.toArray();
    expect(rows.every(r => r.word === '' && r.shadow === undefined && r.looks === undefined)).toBe(true);
    const raw = JSON.stringify(rows.map(({ id: _, fromParadoxId: __, ...r }) => r));
    for (const w of ['selfless', 'selfish', 'thoughtful', 'reactive', 'obsessive', 'vegetable', 'breathing']) expect(raw).not.toContain(w);
    expect((await store.get('values', valueIdOf('px-thoughtful-reactive')))!.revisions[0].fromParadox).toEqual({ overdone: 'obsessive' });
  });

  it('a fresh install has it done already', async () => {
    await ensureSeeded();
    expect(await valuesFromParadoxesOnce()).toEqual([]);
    expect(await db.values.count()).toBe(2);
  });
});

describe('a version 5 database opened by this code', () => {
  it('opens at the current version and, once open, has one value per paradox with nothing lost', async () => {
    const name = `flowstate-v5-values-${Date.now()}`;
    const v5 = new Dexie(name);
    v5.version(1).stores(STORES_V1);
    v5.version(2).stores(STORES_V2);
    v5.version(3).stores(STORES_V3);
    v5.version(4).stores(STORES_V4);
    v5.version(5).stores(STORES_V5);
    await v5.open();
    const { paradoxes, items } = seedParadoxes();
    const third: Paradox = { id: 'px-mine', createdAt: 9, updatedAt: 10, status: 'retired', poleA: { value: 'open', aspect: 'saying it' }, poleB: { value: 'guarded', aspect: '' }, revisions: [], order: 2 };
    await v5.table('paradoxes').bulkPut([...paradoxes, third]);
    await v5.table('items').bulkPut(items);
    await v5.table('settings').put({ ...defaultSettings(1), cleaned: ['seed-pages', 'fixations'] });
    v5.close();
    const opened = openDB(name);
    await opened.open();
    expect(opened.verno).toBe(SCHEMA_VERSION);
    expect(await opened.values.count()).toBe(0);
    await init(opened);
    expect(await valuesFromParadoxesOnce()).toHaveLength(3);
    const vs = await store.all('values');
    expect(vs.map(v => v.fromParadoxId).sort()).toEqual(['px-mine', 'px-selfless-selfish', 'px-thoughtful-reactive']);
    expect(vs.find(v => v.fromParadoxId === 'px-mine')).toMatchObject({ word: 'open', shadow: 'guarded', looks: 'saying it', status: 'resting', order: 2, revisions: [] });
    expect(await opened.paradoxes.count()).toBe(3);
    expect(await opened.items.count()).toBe(8);
    opened.close();
  });
});

describe('a version 5 backup file', () => {
  /** What a version 5 phone exported: its tables without values, the version it was made at. */
  async function v5File(): Promise<string> {
    await v5Journal();
    const f = await exportData(db, 100);
    const { values: _, ...tables } = f.tables;
    return JSON.stringify({ ...f, schemaVersion: 5, tables });
  }

  it('imports with no values table and its paradoxes come in as values (replace)', async () => {
    const text = await v5File();
    const other = await freshDB();
    await importData(parseBackup(text), 'replace', other);
    const vs = (await store.all('values')).sort((a, b) => a.order! - b.order!);
    expect(vs.map(v => [v.id, v.word, v.shadow, v.status])).toEqual([
      [valueIdOf('px-thoughtful-reactive'), 'thoughtful', 'reactive', 'resting'],
      [valueIdOf('px-selfless-selfish'), 'selfless', 'selfish', 'held'],
    ]);
    expect(await other.paradoxes.count()).toBe(2);
    // the pass, which the file's settings have not run, finds them there and writes nothing
    expect(await valuesFromParadoxesOnce()).toEqual([]);
    expect(await other.values.count()).toBe(2);
  });

  it('merged into a phone that already made them, keeps the phone\'s edits and brings no deleted one back', async () => {
    const text = await v5File();
    expect(await valuesFromParadoxesOnce()).toHaveLength(2);
    const a = (await store.get('values', valueIdOf('px-selfless-selfish')))!;
    await store.put('values', { ...a, word: 'generous', updatedAt: Date.now() });
    await store.tx(['values', 'settings'], async tb => {
      await tb('values').delete(valueIdOf('px-thoughtful-reactive'));
      await tombstone(tb, [valueIdOf('px-thoughtful-reactive')]);
    });
    await importData(parseBackup(text), 'merge', db);
    expect((await store.all('values')).map(v => v.word)).toEqual(['generous']);
  });
});

describe('sealing a value', () => {
  it('round-trips with whys under a key; the clear copy keeps ids, sides and dates and no words', async () => {
    await ensureSeeded();
    const v: Value = {
      id: 'val-honest', createdAt: 1, updatedAt: 2, status: 'held', word: 'honesty', shadow: 'tact', looks: 'saying the hard thing kindly', order: 3,
      champions: [{ voiceId: 'v-warrior', side: 'value', at: 5, why: 'I say it plainly' }, { voiceId: 'v-mystic', side: 'shadow', at: 6 }, { voiceId: 'v-warrior', side: 'shadow', at: 7, why: 'and I spare the hurt' }],
      revisions: [{ at: 4, word: 'truth', shadow: 'kindness' }],
    };
    await store.put('values', v);
    const salt = randomSalt();
    const key = await deriveKey('1470', salt, 1000);
    await setKey(key, { salt, iterations: 1000 });
    const raw = (await db.values.get('val-honest'))!;
    const text = JSON.stringify(raw);
    for (const w of ['honesty', 'tact', 'saying', 'plainly', 'spare', 'truth', 'kindness']) expect(text).not.toContain(w);
    expect(raw).toMatchObject({ id: 'val-honest', status: 'held', order: 3, createdAt: 1, updatedAt: 2, word: '' });
    expect(raw.champions).toEqual([{ voiceId: 'v-warrior', side: 'value', at: 5 }, { voiceId: 'v-mystic', side: 'shadow', at: 6 }, { voiceId: 'v-warrior', side: 'shadow', at: 7 }]);
    expect(raw.revisions).toEqual([{ at: 4, word: '' }]);
    expect(await store.get('values', 'val-honest')).toEqual(v);
    lock();
    const shut = (await store.get('values', 'val-honest'))!;
    expect(shut.locked).toBe(true);
    expect(shut.champions.map(c => c.voiceId)).toEqual(['v-warrior', 'v-mystic', 'v-warrior']);
    await unlock(key);
    expect(await store.get('values', 'val-honest')).toEqual(v);
  });
});
