// Package 1: the Journal's model (src/model/pages.ts), on a fresh fake-indexeddb each test.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import type { FlowDB } from '../../src/db/schema';
import { store, setKey } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { ensureSeeded } from '../../src/db/seed';
import {
  parseTags, tagsOf, firstSentence, firstLine, writeLine, messagesOf, setKept, speakAs, turnToAnswer, askQuestion,
  answerState, questions, linkPages, linksOf, takeToCouncil, entries, searchPages, keptLines, pickEcho, setMood,
  setEntryState, entryState, today, pageById, dayKey, findPages, chipVoices, voicesById,
} from '../../src/model/pages';

let db: FlowDB;
beforeEach(async () => { db = await freshDB(); await ensureSeeded(); });

const D5 = new Date(2026, 10, 5, 9).getTime();
const D6 = new Date(2026, 10, 6, 9).getTime();
const D7 = new Date(2026, 10, 7, 9).getTime();

async function entryWith(lines: { text: string; voiceId?: string; wise?: boolean }[], at = D5) {
  let page;
  for (const [i, l] of lines.entries()) {
    const r = await writeLine(page, undefined, l, at + i * 1000);
    page = r!.page;
  }
  return page!;
}

describe('tags', () => {
  it('parses #words inline, lowercased, once each, ignoring numbers in the middle of words', () => {
    expect(parseTags('Chopping vegetables in #Evergreen, again. #evergreen #flow-state.')).toEqual(['evergreen', 'flow-state']);
    expect(parseTags('issue#4 and a # alone and ##double')).toEqual([]);
    expect(tagsOf([{ text: '#one two' }, { text: '#two #one' }])).toEqual(['one', 'two']);
  });
  it('a page carries the tags of all its lines, and loses one when its line is emptied', async () => {
    const p = await entryWith([{ text: 'Volunteering near #evergreen' }, { text: 'and #music' }]);
    expect(p.tags).toEqual(['evergreen', 'music']);
    const [, second] = await messagesOf(p.id);
    const r = await writeLine(p, second.id, { text: '' }, D5 + 5000);
    expect(r!.page.tags).toEqual(['evergreen']);
    expect((await messagesOf(p.id)).length).toBe(1);
  });
});

describe('message ops', () => {
  it('the first keystroke makes the page; later keystrokes update the same line', async () => {
    expect(await writeLine(undefined, undefined, { text: '' }, D7)).toBeNull();
    const a = await writeLine(undefined, undefined, { text: 'A' }, D7);
    const b = await writeLine(a!.page, a!.message!.id, { text: 'All this' }, D7 + 10);
    expect(b!.message!.id).toBe(a!.message!.id);
    const t = await today(new Date(D7));
    expect(t.page?.id).toBe(a!.page.id);
    expect((await messagesOf(a!.page.id)).map(m => m.text)).toEqual(['All this']);
  });
  it('lines keep their order even when written in the same millisecond', async () => {
    const a = await writeLine(undefined, undefined, { text: 'one' }, D7);
    await writeLine(a!.page, undefined, { text: 'two' }, D7);
    await writeLine(a!.page, undefined, { text: 'three' }, D7);
    expect((await messagesOf(a!.page.id)).map(m => m.text)).toEqual(['one', 'two', 'three']);
  });
  it('keep close and reply are stored on the line', async () => {
    const p = await entryWith([{ text: 'Wait out the truly hard parts of life.' }]);
    const [m] = await messagesOf(p.id);
    await setKept(m, true);
    const r = await writeLine(p, undefined, { text: 'They never last forever.', replyTo: m.id }, D5 + 9000);
    const ms = await messagesOf(p.id);
    expect(ms[0].kept).toBe(true);
    expect(ms[1].replyTo).toBe(m.id);
    expect(r!.messages.length).toBe(2);
  });
  it('a later reading on an entry is wise and marks it revisited; states keep PLAN names', async () => {
    const p = await entryWith([{ text: 'All this, and I am reduced to simple journaling.' }]);
    expect(entryState(p.state)).toBe('raw');
    const r = await writeLine(p, undefined, { text: 'It was the simple things.', wise: true }, D7);
    expect(r!.page.state).toBe('revisited');
    expect(entryState(r!.page.state)).toBe('revisited');
    const done = await setEntryState(r!.page, 'integrated');
    expect(done.state).toBe('answered');
    expect(entryState(done.state)).toBe('integrated');
  });
  it('mood words are stored on the page', async () => {
    const p = await entryWith([{ text: 'boiling in my own soup' }]);
    await setMood(p, ['boiling', 'hard']);
    expect((await pageById(p.id))!.page.mood).toEqual(['boiling', 'hard']);
  });
  it('a line stays sealed once a key is set, and the page title too', async () => {
    const salt = randomSalt();
    await setKey(await deriveKey('1', salt, 1000), { salt, iterations: 1000 });
    const p = await entryWith([{ text: 'How can I gauge my pleasure/pain barometer?' }]);
    const q = await turnToAnswer(p, { text: 'How can I gauge my pleasure/pain barometer?' });
    const raw = JSON.stringify([await db.pages.get(q.id), await db.messages.toArray()]);
    expect(raw).not.toContain('barometer');
    expect((await pageById(q.id))!.page.title).toBe('How can I gauge my pleasure/pain barometer?');
  });
});

describe('speak as', () => {
  it('reassigns a line to a voice, and back to plain ink', async () => {
    const p = await entryWith([{ text: 'listen to the quiet voices within' }]);
    const [m] = await messagesOf(p.id);
    await speakAs(m, 'v-mystic');
    expect((await messagesOf(p.id))[0].voiceId).toBe('v-mystic');
    await speakAs((await messagesOf(p.id))[0], undefined);
    expect((await messagesOf(p.id))[0].voiceId).toBeUndefined();
  });
});

describe('turn to answer', () => {
  it('titles the page with the first sentence of a long line, or the whole of a short one', () => {
    expect(firstSentence('Should I commit myself to hard things?')).toBe('Should I commit myself to hard things?');
    const long = 'How do I retain skills that were developed due to dysfunctional beliefs? Enough to remain within those constraints, and more besides.';
    expect(firstSentence(long)).toBe('How do I retain skills that were developed due to dysfunctional beliefs?');
    expect(firstSentence('x '.repeat(60).trim())).toBe('x '.repeat(60).trim());
  });
  it('makes the entry a question, open, listed under Questions, and its first answer answers it', async () => {
    const p = await entryWith([{ text: 'How can I gauge my pleasure/pain barometer to know when I should pull the rip cord? It is hard.' }, { text: 'more' }]);
    const [m] = await messagesOf(p.id);
    const q = await turnToAnswer(p, m, D5 + 5000);
    expect(q.kind).toBe('question');
    expect(q.title).toBe('How can I gauge my pleasure/pain barometer to know when I should pull the rip cord?');
    expect(q.state).toBe('open');
    expect((await questions()).map(x => x.id)).toContain(q.id);
    expect((await today(new Date(D5))).page).toBeUndefined(); // today's entry is now a question
    const a = await writeLine(q, undefined, { text: 'stand tall, young one', wise: true }, D5 + 6000);
    expect(a!.page.state).toBe('answered');
    expect(firstLine(a!.page, a!.messages)).toBe(q.title);
  });
});

describe('question states', () => {
  it('the first answer answers; more the same day leaves it; one on a later day revisits', async () => {
    const q = await askQuestion('  Should I commit myself to hard things that require sacrifice? ', D5);
    expect(q.title).toBe('Should I commit myself to hard things that require sacrifice?');
    const a1 = await writeLine(q, undefined, { text: 'Define ways toward fulfillment.', wise: true, voiceId: 'v-architect' }, D5 + 1);
    expect(a1!.page.state).toBe('answered');
    const a2 = await writeLine(a1!.page, undefined, { text: 'and chase them internally', wise: true }, D5 + 2);
    expect(a2!.page.state).toBe('answered');
    const a3 = await writeLine(a2!.page, undefined, { text: 'Never sacrifice yourself for some fantasy future.', wise: true }, D7);
    expect(a3!.page.state).toBe('revisited');
  });
  it('answerState on its own', () => {
    expect(answerState({ state: 'open' }, [], D5)).toBe('answered');
    expect(answerState({ state: 'answered' }, [{ wise: true, text: 'x', at: D5 }], D5)).toBe('answered');
    expect(answerState({ state: 'answered' }, [{ wise: true, text: 'x', at: D5 }], D6)).toBe('revisited');
    expect(answerState({ state: 'open' }, [{ wise: false, text: 'the entry itself', at: D5 }], D6)).toBe('answered');
  });
  it('lists open questions first, then answered, newest first within each', async () => {
    const old = await askQuestion('old open', D5);
    const ans = await askQuestion('answered', D6);
    await writeLine(ans, undefined, { text: 'yes', wise: true }, D6);
    const young = await askQuestion('new open', D7);
    expect((await questions()).map(q => q.id)).toEqual([young.id, old.id, ans.id]);
  });
});

describe('links', () => {
  it('links both pages, related or smaller version of, and lists them at the bottom', async () => {
    const big = await askQuestion('Should I commit myself to hard things that require sacrifice?', D5);
    const small = await askQuestion('Should I take the hard class?', D6);
    const entry = await entryWith([{ text: 'Volunteering at the kitchen' }], D7);
    const [s2] = await linkPages(small, big, 'smaller');
    await linkPages(s2, entry, 'related');
    const fromSmall = await linksOf((await pageById(small.id))!.page);
    expect(fromSmall.map(l => [l.label, l.line])).toEqual([['Smaller version of', big.title], ['Related', 'Volunteering at the kitchen']]);
    const fromBig = await linksOf((await pageById(big.id))!.page);
    expect(fromBig.map(l => l.label)).toEqual(['A smaller version']);
    const [same] = await linkPages(big, big);
    expect(same.linkedPageIds).not.toContain(big.id);
  });
  it('a pending link (the echo tapped before the first keystroke) lands when the page is made', async () => {
    const r = await writeLine(undefined, undefined, { text: 'x' }, D7, { linkTo: 'pg-manifesto' });
    expect(r!.page.linkedPageIds).toEqual(['pg-manifesto']);
    expect((await pageById('pg-manifesto'))!.page.linkedPageIds).toEqual([r!.page.id]);
  });
  it('take to the council makes a council page with the line copied, linked both ways', async () => {
    const p = await entryWith([{ text: 'Our world is deeply out of balance.', voiceId: 'v-skeptic' }]);
    const [m] = await messagesOf(p.id);
    const c = await takeToCouncil(p, m, D7);
    expect(c.kind).toBe('council');
    expect(c.linkedPageIds).toEqual([p.id]);
    expect((await pageById(p.id))!.page.linkedPageIds).toContain(c.id);
    const cm = await messagesOf(c.id);
    expect(cm.map(x => [x.text, x.voiceId])).toEqual([['Our world is deeply out of balance.', 'v-skeptic']]);
    expect(cm[0].id).not.toBe(m.id);
  });
});

describe('entries and search', () => {
  it('entries are newest first with their first line; empty pages are left out', async () => {
    await entryWith([{ text: 'first page' }], D5);
    const e = await writeLine(undefined, undefined, { text: 'x' }, D6);
    await writeLine(e!.page, e!.message!.id, { text: '' }, D6 + 1);
    await entryWith([{ text: 'third page #evergreen' }], D7);
    const list = await entries();
    expect(list.map(x => x.line)).toEqual(['third page #evergreen', 'first page', 'I determine my core.']);
    expect(list[0].page.tags).toEqual(['evergreen']);
  });
  it('finds pages by title or by any line, case-insensitive, newest first', async () => {
    await askQuestion('How can I gauge my pleasure/pain barometer?', D5);
    await entryWith([{ text: 'nothing here' }, { text: 'The BAROMETER again' }], D6);
    const r = await searchPages('barometer');
    expect(r.map(x => x.line)).toEqual(['nothing here', 'How can I gauge my pleasure/pain barometer?']);
    expect(r[0].match).toBe('The BAROMETER again');
    expect(await searchPages('  ')).toEqual([]);
  });
});

describe('echo', () => {
  const k = (id: string, at: number) => ({ id, at });
  it('picks the oldest unseen kept line, keeps it all day, and starts over once all are seen', () => {
    const kept = [k('b', 2), k('a', 1), k('c', 3)];
    const d1 = pickEcho(kept, undefined, '2026-11-07');
    expect(d1.id).toBe('a');
    expect(pickEcho(kept, d1.state, '2026-11-07').id).toBe('a');
    const d2 = pickEcho(kept, d1.state, '2026-11-08');
    expect(d2.id).toBe('b');
    const d3 = pickEcho(kept, d2.state, '2026-11-09');
    expect(d3.id).toBe('c');
    const d4 = pickEcho(kept, d3.state, '2026-11-10');
    expect(d4.id).toBe('a');
    expect(d4.state.seen).toEqual(['a']);
  });
  it('a dismissed echo stays away for the day only; nothing kept, no echo', () => {
    const d1 = pickEcho([k('a', 1), k('b', 2)], undefined, 'd1');
    expect(pickEcho([k('a', 1), k('b', 2)], { ...d1.state, dismissed: true }, 'd1').id).toBeUndefined();
    expect(pickEcho([k('a', 1), k('b', 2)], { ...d1.state, dismissed: true }, 'd2').id).toBe('b');
    expect(pickEcho([], undefined, 'd1').id).toBeUndefined();
    const empty = pickEcho([], undefined, 'd1').state;
    expect(pickEcho([k('a', 1)], empty, 'd1').id).toBe('a'); // something was kept later that day
  });
  it('kept lines come from every page but today, oldest first; the seed is the manifesto', async () => {
    const p = await entryWith([{ text: 'Wait out the truly hard parts.' }], D7);
    const [m] = await messagesOf(p.id);
    await setKept(m, true);
    expect((await keptLines(p.id)).map(x => x.message.text)).toEqual(['I determine my core.', 'I choose how to flow.']);
    expect((await keptLines()).map(x => x.message.text).at(-1)).toBe('Wait out the truly hard parts.');
    expect(dayKey(D7)).toBe('2026-11-07');
  });
});

describe('finding and voices', () => {
  it('finds pages to link by title or first line, not by later lines, never the page itself', async () => {
    const q = await askQuestion('Should I take the hard class?', D5);
    const e = await entryWith([{ text: 'Hard rain today' }, { text: 'the class again' }], D6);
    expect((await findPages('hard', q.id)).map(x => x.page.id)).toEqual([e.id]);
    expect((await findPages('class')).map(x => x.page.id)).toEqual([q.id]);
    expect((await findPages('')).length).toBe(3);
  });
  it('a caller-chosen id names the new line', async () => {
    const r = await writeLine(undefined, 'm-chosen', { text: 'x' }, D7);
    expect(r!.message!.id).toBe('m-chosen');
  });
  it('chips: starred first; every voice by id for reading, archived too', async () => {
    expect((await chipVoices()).slice(0, 4).map(v => v.name)).toEqual(['Skeptic', 'Mystic', 'Warrior', 'Architect']);
    const v = (await store.get('voices', 'v-joker'))!;
    await store.put('voices', { ...v, archived: true });
    expect((await chipVoices()).map(x => x.id)).not.toContain('v-joker');
    expect((await voicesById()).get('v-joker')!.name).toBe('Joker');
  });
});

describe('the store is the only door', () => {
  it('page rows written by the journal read back through store', async () => {
    const p = await entryWith([{ text: 'mutable by design' }]);
    expect((await store.get('pages', p.id))!.kind).toBe('entry');
  });
});
