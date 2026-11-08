// Package 1: the Journal's model (src/model/pages.ts), on a fresh fake-indexeddb each test.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import type { FlowDB } from '../../src/db/schema';
import { store, setKey } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { ensureSeeded } from '../../src/db/seed';
import {
  parseTags, tagsOf, firstSentence, firstLine, writeLine, messagesOf, setKept, speakAs, askThis, askQuestion,
  answerWith, walkOf, questions, linkPages, linksOf, takeToCouncil, entries, searchPages, keptLines, pickEcho, revise,
  today, pageById, dayKey, findPages, chipVoices, voicesById, pagesList, earlierPages,
} from '../../src/model/pages';
import * as model from '../../src/model/pages';

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
  it('entry states and mood words are gone from the model (v2); an entry stays open whatever is written', async () => {
    for (const gone of ['turnToAnswer', 'setEntryState', 'entryState', 'ENTRY_STATES', 'setMood', 'MOODS']) expect(model).not.toHaveProperty(gone);
    const p = await entryWith([{ text: 'All this, and I am reduced to simple journaling.' }]);
    const r = await writeLine(p, undefined, { text: 'It was the simple things.', wise: true }, D7);
    expect(r!.page.state).toBe('open');
  });
  it('a block placed between two others (Return mid-page) reads back in its place', async () => {
    const p = await entryWith([{ text: 'one' }, { text: 'three' }]);
    const [a, c] = await messagesOf(p.id);
    const r = await writeLine(p, 'm-two', { text: 'two' }, D7, { at: a.at + (c.at - a.at) / 2 });
    expect(r!.messages.map(m => m.text)).toEqual(['one', 'two', 'three']);
    expect((await messagesOf(p.id)).map(m => m.text)).toEqual(['one', 'two', 'three']);
  });
  it('a line stays sealed once a key is set, and the page title too', async () => {
    const salt = randomSalt();
    await setKey(await deriveKey('1', salt, 1000), { salt, iterations: 1000 });
    const p = await entryWith([{ text: 'How can I gauge my pleasure/pain barometer?' }]);
    const { question: q } = await askThis(p, { text: 'How can I gauge my pleasure/pain barometer?' });
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

describe('ask this', () => {
  it('titles the page with the first sentence of a long line, or the whole of a short one', () => {
    expect(firstSentence('Should I commit myself to hard things?')).toBe('Should I commit myself to hard things?');
    const long = 'How do I retain skills that were developed due to dysfunctional beliefs? Enough to remain within those constraints, and more besides.';
    expect(firstSentence(long)).toBe('How do I retain skills that were developed due to dysfunctional beliefs?');
    expect(firstSentence('x '.repeat(60).trim())).toBe('x '.repeat(60).trim());
  });
  it('makes a new open question titled by the line, linked both ways; the day keeps every line', async () => {
    const p = await entryWith([{ text: 'How can I gauge my pleasure/pain barometer to know when I should pull the rip cord? It is hard.' }, { text: 'more' }]);
    const [m] = await messagesOf(p.id);
    const { question: q, page } = await askThis(p, m, D5 + 5000);
    expect(q.kind).toBe('question');
    expect(q.id).not.toBe(p.id);
    expect(q.title).toBe('How can I gauge my pleasure/pain barometer to know when I should pull the rip cord?');
    expect(q.state).toBe('open');
    expect(q.linkedPageIds).toEqual([p.id]);
    expect(page.linkedPageIds).toContain(q.id);
    expect((await questions()).map(x => x.id)).toContain(q.id);
    // the day stays whole: still today's entry, every line where it was
    const t = await today(new Date(D5));
    expect(t.page?.id).toBe(p.id);
    expect(t.page?.kind).toBe('entry');
    expect((await messagesOf(p.id)).map(x => x.text)).toEqual([m.text, 'more']);
    expect(await messagesOf(q.id)).toEqual([]);
    // the day's page reads it as Asked; the question reads where it was asked from
    expect((await linksOf((await pageById(p.id))!.page)).map(l => [l.label, l.line])).toEqual([['Asked', q.title]]);
    expect((await linksOf((await pageById(q.id))!.page)).map(l => [l.label, l.line])).toEqual([['Asked from', m.text]]);
    // writing under the question never marks it (V2): only This answers it does
    const a = await writeLine(q, undefined, { text: 'stand tall, young one' }, D5 + 6000);
    expect(a!.page.state).toBe('open');
    expect(firstLine(a!.page, a!.messages)).toBe(q.title);
  });
});

describe('question states (V2: only This answers it marks one)', () => {
  it('a wise line written is only a line; This answers it makes the line wise and the question answered, with the day', async () => {
    const q = await askQuestion('  Should I commit myself to hard things that require sacrifice? ', D5);
    expect(q.title).toBe('Should I commit myself to hard things that require sacrifice?');
    const w = await writeLine(q, undefined, { text: 'Define ways toward fulfillment.', wise: true }, D5 + 1);
    expect(w!.page.state).toBe('open');
    expect(w!.message!.wise).toBe(true);
    const plain = await writeLine(w!.page, undefined, { text: 'and chase them internally' }, D5 + 2);
    const m = plain!.message!;
    const r = await answerWith(plain!.page, m, true, D6);
    expect(r.message.wise).toBe(true);
    expect(r.page.state).toBe('answered');
    expect(r.page.answeredAt).toBe(D6);
    expect((await pageById(q.id))!.page.state).toBe('answered');
    expect((await messagesOf(q.id)).find(x => x.id === m.id)!.wise).toBe(true);
    // a second answer leaves the day it was first answered
    const again = await answerWith(r.page, (await messagesOf(q.id))[0], true, D7);
    expect(again.page.answeredAt).toBe(D6);
  });
  it('Not the answer clears wise; the question opens again once no wise line is left', async () => {
    const q = await askQuestion('Who are my models?', D5);
    const a = await writeLine(q, undefined, { text: 'Grumpa, Isaac, Alison.' }, D5 + 1);
    const b = await writeLine(a!.page, undefined, { text: 'Then it is the pace.' }, D5 + 2);
    const [ma, mb] = b!.messages;
    let p = (await answerWith(b!.page, ma, true, D6)).page;
    p = (await answerWith(p, mb, true, D6)).page;
    const one = await answerWith(p, ma, false, D7);
    expect(one.message.wise).toBeUndefined();
    expect(one.page.state).toBe('answered');
    const none = await answerWith(one.page, mb, false, D7);
    expect(none.page.state).toBe('open');
    expect(none.page.answeredAt).toBeUndefined();
    expect((await pageById(q.id))!.page.state).toBe('open');
  });
  it('emptying the last answer takes it back; an older revisited row lists as answered', async () => {
    const q = await askQuestion('What is the smallest version of this?', D5);
    const a = await writeLine(q, undefined, { text: 'One page a day.' }, D5 + 1);
    const r = await answerWith(a!.page, a!.message!, true, D5 + 2);
    const gone = await writeLine(r.page, r.message.id, { text: '' }, D5 + 3);
    expect(gone!.page.state).toBe('open');
    const old = await askQuestion('older', D6);
    await model.setTitle({ ...old, state: 'revisited' }, 'older');
    expect((await questions()).map(x => [x.title, x.state])).toEqual([['What is the smallest version of this?', 'open'], ['older', 'revisited']]);
  });
  it('lists open questions first, then answered, newest first within each', async () => {
    const old = await askQuestion('old open', D5);
    const ans = await askQuestion('answered', D6);
    const w = await writeLine(ans, undefined, { text: 'yes' }, D6);
    await answerWith(w!.page, w!.message!, true, D6);
    const young = await askQuestion('new open', D7);
    expect((await questions()).map(q => q.id)).toEqual([young.id, old.id, ans.id]);
  });
  it('the walk: where an open question sits, its neighbours, wrapping at both ends', async () => {
    const c = await askQuestion('What would the Mystic say to the Skeptic?', D5);
    const b = await askQuestion('Who are my models?', D6);
    const a = await askQuestion('How can I gauge my pleasure/pain barometer?', D7);
    expect(await walkOf(b.id)).toEqual({ at: 2, of: 3, prev: a.id, next: c.id });
    expect(await walkOf(c.id)).toEqual({ at: 3, of: 3, prev: b.id, next: a.id });
    expect(await walkOf(a.id)).toEqual({ at: 1, of: 3, prev: c.id, next: b.id });
    const w = await writeLine(b, undefined, { text: 'the pace' }, D7);
    await answerWith(w!.page, w!.message!, true, D7);
    expect(await walkOf(b.id)).toBeUndefined();
    expect(await walkOf(a.id)).toEqual({ at: 1, of: 2, prev: c.id, next: c.id });
    const w2 = await writeLine(c, undefined, { text: 'listen' }, D7);
    await answerWith(w2!.page, w2!.message!, true, D7);
    expect(await walkOf(a.id)).toBeUndefined();
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
    const old = await entryWith([{ text: 'I determine my core.' }], D5);
    const r = await writeLine(undefined, undefined, { text: 'x' }, D7, { linkTo: old.id });
    expect(r!.page.linkedPageIds).toEqual([old.id]);
    expect((await pageById(old.id))!.page.linkedPageIds).toEqual([r!.page.id]);
  });
  it('take to the council makes an empty council about the line, linked both ways (V3: it opens on the seats)', async () => {
    const p = await entryWith([{ text: 'Our world is deeply out of balance.\nAnd more.', voiceId: 'v-skeptic' }]);
    const [m] = await messagesOf(p.id);
    const c = await takeToCouncil(p, m, D7);
    expect(c.kind).toBe('council');
    expect(c.title).toBe('Our world is deeply out of balance.');
    expect(c.seats).toBeUndefined();
    expect(c.linkedPageIds).toEqual([p.id]);
    expect((await pageById(p.id))!.page.linkedPageIds).toContain(c.id);
    expect(await messagesOf(c.id)).toEqual([]);
  });
});

describe('No. counts entries only', () => {
  it('questions and councils do not move the number', async () => {
    const before = (await today(new Date(D7))).no;
    await askQuestion('Who are my models, really?', D5);
    const e = await entryWith([{ text: 'an entry' }], D6);
    const [m] = await messagesOf(e.id);
    await takeToCouncil(e, m, D6 + 10);
    expect((await pageById(e.id))!.no).toBe(before);
    expect((await today(new Date(D7))).no).toBe(before + 1);
    const q = await askQuestion('another', D6);
    expect((await pageById(q.id))!.no).toBeUndefined();
    const t = await entryWith([{ text: 'today' }], D7);
    expect((await today(new Date(D7))).no).toBe(before + 1);
    expect((await pageById(t.id))!.no).toBe(before + 1);
  });
});

describe('revisions', () => {
  it('an edit on a later day keeps the old text, once per day; the same day changes only the line', async () => {
    const p = await entryWith([{ text: 'Wait out the hard parts.' }], D5);
    const [m] = await messagesOf(p.id);
    await writeLine(p, m.id, { text: 'Wait out the truly hard parts.' }, D5 + 60_000);
    expect((await messagesOf(p.id))[0].revisions).toBeUndefined();
    await writeLine(p, m.id, { text: 'Wait out the truly hard parts of life' }, D7);
    await writeLine(p, m.id, { text: 'Wait out the truly hard parts of life.' }, D7 + 1000);
    const [after] = await messagesOf(p.id);
    expect(after.text).toBe('Wait out the truly hard parts of life.');
    expect(after.revisions).toEqual([{ at: D7, text: 'Wait out the truly hard parts.' }]);
    expect(after.at).toBe(m.at); // the line keeps its place and its day
  });
  it('revise on its own', () => {
    const m = { at: D5, text: 'a' };
    expect(revise(m, 'a', D7)).toBeUndefined();
    expect(revise(m, 'b', D5 + 1)).toBeUndefined();
    expect(revise({ at: D5, text: '' }, 'b', D7)).toBeUndefined();
    expect(revise(m, 'b', D7)).toEqual([{ at: D7, text: 'a' }]);
    expect(revise({ ...m, revisions: [{ at: D6, text: 'z' }] }, 'b', D7)).toEqual([{ at: D6, text: 'z' }, { at: D7, text: 'a' }]);
  });
  it('the old text is sealed with the line once a key is set', async () => {
    const salt = randomSalt();
    await setKey(await deriveKey('1', salt, 1000), { salt, iterations: 1000 });
    const p = await entryWith([{ text: 'pleasure and pain barometer' }], D5);
    const [m] = await messagesOf(p.id);
    await writeLine(p, m.id, { text: 'a new reading' }, D7);
    const raw = JSON.stringify(await db.messages.toArray());
    expect(raw).not.toContain('barometer');
    expect(raw).not.toContain('reading');
    expect((await messagesOf(p.id))[0].revisions).toEqual([{ at: D7, text: 'pleasure and pain barometer' }]);
  });
});

describe('entries and search', () => {
  it('the Pages list: entries and councils, newest first, with who spoke; no questions', async () => {
    await askQuestion('a question is not listed', D5);
    const e = await entryWith([{ text: 'an entry #evergreen' }], D5);
    const [m] = await messagesOf(e.id);
    const c = await takeToCouncil(e, m, D6);
    await writeLine((await pageById(c.id))!.page, undefined, { text: 'Which voices?', voiceId: 'v-skeptic' }, D6 + 1);
    await writeLine((await pageById(c.id))!.page, undefined, { text: 'Listen.', voiceId: 'v-mystic' }, D6 + 2);
    const list = await pagesList();
    expect(list.map(x => x.page.kind)).not.toContain('question');
    expect(list.slice(0, 2).map(x => [x.page.kind, x.line])).toEqual([['council', 'an entry #evergreen'], ['entry', 'an entry #evergreen']]);
    expect(list[0].spoke).toEqual(['v-skeptic', 'v-mystic']);
  });
  it('entries are newest first with their first line; empty pages are left out', async () => {
    await entryWith([{ text: 'first page' }], D5);
    const e = await writeLine(undefined, undefined, { text: 'x' }, D6);
    await writeLine(e!.page, e!.message!.id, { text: '' }, D6 + 1);
    await entryWith([{ text: 'third page #evergreen' }], D7);
    const list = await entries();
    expect(list.map(x => x.line)).toEqual(['third page #evergreen', 'first page']);
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

describe('earlier pages (V6: the rail above a pulled page)', () => {
  const day = (n: number) => new Date(2026, 9, n, 9).getTime();
  it('newest first, entries and councils, no questions', async () => {
    await askQuestion('a question is not on the rail', day(3));
    const e = await entryWith([{ text: 'the older entry' }], day(1));
    const [m] = await messagesOf(e.id);
    await takeToCouncil(e, m, day(2));
    await entryWith([{ text: 'the newer entry' }], day(4));
    const rail = await earlierPages();
    expect(rail.map(x => [x.page.kind, x.line])).toEqual([['entry', 'the newer entry'], ['council', 'the older entry'], ['entry', 'the older entry']]);
  });
  it('leaves the open page out', async () => {
    const a = await entryWith([{ text: 'a' }], day(1));
    const b = await entryWith([{ text: 'b' }], day(2));
    expect((await earlierPages(b.id)).map(x => x.page.id)).toEqual([a.id]);
    expect((await earlierPages('not-a-page')).map(x => x.page.id)).toEqual([b.id, a.id]);
  });
  it('keeps six by default, or the limit given', async () => {
    for (let n = 1; n <= 8; n++) await entryWith([{ text: `page ${n}` }], day(n));
    expect((await earlierPages()).map(x => x.line)).toEqual(['page 8', 'page 7', 'page 6', 'page 5', 'page 4', 'page 3']);
    expect((await earlierPages(undefined, 2)).map(x => x.line)).toEqual(['page 8', 'page 7']);
    // the open page leaving does not shorten the rail: the next one comes up
    const open = (await earlierPages())[0].page.id;
    expect((await earlierPages(open)).map(x => x.line)).toEqual(['page 7', 'page 6', 'page 5', 'page 4', 'page 3', 'page 2']);
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
  it('kept lines come from every page but today, oldest first; a fresh journal has none', async () => {
    expect(await keptLines()).toEqual([]);
    const old = await entryWith([{ text: 'I determine my core.' }, { text: 'I choose how to flow.' }], D5);
    for (const om of await messagesOf(old.id)) await setKept(om, true);
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
    expect((await findPages('')).length).toBe(2); // the seed writes no pages (V5)
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
