import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import { freshDB } from './helpers';
import type { FlowDB } from '../../src/db/schema';
import { ensureSeeded, HUES, BROWN_CHROMA, MANIFESTO, antonymsOf, ANTONYMS } from '../../src/db/seed';
import { store } from '../../src/db/fields';

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

  it('seeds both paradoxes, both middles kept as revisions, and the items with their pairs', async () => {
    await ensureSeeded();
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
      expect(pair.lean).toBe(i.lean);
    }
    expect(items.every(i => i.lean >= -1 && i.lean <= 1)).toBe(true);
  });

  it('makes the manifesto the first page, both lines kept', async () => {
    await ensureSeeded();
    const pages = await store.all('pages');
    expect(pages).toHaveLength(1);
    const ms = (await store.all('messages')).sort((a, b) => a.at - b.at);
    expect(ms.map(m => m.text)).toEqual(['I determine my core.', 'I choose how to flow.']);
    expect(MANIFESTO.join(' ')).toBe('I determine my core. I choose how to flow.');
    expect(ms.every(m => m.kept && m.pageId === pages[0].id)).toBe(true);
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
