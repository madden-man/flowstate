// The upgrade from what is on Tommy's phone today (main, deployed 2026-11-25 with the Sunday question: schema version 9,
// RESEARCH_VERSION, with settings.checkin and page.checkin, neither indexed) to the merged schema, WORLDS_VERSION 10.
// The Sunday question added no table and no Dexie version, so version 9 on main is exactly STORES_V9 here; the merge
// adds the worlds' three tables and nothing else. A version 9 journal, plain and locked, opens at 10 with every row
// intact, the question's settings and its linked page read back through the fields layer, no world worn, the new
// tables empty, and a landing the same week writes nothing twice.
import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import {
  openDB, STORES_V1, STORES_V2, STORES_V3, STORES_V4, STORES_V5, STORES_V6, STORES_V7, STORES_V8, STORES_V9,
  VALUES_VERSION, MOUNTAIN_VERSION, TASKS_VERSION, RESEARCH_VERSION, WORLDS_VERSION, SCHEMA_VERSION, type Settings,
} from '../../src/db/schema';
import { init, store, setKey, unlock, worn, keyState } from '../../src/db/fields';
import { deriveKey, randomSalt, isSealed } from '../../src/db/crypto';
import { askCheckin } from '../../src/model/into';
import { messagesOf, questions } from '../../src/model/pages';
import { checkinOf } from '../../src/push/due';

const FAST = 1000;
const LINE = 'Anything on your mind this week?';
const WEEK = '2026-11-22';
const T0 = new Date(2026, 10, 22, 10, 1).getTime();
const V9_TABLES = Object.keys(STORES_V9);

/** A database built exactly as main's openDB builds it: versions 1 to 9, no more. */
async function mainV9(name: string): Promise<Dexie> {
  const old = new Dexie(name);
  old.version(1).stores(STORES_V1);
  old.version(2).stores(STORES_V2);
  old.version(3).stores(STORES_V3);
  old.version(4).stores(STORES_V4);
  old.version(5).stores(STORES_V5);
  old.version(VALUES_VERSION).stores(STORES_V6);
  old.version(MOUNTAIN_VERSION).stores(STORES_V7);
  old.version(TASKS_VERSION).stores(STORES_V8);
  old.version(RESEARCH_VERSION).stores(STORES_V9);
  await old.open();
  return old;
}
const dump = async (d: Dexie) => Object.fromEntries(await Promise.all(V9_TABLES.map(async t => [t, await d.table(t).toArray()] as const)));

/** What main's Sunday question leaves in a journal: the settings (push on, shown this week), the page it landed on,
 *  linked to the week, his question on it, and the question page asked from it. */
function mainRows() {
  const checkin = { on: true, weekday: 0, hour: 10, minute: 0, line: LINE, lastShownWeek: WEEK, push: true };
  return {
    settings: { id: 'app', light: 'sky', stillAfterMidnight: 'offer', sounds: true, haptics: true, lock: { enabled: false, relockAfterMin: 5 }, seededAt: 1, checkin } as Settings,
    pages: [
      { id: 'p-day', kind: 'entry' as const, createdAt: T0, updatedAt: T0, state: 'open' as const, tags: [], paradoxIds: [], linkedPageIds: ['p-q'], checkin: { week: WEEK } },
      { id: 'p-q', kind: 'question' as const, title: LINE, askedFrom: 'p-day', createdAt: T0, updatedAt: T0, state: 'open' as const, tags: [], paradoxIds: [], linkedPageIds: ['p-day'] },
    ],
    messages: [{ id: 'm-q', pageId: 'p-day', at: T0, text: LINE, kept: false }],
    readings: [{ id: 'r1', at: 1, of: 'mountain', value: 0.2 }],
    inquiries: [{ id: 'q1', askedAt: 4, question: 'Does it?', state: 'done', picks: [] }],
  };
}

describe('the upgrade from main\'s deployed schema (version 9, with the Sunday question) to the merged one', () => {
  it('the merged version is 10, and version 9 is main\'s exactly: the merge adds the three worlds tables only', () => {
    expect(SCHEMA_VERSION).toBe(10);
    expect(WORLDS_VERSION).toBe(10);
    expect(RESEARCH_VERSION).toBe(9);
    expect(V9_TABLES).toContain('inquiries');
    expect(V9_TABLES).not.toContain('outbox');
  });

  it('a plain version 9 journal opens at 10 with every row intact and the Sunday question whole', async () => {
    const name = `flowstate-main9-${Date.now()}`;
    const old = await mainV9(name);
    const r = mainRows();
    await old.table('settings').put(r.settings);
    await old.table('pages').bulkPut(r.pages);
    await old.table('messages').bulkPut(r.messages);
    await old.table('readings').bulkPut(r.readings);
    await old.table('inquiries').bulkPut(r.inquiries);
    const before = await dump(old);
    old.close();

    const db = openDB(name);
    await db.open();
    expect(db.verno).toBe(10);
    expect(await dump(db)).toEqual(before);
    for (const t of ['outbox', 'songs', 'takes'] as const) expect(await db.table(t).count(), t).toBe(0);

    await init(db);
    expect(worn()).toBeNull();
    const s = (await store.get('settings', 'app'))!;
    expect(checkinOf(s)).toEqual(r.settings.checkin);
    expect((await store.get('pages', 'p-day'))!.checkin).toEqual({ week: WEEK });
    // the landing again the same week: the page opens, nothing is written or asked twice, and nothing waits to go up
    const again = await askCheckin(WEEK, LINE, T0 + 60_000);
    expect(again.page.id).toBe('p-day');
    expect(again.question).toBeUndefined();
    expect((await messagesOf('p-day')).map(m => m.text)).toEqual([LINE]);
    expect((await questions()).map(q => q.id)).toEqual(['p-q']);
    expect(await db.table('outbox').count()).toBe(0);
    db.close();
  });

  it('a locked version 9 journal opens at 10: sealed rows stay sealed byte for byte and open with the PIN', async () => {
    // rows sealed in the format main writes (the merge only adds fields to the settings secret when a bridge token, a
    // drawing or a research key is there; with none, the secret is the Spotify tokens alone, as on main)
    const sealer = openDB(`flowstate-sealer-${Date.now()}`);
    await sealer.open();
    await init(sealer);
    const r = mainRows();
    await store.put('settings', r.settings);
    await store.many({ pages: r.pages, messages: r.messages });
    const salt = randomSalt();
    const key = await deriveKey('2468', salt, FAST);
    await setKey(key, { salt, iterations: FAST, digits: 4 });
    const sealedRows = Object.fromEntries(await Promise.all(['settings', 'pages', 'messages'].map(async t => [t, await sealer.table(t).toArray()] as const)));
    sealer.close();
    expect(isSealed((sealedRows.messages[0] as { sealed?: unknown }).sealed)).toBe(true);

    const name = `flowstate-main9-locked-${Date.now()}`;
    const old = await mainV9(name);
    for (const [t, rows] of Object.entries(sealedRows)) await old.table(t).bulkPut(rows);
    const before = await dump(old);
    old.close();

    const db = openDB(name);
    await db.open();
    expect(db.verno).toBe(10);
    expect(await dump(db)).toEqual(before);
    await init(db);
    expect(keyState()).toBe('locked');
    expect(await unlock(await deriveKey('2468', salt, FAST))).toBe(true);
    expect(worn()).toBeNull();
    expect(checkinOf((await store.get('settings', 'app'))!)).toEqual(r.settings.checkin);
    expect((await messagesOf('p-day')).map(m => m.text)).toEqual([LINE]);
    expect((await store.get('pages', 'p-q'))!.title).toBe(LINE);
    db.close();
  });
});
