import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from './helpers';
import type { FlowDB, Message, Paradox, Settings } from '../../src/db/schema';
import { store, setKey, removeKey, unlock, lock, keyState, init, LockedError } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { ensureSeeded, defaultSettings, OLD_SEED_PAGES } from '../../src/db/seed';

const FAST = 1000;
let db: FlowDB;
beforeEach(async () => { db = await freshDB(); });

const msg = (id: string, text: string): Message => ({ id, pageId: 'p1', at: 1, text, kept: false });
const rawJSON = async () => JSON.stringify(await Promise.all(db.tables.map(t => t.toArray())));

describe('fields layer without a key', () => {
  it('stores plain text', async () => {
    await store.put('messages', msg('m1', 'All this, and I am reduced to simple journaling'));
    expect(keyState()).toBe('plain');
    expect((await db.messages.get('m1'))!.text).toBe('All this, and I am reduced to simple journaling');
    expect((await store.get('messages', 'm1'))!.text).toBe('All this, and I am reduced to simple journaling');
  });
});

describe('setKey', () => {
  it('re-encrypts every existing row in place, and reads still come back whole', async () => {
    await ensureSeeded();
    // two kept lines to seal: the old seed's manifesto page, now that the seed writes no pages (V5)
    await store.many({ pages: [OLD_SEED_PAGES[0].page], messages: OLD_SEED_PAGES[0].messages });
    await store.put('messages', msg('m1', 'the quiet voices within'));
    await store.put('leans', { id: 'l1', paradoxId: 'px-selfless-selfish', at: 5, lean: 0.4, note: 'leaning selfish this week' });
    await store.put('settings', { ...(await store.get('settings', 'app'))!, spotify: { tokens: { accessToken: 'AT-secret', refreshToken: 'RT-secret', expiresAt: 9 }, connectedAt: 3 } });
    const before = await rawJSON();
    for (const s of ['the quiet voices within', 'leaning selfish', 'vegetable chopping', 'breathing room', 'RT-secret', 'I choose how to flow.']) expect(before).toContain(s);

    const salt = randomSalt();
    const key = await deriveKey('2580', salt, FAST);
    await setKey(key, { salt, iterations: FAST });
    expect(keyState()).toBe('open');

    const after = await rawJSON();
    for (const s of ['the quiet voices within', 'leaning selfish', 'vegetable chopping', 'breathing room', 'RT-secret', 'AT-secret', 'I choose how to flow.', 'opportunities near'])
      expect(after).not.toContain(s);
    // what stays clear: ids, names, values, dates
    for (const s of ['Mystic', 'selfless', 'pg-manifesto', 'compassionate self-awareness']) expect(after).toContain(s);

    expect((await store.get('messages', 'm1'))!.text).toBe('the quiet voices within');
    expect((await store.get('leans', 'l1'))!.note).toBe('leaning selfish this week');
    const p = (await store.get('paradoxes', 'px-selfless-selfish'))!;
    expect(p.poleA.aspect).toBe('vegetable chopping in Evergreen');
    expect(p.revisions[1].poleB.aspect).toBe('something that gives breathing room');
    const s = (await store.get('settings', 'app'))!;
    expect(s.spotify?.tokens?.refreshToken).toBe('RT-secret');
    expect(s.lock.enabled).toBe(true);
    expect(s.lock.salt).toBe(salt);
  });

  it('writes after the key is set are sealed on the spot', async () => {
    await ensureSeeded();
    const salt = randomSalt();
    await setKey(await deriveKey('1', salt, FAST), { salt, iterations: FAST });
    await store.put('messages', msg('m2', 'Wait out the truly hard parts'));
    const raw = (await db.messages.get('m2'))!;
    expect(raw.text).toBe('');
    expect(raw.sealed).toBeDefined();
    expect((await store.get('messages', 'm2'))!.text).toBe('Wait out the truly hard parts');
  });

  it('keeps a paradox middle scenario sealed and its word clear', async () => {
    await ensureSeeded();
    const salt = randomSalt();
    await setKey(await deriveKey('1', salt, FAST), { salt, iterations: FAST });
    const p: Paradox = { ...(await store.get('paradoxes', 'px-thoughtful-reactive'))!, middle: { word: 'considered', scenario: 'asking a friend before replying' } };
    delete (p as { locked?: true }).locked;
    await store.put('paradoxes', p);
    const raw = JSON.stringify(await db.paradoxes.get(p.id));
    expect(raw).toContain('considered');
    expect(raw).not.toContain('before replying');
    expect((await store.get('paradoxes', p.id))!.middle).toEqual({ word: 'considered', scenario: 'asking a friend before replying' });
  });

  it('changing the key re-encrypts with the new one', async () => {
    await ensureSeeded();
    await store.put('messages', msg('m1', 'stand tall'));
    const s1 = randomSalt(), s2 = randomSalt();
    const k1 = await deriveKey('1', s1, FAST), k2 = await deriveKey('2', s2, FAST);
    await setKey(k1, { salt: s1, iterations: FAST });
    await setKey(k2, { salt: s2, iterations: FAST });
    lock();
    expect(await unlock(k1)).toBe(false);
    expect(await unlock(k2)).toBe(true);
    expect((await store.get('messages', 'm1'))!.text).toBe('stand tall');
  });
});

describe('page titles', () => {
  const question = { id: 'q1', kind: 'question' as const, createdAt: 1, updatedAt: 1, state: 'open' as const, tags: ['flow'], paradoxIds: [], linkedPageIds: [], title: 'How can I gauge my pleasure/pain barometer?' };

  it('a stored question title is sealed once a key is set, and reads back after unlock', async () => {
    await ensureSeeded();
    await store.put('pages', question);
    expect((await db.pages.get('q1'))!.title).toBe(question.title);
    const salt = randomSalt();
    const key = await deriveKey('8', salt, FAST);
    await setKey(key, { salt, iterations: FAST });
    const raw = (await db.pages.get('q1'))! as typeof question & { sealed?: unknown };
    expect(raw.title).toBeUndefined();
    expect(raw.sealed).toBeDefined();
    expect(JSON.stringify(raw)).not.toContain('barometer');
    expect(raw.tags).toEqual(['flow']); // tags, kind and dates stay clear
    lock();
    const locked = (await store.get('pages', 'q1'))!;
    expect(locked.locked).toBe(true);
    expect(locked.title).toBeUndefined();
    expect(await unlock(key)).toBe(true);
    expect((await store.get('pages', 'q1'))!.title).toBe(question.title);
    const listed = await store.query('pages', t => t.where('kind').equals('question'));
    expect(listed.map(p => p.title)).toEqual([question.title]);
  });

  it('a page without a title stays without one', async () => {
    await ensureSeeded();
    await store.many({ pages: [OLD_SEED_PAGES[0].page], messages: OLD_SEED_PAGES[0].messages }); // an entry, no title
    const salt = randomSalt();
    await setKey(await deriveKey('8', salt, FAST), { salt, iterations: FAST });
    expect((await store.get('pages', 'pg-manifesto'))!.title).toBeUndefined();
    await removeKey();
    expect((await db.pages.get('q1'))).toBeUndefined();
    expect('title' in (await db.pages.get('pg-manifesto'))!).toBe(false);
  });
});

describe('the creed and the refusals (PLAN-SELF.md section 4)', () => {
  it('are sealed at rest once a key is set; a locked read withholds them and keeps their shape', async () => {
    await ensureSeeded();
    const p: Paradox = { ...(await store.get('paradoxes', 'px-thoughtful-reactive'))!, creed: 'I answer when I am ready', refusals: [{ id: 'r1', text: "I don't fire back", at: 4 }] };
    delete (p as { locked?: true }).locked;
    await store.put('paradoxes', p);
    expect(JSON.stringify(await db.paradoxes.get(p.id))).toContain('fire back');
    const salt = randomSalt();
    const key = await deriveKey('1', salt, FAST);
    await setKey(key, { salt, iterations: FAST });
    const raw = JSON.stringify(await db.paradoxes.get(p.id));
    expect(raw).not.toContain('ready');
    expect(raw).not.toContain('fire back');
    expect(raw).toContain('r1');
    expect(await store.get('paradoxes', p.id)).toEqual(p);
    // a paradox sealed without them reads back without them
    const bare = (await store.get('paradoxes', 'px-selfless-selfish'))!;
    expect('creed' in bare || 'refusals' in bare).toBe(false);
    lock();
    const shut = (await store.get('paradoxes', p.id))!;
    expect(shut).toMatchObject({ locked: true, creed: '', refusals: [{ id: 'r1', text: '', at: 4 }] });
    expect(shut.poleA.aspect).toBe(''); // like the paradox's other sealed words
    const shutBare = (await store.get('paradoxes', 'px-selfless-selfish'))!;
    expect('creed' in shutBare || 'refusals' in shutBare).toBe(false);
    expect(await unlock(key)).toBe(true);
    expect(await store.get('paradoxes', p.id)).toEqual(p);
  });
});

describe('locked', () => {
  it('reads come back marked locked with the text withheld, and writes refuse', async () => {
    await ensureSeeded();
    await store.put('messages', msg('m1', 'kept close'));
    const salt = randomSalt();
    const key = await deriveKey('1234', salt, FAST);
    await setKey(key, { salt, iterations: FAST });
    lock();
    expect(keyState()).toBe('locked');
    const m = (await store.get('messages', 'm1'))!;
    expect(m.locked).toBe(true);
    expect(m.text).toBe('');
    expect((await store.get('voices', 'v-mystic'))!.name).toBe('Mystic'); // lists render before unlock
    await expect(store.put('messages', msg('m3', 'x'))).rejects.toBeInstanceOf(LockedError);
    expect(await unlock(await deriveKey('4321', salt, FAST))).toBe(false);
    expect(await unlock(key)).toBe(true);
    expect((await store.get('messages', 'm1'))!.text).toBe('kept close');
  });

  it('a fresh start with the lock on begins locked', async () => {
    await store.put('settings', { ...defaultSettings(1), lock: { enabled: true, relockAfterMin: 5 } } as Settings);
    await init(db);
    expect(keyState()).toBe('locked');
  });
});

describe('removeKey', () => {
  it('writes every row back as plain text and turns the lock off', async () => {
    await ensureSeeded();
    await store.put('messages', msg('m1', 'mutable by design'));
    const salt = randomSalt();
    await setKey(await deriveKey('5', salt, FAST), { salt, iterations: FAST });
    await removeKey();
    expect(keyState()).toBe('plain');
    expect((await db.messages.get('m1'))!.text).toBe('mutable by design');
    expect((await db.messages.get('m1'))!.sealed).toBeUndefined();
    const s = (await store.get('settings', 'app'))!;
    expect(s.lock).toEqual({ enabled: false, relockAfterMin: 5 });
  });
});
