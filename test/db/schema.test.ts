import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { freshDB } from './helpers';
import { init, store, setKey, openRow } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { ensureSeeded } from '../../src/db/seed';
import { SEED_FLOWS, seedFlow } from '../../src/db/seed-flows';
import { openDB, SCHEMA_VERSION, STORES_V1, STORES_V2, STORES_V3, STORES_V4, STORES_V5, STORES_V6, SEED_CHAKRAS, MOUNTAIN_VERSION, VALUES_VERSION, TASKS_VERSION, RESEARCH_VERSION, STORES_V7, STORES_V8, TABLES, POEMS_ID, POEMS_NAME, coverBytes } from '../../src/db/schema';

describe('schema, version 9', () => {
  it('has every table from PLAN.md section 4, V7\'s playlists and shelves, the flows (F1), the sits (S2), the fixations (X1), the values (C1), the readings (R0), the signs\' shelves, marks and days (T0) and Research\'s inquiries and papers (Q2)', async () => {
    const db = await freshDB();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(RESEARCH_VERSION);
    expect(VALUES_VERSION).toBe(6);
    expect(MOUNTAIN_VERSION).toBe(7);
    expect(TASKS_VERSION).toBe(8);
    expect(RESEARCH_VERSION).toBe(9);
    expect(db.tables.map(t => t.name).sort()).toEqual([...TABLES].sort());
    expect(TABLES).toEqual(['settings', 'voices', 'pages', 'messages', 'paradoxes', 'items', 'leans', 'backups', 'albums', 'playlists', 'shelves', 'flows', 'episodes', 'sits', 'fixations', 'values', 'readings', 'signShelves', 'marks', 'days', 'inquiries', 'papers']);
  });

  it('carries the listed indexes', async () => {
    const db = await freshDB();
    const idx = (t: string) => db.table(t).schema.indexes.map(i => i.src).sort();
    expect(idx('pages')).toEqual(['*paradoxIds', '*tags', 'createdAt', 'kind', 'state']);
    expect(idx('messages')).toEqual(['[pageId+at]']);
    expect(idx('items')).toEqual(['paradoxId']);
    expect(idx('leans')).toEqual(['[paradoxId+at]']);
    expect(idx('playlists')).toEqual(['order']);
    expect(idx('shelves')).toEqual(['playlistId']);
    expect(idx('flows')).toEqual(['order']);
    expect(idx('episodes')).toEqual(['[flowId+startedAt]']);
    expect(idx('sits')).toEqual(['startedAt']);
    expect(idx('fixations')).toEqual([]);
    expect(idx('readings')).toEqual(['[of+at]', 'at']);
    expect(idx('signShelves')).toEqual([]);
    expect(idx('marks')).toEqual(['[chakra+at]', 'at']);
    expect(idx('days')).toEqual([]);
    expect(idx('inquiries')).toEqual(['askedAt']);
    expect(idx('papers')).toEqual([]);
    for (const t of ['inquiries', 'papers']) expect(db.table(t).schema.primKey.name).toBe('id');
    for (const t of ['signShelves', 'marks', 'days']) expect(db.table(t).schema.primKey.name).toBe('id');
    expect(db.table('fixations').schema.primKey.name).toBe('id');
    expect(idx('values')).toEqual([]);
    expect(db.table('values').schema.primKey.name).toBe('id');
    expect(db.table('albums').schema.primKey.name).toBe('albumUri');
    expect(db.table('shelves').schema.primKey.src).toBe('[playlistId+albumUri]');
    expect(db.table('settings').schema.primKey.name).toBe('id');
  });
});

describe('the upgrade from version 1 (V7)', () => {
  it('a version 1 database with ordered albums opens with the Poems shelf in place and the playlist ticked', async () => {
    const name = `flowstate-v1-${Date.now()}`;
    const v1 = new Dexie(name);
    v1.version(1).stores(STORES_V1);
    await v1.open();
    const cover = new Blob([new Uint8Array([9, 8, 7])], { type: 'image/jpeg' });
    await v1.table('albums').bulkPut([
      { albumUri: 'spotify:album:Pagan', album: 'Pagan', artist: 'CLANN', order: 1, firstTrackUri: 'spotify:track:3', cover },
      { albumUri: 'spotify:album:One', album: 'Oneknowing', artist: 'Lena Raine', order: 0, firstTrackUri: 'spotify:track:1', cover },
      { albumUri: 'spotify:album:Takk', album: 'Takk', artist: 'Sigur Rós', order: -1, firstTrackUri: '', cover },
    ]);
    await v1.table('pages').put({ id: 'p1', kind: 'entry', createdAt: 1, updatedAt: 1, state: 'open', tags: [], paradoxIds: [], linkedPageIds: [] });
    v1.close();

    const db = openDB(name);
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    const shelves = (await db.shelves.where('playlistId').equals(POEMS_ID).toArray()).sort((a, b) => a.order - b.order);
    expect(shelves).toEqual([
      { playlistId: POEMS_ID, albumUri: 'spotify:album:One', order: 0, firstTrackUri: 'spotify:track:1' },
      { playlistId: POEMS_ID, albumUri: 'spotify:album:Pagan', order: 1, firstTrackUri: 'spotify:track:3' },
    ]);
    expect(await db.playlists.toArray()).toEqual([
      { id: POEMS_ID, name: POEMS_NAME, uri: `spotify:playlist:${POEMS_ID}`, order: 0, snapshotId: '', total: 0, chosen: true },
    ]);
    // the albums and their covers are untouched, the one off the playlist included; other tables too
    expect(await db.albums.count()).toBe(3);
    const kept = (await db.albums.get('spotify:album:Takk'))!.cover!;
    expect([...await coverBytes(kept)]).toEqual([9, 8, 7]);
    expect(await db.pages.get('p1')).toBeTruthy();
    db.close();
  });
});

describe('the upgrade from version 2 (F1)', () => {
  it('a version 2 database opens at the current version with empty flows and episodes, every row kept', async () => {
    const name = `flowstate-v2-${Date.now()}`;
    const v2 = new Dexie(name);
    v2.version(1).stores(STORES_V1);
    v2.version(2).stores(STORES_V2);
    await v2.open();
    await v2.table('pages').put({ id: 'p1', kind: 'entry', createdAt: 1, updatedAt: 1, state: 'open', tags: [], paradoxIds: [], linkedPageIds: [] });
    v2.close();
    const db = openDB(name);
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(await db.flows.count()).toBe(0);
    expect(await db.episodes.count()).toBe(0);
    expect(await db.pages.get('p1')).toBeTruthy();
    db.close();
  });
});

describe('the upgrade from version 3 (S2)', () => {
  it('a version 3 database opens at the current version with an empty sits table, every row kept', async () => {
    const name = `flowstate-v3-${Date.now()}`;
    const v3 = new Dexie(name);
    v3.version(1).stores(STORES_V1);
    v3.version(2).stores(STORES_V2);
    v3.version(3).stores(STORES_V3);
    await v3.open();
    await v3.table('pages').put({ id: 'p1', kind: 'entry', createdAt: 1, updatedAt: 1, state: 'open', tags: [], paradoxIds: [], linkedPageIds: [], flow: { episodeId: 'e1' } });
    await v3.table('flows').put({ id: 'panic', name: 'Panic', order: 0, createdAt: 1, updatedAt: 1, diagram: 'ring', steps: [], revisions: [] });
    await v3.table('episodes').put({ id: 'e1', flowId: 'panic', startedAt: 1, marks: [], done: [] });
    await v3.table('settings').put({ id: 'app', sitSound: 'ocean' });
    v3.close();
    const db = openDB(name);
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(await db.sits.count()).toBe(0);
    expect(await db.pages.get('p1')).toMatchObject({ flow: { episodeId: 'e1' } });
    expect(await db.flows.get('panic')).toBeTruthy();
    expect(await db.episodes.get('e1')).toBeTruthy();
    expect(await db.settings.get('app')).toMatchObject({ sitSound: 'ocean' });
    db.close();
  });
});

describe('the upgrade from version 4 (X1)', () => {
  it('a version 4 database opens at the current version with an empty fixations table, writing nothing, every row kept', async () => {
    const name = `flowstate-v4-${Date.now()}`;
    const v4 = new Dexie(name);
    v4.version(1).stores(STORES_V1);
    v4.version(2).stores(STORES_V2);
    v4.version(3).stores(STORES_V3);
    v4.version(4).stores(STORES_V4);
    await v4.open();
    await v4.table('episodes').put({ id: 'e1', flowId: 'energize', startedAt: 1, marks: [], done: [] });
    await v4.table('sits').put({ id: 's1', startedAt: 1, endedAt: 70_001, sound: 'rain' });
    await v4.table('settings').put({ id: 'app', cleaned: ['seed-pages'] });
    v4.close();
    const db = openDB(name);
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(await db.fixations.count()).toBe(0);
    expect(await db.episodes.get('e1')).toEqual({ id: 'e1', flowId: 'energize', startedAt: 1, marks: [], done: [] });
    expect(await db.sits.get('s1')).toBeTruthy();
    expect(await db.settings.get('app')).toEqual({ id: 'app', cleaned: ['seed-pages'] });
    db.close();
  });
});

describe('the upgrade from version 5 (C1)', () => {
  it('a version 5 database opens at the current version with empty values and readings tables, every row kept', async () => {
    const name = `flowstate-v5-${Date.now()}`;
    const v5 = new Dexie(name);
    v5.version(1).stores(STORES_V1);
    v5.version(2).stores(STORES_V2);
    v5.version(3).stores(STORES_V3);
    v5.version(4).stores(STORES_V4);
    v5.version(5).stores(STORES_V5);
    await v5.open();
    const px = { id: 'px1', createdAt: 1, updatedAt: 1, status: 'active', poleA: { value: 'a', aspect: 'x' }, poleB: { value: 'b', aspect: 'y' }, revisions: [] };
    await v5.table('paradoxes').put(px);
    await v5.table('fixations').put({ id: 'fx1', name: 'FlowState', hue: 250, createdAt: 1, stints: [] });
    v5.close();
    const db = openDB(name);
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(await db.values.count()).toBe(0);
    expect(await db.readings.count()).toBe(0);
    expect(await db.paradoxes.get('px1')).toEqual(px);
    expect(await db.fixations.get('fx1')).toBeTruthy();
    db.close();
  });
});

describe('the upgrade to MOUNTAIN_VERSION from version 5 (R0)', () => {
  const v5 = async (name: string) => {
    const old = new Dexie(name);
    old.version(1).stores(STORES_V1);
    old.version(2).stores(STORES_V2);
    old.version(3).stores(STORES_V3);
    old.version(4).stores(STORES_V4);
    old.version(5).stores(STORES_V5);
    await old.open();
    return old;
  };
  // a seed flow as a version 5 journal stored it: no chakra
  const asV5 = (f: ReturnType<typeof seedFlow>) => { const { chakra: _c, ...rest } = f; return rest; };

  it('adds each seed flow\'s chakra and nothing else: every flow row, episode and step untouched, an empty readings table', async () => {
    const name = `flowstate-v5-${Date.now()}`;
    const old = await v5(name);
    const rows = SEED_FLOWS.map(f => asV5(seedFlow(f)));
    // one he renamed and edited, and one of his own
    rows[0] = { ...rows[0], name: 'My panic', updatedAt: 99, steps: rows[0].steps.slice(0, 2) };
    const mine = { id: 'mine', name: 'Mine', order: 10, createdAt: 5, updatedAt: 5, diagram: 'ring' as const, steps: [], revisions: [] };
    await old.table('flows').bulkPut([...rows, mine]);
    await old.table('episodes').put({ id: 'e1', flowId: 'panic', startedAt: 1, marks: [], done: [] });
    old.close();

    const db = openDB(name);
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(await db.readings.count()).toBe(0);
    for (const row of rows) {
      const got = (await db.flows.get(row.id))!;
      const { chakra, ...rest } = got;
      expect(rest).toEqual(row);
      expect(chakra).toBe(SEED_CHAKRAS[row.id]);
    }
    expect((await db.flows.get('energize'))!).not.toHaveProperty('chakra');
    expect(await db.flows.get('mine')).toEqual(mine);
    expect(await db.episodes.get('e1')).toEqual({ id: 'e1', flowId: 'panic', startedAt: 1, marks: [], done: [] });
    db.close();
  });

  it('the pairing is PLAN-MOUNTAIN.md section 6\'s', () => {
    expect(SEED_CHAKRAS).toEqual({
      night: 'crown', replay: 'third-eye', fight: 'throat', depress: 'heart', shame: 'solar-plexus', shutdown: 'sacral', panic: 'root', whatif: 'root',
    });
  });

  it('a sealed flow keeps its seal: the chakra is added in the clear and the words still open with the key', async () => {
    const name = `flowstate-v5s-${Date.now()}`;
    // seal the flows at the current version, then strip chakra and reopen the rows as a version 5 store would have them
    const dbNow = openDB(name);
    await dbNow.open();
    await init(dbNow);
    await ensureSeeded();
    const key = await deriveKey('2468', randomSalt(), 1000);
    await setKey(key, { salt: 'x', iterations: 1000 });
    const sealed = await dbNow.flows.toArray();
    expect(sealed.every(f => f.sealed)).toBe(true);
    dbNow.close();
    await Dexie.delete(name);
    const old = await v5(name);
    await old.table('flows').bulkPut(sealed.map(f => { const { chakra: _c, ...rest } = f; return rest; }));
    await old.table('settings').put({ id: 'app', lock: { enabled: true, relockAfterMin: 5 } });
    old.close();
    const db = openDB(name);
    await db.open();
    await init(db);
    expect((await db.flows.get('depress'))!.chakra).toBe('heart');
    expect((await db.flows.get('depress'))!.sealed).toEqual(sealed.find(f => f.id === 'depress')!.sealed);
    // locked, the list still sees the sign; opened with the key, the words come back whole
    const opened = await openRow('flows', (await db.flows.get('depress'))!, key);
    expect(opened.name).toBe('Depress');
    expect(opened.chakra).toBe('heart');
    expect(await store.get('flows', 'depress')).toMatchObject({ locked: true, chakra: 'heart' });
    db.close();
  });
});

describe('a fresh journal (R0)', () => {
  it('seeds every flow with its chakra, Energize with none, beside the values\' two (C1) and no readings', async () => {
    const db = await freshDB();
    expect(db.verno).toBe(SCHEMA_VERSION);
    await ensureSeeded();
    expect(await db.values.count()).toBe(2);
    expect(await db.readings.count()).toBe(0);
    const flows = await store.all('flows');
    for (const f of flows) expect(f.chakra).toBe(SEED_CHAKRAS[f.id]);
    expect(flows.find(f => f.id === 'energize')!.chakra).toBeUndefined();
  });
});

describe('the upgrade to MOUNTAIN_VERSION from version 6, the values (main\'s schema before the mountain)', () => {
  const v6 = async (name: string) => {
    const old = new Dexie(name);
    old.version(1).stores(STORES_V1);
    old.version(2).stores(STORES_V2);
    old.version(3).stores(STORES_V3);
    old.version(4).stores(STORES_V4);
    old.version(5).stores(STORES_V5);
    old.version(VALUES_VERSION).stores(STORES_V6);
    await old.open();
    return old;
  };
  const asV6 = (f: ReturnType<typeof seedFlow>) => { const { chakra: _c, ...rest } = f; return rest; };
  const value = {
    id: 'v1', createdAt: 1, updatedAt: 2, status: 'held', word: 'Brave', shadow: 'Safe', looks: 'I say it first', order: 0,
    champions: [{ voiceId: 'kid', side: 'value', at: 3, why: 'he goes first' }, { voiceId: 'critic', side: 'shadow', at: 4 }],
    revisions: [{ at: 1, word: 'Bold' }], fromParadoxId: 'px1',
  };

  it('keeps every values row, the paradoxes, a labelled line and a council page whole, and gives the seed flows their chakra', async () => {
    const name = `flowstate-v6-${Date.now()}`;
    const old = await v6(name);
    const rows = SEED_FLOWS.map(f => asV6(seedFlow(f)));
    rows[1] = { ...rows[1], name: 'My replay', updatedAt: 77 };
    await old.table('flows').bulkPut(rows);
    await old.table('values').bulkPut([value, { ...value, id: 'v2', status: 'resting', order: 1, champions: [], revisions: [] }]);
    const px = { id: 'px1', createdAt: 1, updatedAt: 1, status: 'active', poleA: { value: 'a', aspect: 'x' }, poleB: { value: 'b', aspect: 'y' }, revisions: [] };
    await old.table('paradoxes').put(px);
    const line = { id: 'm1', pageId: 'p1', voiceId: 'kid', text: 'Go', at: 5, for: { valueId: 'v1', side: 'value' } };
    await old.table('messages').put(line);
    const page = { id: 'p1', createdAt: 5, updatedAt: 5, state: 'open', kind: 'council', tags: [], paradoxIds: [], valueIds: ['v1'] };
    await old.table('pages').put(page);
    await old.table('settings').put({ id: 'app', cleaned: ['values', 'fixations'] });
    old.close();

    const db = openDB(name);
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(await db.readings.count()).toBe(0);
    expect(await db.values.orderBy('id').toArray()).toEqual([value, { ...value, id: 'v2', status: 'resting', order: 1, champions: [], revisions: [] }]);
    expect(await db.paradoxes.get('px1')).toEqual(px);
    expect(await db.messages.get('m1')).toEqual(line);
    expect(await db.pages.get('p1')).toEqual(page);
    expect(await db.settings.get('app')).toEqual({ id: 'app', cleaned: ['values', 'fixations'] });
    for (const row of rows) {
      const { chakra, ...rest } = (await db.flows.get(row.id))!;
      expect(rest).toEqual(row);
      expect(chakra).toBe(SEED_CHAKRAS[row.id]);
    }
    db.close();
  });

  it('a locked version 6 journal: values stay sealed byte for byte, the flows get their chakra in the clear and still open', async () => {
    const name = `flowstate-v6s-${Date.now()}`;
    const dbNow = openDB(name);
    await dbNow.open();
    await init(dbNow);
    await ensureSeeded();
    const key = await deriveKey('2468', randomSalt(), 1000);
    await setKey(key, { salt: 'x', iterations: 1000 });
    await store.put('values', { ...value, id: 'v9' } as never);
    const flows = await dbNow.flows.toArray();
    const values = await dbNow.values.toArray();
    expect(values.length).toBeGreaterThan(0);
    expect(values.every(v => v.sealed && v.word === '')).toBe(true);
    dbNow.close();
    await Dexie.delete(name);
    const old = await v6(name);
    await old.table('flows').bulkPut(flows.map(f => { const { chakra: _c, ...rest } = f; return rest; }));
    await old.table('values').bulkPut(values);
    await old.table('settings').put({ id: 'app', lock: { enabled: true, relockAfterMin: 5 } });
    old.close();

    const db = openDB(name);
    await db.open();
    await init(db);
    expect(await db.values.orderBy('id').toArray()).toEqual([...values].sort((x, y) => x.id.localeCompare(y.id)));
    expect((await db.flows.get('shame'))!.chakra).toBe('solar-plexus');
    expect((await db.flows.get('shame'))!.sealed).toEqual(flows.find(f => f.id === 'shame')!.sealed);
    expect(await store.get('flows', 'shame')).toMatchObject({ locked: true, chakra: 'solar-plexus' });
    expect((await openRow('values', (await db.values.get('v9'))!, key)).word).toBe('Brave');
    expect((await openRow('flows', (await db.flows.get('shame'))!, key)).chakra).toBe('solar-plexus');
    db.close();
  });
});

describe('the upgrade to TASKS_VERSION from version 7, the mountain (main\'s schema before the tasks, T0)', () => {
  const v7 = async (name: string) => {
    const old = new Dexie(name);
    old.version(1).stores(STORES_V1);
    old.version(2).stores(STORES_V2);
    old.version(3).stores(STORES_V3);
    old.version(4).stores(STORES_V4);
    old.version(5).stores(STORES_V5);
    old.version(VALUES_VERSION).stores(STORES_V6);
    old.version(MOUNTAIN_VERSION).stores(STORES_V7);
    await old.open();
    return old;
  };
  const V7_TABLES = Object.keys(STORES_V7);
  const dump = async (d: Dexie) => Object.fromEntries(await Promise.all(V7_TABLES.map(async t => [t, await d.table(t).toArray()] as const)));

  it('the three new tables are the only change from version 7 to 8 (Research\'s two come after them)', () => {
    expect(TABLES.filter(t => !V7_TABLES.includes(t))).toEqual(['signShelves', 'marks', 'days', 'inquiries', 'papers']);
    expect(Object.keys(STORES_V8).filter(t => !V7_TABLES.includes(t))).toEqual(['signShelves', 'marks', 'days']);
  });

  it('a plain version 7 journal opens at the newest version with every row in every table intact and the three new tables empty', async () => {
    const name = `flowstate-v7-${Date.now()}`;
    const old = await v7(name);
    const cover = new Uint8Array([1, 2, 3]).buffer;
    await old.table('settings').put({ id: 'app', light: 'sky', cleaned: ['values', 'fixations'], place: { lat: 39.6, lon: -105.3, name: 'Evergreen, Colorado' } });
    await old.table('voices').put({ id: 'kid', name: 'Kid', aka: [], colour: { hue: 25 }, shade: 'light', starred: false, order: 0, archived: false, revisions: [] });
    await old.table('pages').put({ id: 'p1', kind: 'entry', createdAt: 1, updatedAt: 2, state: 'open', tags: ['x'], paradoxIds: [], linkedPageIds: [] });
    await old.table('messages').put({ id: 'm1', pageId: 'p1', at: 3, text: 'A line', kept: true });
    await old.table('paradoxes').put({ id: 'px1', createdAt: 1, updatedAt: 1, status: 'active', poleA: { value: 'a', aspect: 'x' }, poleB: { value: 'b', aspect: 'y' }, revisions: [] });
    await old.table('items').put({ id: 'i1', paradoxId: 'px1', pole: 'a', text: 'go', lean: 0, doneLog: [], order: 0 });
    await old.table('leans').put({ id: 'l1', paradoxId: 'px1', at: 4, lean: 0.2, note: 'n' });
    await old.table('backups').put({ id: 'b1', at: 5, bytes: 10, encrypted: false });
    await old.table('albums').put({ albumUri: 'spotify:album:Takk', album: 'Takk...', artist: 'Sigur Rós', cover, coverType: 'image/jpeg' });
    await old.table('playlists').put({ id: POEMS_ID, name: POEMS_NAME, uri: `spotify:playlist:${POEMS_ID}`, order: 0, snapshotId: 's', total: 1, chosen: true });
    await old.table('shelves').put({ playlistId: POEMS_ID, albumUri: 'spotify:album:Takk', order: 0, firstTrackUri: 'spotify:track:1' });
    await old.table('flows').bulkPut(SEED_FLOWS.map(f => seedFlow(f)));
    await old.table('episodes').put({ id: 'e1', flowId: 'panic', startedAt: 6, marks: [{ stepId: 'panic-1', at: 6 }], done: [] });
    await old.table('sits').put({ id: 's1', startedAt: 7, endedAt: 8, sound: 'rain' });
    await old.table('fixations').put({ id: 'fx1', name: 'FlowState', hue: 250, createdAt: 1, stints: [{ from: 1, slot: 0 }] });
    await old.table('values').put({ id: 'v1', createdAt: 1, updatedAt: 1, status: 'held', word: 'Brave', champions: [], revisions: [] });
    await old.table('readings').bulkPut([{ id: 'r1', at: 9, of: 'mountain', value: 0.4 }, { id: 'r2', at: 10, of: 'heart', value: 0.7 }]);
    const before = await dump(old);
    for (const t of V7_TABLES) expect(before[t].length, t).toBeGreaterThan(0);
    old.close();

    const db = openDB(name);
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(await dump(db)).toEqual(before);
    expect(await db.signShelves.count()).toBe(0);
    expect(await db.marks.count()).toBe(0);
    expect(await db.days.count()).toBe(0);
    db.close();
  });

  it('a locked version 7 journal: every sealed row stays sealed byte for byte, and still opens with the PIN', async () => {
    const name = `flowstate-v7s-${Date.now()}`;
    const now = openDB(name);
    await now.open();
    await init(now);
    await ensureSeeded();
    const key = await deriveKey('1357', randomSalt(), 1000);
    await setKey(key, { salt: 'x', iterations: 1000 });
    await store.put('readings', { id: 'r1', at: 9, of: 'root', value: 0.6 });
    const sealed = await dump(now);
    expect((sealed.readings[0] as { sealed?: unknown }).sealed).toBeTruthy();
    now.close();
    await Dexie.delete(name);
    const old = await v7(name);
    for (const t of V7_TABLES) await old.table(t).bulkPut(sealed[t]);
    old.close();

    const db = openDB(name);
    await db.open();
    await init(db);
    expect(await dump(db)).toEqual(sealed);
    expect(await store.get('readings', 'r1')).toMatchObject({ locked: true });
    expect((await openRow('readings', (await db.readings.get('r1'))!, key)).value).toBe(0.6);
    db.close();
  });
});

describe('the upgrade to RESEARCH_VERSION from version 8, the tasks (Q2, PLAN-RESEARCH.md section 5)', () => {
  const v8 = async (name: string) => {
    const old = new Dexie(name);
    old.version(1).stores(STORES_V1);
    old.version(2).stores(STORES_V2);
    old.version(3).stores(STORES_V3);
    old.version(4).stores(STORES_V4);
    old.version(5).stores(STORES_V5);
    old.version(VALUES_VERSION).stores(STORES_V6);
    old.version(MOUNTAIN_VERSION).stores(STORES_V7);
    old.version(TASKS_VERSION).stores(STORES_V8);
    await old.open();
    return old;
  };
  const V8_TABLES = Object.keys(STORES_V8);
  const dump = async (d: Dexie) => Object.fromEntries(await Promise.all(V8_TABLES.map(async t => [t, await d.table(t).toArray()] as const)));

  it('the two new tables are the only change from version 8', () => {
    expect(TABLES.filter(t => !V8_TABLES.includes(t))).toEqual(['inquiries', 'papers']);
  });

  it('a version 8 journal opens at version 9 with every row in every table intact and the two new tables empty', async () => {
    const name = `flowstate-v8-${Date.now()}`;
    const old = await v8(name);
    await old.table('settings').put({ id: 'app', light: 'sky', cleaned: ['values'], spotify: { connectedAt: 3, tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: 9 } } });
    await old.table('pages').put({ id: 'p1', kind: 'question', title: 'Does cold water help?', createdAt: 1, updatedAt: 2, state: 'open', tags: [], paradoxIds: [], linkedPageIds: [] });
    await old.table('messages').put({ id: 'm1', pageId: 'p1', at: 3, text: 'A line', kept: true });
    await old.table('readings').put({ id: 'r1', at: 9, of: 'mountain', value: 0.4 });
    await old.table('signShelves').put({ id: 'heart', picks: [], updatedAt: 4 });
    await old.table('marks').put({ id: 'mk1', chakra: 'heart', touch: 'ask', text: 'mine', at: 5 });
    await old.table('days').put({ id: '2026-11-13', basics: ['ate'], updatedAt: 6 });
    const before = await dump(old);
    old.close();

    const db = openDB(name);
    await db.open();
    expect(db.verno).toBe(RESEARCH_VERSION);
    expect(await dump(db)).toEqual(before);
    expect(await db.inquiries.count()).toBe(0);
    expect(await db.papers.count()).toBe(0);
    db.close();
  });
});
