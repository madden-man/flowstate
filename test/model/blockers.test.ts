// Blockers and questions under each sign (PLAN-BLOCKERS.md, K0): the starter deck and its reads and writes (sections 5
// and 6), resolving a question by the word (resolveQuestion), what blocks a sign (blockersOf, strikeOff, listUnder), the
// one-time seed pass of the second listings and the six candidates (section 4), and backup both ways.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import { store, setKey, lock, unlock, LockedError } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { ensureSeeded, seedBlockersOnce, BLOCKERS_PASS } from '../../src/db/seed';
import { BLOCKER_DRAFTS, SEED_ALSO_UNDER } from '../../src/db/seed/blockers';
import { SCHEMA_VERSION, type FlowDB } from '../../src/db/schema';
import { exportData, importData, parseBackup } from '../../src/db/backup';
import { CHAKRA_IDS, blockersOf, blockerSheetOf, strikeOff, listUnder } from '../../src/model/mountain';
import { STARTER_ASKS, STARTER_DECK, STARTERS, starterAskId, deckOf, resolveAsk, setDeck, asksOf, setAsk, shelf, addPick } from '../../src/model/acts';
import { askQuestion, writeLine, answerWith, resolveQuestion, pageById } from '../../src/model/pages';
import { startEpisode } from '../../src/model/flows';

let db: FlowDB;
beforeEach(async () => { db = await freshDB(); });

const lockWith = async (pin = '2580') => {
  const salt = randomSalt();
  const key = await deriveKey(pin, salt, 1000);
  await setKey(key, { salt, iterations: 1000 });
  return key;
};
const texts = (qs: { text: string }[]) => qs.map(q => q.text);

describe('the starter deck (section 6)', () => {
  it('seven a sign: today\'s three first, then the four of section 6, verbatim, with no em dash', () => {
    expect(Object.keys(STARTER_DECK)).toEqual([...CHAKRA_IDS]);
    for (const c of CHAKRA_IDS) {
      expect(STARTER_DECK[c]).toHaveLength(7);
      expect(STARTER_DECK[c].slice(0, 3)).toEqual([...STARTER_ASKS[c]]);
      expect(new Set(STARTER_DECK[c]).size).toBe(7);
      for (const q of STARTER_DECK[c]) expect(q).not.toMatch(/\u2014|\u2013/);
    }
    expect(STARTER_DECK.root.slice(3)).toEqual([
      'Where in the body is it quiet?', 'What is happening, apart from the fear?', 'Who or what is solid right now?', 'What does the alarm want you to do?',
    ]);
    expect(STARTER_DECK.crown[3]).toBe('What are you trying to control that will not be controlled?');
  });
});

describe('the deck (section 5)', () => {
  it('absent, it reads as the starters with stable ids, writing nothing; asksOf is its first three', async () => {
    const d = await deckOf('heart');
    expect(texts(d.open)).toEqual([...STARTER_DECK.heart]);
    expect(d.open.map(q => q.id)).toEqual(STARTER_DECK.heart.map((_, i) => starterAskId('heart', i)));
    expect(d.resolved).toEqual([]);
    expect(await asksOf('heart')).toEqual([...STARTER_ASKS.heart]);
    expect(await db.signShelves.count()).toBe(0);
  });

  it('his rewritten asks lie over the first three until a deck is stored', async () => {
    await setAsk('throat', 1, 'Who needs to hear it?', 1);
    const d = await deckOf('throat');
    expect(texts(d.open).slice(0, 4)).toEqual(['What did you not say?', 'Who needs to hear it?', 'What do you want them to understand?', STARTER_DECK.throat[3]]);
    expect(d.open[1].id).toBe(starterAskId('throat', 1));
  });

  it('a resolve stores the deck whole, asks left as they were; the next open one comes up in asksOf', async () => {
    await setAsk('throat', 0, 'What did you swallow?', 1);
    const d = await resolveAsk('throat', starterAskId('throat', 0), true, 50);
    expect(d.resolved).toEqual([{ id: 'throat-1', text: 'What did you swallow?', resolvedAt: 50 }]);
    expect(texts(d.open)).toEqual(STARTER_DECK.throat.slice(1));
    const row = (await db.signShelves.get('throat'))!;
    expect(row.deck).toHaveLength(7);
    expect(row.asks).toEqual(['What did you swallow?', '', '']);
    expect(row.updatedAt).toBe(50);
    expect(await asksOf('throat')).toEqual(STARTER_DECK.throat.slice(1, 4));
  });

  it('taking a resolve back puts it where it stood; an unknown id or a repeat writes nothing', async () => {
    await resolveAsk('crown', 'crown-2', true, 10);
    expect(await asksOf('crown')).toEqual([STARTER_DECK.crown[0], STARTER_DECK.crown[2], STARTER_DECK.crown[3]]);
    const back = await resolveAsk('crown', 'crown-2', false, 11);
    expect(texts(back.open)).toEqual([...STARTER_DECK.crown]);
    expect(back.resolved).toEqual([]);
    expect(back.open[1]).toEqual({ id: 'crown-2', text: STARTER_DECK.crown[1] });
    await resolveAsk('crown', 'nope', true, 12);
    await resolveAsk('crown', 'crown-2', false, 13);
    expect((await db.signShelves.get('crown'))!.updatedAt).toBe(11);
    // nothing stored on a sign never touched
    await resolveAsk('root', 'nope', true, 14);
    expect(await db.signShelves.get('root')).toBeUndefined();
  });

  it('with every question resolved the block shows what is left, fewer than three', async () => {
    for (let i = 0; i < 6; i++) await resolveAsk('sacral', starterAskId('sacral', i), true, i);
    expect(await asksOf('sacral')).toEqual([STARTER_DECK.sacral[6]]);
    await resolveAsk('sacral', 'sacral-7', true, 7);
    expect(await asksOf('sacral')).toEqual([]);
    expect((await deckOf('sacral')).resolved).toHaveLength(7);
  });

  it('a resolve or a deck keeps the shelf, and a shelf change keeps the deck', async () => {
    await addPick('heart', { kind: 'film', title: 'Paddington 2', id: 'pad' }, 1);
    await resolveAsk('heart', 'heart-1', true, 2);
    expect((await shelf('heart')).at(-1)!.id).toBe('pad');
    await addPick('heart', { kind: 'film', title: 'Elf', id: 'elf' }, 3);
    expect((await deckOf('heart')).resolved.map(q => q.id)).toEqual(['heart-1']);
    // a sign with no row gets its starters as its shelf
    await resolveAsk('root', 'root-1', true, 4);
    expect(await shelf('root')).toEqual(STARTERS.root);
  });
});

describe('setDeck (the sheet)', () => {
  it('rewrites in place keeping the id, removes an emptied rule, adds the blank last rule, one line each', async () => {
    const d0 = await deckOf('heart');
    const sheet = texts(d0.open);
    sheet[1] = '  What is\n heavy tonight? ';
    sheet[4] = '';
    sheet.push('Who would you call first?');
    const d = await setDeck('heart', sheet, 9);
    expect(texts(d.open)).toEqual([
      STARTER_DECK.heart[0], 'What is heavy tonight?', STARTER_DECK.heart[2], STARTER_DECK.heart[3], STARTER_DECK.heart[5], STARTER_DECK.heart[6], 'Who would you call first?',
    ]);
    expect(d.open[1].id).toBe('heart-2');
    expect(d.open.map(q => q.id)).not.toContain('heart-5');
    expect(d.open[6].id).not.toMatch(/^heart-/);
    expect((await db.signShelves.get('heart'))!.updatedAt).toBe(9);
    expect(await asksOf('heart')).toEqual([STARTER_DECK.heart[0], 'What is heavy tonight?', STARTER_DECK.heart[2]]);
  });

  it('a reorder keeps every id', async () => {
    const d0 = await deckOf('root');
    const sheet = texts(d0.open).reverse();
    const d = await setDeck('root', sheet, 1);
    expect(d.open.map(q => q.id)).toEqual(d0.open.map(q => q.id).reverse());
  });

  it('an open deck left under three is filled back from the starters not in it; resolved ones stay resolved and are kept', async () => {
    await resolveAsk('crown', 'crown-4', true, 1);
    const d = await setDeck('crown', ['Mine only', '', ''], 2);
    // the first rule rewritten in its place keeps crown-1; the two emptied are filled back from crown-2 and crown-3
    // (rule 37: an emptied rule puts its starter back), and crown-4 is resolved, so not back
    expect(texts(d.open)).toEqual(['Mine only', STARTER_DECK.crown[1], STARTER_DECK.crown[2]]);
    expect(d.open[0].id).toBe('crown-1');
    expect(d.resolved.map(q => q.id)).toEqual(['crown-4']);
    // emptied all the way, the starters come back but never the resolved one, and a text already there is not doubled
    const e = await setDeck('crown', [STARTER_DECK.crown[2]], 3);
    expect(texts(e.open)).toEqual([STARTER_DECK.crown[2], STARTER_DECK.crown[0], STARTER_DECK.crown[1]]);
  });

  it('with every starter resolved, nothing refills', async () => {
    for (let i = 0; i < 7; i++) await resolveAsk('throat', starterAskId('throat', i), true, i);
    const d = await setDeck('throat', ['Only this one'], 9);
    expect(texts(d.open)).toEqual(['Only this one']);
    expect(d.resolved).toHaveLength(7);
  });

  it('setAsk on a stored deck rewrites the open question at that place', async () => {
    await resolveAsk('solar-plexus', 'solar-plexus-1', true, 1);
    expect(await setAsk('solar-plexus', 0, 'What would you do today?', 2)).toEqual([
      'What would you do today?', STARTER_DECK['solar-plexus'][2], STARTER_DECK['solar-plexus'][3],
    ]);
    expect((await deckOf('solar-plexus')).open[0].id).toBe('solar-plexus-2');
  });

  it('sealed with the picks: no words of his in the database, none while locked, all of them once open', async () => {
    await ensureSeeded();
    await setDeck('heart', ['Who is Grandpa to you now?'], 1);
    await resolveAsk('heart', 'heart-2', true, 2);
    const key = await lockWith();
    const raw = (await db.signShelves.get('heart'))!;
    expect(raw.deck).toBeUndefined();
    expect(JSON.stringify(raw)).not.toMatch(/Grandpa|missing/);
    lock();
    expect(await deckOf('heart')).toEqual({ open: [], resolved: [] });
    expect(await asksOf('heart')).toEqual([]);
    await expect(resolveAsk('heart', 'heart-3', true)).rejects.toBeInstanceOf(LockedError);
    await expect(setDeck('heart', ['x'])).rejects.toBeInstanceOf(LockedError);
    expect(await unlock(key)).toBe(true);
    expect(texts((await deckOf('heart')).open)[0]).toBe('Who is Grandpa to you now?');
    expect((await deckOf('heart')).resolved.map(q => q.id)).toEqual(['heart-2']);
  });

  it('refuses an unknown sign', async () => {
    await expect(deckOf('elbow' as never)).rejects.toThrow();
    await expect(setDeck('elbow' as never, [])).rejects.toThrow();
    await expect(resolveAsk('elbow' as never, 'x', true)).rejects.toThrow();
  });
});

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

describe('the seed pass (section 4)', () => {
  it('a fresh journal gets the three second listings and the six candidates, once', async () => {
    await ensureSeeded();
    const written = await seedBlockersOnce();
    expect(written!.sort()).toEqual(['night', 'replay', 'whatif', ...BLOCKER_DRAFTS.map(f => f.id)].sort());
    expect((await store.get('flows', 'night'))!.alsoUnder).toEqual(['root']);
    expect((await store.get('flows', 'replay'))!.alsoUnder).toEqual(['crown']);
    expect((await store.get('flows', 'whatif'))!.alsoUnder).toEqual(['third-eye']);
    const g = (await store.get('flows', 'gripping'))!;
    expect(g).toMatchObject({ name: 'Gripping', chakra: 'crown', diagram: 'ring', draft: true });
    expect(g.steps.map(s => s.name)).toEqual(['Planning', 'Re-planning', 'Checking', 'Tighter']);
    expect(g.steps.every(s => s.tips.length === 0 && !s.said && !s.line)).toBe(true);
    expect(g.revisions).toHaveLength(1);
    expect((await store.get('settings', 'app'))!.cleaned).toContain(BLOCKERS_PASS);
    expect(await seedBlockersOnce()).toEqual([]);
  });

  it('the candidates are the plan\'s, one under each sign but Root, step words verbatim', () => {
    expect(BLOCKER_DRAFTS.map(f => [f.name, f.chakra, f.diagram, f.steps.map(s => s.name).join(', ')])).toEqual([
      ['Gripping', 'crown', 'ring', 'Planning, Re-planning, Checking, Tighter'],
      ["Can't choose", 'third-eye', 'fork', 'Two doors, More research, Asking everyone, Neither'],
      ['Swallowed it', 'throat', 'stairs', 'Almost said, Let it pass, Rehearsing, Resenting'],
      ['Missing someone', 'heart', 'curve', 'A reminder, The wave, Aching, Easing'],
      ["Can't start", 'solar-plexus', 'valley', 'Should, Putting off, Dread, One small piece'],
      ['Numbing', 'sacral', 'coil', 'Restless, Reaching, Scrolling, Hollow'],
    ]);
    expect(Object.keys(SEED_ALSO_UNDER).sort()).toEqual(['night', 'replay', 'whatif']);
  });

  it('a flow he deleted gets nothing, his own alsoUnder is kept, a candidate he deletes never comes back', async () => {
    await ensureSeeded();
    await db.flows.delete('replay');
    await db.flows.update('night', { alsoUnder: ['heart'] });
    await db.flows.update('whatif', { updatedAt: 77 });
    const written = await seedBlockersOnce();
    expect(written).not.toContain('replay');
    expect(written).not.toContain('night');
    expect(await db.flows.get('replay')).toBeUndefined();
    expect((await db.flows.get('night'))!.alsoUnder).toEqual(['heart']);
    // a clear field, added as the mountain added chakra: no new date, no revision
    const w = (await db.flows.get('whatif'))!;
    expect(w.updatedAt).toBe(77);
    await db.flows.delete('numbing');
    expect(await seedBlockersOnce()).toEqual([]);
    expect(await db.flows.get('numbing')).toBeUndefined();
  });

  it('locked, it waits; sealed, the candidates keep their names under the PIN', async () => {
    await ensureSeeded();
    const key = await lockWith();
    lock();
    expect(await seedBlockersOnce()).toBeNull();
    expect(await db.flows.get('gripping')).toBeUndefined();
    expect(await unlock(key)).toBe(true);
    expect((await seedBlockersOnce())!.length).toBe(9);
    const raw = (await db.flows.get('gripping'))!;
    expect(JSON.stringify(raw)).not.toMatch(/Gripping|Planning/);
    expect(raw.draft).toBe(true);
    expect(raw.chakra).toBe('crown');
    expect((await db.flows.get('night'))!.alsoUnder).toEqual(['root']);
  });

  it('runs no Dexie version: the schema stays 9', () => {
    expect(SCHEMA_VERSION).toBe(9);
  });
});

describe('blockersOf, strikeOff, listUnder (sections 2 and 5)', () => {
  beforeEach(async () => { await ensureSeeded(); await seedBlockersOnce(); });
  const names = async (c: Parameters<typeof blockersOf>[0]) => (await blockersOf(c)).map(b => b.flow.id);

  it('each sign lists its own and its second listings, in list order', async () => {
    expect(await names('root')).toEqual(['panic', 'whatif', 'night']);
    expect(await names('crown')).toEqual(['replay', 'night', 'gripping']);
    expect(await names('third-eye')).toEqual(['whatif', 'replay', 'cant-choose']);
    expect(await names('throat')).toEqual(['fight', 'swallowed-it']);
    expect(await names('heart')).toEqual(['depress', 'missing-someone']);
    expect(await names('solar-plexus')).toEqual(['shame', 'cant-start']);
    expect(await names('sacral')).toEqual(['shutdown', 'numbing']);
    for (const c of CHAKRA_IDS) expect((await names(c)).includes('energize')).toBe(false);
  });

  it('a live one comes first, with its episode', async () => {
    const e = await startEpisode('night', ['night-1'], 5);
    const rows = await blockersOf('root');
    expect(rows.map(b => b.flow.id)).toEqual(['night', 'panic', 'whatif']);
    expect(rows[0].live!.id).toBe(e.id);
    expect(rows[1].live).toBeUndefined();
    expect('live' in rows[1]).toBe(false);
  });

  it('struck off one sign, it leaves that sign only, and is kept whole; put back, it returns to its place', async () => {
    const f = (await strikeOff('night', 'root', true, 10))!;
    expect(f.offSigns).toEqual(['root']);
    expect(f.updatedAt).toBe(10);
    expect(await names('root')).toEqual(['panic', 'whatif']);
    expect(await names('crown')).toContain('night');
    expect((await store.get('flows', 'night'))!.steps.length).toBeGreaterThan(0);
    expect((await blockerSheetOf('root')).map(r => [r.flow.id, r.struck])).toEqual([['panic', false], ['whatif', false], ['night', true]]);
    // its own sign too
    await strikeOff('panic', 'root', true, 11);
    expect(await names('root')).toEqual(['whatif']);
    const back = (await strikeOff('night', 'root', false, 12))!;
    expect(back.offSigns).toBeUndefined();
    expect(await names('root')).toEqual(['whatif', 'night']);
  });

  it('a sign it is not listed under, or a repeat, writes nothing', async () => {
    expect((await strikeOff('fight', 'root', true, 20))!.offSigns).toBeUndefined();
    await strikeOff('fight', 'throat', true, 21);
    expect((await strikeOff('fight', 'throat', true, 22))!.updatedAt).toBe(21);
    expect(await strikeOff('nope', 'root', true)).toBeUndefined();
    await expect(strikeOff('fight', 'elbow' as never, true)).rejects.toThrow();
  });

  it('listUnder lists a flow under another sign, or puts back one struck there', async () => {
    const f = (await listUnder('fight', 'heart', 30))!;
    expect(f.alsoUnder).toEqual(['heart']);
    expect(await names('heart')).toEqual(['depress', 'fight', 'missing-someone']);
    await strikeOff('depress', 'heart', true, 31);
    const d = (await listUnder('depress', 'heart', 32))!;
    expect(d.offSigns).toBeUndefined();
    expect(d.alsoUnder).toBeUndefined();
    expect((await listUnder('fight', 'heart', 33))!.updatedAt).toBe(30);
  });

  it('struck and listed signs are clear fields: a locked journal still lists the rows, and refuses to change them', async () => {
    await strikeOff('night', 'root', true, 40);
    const key = await lockWith();
    lock();
    expect(await names('root')).toEqual(['panic', 'whatif']);
    await expect(strikeOff('night', 'root', false)).rejects.toBeInstanceOf(LockedError);
    expect(await unlock(key)).toBe(true);
  });
});

describe('backup carries the new fields (section 5)', () => {
  it('both ways: alsoUnder, offSigns, draft, the deck and resolvedByTap', async () => {
    await ensureSeeded();
    await seedBlockersOnce();
    await strikeOff('night', 'root', true, 1);
    await resolveAsk('heart', 'heart-2', true, 2);
    await setDeck('heart', ['Who is Grandpa to you now?'], 3);
    const q = await askQuestion('Q', 4);
    await resolveQuestion(q.id, true, 5);
    const file = parseBackup(JSON.stringify(await exportData(db, 1000)));
    const other = await freshDB();
    await importData(file, 'replace', other);
    expect((await other.flows.get('night'))!).toMatchObject({ alsoUnder: ['root'], offSigns: ['root'] });
    expect((await other.flows.get('numbing'))!.draft).toBe(true);
    expect((await other.pages.get(q.id))!.resolvedByTap).toBe(true);
    expect((await deckOf('heart')).resolved.map(x => x.id)).toEqual(['heart-2']);
    expect(texts((await deckOf('heart')).open)[0]).toBe('Who is Grandpa to you now?');
    expect((await exportData(other, 1000)).tables).toEqual((await exportData(db, 1000)).tables);
  });

  it('sealed: the deck travels sealed and opens with the file\'s PIN', async () => {
    await ensureSeeded();
    await resolveAsk('root', 'root-1', true, 2);
    const key = await lockWith();
    const file = parseBackup(JSON.stringify(await exportData(db, 1000)));
    expect(JSON.stringify(file.tables.signShelves)).not.toMatch(/true right here/);
    const other = await freshDB();
    await importData(file, 'replace', other, key);
    expect((await deckOf('root')).resolved).toEqual([{ id: 'root-1', text: STARTER_DECK.root[0], resolvedAt: 2 }]);
  });

  it('a schema 9 file without them imports unchanged', async () => {
    await ensureSeeded();
    await setAsk('crown', 0, 'What is mine to carry?', 1);
    const q = await askQuestion('Q', 4);
    const before = await exportData(db, 1000);
    expect(before.schemaVersion).toBe(9);
    const raw = JSON.stringify(before);
    expect(raw).not.toMatch(/alsoUnder|offSigns|"draft"|"deck"|resolvedByTap/);
    const file = parseBackup(raw);
    expect(file.madeAt).toBeUndefined();
    const other = await freshDB();
    await importData(file, 'replace', other);
    expect((await exportData(other, 1000)).tables).toEqual(before.tables);
    expect(await asksOf('crown')).toEqual(['What is mine to carry?', STARTER_ASKS.crown[1], STARTER_ASKS.crown[2]]);
    expect((await other.pages.get(q.id))!.state).toBe('open');
    expect((await blockersOf('root')).map(b => b.flow.id)).toEqual(['panic', 'whatif']);
  });
});
