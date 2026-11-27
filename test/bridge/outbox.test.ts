// The outbox's rules (PLAN-WORLDS.md section 5, W2), each one: what travels and what never does, a kept line then
// unkept, edits collapsing, an acknowledgement only for what was not written again, nothing while locked, nothing from
// the personal notebook (section 3's no-leak test), and nothing that came down from the bible.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Dexie from 'dexie';
import { openDB, DB_NAME, TABLES, type FlowDB, type Tables, type TableName } from '../../src/db/schema';
import { init, store, setKey, lock, unlock, type Handed } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { newCouncil, speak, keepClose, editMessage, addVoice } from '../../src/model/council';
import { writeLine, askQuestion, setKept } from '../../src/model/pages';
import { readBatch, settle, sendOnce, drain } from '../../src/bridge/up';
import { applyPocket } from '../../src/bridge/down';
import { exportData, importData } from '../../src/db/backup';
import { worldDB, settled, fakeBridge } from './helpers';

const WORLD = 'eastwinds';
let db: FlowDB;
let h: Handed;
beforeEach(async () => { ({ db, h } = await worldDB()); });
afterEach(() => { vi.restoreAllMocks(); });

const outbox = async () => (await db.outbox.orderBy('n').toArray()).map(o => `${o.table} ${o.id}`);
const entry = async (text: string, kept = false) => {
  const r = (await writeLine(undefined, undefined, { text }, Date.now(), { kind: 'entry' }))!;
  if (kept) await setKept(r.message!, true);
  return r;
};

/** One row in every table, written through the fields layer, as a notebook in use would hold. */
function everyRow(): { [K in TableName]?: Tables[K][] } {
  const now = 1_700_000_000_000;
  return {
    settings: [{ id: 'app', light: 'sky', stillAfterMidnight: 'offer', sounds: true, haptics: true, lock: { enabled: false, relockAfterMin: 5 } }],
    voices: [{ id: 'v1', name: 'Kid', aka: [], colour: { hue: 25 }, shade: 'light', starred: false, order: 0, archived: false, revisions: [] }],
    pages: [
      { id: 'pe', kind: 'entry', createdAt: now, updatedAt: now, state: 'open', tags: [], paradoxIds: [], linkedPageIds: [] },
      { id: 'pc', kind: 'council', createdAt: now, updatedAt: now, state: 'open', tags: [], paradoxIds: [], linkedPageIds: [] },
      { id: 'pq', kind: 'question', title: 'Why?', createdAt: now, updatedAt: now, state: 'open', tags: [], paradoxIds: [], linkedPageIds: [] },
    ],
    messages: [
      { id: 'me', pageId: 'pe', at: now, text: 'kept', kept: true },
      { id: 'mc', pageId: 'pc', at: now, text: 'council', kept: false },
      { id: 'mq', pageId: 'pq', at: now, text: 'answer', kept: false, wise: true },
    ],
    paradoxes: [{ id: 'px', createdAt: now, updatedAt: now, status: 'active', poleA: { value: 'a', aspect: 'x' }, poleB: { value: 'b', aspect: 'y' }, revisions: [] }],
    items: [{ id: 'i1', paradoxId: 'px', pole: 'a', text: 'go', lean: 0, doneLog: [], order: 0 }],
    leans: [{ id: 'l1', paradoxId: 'px', at: now, lean: 0, note: 'n' }],
    backups: [{ id: 'b1', at: now, bytes: 1, encrypted: false }],
    albums: [{ albumUri: 'spotify:album:x', album: 'X', artist: 'Y' }],
    playlists: [{ id: 'pl', name: 'P', uri: 'spotify:playlist:pl', order: 0, snapshotId: '', total: 0, chosen: true }],
    shelves: [{ playlistId: 'pl', albumUri: 'spotify:album:x', order: 0, firstTrackUri: '' }],
    flows: [{ id: 'f1', name: 'F', order: 0, createdAt: now, updatedAt: now, diagram: 'ring', steps: [], revisions: [] }],
    episodes: [{ id: 'e1', flowId: 'f1', startedAt: now, marks: [], done: [] }],
    sits: [{ id: 's1', startedAt: now, endedAt: now + 1, sound: 'rain' }],
    fixations: [{ id: 'fx', name: 'F', hue: 10, createdAt: now, stints: [] }],
    values: [{ id: 'va', createdAt: now, updatedAt: now, status: 'held', word: 'Brave', champions: [], revisions: [] }],
    readings: [{ id: 'r1', at: now, of: 'mountain', value: 0.2 }],
    signShelves: [{ id: 'heart', picks: [], updatedAt: now }],
    marks: [{ id: 'mk', chakra: 'heart', touch: 'ask', text: 't', at: now }],
    days: [{ id: '2026-11-25', basics: ['ate'], updatedAt: now }],
    inquiries: [{ id: 'q1', askedAt: now, question: 'Does it?', state: 'done', picks: [] }],
    papers: [{ id: 'doi:1', title: 'T', abstract: [], kind: 'Review', tier: 1, url: 'u', source: 'crossref', fetchedAt: now }],
    songs: [{ id: 'sg', createdAt: now, updatedAt: now, title: 'Low tide', lyric: 'la', sections: [] }],
    takes: [{ id: 'tk', songId: 'sg', at: now, seconds: 3, audio: new Uint8Array([1, 2]).buffer, pitch: [1, 2] }],
  };
}

describe('the personal notebook (section 3: no leak by construction)', () => {
  it('opens the personal notebook, writes in every table, and the outbox stays empty with no request made', async () => {
    await Dexie.delete(DB_NAME);
    const home = openDB(DB_NAME);
    await home.open();
    await init(home);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const rows = everyRow();
    for (const t of TABLES.filter(t => t !== 'outbox')) expect(rows[t]?.length, t).toBeTruthy();
    for (const t of Object.keys(rows) as TableName[]) await store.bulkPut(t, rows[t] as never);
    await store.many({ pages: rows.pages, messages: rows.messages, inquiries: rows.inquiries, songs: rows.songs, takes: rows.takes });
    // and the ways the app really writes
    const c = await newCouncil();
    await speak(c.id, 'A line at a council');
    const e = (await writeLine(undefined, undefined, { text: 'A journal line' }, Date.now(), { kind: 'entry' }))!;
    await keepClose(e.message!.id);
    await askQuestion('A question');
    await store.delete('messages', 'mc');
    await store.tx(['pages', 'messages'], async tb => { await tb('messages').where('[pageId+at]').between(['pq', -Infinity], ['pq', Infinity]).delete(); await tb('pages').delete('pq'); });
    const salt = randomSalt();
    await setKey(await deriveKey('2580', salt, 1000), { salt, iterations: 1000 });
    await speak(c.id, 'sealed now');
    await settled();
    expect(await home.outbox.count()).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    home.close();
  });
});

describe('what travels from a world', () => {
  it('a council page and every line on it', async () => {
    const c = await newCouncil();
    const m = await speak(c.id, 'Dawn would not have said that');
    expect(await outbox()).toEqual([`pages ${c.id}`, `messages ${m.id}`]);
  });
  it('a question page and its lines', async () => {
    const q = await askQuestion('Does the river freeze in 2071?');
    const r = (await writeLine(q, undefined, { text: 'Only the edges' }, Date.now(), { kind: 'question' }))!;
    expect(await outbox()).toEqual([`pages ${q.id}`, `messages ${r.message!.id}`]);
  });
  it('a journal page never, and its lines only while kept; unkept, the line goes once more, as a delete', async () => {
    const r = await entry('She keeps it for a year');
    await entry('Another line, never kept');
    expect(await outbox()).toEqual([]);
    await setKept(r.message!, true);
    expect(await outbox()).toEqual([`messages ${r.message!.id}`]);
    let b = (await readBatch(h, WORLD))!;
    expect(b.envelopes).toHaveLength(1);
    expect(b.envelopes[0].row).toMatchObject({ id: r.message!.id, text: 'She keeps it for a year', kind: 'kept', date: r.page.createdAt, chips: { characterIds: [], placeIds: [] } });
    // no year worn when it was written: no year is sent (null would say the whole book; W4 review finding 4)
    expect(b.envelopes[0].row).not.toHaveProperty('year');
    // never the page or its other lines
    expect(b.envelopes[0].row).not.toHaveProperty('pageId');
    expect(b.body).not.toContain('Another line');
    await settle(h, b, b.envelopes.map(e => ({ table: e.table, id: e.id, rev: e.rev, result: 'stored' as const })));
    expect(await outbox()).toEqual([]);
    await setKept({ ...(await store.get('messages', r.message!.id))! }, false);
    b = (await readBatch(h, WORLD))!;
    expect(b.envelopes).toEqual([{ world: WORLD, table: 'messages', id: r.message!.id, rev: expect.any(Number), deleted: true }]);
    // edited while unkept: nothing goes
    await settle(h, b, b.envelopes.map(e => ({ table: e.table, id: e.id, rev: e.rev, result: 'stored' as const })));
    await writeLine(r.page, r.message!.id, { text: 'edited, still not kept' }, Date.now());
    expect(await outbox()).toEqual([]);
  });
  it('a kept line carries its own chips and its page\'s year, and goes again when the page\'s year changes', async () => {
    const r = await entry('Dawn at the gate', true);
    await store.put('messages', { ...(await store.get('messages', r.message!.id))!, chips: { characterIds: ['dawn'], placeIds: ['gate'] } });
    await drainAll();
    await store.put('pages', { ...(await store.get('pages', r.page.id))!, year: 2071 });
    const b = (await readBatch(h, WORLD))!;
    expect(b.envelopes.map(e => e.row)).toEqual([expect.objectContaining({ year: 2071, chips: { characterIds: ['dawn'], placeIds: ['gate'] } })]);
  });
  it('a kept journal line deleted goes up as a delete; an unkept one deleted sends nothing', async () => {
    const kept = await entry('kept then gone', true);
    const plain = await entry('never kept, then gone');
    await drainAll();
    await store.delete('messages', kept.message!.id);
    await store.delete('messages', plain.message!.id);
    expect(await outbox()).toEqual([`messages ${kept.message!.id}`]);
    expect((await readBatch(h, WORLD))!.envelopes[0]).toMatchObject({ deleted: true });
  });
  it('inquiries, songs and takes, always; a take without its audio', async () => {
    const rows = everyRow();
    await store.put('inquiries', rows.inquiries![0]);
    await store.put('papers', rows.papers![0]);
    await store.put('songs', rows.songs![0]);
    await store.put('takes', rows.takes![0]);
    expect(await outbox()).toEqual(['inquiries q1', 'songs sg', 'takes tk']);
    const b = (await readBatch(h, WORLD))!;
    expect(b.envelopes.find(e => e.table === 'takes')!.row).not.toHaveProperty('audio');
    expect(b.envelopes.find(e => e.table === 'songs')!.row).toMatchObject({ title: 'Low tide', lyric: 'la' });
  });
  it('values, voices, and every other table never enter it', async () => {
    const rows = everyRow();
    const never = TABLES.filter(t => !['pages', 'messages', 'inquiries', 'songs', 'takes', 'outbox'].includes(t));
    for (const t of never) await store.bulkPut(t, rows[t] as never);
    await addVoice({ name: 'Warrior', colour: { hue: 30 } } as never).catch(() => undefined);
    expect(await outbox()).toEqual([]);
  });
  it('a council page deleted with its lines in one transaction goes up as deletes', async () => {
    const c = await newCouncil();
    const m = await speak(c.id, 'soon gone');
    await drainAll();
    await store.tx(['pages', 'messages'], async tb => {
      await tb('messages').where('[pageId+at]').between([c.id, -Infinity], [c.id, Infinity]).delete();
      await tb('pages').delete(c.id);
    });
    const b = (await readBatch(h, WORLD))!;
    expect(b.envelopes.map(e => [e.table, e.id, e.deleted])).toEqual([['messages', m.id, true], ['pages', c.id, true]]);
  });
});

async function drainAll() {
  const { fetcher } = fakeBridge();
  await drain(h, WORLD, 'tok', fetcher);
}

describe('edits collapse, and acknowledgements clear only what did not change', () => {
  it('five edits to a line before a send are one envelope, built from the line as it stands, with the newest rev', async () => {
    const c = await newCouncil();
    const m = await speak(c.id, 'one');
    const revs: number[] = [];
    for (const t of ['two', 'three', 'four', 'five']) {
      await editMessage(m.id, t);
      revs.push((await db.outbox.where('[table+id]').equals(['messages', m.id]).first())!.rev);
    }
    expect(revs).toEqual([...revs].sort((a, b) => a - b));
    expect(new Set(revs).size).toBe(4);
    expect(await outbox()).toEqual([`messages ${m.id}`, `pages ${c.id}`]);
    const b = (await readBatch(h, WORLD))!;
    expect(b.envelopes.find(e => e.id === m.id)).toMatchObject({ rev: revs[3], row: { text: 'five' } });
  });
  it('a line written again after it was read for sending stays in the outbox when the send is acknowledged', async () => {
    const c = await newCouncil();
    const m = await speak(c.id, 'first');
    const b = (await readBatch(h, WORLD))!;
    await editMessage(m.id, 'second');
    await settle(h, b, b.envelopes.map(e => ({ table: e.table, id: e.id, rev: e.rev, result: 'stored' as const })));
    expect(await outbox()).toEqual([`messages ${m.id}`, `pages ${c.id}`]);
    const next = (await readBatch(h, WORLD))!;
    expect(next.envelopes.find(e => e.id === m.id)!.row).toMatchObject({ text: 'second' });
  });
  it('a refused envelope stays; stored, same and older clear', async () => {
    const c = await newCouncil();
    const m = await speak(c.id, 'x');
    const b = (await readBatch(h, WORLD))!;
    await settle(h, b, [{ table: 'pages', id: c.id, rev: 1, result: 'older' }, { table: 'messages', id: m.id, rev: 1, result: 'refused', reason: 'size' }]);
    expect(await outbox()).toEqual([`messages ${m.id}`]);
  });
  it('a resend after a lost answer is the same rev, so the function answers "same"', async () => {
    const c = await newCouncil();
    await speak(c.id, 'x');
    const bridge = fakeBridge();
    const b = (await readBatch(h, WORLD))!;
    await bridge.fetcher('/x', { method: 'POST', body: b.body }); // arrived, but the phone never heard
    expect(await outbox()).toHaveLength(2);
    await sendOnce(h, WORLD, 'tok', { fetcher: bridge.fetcher });
    expect(await outbox()).toEqual([]);
    expect(bridge.kept.size).toBe(2);
  });
});

describe('locked and offline', () => {
  it('nothing goes up while the notebook is locked; unlocked, it does', async () => {
    await store.put('settings', everyRow().settings![0]);
    const salt = randomSalt();
    const key = await deriveKey('2580', salt, 1000);
    await setKey(key, { salt, iterations: 1000 });
    const c = await newCouncil();
    await speak(c.id, 'sealed');
    // a PIN change re-seals rows: it is not a write of his to send again
    await setKey(key, { salt, iterations: 1000 });
    expect(await outbox()).toHaveLength(2);
    lock();
    const bridge = fakeBridge();
    expect(await readBatch(h, WORLD)).toBeNull();
    expect(await sendOnce(h, WORLD, 'tok', { fetcher: bridge.fetcher })).toBeNull();
    expect(bridge.calls).toEqual([]);
    expect(await unlock(key)).toBe(true);
    await sendOnce(h, WORLD, 'tok', { fetcher: bridge.fetcher });
    expect(bridge.calls).toHaveLength(1);
    expect(String(bridge.calls[0].init!.body)).toContain('sealed');
    expect(await outbox()).toEqual([]);
  });
  it('offline, the outbox waits whole; online, it drains', async () => {
    let off = true;
    const bridge = fakeBridge({ offline: () => off });
    const c = await newCouncil();
    await speak(c.id, 'in a tunnel');
    await expect(sendOnce(h, WORLD, 'tok', { fetcher: bridge.fetcher })).rejects.toMatchObject({ status: 'offline' });
    expect(await outbox()).toHaveLength(2);
    off = false;
    await drain(h, WORLD, 'tok', bridge.fetcher);
    expect(await outbox()).toEqual([]);
  });
  it('a send as the app is hidden keeps its body under the keepalive budget and asks for keepalive', async () => {
    const c = await newCouncil();
    for (let i = 0; i < 12; i++) await speak(c.id, `${i} ${'x'.repeat(8000)}`);
    const bridge = fakeBridge();
    await sendOnce(h, WORLD, 'tok', { keepalive: true, fetcher: bridge.fetcher });
    const sent = bridge.calls[0];
    expect(sent.init!.keepalive).toBe(true);
    expect(new TextEncoder().encode(String(sent.init!.body)).length).toBeLessThanOrEqual(60 * 1024);
    // what did not fit is still waiting
    expect((await outbox()).length).toBeGreaterThan(0);
  });
});

describe('what comes down never goes back up', () => {
  it('voices and question pages written from the pocket leave the outbox empty; his own line under one goes up', async () => {
    await applyPocket(h, {
      kind: 'novel', places: [], chapters: [], events: [],
      characters: [{ id: 'dawn', fullName: 'Dawn Li', firstName: 'Dawn', familyColour: '#3366cc' }],
      questions: [{ id: 'q-river', question: 'Does the river freeze?', state: 'decided', decision: 'Only the edges', changedAt: 5 }],
    });
    await settled();
    expect(await outbox()).toEqual([]);
    expect(await db.voices.count()).toBe(1);
    const q = (await store.get('pages', 'q-river'))!;
    const r = (await writeLine(q, undefined, { text: 'and the ice sings' }, Date.now()))!;
    expect(await outbox()).toEqual(['pages q-river', `messages ${r.message!.id}`]);
  });
  it('an import into a world records nothing to send, and the file carries no outbox', async () => {
    const c = await newCouncil();
    await speak(c.id, 'from a file');
    const file = await exportData(db);
    expect(file.notebook).toBe('eastwinds');
    expect(file.tables).not.toHaveProperty('outbox');
    await db.outbox.clear();
    await importData(file, 'replace', db);
    expect(await db.outbox.count()).toBe(0);
    expect(await db.pages.count()).toBe(1);
  });
});

describe('FlowState never sends another client\'s table (review of #116, finding 2)', () => {
  it('its own pre-send check is the five TRAVELS: a companion envelope is refused there', async () => {
    const { envelopeProblem, UP_TABLES } = await import('../../src/bridge/protocol');
    const e = { world: 'songbook', table: 'companion', id: 'mac-tide', rev: 5, deleted: true };
    expect(envelopeProblem(e, 'songbook')).toBe('table');
    // only the function, which passes UP_TABLES and the world's kind, accepts it
    expect(envelopeProblem(e, 'songbook', UP_TABLES, 'songs')).toBeNull();
  });
  it('a stray outbox row of a table it does not send leaves unsent, never as a take\'s delete under that table', async () => {
    const { worldDB: w } = await import('./helpers');
    const { db: sdb, h: sh } = await w('songbook');
    await sdb.outbox.add({ table: 'companion' as never, id: 'mac-tide', rev: 5, at: 5 });
    await sdb.outbox.add({ table: 'notes' as never, id: 'n1', rev: 6, at: 6 });
    const b = (await readBatch(sh, 'songbook'))!;
    expect(b.envelopes).toEqual([]);
    expect(JSON.parse(b.body).envelopes).toEqual([]);
    expect(b.drops).toHaveLength(2);
    const f = fakeBridge();
    await drain(sh, 'songbook', 'tok', f.fetcher);
    expect(f.calls).toHaveLength(0);
    expect(await sdb.outbox.count()).toBe(0);
  });
});
