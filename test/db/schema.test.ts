import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { freshDB } from './helpers';
import { openDB, SCHEMA_VERSION, STORES_V1, TABLES, POEMS_ID, POEMS_NAME, coverBytes } from '../../src/db/schema';

describe('schema, version 2', () => {
  it('has every table from PLAN.md section 4, and V7\'s playlists and shelves', async () => {
    const db = await freshDB();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(2);
    expect(db.tables.map(t => t.name).sort()).toEqual([...TABLES].sort());
    expect(TABLES).toEqual(['settings', 'voices', 'pages', 'messages', 'paradoxes', 'items', 'leans', 'backups', 'albums', 'playlists', 'shelves']);
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
    expect(db.verno).toBe(2);
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
