import { describe, it, expect } from 'vitest';
import { freshDB } from './helpers';
import { SCHEMA_VERSION, TABLES } from '../../src/db/schema';

describe('schema, version 1', () => {
  it('has every table from PLAN.md section 4', async () => {
    const db = await freshDB();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(db.tables.map(t => t.name).sort()).toEqual([...TABLES].sort());
    expect(TABLES).toEqual(['settings', 'voices', 'pages', 'messages', 'paradoxes', 'items', 'leans', 'backups', 'albums']);
  });

  it('carries the listed indexes', async () => {
    const db = await freshDB();
    const idx = (t: string) => db.table(t).schema.indexes.map(i => i.src).sort();
    expect(idx('pages')).toEqual(['*paradoxIds', '*tags', 'createdAt', 'kind', 'state']);
    expect(idx('messages')).toEqual(['[pageId+at]']);
    expect(idx('items')).toEqual(['paradoxId']);
    expect(idx('leans')).toEqual(['[paradoxId+at]']);
    expect(db.table('albums').schema.primKey.name).toBe('albumUri');
    expect(db.table('settings').schema.primKey.name).toBe('id');
  });
});
