// What each sign is for (PLAN-SIGN-LINES.md, L1): the seven starter lines and pairs on CHAKRAS, inside the copy rules
// of section 2, and the line his to rewrite (lineOf, setLine): kept on the sign's shelf row, sealed with it, the
// starter when absent or empty, and every other write to the row keeping it.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import { store, setKey, lock, unlock, LockedError } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { ensureSeeded } from '../../src/db/seed';
import type { FlowDB } from '../../src/db/schema';
import { CHAKRA_IDS, CHAKRAS, chakraOf } from '../../src/model/mountain';
import {
  STARTERS, shelf, addPick, removePick, setAsk, asksOf, deckOf, resolveAsk, setDeck, starterAskId, lineOf, setLine,
} from '../../src/model/acts';

const lockWith = async (pin = '2580') => {
  await ensureSeeded();
  const salt = randomSalt();
  const key = await deriveKey(pin, salt, 1000);
  await setKey(key, { salt, iterations: 1000 });
  return key;
};

describe('the seven lines and pairs (section 2)', () => {
  it('are the plan\'s, verbatim, summit to foot', () => {
    expect(CHAKRAS.map(c => [c.line, c.versus.join(' vs. ')])).toEqual([
      ['You want to rest in something larger. You keep a hand on everything.', 'Letting go vs. holding on'],
      ['You want to see what is true. The old story speaks first.', 'Seeing vs. the story'],
      ['You want to be heard as you are. Saying it risks the answer.', 'Saying it vs. swallowing it'],
      ['You want to love and be loved. What you love can be lost.', 'Opening vs. guarding'],
      ['You want to act and to matter. One failure reads like a verdict.', 'Will vs. shame'],
      ['You want to feel alive. Feeling lets the pain in too.', 'Feeling vs. numbing'],
      ['You want to be safe. The alarm rings when nothing is wrong.', 'Safety vs. fear'],
    ]);
  });
  it('each line: second person, two short sentences, 70 characters at most, no advice, no dash, no tradition', () => {
    for (const c of CHAKRAS) {
      expect(c.line.length, c.id).toBeLessThanOrEqual(70);
      expect(c.line, c.id).toMatch(/^You want to [^.]+\. [^.]+\.$/);
      expect(c.line, c.id).not.toMatch(/—|–|\bshould\b/i);
      expect(c.line, c.id).not.toMatch(/sahasrara|ajna|vishuddha|anahata|manipura|svadhisthana|muladhara|lotus|petal|element|seed/i);
    }
  });
  it('each pair: the want then what works against it, three words at most a side, the right side lower case', () => {
    for (const c of CHAKRAS) {
      expect(c.versus, c.id).toHaveLength(2);
      for (const w of c.versus) expect(w.split(' ').length, `${c.id} ${w}`).toBeLessThanOrEqual(3);
      expect(c.versus[0][0], c.id).toMatch(/[A-Z]/);
      expect(c.versus[1][0], c.id).toMatch(/[a-z]/);
      expect(c.versus.join(' '), c.id).not.toMatch(/—|–/);
    }
    // the gloss stays for the mountain
    expect(chakraOf('root').gloss).toBe('Root · feeling safe');
  });
});

describe('lineOf and setLine (section 7)', () => {
  let db: FlowDB;
  beforeEach(async () => { db = await freshDB(); });

  it('reads the starter with no row, and writes nothing to read it', async () => {
    for (const c of CHAKRA_IDS) expect(await lineOf(c)).toBe(chakraOf(c).line);
    expect(await db.signShelves.count()).toBe(0);
  });
  it('a rewrite is one line, trimmed, kept on the row; the starter\'s own words or an empty rule put the starter back', async () => {
    expect(await setLine('heart', '  You want to be held.\n  You hold   back. ', 100)).toBe('You want to be held. You hold back.');
    expect(await lineOf('heart')).toBe('You want to be held. You hold back.');
    const row = (await store.get('signShelves', 'heart'))!;
    expect(row.line).toBe('You want to be held. You hold back.');
    expect(row.updatedAt).toBe(100);
    // a row with no shelf of his own gets the starters as picks, so the shelf reads as it did
    expect(await shelf('heart')).toEqual(STARTERS.heart);
    expect(await setLine('heart', '   ', 200)).toBe(chakraOf('heart').line);
    expect((await store.get('signShelves', 'heart'))!.line).toBeUndefined();
    await setLine('heart', 'Mine.', 300);
    expect(await setLine('heart', ` ${chakraOf('heart').line} `, 400)).toBe(chakraOf('heart').line);
    expect((await store.get('signShelves', 'heart'))!.line).toBeUndefined();
  });
  it('putting the starter back on a sign with no row, or a line unchanged, writes nothing', async () => {
    await setLine('root', '', 1);
    await setLine('root', chakraOf('root').line, 2);
    expect(await db.signShelves.count()).toBe(0);
    await setLine('root', 'Mine.', 3);
    await setLine('root', ' Mine. ', 4);
    expect((await store.get('signShelves', 'root'))!.updatedAt).toBe(3);
  });
  it('the line keeps the shelf, the asks and the deck; each of them keeps the line', async () => {
    await removePick('crown', STARTERS.crown[0].id, 1);
    await setAsk('crown', 0, 'What is mine to carry?', 2);
    await setLine('crown', 'You want rest. You hold on.', 3);
    expect((await shelf('crown')).length).toBe(STARTERS.crown.length - 1);
    expect((await asksOf('crown'))[0]).toBe('What is mine to carry?');
    await addPick('crown', { kind: 'film', title: 'Elf', id: 'elf' }, 4);
    await setAsk('crown', 1, 'What can wait?', 5);
    await resolveAsk('crown', starterAskId('crown', 2), true, 6);
    await setDeck('crown', (await deckOf('crown')).open.map(q => q.text), 7);
    await setAsk('crown', 0, 'What else?', 8);
    expect(await lineOf('crown')).toBe('You want rest. You hold on.');
    await setLine('crown', 'You want rest. You hold on tight.', 9);
    const row = (await store.get('signShelves', 'crown'))!;
    expect(row.deck?.length).toBeGreaterThan(0);
    expect(row.asks?.[0]).toBe('What is mine to carry?');
    expect(row.picks.at(-1)?.id).toBe('elf');
    expect(row.line).toBe('You want rest. You hold on tight.');
  });
  it('refuses an unknown sign', async () => {
    await expect(lineOf('elbow' as never)).rejects.toThrow();
    await expect(setLine('elbow' as never, 'x')).rejects.toThrow();
  });
  it('sealed with the picks: not in the database in the clear, empty while locked, his again once open', async () => {
    await setLine('throat', 'You want to say it. Grandpa would not.', 1);
    const key = await lockWith();
    const raw = (await db.signShelves.get('throat'))!;
    expect(raw.line).toBeUndefined();
    expect(raw.sealed).toBeTruthy();
    expect(JSON.stringify(raw)).not.toMatch(/Grandpa/);
    lock();
    expect(await lineOf('throat')).toBe('');
    expect(await lineOf('root')).toBe('');
    await expect(setLine('throat', 'x')).rejects.toBeInstanceOf(LockedError);
    expect(await unlock(key)).toBe(true);
    expect(await lineOf('throat')).toBe('You want to say it. Grandpa would not.');
    expect(await lineOf('root')).toBe(chakraOf('root').line);
  });
});
