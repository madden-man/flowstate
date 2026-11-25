// Resolving a question by the word (PLAN-BLOCKERS.md K0, resolveQuestion: the ? tab and a question page), and the
// mountain's flow fields and a sign's deck still travelling in a backup, unread, after the mountain left the app
// (PLAN-WORLDS.md section 4.1: nothing is deleted).
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import { store, setKey, lock, LockedError } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { ensureSeeded, seedFlowsOnce } from '../../src/db/seed';
import type { FlowDB } from '../../src/db/schema';
import { exportData, importData, parseBackup } from '../../src/db/backup';
import { askQuestion, writeLine, answerWith, resolveQuestion, pageById } from '../../src/model/pages';

let db: FlowDB;
beforeEach(async () => { db = await freshDB(); });

const lockWith = async (pin = '2580') => {
  const salt = randomSalt();
  const key = await deriveKey(pin, salt, 1000);
  await setKey(key, { salt, iterations: 1000 });
  return key;
};

describe('resolveQuestion (the word on the ? tab and a question page)', () => {
  const D5 = new Date(2026, 10, 5, 9).getTime();
  const D6 = new Date(2026, 10, 6, 9).getTime();

  it('resolves with nothing written, and takes it back', async () => {
    await ensureSeeded();
    const q = await askQuestion('What would enough look like?', D5);
    const r = await resolveQuestion(q.id, true, D6);
    expect(r).toMatchObject({ state: 'answered', answeredAt: D6, resolvedByTap: true, updatedAt: D6 });
    expect((await pageById(q.id))!.page.resolvedByTap).toBe(true);
    const back = (await resolveQuestion(q.id, false, D6 + 1))!;
    expect(back.state).toBe('open');
    expect(back.answeredAt).toBeUndefined();
    expect(back.resolvedByTap).toBeUndefined();
    expect('resolvedByTap' in (await db.pages.get(q.id))!).toBe(false);
  });

  it('a repeat, an entry, or no page writes nothing', async () => {
    await ensureSeeded();
    const q = await askQuestion('Q', D5);
    await resolveQuestion(q.id, true, D6);
    expect((await resolveQuestion(q.id, true, D6 + 5))!.answeredAt).toBe(D6);
    expect(await resolveQuestion('nope', true)).toBeUndefined();
    const e = await writeLine(undefined, undefined, { text: 'an entry' }, D5);
    expect((await resolveQuestion(e!.page.id, true, D6))!.state).toBe('open');
  });

  it('resolved by the word, unmarking its last wise line does not reopen it; resolved by a line, it does', async () => {
    await ensureSeeded();
    const q = await askQuestion('Who are my models?', D5);
    const a = await writeLine(q, undefined, { text: 'Grumpa.' }, D5 + 1);
    let p = (await answerWith(a!.page, a!.message!, true, D6)).page;
    p = (await resolveQuestion(p.id, true, D6))!;
    // already answered by the line: the word leaves it as it is, so it is not marked
    expect(p.resolvedByTap).toBeUndefined();
    p = (await answerWith(p, a!.message!, false, D6 + 1)).page;
    expect(p.state).toBe('open');

    const t = await askQuestion('What is the next thing?', D5);
    const b = await writeLine(t, undefined, { text: 'Call Mom.' }, D5 + 1);
    let tp = (await answerWith(b!.page, b!.message!, true, D6)).page;
    tp = (await resolveQuestion(tp.id, false, D6))!;
    tp = (await resolveQuestion(tp.id, true, D6 + 1))!;
    expect(tp.resolvedByTap).toBe(true);
    tp = (await answerWith(tp, b!.message!, false, D6 + 2)).page;
    expect(tp.state).toBe('answered');
    expect(tp.answeredAt).toBe(D6 + 1);
    // emptying the line keeps it resolved too
    const gone = await writeLine(tp, b!.message!.id, { text: '' }, D6 + 3);
    expect(gone!.page.state).toBe('answered');
  });

  it('refuses while locked', async () => {
    await ensureSeeded();
    const q = await askQuestion('Q', D5);
    await lockWith();
    lock();
    await expect(resolveQuestion(q.id, true)).rejects.toBeInstanceOf(LockedError);
  });
});

describe('backup still carries what the mountain left (PLAN-WORLDS.md section 4.1)', () => {
  const deck = [{ id: 'heart-1', text: 'Who is Grandpa to you now?' }, { id: 'heart-2', text: 'What did you keep?', resolvedAt: 2 }];

  it('both ways: alsoUnder, offSigns, draft, a sign\'s deck and resolvedByTap', async () => {
    await ensureSeeded();
    await seedFlowsOnce();
    const night = (await store.get('flows', 'night'))!;
    await store.put('flows', { ...night, alsoUnder: ['root'], offSigns: ['root'] });
    await store.put('flows', { ...night, id: 'numbing', name: 'Numbing', chakra: 'sacral', draft: true, alsoUnder: undefined, offSigns: undefined });
    await store.put('signShelves', { id: 'heart', picks: [], updatedAt: 3, deck });
    const q = await askQuestion('Q', 4);
    await resolveQuestion(q.id, true, 5);
    const file = parseBackup(JSON.stringify(await exportData(db, 1000)));
    const other = await freshDB();
    await importData(file, 'replace', other);
    expect((await other.flows.get('night'))!).toMatchObject({ alsoUnder: ['root'], offSigns: ['root'], chakra: 'crown' });
    expect((await other.flows.get('numbing'))!.draft).toBe(true);
    expect((await other.pages.get(q.id))!.resolvedByTap).toBe(true);
    expect((await store.get('signShelves', 'heart'))!.deck).toEqual(deck);
    expect((await exportData(other, 1000)).tables).toEqual((await exportData(db, 1000)).tables);
  });

  it('sealed: the deck travels sealed and opens with the file\'s PIN', async () => {
    await ensureSeeded();
    await store.put('signShelves', { id: 'root', picks: [], updatedAt: 2, deck });
    const key = await lockWith();
    const file = parseBackup(JSON.stringify(await exportData(db, 1000)));
    expect(JSON.stringify(file.tables.signShelves)).not.toMatch(/Grandpa/);
    const other = await freshDB();
    await importData(file, 'replace', other, key);
    expect((await store.get('signShelves', 'root'))!.deck).toEqual(deck);
  });
});
