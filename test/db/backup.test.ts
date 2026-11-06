import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from './helpers';
import { type FlowDB, SCHEMA_VERSION } from '../../src/db/schema';
import { exportData, importData, parseBackup, BackupError, stamp, fileName } from '../../src/db/backup';
import { ensureSeeded } from '../../src/db/seed';
import { store, setKey } from '../../src/db/fields';
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
  it('refuses a file sealed with a PIN while this journal has none, and any import while the lock is on', async () => {
    await ensureSeeded();
    const salt = randomSalt();
    await setKey(await deriveKey('1', salt, 1000), { salt, iterations: 1000 });
    const sealed = await roundTrip(db);
    await expect(importData(sealed, 'merge', db)).rejects.toThrow();
    const plainDb = await freshDB();
    await expect(importData(sealed, 'merge', plainDb)).rejects.toThrow('locked with a PIN');
  });
});
