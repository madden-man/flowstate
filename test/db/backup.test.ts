import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from './helpers';
import { type FlowDB, SCHEMA_VERSION, POEMS_ID } from '../../src/db/schema';
import { exportData, importData, parseBackup, BackupError, NeedsPinError, stamp, fileName, fileLock } from '../../src/db/backup';
import { ensureSeeded } from '../../src/db/seed';
import { store, setKey, lock, unlock, init, keyState, LockedError } from '../../src/db/fields';
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
    const cover = (await other.albums.get('spotify:album:1'))!.cover!;
    expect(cover.type).toBe('image/jpeg');
    expect([...new Uint8Array(await cover.arrayBuffer())]).toEqual([1, 2, 3, 250]);
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
    expect([...new Uint8Array(await cover.arrayBuffer())]).toEqual([4, 5]);
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
    expect([...new Uint8Array(await (await db.albums.get('spotify:album:1'))!.cover!.arrayBuffer())]).toEqual([1, 2]);
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
