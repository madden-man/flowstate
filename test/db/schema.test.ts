import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { freshDB } from './helpers';
import { openDB, SCHEMA_VERSION, STORES_V1, STORES_V2, STORES_V3, STORES_V4, STORES_V5, TABLES, POEMS_ID, POEMS_NAME, coverBytes } from '../../src/db/schema';

describe('schema, version 6', () => {
  it('has every table from PLAN.md section 4, V7\'s playlists and shelves, the flows (F1), the sits (S2), the fixations (X1) and the values (C1)', async () => {
    const db = await freshDB();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(6);
    expect(db.tables.map(t => t.name).sort()).toEqual([...TABLES].sort());
    expect(TABLES).toEqual(['settings', 'voices', 'pages', 'messages', 'paradoxes', 'items', 'leans', 'backups', 'albums', 'playlists', 'shelves', 'flows', 'episodes', 'sits', 'fixations', 'values']);
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
  it('a version 5 database opens at version 6 with an empty values table, writing nothing, every row kept', async () => {
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
    expect(db.verno).toBe(6);
    expect(await db.values.count()).toBe(0);
    expect(await db.paradoxes.get('px1')).toEqual(px);
    expect(await db.fixations.get('fx1')).toBeTruthy();
    db.close();
  });
});
