import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from './helpers';
import { type FlowDB, SCHEMA_VERSION, MOUNTAIN_VERSION, VALUES_VERSION, TASKS_VERSION, POEMS_ID, coverBytes } from '../../src/db/schema';
import { exportData, importData, parseBackup, BackupError, NeedsPinError, stamp, fileName, fileLock } from '../../src/db/backup';
import { ensureSeeded, seedFixationsOnce, defaultSettings } from '../../src/db/seed';
import { store, setKey, lock, unlock, init, keyState, LockedError, tombstone } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';

let db: FlowDB;
beforeEach(async () => { db = await freshDB(); });

const roundTrip = async (from: FlowDB) => parseBackup(JSON.stringify(await exportData(from, 1000)));

describe('export', () => {
  it('writes every table, the schema version and exportedAt', async () => {
    const f = await exportData(db, 1234);
    expect(f.app).toBe('flowstate');
    expect(f.schemaVersion).toBe(SCHEMA_VERSION);
    expect(f.exportedAt).toBe(1234);
    expect(Object.keys(f.tables).sort()).toEqual(db.tables.map(t => t.name).sort());
  });

  it('names the file by date', () => {
    expect(fileName(new Date(2026, 10, 7))).toBe('flowstate-2026-11-07.json');
  });
});

describe('round trip', () => {
  it('an empty database round-trips', async () => {
    const file = await roundTrip(db);
    const other = await freshDB();
    await importData(file, 'replace', other);
    expect((await exportData(other, 1000)).tables).toEqual((await exportData(db, 1000)).tables);
  });

  it('a seeded database round-trips, cover blobs included', async () => {
    await ensureSeeded(7);
    await db.albums.put({ albumUri: 'spotify:album:1', album: 'Oneknowing', artist: 'Lena Raine', order: 0, firstTrackUri: 't1', cover: new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/jpeg' }) });
    const before = await exportData(db, 1000);
    const file = await roundTrip(db);
    const other = await freshDB();
    await importData(file, 'replace', other);
    const after = await exportData(other, 1000);
    expect(after.tables).toEqual(before.tables);
    // V9: an imported cover is kept as bytes with its type
    const row = (await other.albums.get('spotify:album:1'))!;
    expect(row.cover).toBeInstanceOf(ArrayBuffer);
    expect(row.coverType).toBe('image/jpeg');
    expect([...await coverBytes(row.cover!)]).toEqual([1, 2, 3, 250]);
  });

  it('playlists and their shelves round-trip, and merge keys a shelf row on its playlist and album (V7)', async () => {
    await db.albums.put({ albumUri: 'spotify:album:1', album: 'Oneknowing', artist: 'Lena Raine', cover: new Blob([new Uint8Array([4, 5])], { type: 'image/jpeg' }) });
    await db.playlists.bulkPut([
      { id: 'M', name: 'master (ii)', uri: 'spotify:playlist:M', order: 0, snapshotId: 's1', total: 3120, chosen: true, readAt: 5 },
      { id: POEMS_ID, name: 'Poems', uri: `spotify:playlist:${POEMS_ID}`, order: 1, snapshotId: '', total: 0, chosen: false },
    ]);
    await db.shelves.bulkPut([
      { playlistId: 'M', albumUri: 'spotify:album:1', order: 0, firstTrackUri: 't1' },
      { playlistId: POEMS_ID, albumUri: 'spotify:album:1', order: 4, firstTrackUri: 't9' },
    ]);
    const before = await exportData(db, 1000);
    const file = await roundTrip(db);
    const other = await freshDB();
    await importData(file, 'replace', other);
    expect((await exportData(other, 1000)).tables).toEqual(before.tables);
    expect(await other.shelves.get(['M', 'spotify:album:1'])).toEqual({ playlistId: 'M', albumUri: 'spotify:album:1', order: 0, firstTrackUri: 't1' });
    const cover = (await other.albums.get('spotify:album:1'))!.cover!;
    expect([...await coverBytes(cover)]).toEqual([4, 5]);
    // merge into a journal that has one of the two shelf rows: the other is added, the one there kept
    const third = await freshDB();
    await third.shelves.put({ playlistId: 'M', albumUri: 'spotify:album:1', order: 7, firstTrackUri: 'mine' });
    const r = await importData(file, 'merge', third);
    expect(await third.shelves.count()).toBe(2);
    expect((await third.shelves.get(['M', 'spotify:album:1']))!.firstTrackUri).toBe('mine');
    expect(r.added).toBeGreaterThan(0);
  });

  it('a version 1 file imports with its ordered albums as the Poems shelf, ticked (V7)', async () => {
    const v1 = {
      app: 'flowstate', schemaVersion: 1, exportedAt: 1,
      tables: {
        settings: [], voices: [], pages: [], messages: [], paradoxes: [], items: [], leans: [], backups: [],
        albums: [
          { albumUri: 'spotify:album:1', album: 'Oneknowing', artist: 'Lena Raine', order: 0, firstTrackUri: 't1', cover: { type: 'image/png', b64: 'AQI=' } },
          { albumUri: 'spotify:album:2', album: 'Takk', artist: 'Sigur Rós', order: -1, firstTrackUri: '' },
        ],
      },
    };
    const file = parseBackup(JSON.stringify(v1));
    expect(file.schemaVersion).toBe(SCHEMA_VERSION);
    await importData(file, 'replace', db);
    expect(await db.shelves.toArray()).toEqual([{ playlistId: POEMS_ID, albumUri: 'spotify:album:1', order: 0, firstTrackUri: 't1' }]);
    expect((await db.playlists.get(POEMS_ID))?.chosen).toBe(true);
    expect([...await coverBytes((await db.albums.get('spotify:album:1'))!.cover!)]).toEqual([1, 2]);
  });

  it('the sits and a page written after one round-trip, plain and in a merge (S2)', async () => {
    const sit = { id: 's1', startedAt: 1000, endedAt: 1000 + 12 * 60_000, sound: 'rain' as const, minutes: 10 as const, pageId: 'p1' };
    const open = { id: 's2', startedAt: 5000, endedAt: 5000 + 3 * 60_000, sound: 'quiet' as const };
    await store.bulkPut('sits', [sit, open]);
    await store.put('pages', { id: 'p1', kind: 'entry', createdAt: 2000, updatedAt: 2000, state: 'open', tags: [], paradoxIds: [], linkedPageIds: [], sit: { sitId: 's1' } });
    const file = await roundTrip(db);
    expect(file.tables.sits).toHaveLength(2);
    const other = await freshDB();
    await importData(file, 'replace', other);
    expect((await other.sits.toArray()).sort((a, b) => a.startedAt - b.startedAt)).toEqual([sit, open]);
    expect((await other.pages.get('p1'))!.sit).toEqual({ sitId: 's1' });
    // a merge adds a sit this phone has not got, and keeps the ones it has
    const third = await freshDB();
    await third.sits.put(open);
    expect(await importData(file, 'merge', third)).toMatchObject({ added: 2, kept: 1 });
    expect(await third.sits.count()).toBe(2);
  });

  it('the readings round-trip, plain, sealed and in a merge (R0)', async () => {
    const rows = [
      { id: 'r1', at: 1000, of: 'mountain' as const, value: 0.6 },
      { id: 'r2', at: 2000, of: 'heart' as const, value: 0.4 },
      { id: 'r3', at: 3000, of: 'heart' as const, value: 0 },
    ];
    await store.bulkPut('readings', rows);
    const file = await roundTrip(db);
    expect(file.tables.readings).toHaveLength(3);
    const other = await freshDB();
    await importData(file, 'replace', other);
    expect((await other.readings.toArray()).sort((a, b) => a.at - b.at)).toEqual(rows);
    // a merge adds the readings this phone has not got and keeps the ones it has (never edited, so never updated)
    const third = await freshDB();
    await third.readings.put(rows[1]);
    expect(await importData(file, 'merge', third)).toMatchObject({ added: 2, updated: 0, kept: 1 });
    expect(await third.readings.count()).toBe(3);
    // with the lock on, a reading's value is sealed in the database and in the file; of, at and the id stay clear
    await init(db); // freshDB pointed the fields layer at the last journal made
    await ensureSeeded(7);
    const salt = randomSalt();
    await setKey(await deriveKey('1357', salt, 1000), { salt, iterations: 1000 });
    for (const r of await db.readings.toArray()) { expect(r).not.toHaveProperty('value'); expect(r.sealed).toBeTruthy(); }
    const sealed = await roundTrip(db);
    expect(sealed.encrypted).toBe(true);
    const inFile = (sealed.tables.readings as Record<string, unknown>[]).sort((a, b) => (a.at as number) - (b.at as number));
    expect(inFile.map(r => [r.id, r.at, r.of, 'value' in r, !!r.sealed])).toEqual(rows.map(r => [r.id, r.at, r.of, false, true]));
    expect(JSON.stringify(sealed.tables.readings)).not.toMatch(/0\.6|0\.4/);
    // opened with that file's PIN into a plain journal, the values come back whole
    const fourth = await freshDB();
    await importData(sealed, 'replace', fourth, await deriveKey('1357', sealed.salt!, sealed.iterations!));
    expect((await fourth.readings.toArray()).sort((a, b) => a.at - b.at)).toEqual(rows);
  });

  it('the signs\' shelves, marks and days round-trip, plain and sealed (T0)', async () => {
    const shelfRow = { id: 'heart' as const, picks: [{ id: 'pk1', kind: 'film' as const, title: 'The Big Sick' }], updatedAt: 1000 };
    const marks = [
      { id: 'mk1', chakra: 'heart' as const, touch: 'grieve', text: 'Grandpa', at: 1000 },
      { id: 'mk2', chakra: 'solar-plexus' as const, touch: 'reword', text: 'I sent it', struck: 'I am late', at: 2000 },
    ];
    const day = { id: '2026-11-11', basics: ['ate' as const, 'water' as const], updatedAt: 3000 };
    await store.put('signShelves', shelfRow);
    await store.bulkPut('marks', marks);
    await store.put('days', day);
    const file = await roundTrip(db);
    const other = await freshDB();
    await importData(file, 'replace', other);
    expect(await other.signShelves.toArray()).toEqual([shelfRow]);
    expect((await other.marks.toArray()).sort((a, b) => a.at - b.at)).toEqual(marks);
    expect(await other.days.toArray()).toEqual([day]);
    // sealed: none of his words in the file, and they open again with its PIN
    await init(db);
    await ensureSeeded(7);
    const salt = randomSalt();
    await setKey(await deriveKey('1357', salt, 1000), { salt, iterations: 1000 });
    const sealed = await roundTrip(db);
    const text = JSON.stringify([sealed.tables.signShelves, sealed.tables.marks, sealed.tables.days]);
    expect(text).not.toMatch(/Big Sick|Grandpa|I sent it|I am late|water/);
    const fourth = await freshDB();
    await importData(sealed, 'replace', fourth, await deriveKey('1357', sealed.salt!, sealed.iterations!));
    expect(await fourth.signShelves.toArray()).toEqual([shelfRow]);
    expect((await fourth.marks.toArray()).sort((a, b) => a.at - b.at)).toEqual(marks);
    expect(await fourth.days.toArray()).toEqual([day]);
  });

  it('a file from before the tasks (TASKS_VERSION - 1) imports whole, with the three new tables empty', async () => {
    await ensureSeeded(7);
    await store.put('readings', { id: 'r1', at: 1, of: 'root', value: 0.3 });
    const f = await exportData(db, 1000);
    const v7 = { ...f, schemaVersion: TASKS_VERSION - 1, tables: { ...f.tables, signShelves: undefined, marks: undefined, days: undefined } };
    const parsed = parseBackup(JSON.stringify(v7));
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.tables.signShelves).toEqual([]);
    expect(parsed.tables.marks).toEqual([]);
    expect(parsed.tables.days).toEqual([]);
    expect(parsed.tables.flows).toEqual(f.tables.flows);
    expect(parsed.tables.readings).toEqual(f.tables.readings);
    const other = await freshDB();
    await importData(parsed, 'replace', other);
    expect(await other.readings.get('r1')).toEqual({ id: 'r1', at: 1, of: 'root', value: 0.3 });
    expect(await other.signShelves.count()).toBe(0);
  });

  it('a file from before the mountain (MOUNTAIN_VERSION - 1) imports with empty readings and its seed flows under their signs', async () => {
    await ensureSeeded(7);
    const f = await exportData(db, 1000);
    const v5 = { ...f, schemaVersion: MOUNTAIN_VERSION - 1, tables: { ...f.tables, readings: undefined, flows: (f.tables.flows as { chakra?: string }[]).map(({ chakra: _c, ...r }) => r) } };
    const parsed = parseBackup(JSON.stringify(v5));
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.tables.readings).toEqual([]);
    expect(parsed.tables.flows).toEqual(f.tables.flows);
    const other = await freshDB();
    await importData(parsed, 'replace', other);
    expect((await other.flows.get('whatif'))!.chakra).toBe('root');
    expect((await other.flows.get('energize'))!.chakra).toBeUndefined();
  });

  /** What a phone on main's version 6 (the values, before the mountain) exported: values, no readings, flows without chakra. */
  const asV6File = (f: Awaited<ReturnType<typeof exportData>>) => ({
    ...f, schemaVersion: VALUES_VERSION,
    tables: { ...f.tables, readings: undefined, flows: (f.tables.flows as { chakra?: string }[]).map(({ chakra: _c, ...r }) => r) },
  });

  it('a version 6 file (main\'s values, before the mountain) imports whole: every value as it was, none made again from a paradox', async () => {
    await ensureSeeded(7);
    await store.put('values', { id: 'v-mine', createdAt: 3, updatedAt: 4, status: 'held', word: 'Brave', shadow: 'Safe', champions: [{ voiceId: 'kid', side: 'value', at: 4, why: 'first' }], revisions: [], order: 5 });
    const f = await exportData(db, 1000);
    const values = (f.tables.values as { id: string }[]).sort((a, b) => a.id.localeCompare(b.id));
    expect(values.length).toBeGreaterThan(1);
    const parsed = parseBackup(JSON.stringify(asV6File(f)));
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.madeAt).toBe(VALUES_VERSION);
    expect(parsed.tables.readings).toEqual([]);
    expect(parsed.tables.flows).toEqual(f.tables.flows);
    for (const mode of ['replace', 'merge'] as const) {
      const other = await freshDB();
      // a paradox in the file must not come in as a second value: a version 6 file has its values already
      await importData(parseBackup(JSON.stringify({ ...asV6File(f), tables: { ...asV6File(f).tables, paradoxes: [{ id: 'px-late', createdAt: 1, updatedAt: 1, status: 'active', poleA: { value: 'a', aspect: '' }, poleB: { value: 'b', aspect: '' }, revisions: [] }] } })), mode, other);
      const got = (await store.all('values')).filter(v => values.some(w => w.id === v.id)).sort((a, b) => a.id.localeCompare(b.id));
      expect(got).toEqual(values);
      expect((await store.all('values')).some(v => v.fromParadoxId === 'px-late')).toBe(false);
      expect(await other.readings.count()).toBe(0);
      expect((await other.flows.get('depress'))!.chakra).toBe('heart');
    }
  });

  it('a locked version 6 file opens with its PIN: values come back whole, flows under their signs', async () => {
    await init(db);
    await ensureSeeded(7);
    await store.put('values', { id: 'v-mine', createdAt: 3, updatedAt: 4, status: 'held', word: 'Brave', champions: [{ voiceId: 'kid', side: 'value', at: 4, why: 'first' }], revisions: [] });
    const salt = randomSalt();
    await setKey(await deriveKey('1357', salt, 1000), { salt, iterations: 1000 });
    const f = await exportData(db, 1000);
    expect(f.encrypted).toBe(true);
    expect(JSON.stringify(f.tables.values)).not.toMatch(/Brave|first/);
    const parsed = parseBackup(JSON.stringify(asV6File(f)));
    const other = await freshDB();
    await importData(parsed, 'replace', other, await deriveKey('1357', parsed.salt!, parsed.iterations!));
    expect(await store.get('values', 'v-mine')).toMatchObject({ word: 'Brave', champions: [{ voiceId: 'kid', side: 'value', at: 4, why: 'first' }] });
    expect((await store.get('flows', 'depress'))!.chakra).toBe('heart');
    expect((await store.get('flows', 'panic'))!.name).toBe('Panic');
  });

  it('a version 5 file (before the values and the mountain) gets both: values from its paradoxes and its seed flows\' signs', async () => {
    await ensureSeeded(7);
    const f = await exportData(db, 1000);
    const { values: _v, readings: _r, ...tables } = f.tables;
    const px = { id: 'px-old', createdAt: 1, updatedAt: 1, status: 'active', poleA: { value: 'open', aspect: 'saying it' }, poleB: { value: 'guarded', aspect: '' }, revisions: [] };
    const v5 = { ...f, schemaVersion: 5, tables: { ...tables, paradoxes: [px], flows: (f.tables.flows as { chakra?: string }[]).map(({ chakra: _c, ...r }) => r) } };
    const other = await freshDB();
    await importData(parseBackup(JSON.stringify(v5)), 'replace', other);
    expect((await store.all('values')).find(v => v.fromParadoxId === 'px-old')).toMatchObject({ word: 'open', shadow: 'guarded' });
    expect((await other.flows.get('night'))!.chakra).toBe('crown');
    expect(await other.readings.count()).toBe(0);
  });

  it('a version 3 file (before the sits) imports with an empty sits table', async () => {
    const f = parseBackup('{"app":"flowstate","schemaVersion":3,"exportedAt":1,"tables":{"pages":[]}}');
    expect(f.schemaVersion).toBe(SCHEMA_VERSION);
    expect(f.tables.sits).toEqual([]);
  });

  it('the fixations and a ride for one round-trip, plain and in a merge (X1)', async () => {
    const on = { id: 'fx-a', name: 'FlowState', hue: 250, createdAt: 100, stints: [{ from: 100, to: 200, slot: 0 }, { from: 300, slot: 1 }], next: 'the deck sheet', updatedAt: 300 };
    const done = { id: 'fx-b', name: 'East Winds', hue: 150, createdAt: 50, stints: [{ from: 50, to: 400, slot: 1 }], finishedAt: 400, updatedAt: 400 };
    await store.bulkPut('fixations', [on, done]);
    await store.put('episodes', { id: 'e1', flowId: 'energize', startedAt: 500, marks: [], done: [], fixationId: 'fx-a' });
    const file = await roundTrip(db);
    expect(file.tables.fixations).toHaveLength(2);
    const other = await freshDB();
    await importData(file, 'replace', other);
    expect(await store.get('fixations', 'fx-a')).toEqual(on);
    expect(await store.get('fixations', 'fx-b')).toEqual(done);
    expect((await store.get('episodes', 'e1'))!.fixationId).toBe('fx-a');
    // a merge: the file's newer row wins, this phone's newer row stays
    const third = await freshDB();
    await store.bulkPut('fixations', [{ ...on, name: 'older here', updatedAt: 250 }, { ...done, name: 'newer here', updatedAt: 900 }]);
    expect(await importData(file, 'merge', third)).toMatchObject({ updated: 1 });
    expect((await store.get('fixations', 'fx-a'))!.name).toBe('FlowState');
    expect((await store.get('fixations', 'fx-b'))!.name).toBe('newer here');
  });

  it('a version 4 file (before the fixations) imports cleanly with none, and the seed pass writes them next open', async () => {
    const v4 = {
      app: 'flowstate', schemaVersion: 4, exportedAt: 1,
      tables: {
        settings: [{ id: 'app', light: 'sky', stillAfterMidnight: 'offer', sounds: true, haptics: true, lock: { enabled: false, relockAfterMin: 5 }, cleaned: ['seed-pages'] }],
        voices: [], pages: [], messages: [], paradoxes: [], items: [], leans: [], backups: [], albums: [], playlists: [], shelves: [], flows: [],
        episodes: [{ id: 'e1', flowId: 'energize', startedAt: 1, marks: [], done: [] }],
        sits: [{ id: 's1', startedAt: 1, endedAt: 70_001, sound: 'rain' }],
      },
    };
    const f = parseBackup(JSON.stringify(v4));
    expect(f.schemaVersion).toBe(SCHEMA_VERSION);
    expect(f.tables.fixations).toEqual([]);
    await importData(f, 'replace', db);
    expect(await db.fixations.count()).toBe(0);
    expect(await db.sits.count()).toBe(1);
    expect(await db.episodes.get('e1')).toBeTruthy();
    expect(await seedFixationsOnce()).toHaveLength(7);
  });

  it('replace makes the database the file', async () => {
    await ensureSeeded();
    const file = await roundTrip(db);
    await store.put('messages', { id: 'extra', pageId: 'p', at: 1, text: 'not in the file', kept: false });
    await importData(file, 'replace', db);
    expect(await db.messages.get('extra')).toBeUndefined();
  });

  it('replace keeps this phone\'s settings when the file has none', async () => {
    await ensureSeeded(5);
    const file = await roundTrip(db);
    file.tables.settings = [];
    await importData(file, 'replace', db);
    expect((await db.settings.get('app'))!.seededAt).toBe(5);
  });
});

describe('merge', () => {
  it('keys on id and the newest updatedAt wins', async () => {
    await ensureSeeded();
    await store.put('pages', { id: 'p1', kind: 'entry', createdAt: 10, updatedAt: 20, state: 'open', tags: ['mine'], paradoxIds: [], linkedPageIds: [] });
    await store.put('pages', { id: 'p2', kind: 'entry', createdAt: 10, updatedAt: 50, state: 'open', tags: ['mine'], paradoxIds: [], linkedPageIds: [] });
    const file = await roundTrip(db);
    const pages = file.tables.pages as { id: string; updatedAt: number; tags: string[] }[];
    Object.assign(pages.find(p => p.id === 'p1')!, { updatedAt: 30, tags: ['theirs'] }); // newer: wins
    Object.assign(pages.find(p => p.id === 'p2')!, { updatedAt: 40, tags: ['theirs'] }); // older: loses
    pages.push({ ...pages[0], id: 'p3', updatedAt: 1, tags: ['new'] } as never);           // new: added
    const r = await importData(file, 'merge', db);
    expect((await db.pages.get('p1'))!.tags).toEqual(['theirs']);
    expect((await db.pages.get('p2'))!.tags).toEqual(['mine']);
    expect((await db.pages.get('p3'))!.tags).toEqual(['new']);
    expect(r.added).toBe(1);
    expect(r.updated).toBe(1);
  });

  it('keeps this phone\'s settings', async () => {
    await ensureSeeded();
    const file = await roundTrip(db);
    (file.tables.settings[0] as { light: string }).light = 'night';
    await importData(file, 'merge', db);
    expect((await db.settings.get('app'))!.light).toBe('sky');
  });

  it('stamps rows by updatedAt, then at, then the newest revision, then createdAt', () => {
    expect(stamp({ updatedAt: 5, at: 9 })).toBe(5);
    expect(stamp({ at: 9 })).toBe(9);
    expect(stamp({ revisions: [{ at: 3 }, { at: 8 }] })).toBe(8);
    expect(stamp({ createdAt: 2 })).toBe(2);
    expect(stamp({})).toBe(0);
  });
});

describe('deleted stays deleted (PLAN-VALUES.md C0, from PLAN-SELF.md section 4)', () => {
  const pole = (value: string) => ({ value, aspect: '' });
  const paradox = (id: string, createdAt: number) => ({ id, poleA: pole('a'), poleB: pole('b'), status: 'active' as const, createdAt, updatedAt: createdAt, revisions: [] });
  // the delete as a later package writes it: rows gone and ids tombstoned in one store.tx
  const forget = (ids: string[]) => store.tx(['paradoxes', 'items', 'leans', 'pages', 'fixations', 'settings'], async tb => {
    for (const id of ids) {
      await tb('paradoxes').delete(id);
      await tb('items').delete(id);
      await tb('items').where('paradoxId').equals(id).delete();
      await tb('leans').where('paradoxId').equals(id).delete();
      await tb('fixations').delete(id);
    }
    await tombstone(tb, ids);
  });
  async function journal() {
    await db.settings.put(defaultSettings(1));
    await store.bulkPut('paradoxes', [paradox('p', 1), paradox('q', 2)]);
    const goal = (id: string, paradoxId: string, pole: 'a' | 'b', pairId?: string) =>
      ({ id, paradoxId, pole, text: id, lean: 0.5, cadence: 'daily' as const, doneLog: [], order: 0, ...(pairId ? { pairId, nextTo: pairId } : {}) });
    await store.bulkPut('items', [goal('x', 'q', 'a', 'y'), goal('y', 'q', 'b', 'x'), goal('z', 'p', 'a')]);
    await store.put('leans', { id: 'l1', paradoxId: 'p', at: 3, lean: 0.2, note: 'a lean' });
    await store.put('pages', { id: 'pg', kind: 'entry', createdAt: 4, updatedAt: 4, state: 'open', tags: [], paradoxIds: ['p', 'q'], linkedPageIds: [] });
    await store.put('fixations', { id: 'fx', name: 'FlowState', hue: 250, createdAt: 1, stints: [], updatedAt: 1 });
    return roundTrip(db);
  }

  it('a merge of a file taken before the delete brings back no tombstoned row, nothing it owns, and no link to it', async () => {
    const file = await journal();
    // the file was edited after (another phone): a newer page still linking p, and a goal new here paired with x
    const t = file.tables as unknown as Record<string, Record<string, unknown>[]>;
    t.pages = t.pages.map(pg => ({ ...pg, updatedAt: 9 }));
    t.items.push({ ...t.items.find(i => i.id === 'y')!, id: 'w', pairId: 'x', nextTo: 'x' });
    await forget(['p', 'x', 'fx']);
    expect((await db.settings.get('app'))!.deleted).toEqual(['p', 'x', 'fx']);
    await importData(file, 'merge', db);
    expect(await db.paradoxes.get('p')).toBeUndefined();
    expect(await db.items.get('z')).toBeUndefined(); // owned by p
    expect(await db.leans.get('l1')).toBeUndefined(); // owned by p
    expect(await db.items.get('x')).toBeUndefined();
    expect(await db.fixations.get('fx')).toBeUndefined(); // any table's row id works
    expect((await db.pages.get('pg'))!.paradoxIds).toEqual(['q']);
    expect((await db.pages.get('pg'))!.updatedAt).toBe(9); // the newer page won, less its link to p
    const w = (await store.get('items', 'w'))!;
    expect(w.paradoxId).toBe('q');
    expect(w.pairId).toBeUndefined();
    expect(w.nextTo).toBeUndefined();
    expect(await db.paradoxes.get('q')).toBeDefined();
  });

  it('a merge keeps this phone\'s list, not the file\'s', async () => {
    await journal();
    await forget(['fx']);
    const file = await roundTrip(db);
    const other = await freshDB();
    // the other phone still has fx (the file's list names it) and deleted q (the file holds it)
    await other.settings.put({ ...defaultSettings(1), deleted: ['q'] });
    await other.fixations.put({ id: 'fx', name: 'FlowState', hue: 250, createdAt: 1, stints: [], updatedAt: 1 });
    await importData(file, 'merge', other);
    expect((await other.settings.get('app'))!.deleted).toEqual(['q']);
    expect(await other.fixations.get('fx')).toBeDefined();
    expect(await other.paradoxes.get('q')).toBeUndefined();
  });

  it('a replace import takes the file\'s list and restores what the file holds', async () => {
    const before = await journal();
    await forget(['fx']);
    const after = await roundTrip(db); // its list holds fx
    await forget(['p']);
    await importData(after, 'replace', db);
    expect((await db.settings.get('app'))!.deleted).toEqual(['fx']);
    expect(await db.paradoxes.get('p')).toBeDefined();
    // the file's list now guards a merge: an older file brings p back (p is not on it) but never fx
    await importData(before, 'merge', db);
    expect(await db.paradoxes.get('p')).toBeDefined();
    expect(await db.fixations.get('fx')).toBeUndefined();
    // a replace from a file whose list is empty clears it, and the file's rows come back
    await importData(before, 'replace', db);
    expect((await db.settings.get('app'))!.deleted).toBeUndefined();
    expect(await db.fixations.get('fx')).toBeDefined();
  });

  it('a replace from a file with no settings row clears the list as well', async () => {
    const file = await journal();
    await forget(['p']);
    await importData({ ...file, tables: { ...file.tables, settings: [] } }, 'replace', db);
    expect((await db.settings.get('app'))!.deleted).toBeUndefined();
    expect(await db.paradoxes.get('p')).toBeDefined();
  });
});

describe('import validation', () => {
  it('refuses what is not a FlowState file', () => {
    expect(() => parseBackup('nope')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"other","schemaVersion":1,"tables":{}}')).toThrow('Not a FlowState file');
  });
  it('refuses a missing or newer schema version', () => {
    expect(() => parseBackup('{"app":"flowstate","tables":{}}')).toThrow('No schema version');
    expect(() => parseBackup(`{"app":"flowstate","schemaVersion":${SCHEMA_VERSION + 1},"tables":{}}`)).toThrow('newer');
  });
  it('refuses a damaged table', () => {
    expect(() => parseBackup('{"app":"flowstate","schemaVersion":1,"tables":{"pages":[{"no":"id"}]}}')).toThrow('Damaged table: pages');
  });
  it('fills absent tables with nothing', () => {
    const f = parseBackup('{"app":"flowstate","schemaVersion":1,"exportedAt":1,"tables":{}}');
    expect(f.tables.voices).toEqual([]);
  });
  it('refuses any import while locked: there is no key to store the rows with', async () => {
    await ensureSeeded();
    const plain = await roundTrip(db);
    const salt = randomSalt();
    await setKey(await deriveKey('1', salt, 1000), { salt, iterations: 1000 });
    lock();
    await expect(importData(plain, 'merge', db)).rejects.toBeInstanceOf(LockedError);
  });
});

describe('encrypted export and import (package 6)', () => {
  const FAST = 1000;
  const raw = async (d: FlowDB) => JSON.stringify(await Promise.all(d.tables.map(t => t.toArray())));
  async function sealWith(d: FlowDB, pin: string) {
    await init(d);
    const salt = randomSalt();
    await setKey(await deriveKey(pin, salt, FAST), { salt, iterations: FAST, digits: pin.length });
    return salt;
  }
  async function sealedFile(pin = '3569') {
    await ensureSeeded();
    await store.put('messages', { id: 'm1', pageId: 'pg-manifesto', at: 9, text: 'Wait out the truly hard parts', kept: false });
    await store.put('pages', { id: 'q1', kind: 'question', createdAt: 1, updatedAt: 1, state: 'open', tags: [], paradoxIds: [], linkedPageIds: [], title: 'How can I gauge my pleasure/pain barometer?' });
    await sealWith(db, pin);
    return roundTrip(db);
  }
  const fileKey = (file: Awaited<ReturnType<typeof roundTrip>>, pin: string) => deriveKey(pin, file.salt!, file.iterations!);

  it('export writes the sealed rows as stored, with salt, iterations and verifier in the header', async () => {
    const file = await sealedFile();
    expect(file.encrypted).toBe(true);
    expect(file.iterations).toBe(FAST);
    expect(file.digits).toBe(4);
    expect(fileLock(file)!.verifier).toEqual((await db.settings.get('app'))!.lock.verifier);
    const text = JSON.stringify(file);
    for (const s of ['Wait out the truly hard parts', 'barometer', 'I choose how to flow.', 'vegetable chopping']) expect(text).not.toContain(s);
  });

  it('a plain journal exports a plain file', async () => {
    await ensureSeeded();
    const file = await roundTrip(db);
    expect(file.encrypted).toBeUndefined();
    expect(fileLock(file)).toBeNull();
  });

  it('round-trips with the same PIN: every row opens, then is sealed again with this journal\'s key', async () => {
    const file = await sealedFile('3569');
    const other = await freshDB();
    await ensureSeeded();
    await sealWith(other, '3569'); // same PIN, its own salt
    await expect(importData(file, 'replace', other)).rejects.toBeInstanceOf(NeedsPinError);
    await importData(file, 'replace', other, await fileKey(file, '3569'));
    expect(await raw(other)).not.toContain('Wait out the truly hard parts');
    lock();
    const s = (await other.settings.get('app'))!;
    expect(s.lock.salt).not.toBe(file.salt); // this phone's lock stayed this phone's
    expect(await unlock(await deriveKey('3569', s.lock.salt!, FAST))).toBe(true);
    expect((await store.get('messages', 'm1'))!.text).toBe('Wait out the truly hard parts');
    expect((await store.get('pages', 'q1'))!.title).toBe('How can I gauge my pleasure/pain barometer?');
  });

  it('round-trips into a journal with a different current PIN', async () => {
    const file = await sealedFile('3569');
    const other = await freshDB();
    await ensureSeeded();
    const salt = await sealWith(other, '76937');
    await importData(file, 'merge', other, await fileKey(file, '3569'));
    lock();
    expect(await unlock(await deriveKey('3569', salt, FAST))).toBe(false);
    expect(await unlock(await deriveKey('76937', salt, FAST))).toBe(true);
    expect((await store.get('messages', 'm1'))!.text).toBe('Wait out the truly hard parts');
    expect((await other.messages.get('m1'))!.text).toBe('');
  });

  it('a sealed file imports into a journal with no PIN as plain rows', async () => {
    const file = await sealedFile('3569');
    const other = await freshDB();
    await importData(file, 'replace', other, await fileKey(file, '3569'));
    expect(keyState()).toBe('plain');
    expect((await other.messages.get('m1'))!.text).toBe('Wait out the truly hard parts');
    expect((await other.settings.get('app'))!.lock.enabled).toBe(false);
  });

  it('a plain file imports into a sealed journal sealed with the current key', async () => {
    await ensureSeeded();
    await store.put('messages', { id: 'm2', pageId: 'pg-manifesto', at: 9, text: 'stand tall, young one', kept: false });
    const plain = await roundTrip(db);
    const other = await freshDB();
    await ensureSeeded();
    const salt = await sealWith(other, '3569');
    await importData(plain, 'replace', other);
    expect(await raw(other)).not.toContain('stand tall');
    const s = (await other.settings.get('app'))!;
    expect(s.lock.enabled).toBe(true); // the file's plain lock did not turn this one off
    lock();
    expect(await unlock(await deriveKey('3569', salt, FAST))).toBe(true);
    expect((await store.get('messages', 'm2'))!.text).toBe('stand tall, young one');
  });

  it('the wrong PIN for the file is refused and nothing is written', async () => {
    const file = await sealedFile('3569');
    const other = await freshDB();
    await ensureSeeded();
    await sealWith(other, '3569');
    const before = await raw(other);
    await expect(importData(file, 'replace', other, await fileKey(file, '0000'))).rejects.toThrow('Not that one');
    expect(await raw(other)).toBe(before);
  });

  it('a sealed file whose header is gone is damaged, not opened', async () => {
    const file = await sealedFile();
    delete file.salt;
    expect(() => fileLock(file)).toThrow(BackupError);
  });
});
