// Two notebooks (PLAN-WORLDS.md section 3, W1): home and book in the fields layer, don and doff keeping the key, the
// settings row parted between home's row and the notebook's own, one PIN across every notebook (set, changed, removed,
// locked and unlocked, and a change stopped halfway finished by either PIN), no seeds in a world, backup per notebook,
// a cover's drawing sealed, and the structural half of the no-leak test: a write in one notebook writes nothing in another.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Dexie from 'dexie';
import { freshDB } from './helpers';
import { openDB, worldDbName, TABLES, type FlowDB, type Settings, type TableName, type Tables } from '../../src/db/schema';
import {
  store, setKey, removeKey, unlock, lock, keyState, init, home, book, worn, don, doff, peek, dress, tombstone, LockedError, lockSalts,
} from '../../src/db/fields';
import { deriveKey, randomSalt, isSealed } from '../../src/db/crypto';
import { ensureSeeded, seedFlowsOnce, seedPicksOnce, seedFixationsOnce, valuesFromParadoxesOnce, moveDoctorLineOnce, cleanSeedPages } from '../../src/db/seed';
import { exportData, importData, fileName, parseBackup, BackupError } from '../../src/db/backup';
import { saveResearchKey, researchKey } from '../../src/research/store';
import { onWrite, type WriteNote } from '../../src/db/writes';
import { settings, loadSettings, saveSettings } from '../../src/ui/settings';
import WORLDS from '../fixtures/worlds.json';

const FAST = 1000;
let db: FlowDB;
const world = (id: string) => openDB(worldDbName(db.name, id));
const rawJSON = async (d: FlowDB) => JSON.stringify(await Promise.all(d.tables.map(t => t.toArray())));
const pinKey = async (pin: string, salt: string) => deriveKey(pin, salt, FAST);

beforeEach(async () => {
  db = await freshDB();
  await ensureSeeded();
  // the registry as the bridge would leave it (test/fixtures/worlds.json)
  await db.settings.update('app', { worlds: WORLDS as Settings['worlds'] });
});
afterEach(() => vi.restoreAllMocks());

/** One row for every table, ids prefixed so a leak is easy to see. */
function rowsFor(tag: string): { [K in TableName]?: Tables[K][] } {
  const at = 1_700_000_000_000;
  return {
    voices: [{ id: `${tag}-v`, name: `${tag} voice`, aka: [], colour: { hue: 250 }, shade: 'light', starred: false, order: 9, archived: false, revisions: [] }],
    pages: [{ id: `${tag}-p`, kind: 'entry', createdAt: at, updatedAt: at, state: 'open', tags: [], paradoxIds: [], linkedPageIds: [] }],
    messages: [{ id: `${tag}-m`, pageId: `${tag}-p`, at, text: `${tag} line`, kept: true }],
    paradoxes: [{ id: `${tag}-x`, createdAt: at, updatedAt: at, status: 'active', poleA: { value: 'a', aspect: `${tag} aspect` }, poleB: { value: 'b', aspect: 'b' }, revisions: [] }],
    items: [{ id: `${tag}-i`, paradoxId: `${tag}-x`, pole: 'a', text: `${tag} goal`, lean: 0, doneLog: [], order: 0 }],
    leans: [{ id: `${tag}-l`, paradoxId: `${tag}-x`, at, lean: 0, note: `${tag} note` }],
    backups: [{ id: `${tag}-b`, at, bytes: 1, encrypted: false }],
    albums: [{ albumUri: `spotify:album:${tag}`, album: `${tag} album`, artist: 'x' }],
    playlists: [{ id: `${tag}-pl`, name: `${tag} list`, uri: 'u', order: 0, snapshotId: '', total: 1, chosen: true }],
    shelves: [{ playlistId: `${tag}-pl`, albumUri: `spotify:album:${tag}`, order: 0, firstTrackUri: 't' }],
    flows: [{ id: `${tag}-f`, name: `${tag} flow`, order: 99, createdAt: at, updatedAt: at, diagram: 'ring', steps: [], revisions: [] }],
    episodes: [{ id: `${tag}-e`, flowId: `${tag}-f`, startedAt: at, marks: [], done: [] }],
    sits: [{ id: `${tag}-s`, startedAt: at, endedAt: at + 60_000, sound: 'rain' }],
    fixations: [{ id: `${tag}-fx`, name: `${tag} fixation`, hue: 10, createdAt: at, stints: [] }],
    values: [{ id: `${tag}-val`, createdAt: at, updatedAt: at, status: 'held', word: `${tag} word`, champions: [], revisions: [] }],
    readings: [{ id: `${tag}-r`, at, of: 'mountain', value: 0.5 }],
    signShelves: [{ id: 'root', picks: [{ id: `${tag}-pk`, kind: 'book', title: `${tag} pick` }], updatedAt: at }],
    marks: [{ id: `${tag}-mk`, chakra: 'root', touch: 't', text: `${tag} mark`, at }],
    days: [{ id: `${tag}-day`, basics: ['ate'], updatedAt: at }],
    inquiries: [{ id: `${tag}-q`, question: `${tag} question?`, askedAt: at, state: 'done', picks: [] } as unknown as Tables['inquiries']],
    papers: [{ id: `${tag}-paper`, title: `${tag} paper` } as unknown as Tables['papers']],
    // schema 10 (W2): the songs and takes; the outbox is written by the write path itself in a world, never by hand
    songs: [{ id: `${tag}-song`, createdAt: at, updatedAt: at, title: `${tag} song`, lyric: `${tag} lyric`, sections: [] }],
    takes: [{ id: `${tag}-take`, songId: `${tag}-song`, at, seconds: 1, audio: new Uint8Array([1]).buffer, pitch: [] }],
  };
}
async function writeEverything(tag: string) {
  const rows = rowsFor(tag);
  for (const t of Object.keys(rows) as TableName[]) await store.put(t, rows[t]![0] as never);
  // the settings row too: a notebook field and a home field
  await store.put('settings', { ...(await store.get('settings', 'app'))!, echo: { day: tag, seen: [] } });
}
const counts = async (d: FlowDB) => Object.fromEntries(await Promise.all(TABLES.map(async t => [t, await d.table(t).count()] as const)));

describe('home and book', () => {
  it('book is home until a world is worn; tables read and write the book', async () => {
    expect(book()).toBe(home());
    expect(worn()).toBeNull();
    await store.put('pages', rowsFor('own').pages![0]);
    await don('eastwinds');
    expect(worn()).toBe('eastwinds');
    expect(book().name).toBe(`${db.name}-w-eastwinds`);
    expect(home()).toBe(db);
    // the world's pages are its own: his are not there, and what is written lands in its database
    expect(await store.all('pages')).toEqual([]);
    await store.put('pages', rowsFor('ew').pages![0]);
    expect((await world('eastwinds').pages.toArray()).map(p => p.id)).toEqual(['ew-p']);
    expect((await db.pages.toArray()).map(p => p.id)).toEqual(['own-p']);
    await doff();
    expect(book()).toBe(home());
    expect(worn()).toBeNull();
    expect((await store.all('pages')).map(p => p.id)).toEqual(['own-p']);
  });

  it('the notebook worn is kept on home\'s row, and init reopens it', async () => {
    await don('eastwinds');
    expect((await db.settings.get('app'))!.world).toBe('eastwinds');
    await init(db);
    expect(worn()).toBe('eastwinds');
    expect(book().name).toBe(`${db.name}-w-eastwinds`);
    await doff();
    expect((await db.settings.get('app'))!.world).toBeUndefined();
    await init(db);
    expect(worn()).toBeNull();
  });

  it('peek reads another notebook without putting it on; a world never opened has nothing', async () => {
    expect(await peek('songbook', async r => r.all('pages'))).toBeUndefined();
    await don('eastwinds');
    await store.put('pages', rowsFor('ew').pages![0]);
    await doff();
    expect((await peek('eastwinds', r => r.all('pages')))!.map(p => p.id)).toEqual(['ew-p']);
    expect(worn()).toBeNull();
    expect(await store.all('pages')).toEqual([]);
  });

  it('every write to a notebook passes the one place W2 listens, named by its database', async () => {
    const heard: Pick<WriteNote, 'db' | 'table' | 'keys' | 'gone'>[] = [];
    const stop = onWrite(n => heard.push({ db: n.db, table: n.table, keys: n.keys, gone: n.gone }));
    await don('eastwinds');
    heard.length = 0;
    await store.put('pages', rowsFor('ew').pages![0]);
    await store.many({ messages: rowsFor('ew').messages! });
    await store.tx(['messages', 'settings'], async tb => { await tb('messages').delete('ew-m'); await tombstone(tb, ['ew-m']); });
    stop();
    const ew = `${db.name}-w-eastwinds`;
    expect(heard).toEqual(expect.arrayContaining([
      { db: ew, table: 'pages', keys: ['ew-p'], gone: false },
      { db: ew, table: 'messages', keys: ['ew-m'], gone: false },
      { db: ew, table: 'messages', keys: ['ew-m'], gone: true },
    ]));
    expect(heard.some(n => n.db === db.name && n.table !== 'settings')).toBe(false);
  });
});

describe('the settings row, parted', () => {
  it('home\'s fields stay on home\'s row and the notebook\'s own go to the book\'s', async () => {
    await don('eastwinds');
    const s = (await store.get('settings', 'app'))!;
    // home's fields read through, whatever is worn
    expect(s.light).toBe('sky');
    expect(s.worlds).toEqual(WORLDS);
    expect(s.world).toBe('eastwinds');
    await store.put('settings', { ...s, light: 'night', sounds: false, echo: { day: 'w', seen: ['x'] }, beFolded: { '1': true }, year: 2071, lastBackupAt: 7 });
    const h = (await db.settings.get('app'))!;
    const w = (await world('eastwinds').settings.get('app'))!;
    expect([h.light, h.sounds]).toEqual(['night', false]);
    expect(h.echo).toBeUndefined();
    expect(h.beFolded).toBeUndefined();
    expect(h.year).toBeUndefined();
    expect(h.lastBackupAt).toBeUndefined();
    expect(h.seededAt).toBeTypeOf('number');
    expect(w.echo).toEqual({ day: 'w', seen: ['x'] });
    expect([w.beFolded, w.year, w.lastBackupAt]).toEqual([{ '1': true }, 2071, 7]);
    expect('light' in w).toBe(false);
    expect('worlds' in w).toBe(false);
    // and the reverse: back home, the book's fields are his own again
    await doff();
    const mine = (await store.get('settings', 'app'))!;
    expect(mine.light).toBe('night');
    expect(mine.echo).toBeUndefined();
    expect(mine.year).toBeUndefined();
  });

  it('a seed pass\'s write, Research\'s key and a tombstone each go to the right row', async () => {
    await don('eastwinds');
    await store.many({ settings: [{ ...(await store.get('settings', 'app'))!, cleaned: ['x'] }] });
    await saveResearchKey('sk-ant-test');
    await store.tx(['settings'], tb => tombstone(tb, ['gone-id']));
    const h = (await db.settings.get('app'))!;
    const w = (await world('eastwinds').settings.get('app'))!;
    expect(h.research?.key).toBe('sk-ant-test');
    expect(w.research).toBeUndefined();
    expect(w.cleaned).toEqual(['x']);
    expect(h.cleaned).not.toContain('x');
    expect(w.deleted).toEqual(['gone-id']);
    expect(h.deleted ?? []).not.toContain('gone-id');
    expect((await researchKey())?.key).toBe('sk-ant-test');
  });
});

describe('no seeds in a world', () => {
  it('a world starts empty and every seed pass leaves it so', async () => {
    await don('eastwinds');
    expect(await ensureSeeded()).toBe(false);
    for (const pass of [seedFlowsOnce, seedPicksOnce, seedFixationsOnce, valuesFromParadoxesOnce, moveDoctorLineOnce, cleanSeedPages]) await pass();
    const c = await counts(world('eastwinds'));
    expect({ ...c, settings: 0 }).toEqual(Object.fromEntries(TABLES.map(t => [t, 0])));
    // his own notebook keeps its seeds
    expect(await db.voices.count()).toBeGreaterThan(0);
    expect(await db.flows.count()).toBeGreaterThan(0);
  });
});

describe('the no-leak test, structurally (PLAN-WORLDS.md section 3)', () => {
  it('writing in every table of his own pages writes nothing in any world', async () => {
    await don('eastwinds'); await doff();
    await don('songbook'); await doff();
    const before = { ew: await rawJSON(world('eastwinds')), sb: await rawJSON(world('songbook')) };
    await writeEverything('own');
    expect(await rawJSON(world('eastwinds'))).toBe(before.ew);
    expect(await rawJSON(world('songbook'))).toBe(before.sb);
    expect(before.ew).not.toContain('"own-');
  });

  it('writing in every table of a world writes nothing in his own pages or another world', async () => {
    await don('songbook'); await doff();
    const mine = await counts(db);
    const sb = await rawJSON(world('songbook'));
    await don('eastwinds');
    await writeEverything('ew');
    const homeRaw = await rawJSON(db);
    expect(homeRaw).not.toContain('"ew-');
    expect(homeRaw).not.toContain('ew line');
    expect(await counts(db)).toEqual(mine);
    expect(await rawJSON(world('songbook'))).toBe(sb);
    // and every table of the world took its row
    const c = await counts(world('eastwinds'));
    for (const t of TABLES.filter(t => t !== 'outbox')) expect(c[t], t).toBe(1);
    // the outbox is the write path's own: the kept line, the question asked, the song and the take (W2, src/db/outbox.ts)
    expect(c.outbox).toBe(4);
    expect(mine.outbox).toBe(0);
  });
});

describe('one PIN across every notebook', () => {
  async function threeNotebooks() {
    await writeEverything('own');
    await don('eastwinds'); await writeEverything('ew');
    await don('songbook'); await writeEverything('sb');
    await doff();
  }
  const words = ['own line', 'ew line', 'sb line'];

  it('setting a PIN seals every notebook, each world stamped with the lock; removing it unseals them all', async () => {
    await threeNotebooks();
    const salt = randomSalt();
    const key = await pinKey('2580', salt);
    await setKey(key, { salt, iterations: FAST });
    for (const d of [db, world('eastwinds'), world('songbook')]) {
      const raw = await rawJSON(d);
      for (const w of words) expect(raw).not.toContain(w);
      const s = (await d.settings.get('app'))!;
      expect(s.lock.enabled).toBe(true);
      expect(s.lock.salt).toBe(salt);
      expect(isSealed((await d.messages.toArray())[0].sealed)).toBe(true);
    }
    await don('eastwinds');
    expect(keyState()).toBe('open');
    expect((await store.get('messages', 'ew-m'))!.text).toBe('ew line');
    await removeKey();
    for (const d of [db, world('eastwinds'), world('songbook')]) {
      expect((await d.settings.get('app'))!.lock.enabled).toBe(false);
      expect(await rawJSON(d)).toMatch(/(own|ew|sb) line/);
    }
    expect(keyState()).toBe('plain');
  });

  it('changing the PIN moves every world: none is left sealed with the old key', async () => {
    await threeNotebooks();
    const s1 = randomSalt(), k1 = await pinKey('1111', s1);
    await setKey(k1, { salt: s1, iterations: FAST });
    const s2 = randomSalt(), k2 = await pinKey('2222', s2);
    await setKey(k2, { salt: s2, iterations: FAST });
    expect((await db.settings.get('app'))!.lock.moving).toBeUndefined();
    for (const id of ['eastwinds', 'songbook']) {
      const s = (await world(id).settings.get('app'))!;
      expect(s.lock.salt).toBe(s2);
    }
    // a fresh start (a reload): the old PIN opens nothing, the new one opens every notebook
    lock();
    await init(db);
    expect(await unlock(k1)).toBe(false);
    expect(await unlock(k2)).toBe(true);
    await don('songbook');
    expect((await store.get('messages', 'sb-m'))!.text).toBe('sb line');
    await don('eastwinds');
    expect((await store.get('messages', 'ew-m'))!.text).toBe('ew line');
  });

  it('locked, no notebook reads and none writes; unlocked from a world, all of them open', async () => {
    await threeNotebooks();
    const salt = randomSalt(), k = await pinKey('2580', salt);
    await setKey(k, { salt, iterations: FAST });
    await don('eastwinds');
    lock();
    expect(keyState()).toBe('locked');
    expect((await store.get('messages', 'ew-m'))!.locked).toBe(true);
    expect((await peek(null, r => r.get('messages', 'own-m')))!.locked).toBe(true);
    await expect(store.put('pages', rowsFor('late').pages![0])).rejects.toBeInstanceOf(LockedError);
    expect(await unlock(k)).toBe(true);
    expect((await store.get('messages', 'ew-m'))!.text).toBe('ew line');
    expect((await peek(null, r => r.get('messages', 'own-m')))!.text).toBe('own line');
    expect((await peek('songbook', r => r.get('messages', 'sb-m')))!.text).toBe('sb line');
  });

  it('a world made while the lock is on is sealed with the key at once', async () => {
    const salt = randomSalt(), k = await pinKey('2580', salt);
    await setKey(k, { salt, iterations: FAST });
    await don('eastwinds');
    await store.put('messages', rowsFor('ew').messages![0]);
    expect(await rawJSON(world('eastwinds'))).not.toContain('ew line');
    expect((await world('eastwinds').settings.get('app'))!.lock.verifier).toEqual((await db.settings.get('app'))!.lock.verifier);
  });

  /** Makes every transaction on the named database throw from now on, as a stop halfway would leave it. */
  function stopAt(name: string) {
    const real = Dexie.prototype.transaction;
    return vi.spyOn(Dexie.prototype, 'transaction').mockImplementation(function (this: Dexie, ...args: unknown[]) {
      if (this.name === name && args[0] === 'rw') throw new Error('stopped');
      return (real as (...a: unknown[]) => unknown).apply(this, args);
    } as never);
  }

  for (const [when, at] of [['after home and East Winds', 'songbook'], ['before home moved', 'home']] as const) {
    for (const pin of ['new', 'old'] as const) {
      it(`a PIN change stopped ${when} is finished by the ${pin} PIN, and every notebook opens with the new key`, async () => {
        await threeNotebooks();
        const s1 = randomSalt(), k1 = await pinKey('1111', s1);
        await setKey(k1, { salt: s1, iterations: FAST });
        const stop = stopAt(at === 'home' ? db.name : `${db.name}-w-${at}`);
        const s2 = randomSalt(), k2 = await pinKey('2222', s2);
        await expect(setKey(k2, { salt: s2, iterations: FAST })).rejects.toThrow('stopped');
        stop.mockRestore();
        // the phone starts again with the move on home's row
        lock();
        await init(db);
        const l = (await db.settings.get('app'))!.lock;
        expect(l.moving).toBeDefined();
        expect(lockSalts(l).map(x => x.salt).sort()).toEqual([s1, s2].sort());
        // the PIN typed is derived with each salt the lock knows, as ui/lock/pin.ts tryPin does
        let opened = false;
        for (const { salt } of lockSalts(l)) if (await unlock(await pinKey(pin === 'new' ? '2222' : '1111', salt))) { opened = true; break; }
        expect(opened).toBe(true);
        expect((await db.settings.get('app'))!.lock.moving).toBeUndefined();
        expect((await db.settings.get('app'))!.lock.salt).toBe(s2);
        for (const id of ['eastwinds', 'songbook']) expect((await world(id).settings.get('app'))!.lock.salt).toBe(s2);
        // from here the new PIN is the PIN everywhere
        lock();
        await init(db);
        expect(await unlock(k1)).toBe(false);
        expect(await unlock(k2)).toBe(true);
        expect((await store.get('messages', 'own-m'))!.text).toBe('own line');
        expect((await peek('eastwinds', r => r.get('messages', 'ew-m')))!.text).toBe('ew line');
        expect((await peek('songbook', r => r.get('messages', 'sb-m')))!.text).toBe('sb line');
      });
    }
  }

  it('the PIN turned on and stopped before a world was sealed: the next unlock seals it', async () => {
    await threeNotebooks();
    const stop = stopAt(`${db.name}-w-songbook`);
    const salt = randomSalt(), k = await pinKey('2580', salt);
    await expect(setKey(k, { salt, iterations: FAST })).rejects.toThrow('stopped');
    stop.mockRestore();
    expect(await rawJSON(world('songbook'))).toContain('sb line');
    lock();
    await init(db);
    expect(await unlock(k)).toBe(true);
    expect(await rawJSON(world('songbook'))).not.toContain('sb line');
    expect((await peek('songbook', r => r.get('messages', 'sb-m')))!.text).toBe('sb line');
  });
});

describe('a cover', () => {
  it('a drawing is kept in its notebook, sealed, and comes back as the same bytes', async () => {
    const salt = randomSalt(), k = await pinKey('2580', salt);
    await setKey(k, { salt, iterations: FAST });
    const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 250]);
    await dress('eastwinds', { drawing: new Blob([bytes], { type: 'image/png' }) });
    const raw = (await world('eastwinds').settings.get('app'))!;
    expect(raw.cover).toBeUndefined();
    expect(isSealed(raw.sealed)).toBe(true);
    const c = (await peek('eastwinds', r => r.get('settings', 'app')))!.cover as { drawing: Blob };
    expect(c.drawing.type).toBe('image/png');
    expect(new Uint8Array(await c.drawing.arrayBuffer())).toEqual(bytes);
    // his own cover stays his: albums, in the order worn
    await dress(null, { albums: ['spotify:album:a', 'spotify:album:b'] });
    expect((await store.get('settings', 'app'))!.cover).toEqual({ albums: ['spotify:album:a', 'spotify:album:b'] });
    await dress(null, undefined);
    expect((await store.get('settings', 'app'))!.cover).toBeUndefined();
  });

  // a cover is dress()'s alone to change: the settings signal (ui/settings.ts) holds a copy read before the dress, and
  // the next save of any other setting writes that copy whole, so the layer keeps the cover stored on the row
  const cover = async (w: string | null) => (await peek(w, r => r.get('settings', 'app')))?.cover;
  const flip = () => saveSettings({ sounds: !settings.value.sounds });

  it('his own cover survives a later settings save', async () => {
    await loadSettings();
    await dress(null, { albums: ['spotify:album:a'] });
    await flip();
    expect(await cover(null)).toEqual({ albums: ['spotify:album:a'] });
  });

  it('the cover of the world worn survives a later settings save, and his own on home\'s row too', async () => {
    const id = WORLDS[0].id;
    await dress(null, { albums: ['spotify:album:own'] });
    await don(id); await loadSettings();
    await dress(id, { albums: ['spotify:album:a'] });
    await flip();
    expect(await cover(id)).toEqual({ albums: ['spotify:album:a'] });
    expect(await cover(null)).toEqual({ albums: ['spotify:album:own'] });
  });

  it('plain paper stays plain after a later settings save', async () => {
    await dress(null, { albums: ['spotify:album:a'] });
    await loadSettings();
    await dress(null, undefined);
    await flip();
    expect(await cover(null)).toBeUndefined();
  });

  it('a drawing survives a later settings save, sealed, with a world worn or not', async () => {
    const salt = randomSalt(), k = await pinKey('2580', salt);
    await setKey(k, { salt, iterations: FAST });
    const bytes = new Uint8Array([1, 2, 3]);
    await loadSettings();
    await dress(null, { drawing: new Blob([bytes], { type: 'image/png' }) });
    await flip();
    const own = (await cover(null)) as { drawing: Blob };
    expect(new Uint8Array(await own.drawing.arrayBuffer())).toEqual(bytes);
    const id = WORLDS[0].id;
    await don(id); await loadSettings();
    await dress(id, { drawing: new Blob([bytes], { type: 'image/png' }) });
    await store.many({ settings: [settings.value] });
    const theirs = (await cover(id)) as { drawing: Blob };
    expect(new Uint8Array(await theirs.drawing.arrayBuffer())).toEqual(bytes);
    expect((await world(id).settings.get('app'))!.cover).toBeUndefined();
  });
});

describe('backup per notebook', () => {
  it('exports the notebook worn, says which in the file and its name, and imports only into its own notebook', async () => {
    await writeEverything('own');
    await don('eastwinds');
    await writeEverything('ew');
    const file = await exportData();
    expect(file.notebook).toBe('eastwinds');
    expect(JSON.stringify(file)).not.toContain('own line');
    expect(JSON.stringify(file)).toContain('ew line');
    expect(fileName(new Date(2026, 10, 25), file.notebook)).toBe('flowstate-eastwinds-2026-11-25.json');
    expect(fileName(new Date(2026, 10, 25))).toBe('flowstate-2026-11-25.json');
    // into the world itself it goes back
    const back = parseBackup(JSON.stringify(file));
    await importData(back, 'replace');
    expect((await store.get('messages', 'ew-m'))!.text).toBe('ew line');
    // his own pages never go into a world, and a world's never into his
    await doff();
    const mine = parseBackup(JSON.stringify(await exportData()));
    expect(mine.notebook).toBeUndefined();
    await expect(importData(back, 'merge')).rejects.toBeInstanceOf(BackupError);
    await don('songbook');
    await expect(importData(mine, 'merge')).rejects.toBeInstanceOf(BackupError);
    await expect(importData(back, 'merge')).rejects.toBeInstanceOf(BackupError);
    expect(await store.all('messages')).toEqual([]);
  });

  it('a replace import of his own file keeps the notebook worn and the registry', async () => {
    const file = parseBackup(JSON.stringify(await exportData()));
    await db.settings.update('app', { worlds: [WORLDS[0]] as Settings['worlds'] });
    await importData(file, 'replace');
    expect((await db.settings.get('app'))!.worlds).toEqual([WORLDS[0]]);
  });
});

describe('the shelf\'s reads (model/shelf.ts)', () => {
  it('a cover wears five albums at most, found among the kept covers wherever they are, in the order worn', async () => {
    const { dressCover, notebookShown, COVER_MAX } = await import('../../src/model/shelf');
    const cover = new Uint8Array([1, 2, 3]).buffer;
    // kept in his own notebook, where the ♪ they were picked from lives
    await store.bulkPut('albums', ['a', 'b', 'c'].map(x => ({ albumUri: `spotify:album:${x}`, album: x, artist: 'x', cover })));
    expect(COVER_MAX).toBe(5);
    expect(() => dressCover('eastwinds', { albums: ['1', '2', '3', '4', '5', '6'] })).toThrow('Five at most');
    await dressCover('eastwinds', { albums: ['spotify:album:c', 'spotify:album:gone', 'spotify:album:a'] });
    const s = await notebookShown('eastwinds');
    expect(s.albums.map(a => a.albumUri)).toEqual(['spotify:album:c', 'spotify:album:a']);
    expect(s.last).toBeNull();
    // a world never opened shows plain paper and no line
    expect(await notebookShown('songbook')).toEqual({ albums: [], last: null });
  });
});
