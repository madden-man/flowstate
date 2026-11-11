import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import { freshDB, writeSeedParadoxes } from './helpers';
import type { FlowDB } from '../../src/db/schema';
import { ensureSeeded, VALUES_PASS, HUES, BROWN_CHROMA, MANIFESTO, antonymsOf, ANTONYMS, cleanSeedPages, OLD_SEED_PAGES, SEED_PAGES_PASS } from '../../src/db/seed';
import { store, setKey, lock, unlock } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';

let db: FlowDB;
beforeEach(async () => { db = await freshDB(); });

describe('seed', () => {
  it('runs once on an empty database', async () => {
    expect(await ensureSeeded()).toBe(true);
    const counts = await Promise.all(db.tables.map(async t => [t.name, await t.count()]));
    expect(await ensureSeeded()).toBe(false);
    expect(await Promise.all(db.tables.map(async t => [t.name, await t.count()]))).toEqual(counts);
  });

  it('never seeds again once the voices are gone', async () => {
    await ensureSeeded();
    await db.voices.clear();
    expect(await ensureSeeded()).toBe(false);
    expect(await db.voices.count()).toBe(0);
  });

  it('seeds the pantheon: nine light voices, five deep twins, the starred four first', async () => {
    await ensureSeeded();
    const vs = (await store.all('voices')).sort((a, b) => a.order - b.order);
    expect(vs.filter(v => v.shade === 'light').map(v => v.name)).toEqual(
      ['Skeptic', 'Mystic', 'Warrior', 'Architect', 'Meaning Maker', 'Engineer', 'Explorer', 'Sensualist', 'Joker']);
    expect(vs.filter(v => v.shade === 'deep').map(v => v.name).sort()).toEqual(['Addict', 'Phantom', 'Sojourner', 'Victim', 'Workaholic']);
    expect(vs.filter(v => v.starred).map(v => v.name)).toEqual(['Skeptic', 'Mystic', 'Warrior', 'Architect']);
    expect(vs.slice(0, 4).every(v => v.starred)).toBe(true);
    const by = Object.fromEntries(vs.map(v => [v.name, v]));
    expect(by.Skeptic.aka).toEqual(['Thinker', 'Philosopher']);
    expect(by.Phantom.aka).toEqual(['Ghost']);
    expect(by.Sojourner.aka).toEqual(['Ranger']);
    expect(by.Skeptic.colour.hue).toBeNull();
    expect(by.Engineer.colour).toEqual({ hue: HUES.brown, chroma: BROWN_CHROMA });
    // twins point at each other and share a hue
    for (const v of vs.filter(x => x.twinId)) {
      const t = by[vs.find(x => x.id === v.twinId)!.name];
      expect(t.twinId).toBe(v.id);
      expect(t.colour.hue).toBe(v.colour.hue);
      expect(t.shade).not.toBe(v.shade);
    }
  });

  it('takes its hues from tokens.css', () => {
    const css = fs.readFileSync('src/ui/tokens.css', 'utf8');
    for (const [name, hue] of Object.entries(HUES)) expect(css).toMatch(new RegExp(`--h-${name}:\\s*${hue};`));
    expect(css).toMatch(/--v-brown:\s+oklch\(var\(--voice-l\) calc\(var\(--voice-c\) \* \.5\)/);
  });

  it('seeds the two values and no paradoxes (PLAN-VALUES.md section 5), the values pass marked done', async () => {
    await ensureSeeded();
    expect(await db.paradoxes.count()).toBe(0);
    expect(await db.items.count()).toBe(0);
    const vs = (await store.all('values')).sort((a, b) => a.order! - b.order!);
    expect(vs.map(v => [v.id, v.status, v.word, v.shadow, v.looks ?? null, v.order])).toEqual([
      ['value-px-selfless-selfish', 'held', 'selfless', 'selfish', 'vegetable chopping in Evergreen', 0],
      ['value-px-thoughtful-reactive', 'held', 'thoughtful', 'reactive', null, 1],
    ]);
    // what the value has no field for is kept in its first revision: pole B's aspect, and pole A's bracket word
    expect(vs[0].revisions).toEqual([{ at: vs[0].updatedAt, word: 'selfless', shadow: 'selfish', fromParadox: { shadowLooks: 'something that gives breathing room' } }]);
    expect(vs[1].revisions).toEqual([{ at: vs[1].updatedAt, word: 'thoughtful', shadow: 'reactive', fromParadox: { overdone: 'obsessive' } }]);
    expect(vs.every(v => v.champions.length === 0)).toBe(true);
    expect((await store.get('settings', 'app'))!.cleaned).toContain(VALUES_PASS);
  });

  it('keeps the notebook paradoxes, both middles kept as revisions, and the items with their pairs, for the pass', async () => {
    await writeSeedParadoxes();
    const p1 = (await store.get('paradoxes', 'px-selfless-selfish'))!;
    expect([p1.poleA.value, p1.poleB.value]).toEqual(['selfless', 'selfish']);
    expect(p1.middle).toBeUndefined();
    expect(p1.revisions.map(r => r.middle?.word)).toEqual(['compassionate self-awareness', 'balance self with others, fill all needs']);
    const p2 = (await store.get('paradoxes', 'px-thoughtful-reactive'))!;
    expect(p2.poleA).toMatchObject({ value: 'thoughtful', shadow: 'obsessive' });
    expect(p2.poleB.value).toBe('reactive');

    const items = await store.all('items');
    expect(items.filter(i => i.paradoxId === p1.id)).toHaveLength(4);
    expect(items.filter(i => i.paradoxId === p2.id).sort((a, b) => a.order - b.order).map(i => i.text))
      .toEqual(['journaling', 'asking Claude', 'asking a friend', 'giving feedback']);
    for (const i of items.filter(x => x.pairId)) {
      const pair = items.find(x => x.id === i.pairId)!;
      expect(pair.pairId).toBe(i.id);
      expect(pair.pole).not.toBe(i.pole);
    }
    // the notebook's diagonal: A to B, top to bottom (package 3 moved the seed leans to make it true)
    for (const p of [p1, p2]) {
      const mine = items.filter(i => i.paradoxId === p.id).sort((a, b) => a.order - b.order);
      expect(mine.map(i => i.lean)).toEqual([...mine.map(i => i.lean)].sort((a, b) => a - b));
      expect(mine.map(i => i.pole)).toEqual(['a', 'a', 'b', 'b']);
    }
    expect(items.every(i => i.lean >= -1 && i.lean <= 1)).toBe(true);
  });

  it('writes no pages: the journal opens empty, the manifesto stays the threshold copy', async () => {
    await ensureSeeded();
    expect(await db.pages.count()).toBe(0);
    expect(await db.messages.count()).toBe(0);
    expect(MANIFESTO.join(' ')).toBe('I determine my core. I choose how to flow.');
  });

  it('writes default settings: follow the sky, unlocked', async () => {
    await ensureSeeded(42);
    const s = (await store.get('settings', 'app'))!;
    expect(s).toMatchObject({ light: 'sky', stillAfterMidnight: 'offer', sounds: true, haptics: true, seededAt: 42, lock: { enabled: false } });
  });

  it('offers antonyms both ways, never fills them in', () => {
    expect(antonymsOf('Selfless')).toEqual(['selfish']);
    expect(antonymsOf('reactive')).toEqual(['thoughtful']);
    expect(antonymsOf('zzz')).toEqual([]);
    expect(new Set(ANTONYMS.flat()).size).toBe(ANTONYMS.length * 2);
  });
});

describe('the seed pages pass (V5)', () => {
  // A journal as packages 1 to 8 seeded it: settings without the pass, and the two seed pages.
  async function oldJournal() {
    await ensureSeeded();
    await writeSeedParadoxes();
    await db.settings.update('app', { cleaned: undefined, seedsAdded: ['models'] } as never);
    for (const { page, messages } of OLD_SEED_PAGES) await store.many({ pages: [page], messages });
  }
  const ids = async () => (await store.all('pages')).map(p => p.id).sort();

  it('removes both pages and their lines when they were never written on, and marks the pass', async () => {
    await oldJournal();
    expect((await cleanSeedPages())!.sort()).toEqual(['pg-manifesto', 'pg-models']);
    expect(await db.pages.count()).toBe(0);
    expect(await db.messages.count()).toBe(0);
    const s = (await store.get('settings', 'app'))!;
    expect(s.cleaned).toEqual([SEED_PAGES_PASS]);
    expect('seedsAdded' in s).toBe(false);
  });

  it('keeps a page with a line added', async () => {
    await oldJournal();
    await store.put('messages', { id: 'm-mine', pageId: 'pg-models', at: 9, text: 'and Dad', kept: false });
    expect(await cleanSeedPages()).toEqual(['pg-manifesto']);
    expect(await ids()).toEqual(['pg-models']);
    expect((await store.all('messages')).map(m => m.id).sort()).toEqual(['m-mine', 'm-models-1']);
  });

  it('keeps a page whose kept flag, text, title, tags, links or state changed', async () => {
    await oldJournal();
    const m = (await store.get('messages', 'm-manifesto-2'))!;
    await store.put('messages', { ...m, kept: false });
    const p = (await store.get('pages', 'pg-models'))!;
    await store.put('pages', { ...p, state: 'answered' });
    expect(await cleanSeedPages()).toEqual([]);
    expect(await ids()).toEqual(['pg-manifesto', 'pg-models']);
    for (const change of [{ title: 'Who are my teachers?' }, { tags: ['family'] }, { linkedPageIds: ['pg-x'] }]) {
      await oldJournal();
      await store.put('pages', { ...OLD_SEED_PAGES[1].page, ...change });
      await cleanSeedPages();
      expect(await store.get('pages', 'pg-models')).toBeDefined();
    }
    await oldJournal();
    await store.put('messages', { ...OLD_SEED_PAGES[0].messages[0], text: 'I determine my own core.' });
    expect(await cleanSeedPages()).toEqual(['pg-models']);
  });

  it('runs once: a seed page put back later stays', async () => {
    await oldJournal();
    await cleanSeedPages();
    await store.many({ pages: [OLD_SEED_PAGES[0].page], messages: OLD_SEED_PAGES[0].messages });
    expect(await cleanSeedPages()).toBeNull();
    expect(await ids()).toEqual(['pg-manifesto']);
  });

  it('a fresh journal has nothing to do and nothing else is touched', async () => {
    await ensureSeeded();
    const before = await Promise.all(db.tables.map(async t => [t.name, await t.toArray()]));
    expect(await cleanSeedPages()).toBeNull();
    expect(await Promise.all(db.tables.map(async t => [t.name, await t.toArray()]))).toEqual(before);
  });

  it('leaves every voice, renamed or added, and both paradoxes', async () => {
    await oldJournal();
    const v = (await store.get('voices', 'v-joker'))!;
    await store.put('voices', { ...v, name: 'Jester' });
    await store.put('voices', { ...v, id: 'v-mine', name: 'Gardener' });
    await cleanSeedPages();
    expect((await store.all('voices')).map(x => x.name)).toEqual(expect.arrayContaining(['Jester', 'Gardener', 'Skeptic']));
    expect(await db.voices.count()).toBe(15); // the fourteen seeded and the one added
    expect(await db.paradoxes.count()).toBe(2);
    expect(await db.items.count()).toBe(8);
  });

  it('locked, it does nothing and waits for the next open; opened, it reads the sealed title and runs', async () => {
    await oldJournal();
    const salt = randomSalt();
    const key = await deriveKey('3569', salt, 1000);
    await setKey(key, { salt, iterations: 1000 });
    lock();
    expect(await cleanSeedPages()).toBeNull();
    expect(await db.pages.count()).toBe(2);
    expect(await unlock(key)).toBe(true);
    expect((await cleanSeedPages())!.sort()).toEqual(['pg-manifesto', 'pg-models']);
    expect((await store.get('settings', 'app'))!.cleaned).toEqual([SEED_PAGES_PASS]);
  });

  it('sweeps seed lines left without their page by a stop halfway', async () => {
    await oldJournal();
    await db.pages.delete('pg-manifesto');
    expect(await cleanSeedPages()).toEqual(['pg-models']);
    expect(await db.messages.count()).toBe(0);
  });
});
