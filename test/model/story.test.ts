// The sections in a world (PLAN-WORLDS.md section 4 and 5, W4): the year worn and its stamp on every new page and
// council, who is alive and how old, the seat labels, names found in a page, a kept line's own chips, the waiting
// question, a council's reading, the Year chip, and Research from a question. His own pages gain none of it.
import { describe, it, expect, beforeEach } from 'vitest';
import { doff, don, peek, store, worn } from '../../src/db/fields';
import { applyPocket } from '../../src/bridge/down';
import type { NovelPocket } from '../../src/bridge/protocol';
import {
  aliveIn, chipsAtKeeping, keepLine, lifeOf, linkAsked, namedIn, noteYearWorn, pocketFor, readingOf, seatLabel, setLineChips,
  setPageChips, setPageYear, setReading, spanOf, startOf, startYearOnce, toggleChip, waitingIn, yearStamp, questionTitle,
} from '../../src/model/story';
import { askQuestion, askThis, newPage, takeToCouncil, writeLine, writeToday, today, resolveQuestion, answerWith, messagesOf } from '../../src/model/pages';
import { newCouncil } from '../../src/model/council';
import { ask } from '../../src/research/run';
import { getInquiry } from '../../src/research/store';
import { readBatch } from '../../src/bridge/up';
import { worldDB } from '../bridge/helpers';
import { freshDB } from '../db/helpers';
import { defaultSettings } from '../../src/db/seed';

const POCKET: NovelPocket = {
  kind: 'novel',
  characters: [
    { id: 'ren', fullName: 'Abbot Ren', firstName: 'Ren', familyColour: '#806040', born: 2010, died: 2069 },
    { id: 'siyuan', fullName: 'Siyuan', firstName: 'Siyuan', familyColour: '#3060d0', born: 2041 },
    { id: 'dawn', fullName: 'Dawn Li', firstName: 'Dawn', familyColour: '#40a060', born: 2062 },
    { id: 'mei', fullName: 'Mei', firstName: 'Mei', born: 2075 },
    { id: 'ghost', fullName: 'The Ferryman', firstName: 'Ferryman' },
  ],
  places: [{ id: 'gate', name: 'the temple gate' }, { id: 'river', name: 'Pearl River' }],
  chapters: [{ id: 'ch12', title: 'The flood', year: 2071 }],
  events: [{ id: 'ev1', title: 'The flood', year: 2071 }],
  storyYear: 2071, span: { from: 2040, to: 2080 },
  questions: [
    { id: 'q-old', question: 'Who raises Dawn after 2065?', state: 'open', changedAt: 10 },
    { id: 'q-new', question: 'Does Siyuan leave before the flood, or after?', state: 'open', changedAt: 20 },
    { id: 'q-done', question: 'Which year is the Introduction?', state: 'decided', decision: '2071', changedAt: 30 },
  ],
};

/** The pocket kept on home's row, as carry.ts keeps it after a fetch. */
async function keepPocket(world = 'eastwinds', pocket: NovelPocket = POCKET) {
  await store.unit(async u => {
    const s = (await u.get('settings', 'app')) ?? defaultSettings(1);
    const { locked: _, ...row } = s as typeof s & { locked?: true };
    await u.put('settings', { ...row, bridge: { token: 't', pocket: { world, stamp: 's1', pocket } } });
  });
}

describe('lives (pure)', () => {
  it('alive, not yet born, already dead, or unknown; ages in the year', () => {
    expect(lifeOf(POCKET.characters[0], 2065)).toBe('alive');
    expect(lifeOf(POCKET.characters[0], 2069)).toBe('alive');
    expect(lifeOf(POCKET.characters[0], 2070)).toBe('dead');
    expect(lifeOf(POCKET.characters[3], 2071)).toBe('unborn');
    expect(lifeOf(POCKET.characters[4], 2071)).toBe('unknown');
    expect(aliveIn(POCKET, 2065)).toEqual([
      { id: 'ren', name: 'Abbot Ren', age: 55 }, { id: 'siyuan', name: 'Siyuan', age: 24 }, { id: 'dawn', name: 'Dawn Li', age: 3 },
    ]);
    expect(aliveIn(POCKET, 2071).map(a => a.name)).toEqual(['Siyuan', 'Dawn Li']);
  });
  it('a seat prints the age that year, d. for the dead, b. for the unborn, the name alone for the whole book', () => {
    expect(seatLabel('Dawn Li', POCKET.characters[2], 2071)).toBe('Dawn Li, 9');
    expect(seatLabel('Abbot Ren', POCKET.characters[0], 2071)).toBe('Abbot Ren, d. 2069');
    expect(seatLabel('Mei', POCKET.characters[3], 2071)).toBe('Mei, b. 2075');
    expect(seatLabel('The Ferryman', POCKET.characters[4], 2071)).toBe('The Ferryman');
    expect(seatLabel('Dawn Li', POCKET.characters[2], null)).toBe('Dawn Li');
  });
  it('the span is the pocket\'s, else the years it holds; the year starts at the story year, else the span\'s first', () => {
    expect(spanOf(POCKET)).toEqual({ from: 2040, to: 2080 });
    const bare = { ...POCKET, span: undefined, storyYear: undefined };
    expect(spanOf(bare)).toEqual({ from: 2010, to: 2075 });
    expect(startOf(POCKET)).toBe(2071);
    expect(startOf(bare)).toBe(2010);
    expect(spanOf({ ...bare, characters: [], chapters: [], events: [] })).toBeUndefined();
  });
});

describe('names in the text (pure)', () => {
  it('a character by full, first or Chinese name, a place by name, whole words, as written', () => {
    expect(namedIn('He tells nobody but Dawn. She keeps it at the temple gate.', POCKET)).toEqual({ characterIds: ['dawn'], placeIds: ['gate'] });
    expect(namedIn('Up at dawn, Siyuanese food', POCKET)).toEqual({ characterIds: [], placeIds: [] });
    expect(namedIn('李 waits', { ...POCKET, characters: [{ id: 'li', fullName: 'Li Wei', firstName: 'Wei', chineseName: '李' }] }).characterIds).toEqual(['li']);
  });
  it('a kept line\'s chips: the page\'s, plus every name its lines use', () => {
    const page = { chips: { characterIds: ['siyuan'], placeIds: [] } };
    const lines = [{ text: 'He tells nobody but Dawn.' }, { text: 'She is nine and keeps it for a year.' }];
    expect(chipsAtKeeping(page, lines, POCKET)).toEqual({ characterIds: ['siyuan', 'dawn'], placeIds: [] });
    expect(toggleChip({ characterIds: ['dawn'], placeIds: [] }, 'character', 'dawn')).toEqual({ characterIds: [], placeIds: [] });
    expect(toggleChip(undefined, 'place', 'gate')).toEqual({ characterIds: [], placeIds: ['gate'] });
  });
});

describe('the year worn', () => {
  // a phone in use has home's row (seeded at first open); a test's fresh notebook is given one
  beforeEach(async () => { await worldDB(); await store.put('settings', defaultSettings(1)); });

  it('starts once from the pocket\'s story year, and is the phone\'s own after', async () => {
    expect(await startYearOnce('eastwinds', POCKET)).toBe(2071);
    expect((await store.get('settings', 'app'))!.year).toBe(2071);
    expect(await startYearOnce('eastwinds', { ...POCKET, storyYear: 2050 })).toBe(2071);
  });

  it('every new page and council in a novel takes the year worn; the Year chip changes one page alone', async () => {
    noteYearWorn({ year: 2065 });
    expect(yearStamp()).toBe(2065);
    const t = await writeToday(await today(), 'Trying the leaving again.');
    expect(t.page!.year).toBe(2065);
    const c = await newCouncil();
    expect(c.year).toBe(2065);
    const q = await askQuestion('What does it cost Dawn to keep it?');
    expect(q.year).toBe(2065);
    const l = await writeLine(undefined, undefined, { text: 'x' });
    expect(l!.page.year).toBe(2065);
    const asked = await askThis(t.page!, { text: 'Why the coat?' });
    expect(asked.question.year).toBe(2065);
    expect((await takeToCouncil(t.page!, t.message!)).year).toBe(2065);
    await setPageYear(t.page!.id, 2071);
    expect((await store.get('pages', t.page!.id))!.year).toBe(2071);
    expect((await store.get('pages', c.id))!.year).toBe(2065);
  });

  it('his own pages take no year, whatever the world\'s row says', async () => {
    noteYearWorn({ year: 2065 });
    await doff();
    // taken off before the row is read again: nothing of the world's year is stamped
    expect(yearStamp()).toBeUndefined();
    noteYearWorn({ year: 2065 });
    expect(worn()).toBeNull();
    expect(yearStamp()).toBeUndefined();
    expect(newPage('entry').year).toBeUndefined();
    expect('year' in (await newCouncil())).toBe(false);
  });
});

describe('a council\'s reading', () => {
  beforeEach(async () => { await worldDB(); noteYearWorn({ year: 2071 }); });

  it('About by default; In the story always has a year; the whole book only about the story', async () => {
    const c = await newCouncil();
    expect(readingOf(c)).toBe('about');
    await setPageYear(c.id, null);
    expect((await store.get('pages', c.id))!.year).toBeNull();
    // turned in the story, it takes the year worn back
    await setReading(c.id, 'in');
    expect(await store.get('pages', c.id)).toMatchObject({ reading: 'in', year: 2071 });
    // an in-story council refuses the whole book
    await setPageYear(c.id, null);
    expect((await store.get('pages', c.id))!.year).toBe(2071);
    await setReading(c.id, 'about');
    expect((await store.get('pages', c.id))!.reading).toBe('about');
  });

  it('the reading and the year go up with the council page', async () => {
    const c = await newCouncil();
    await setReading(c.id, 'in');
    const { h } = { h: (await import('../../src/db/fields')).handed((await import('../../src/db/fields')).book()) };
    const b = (await readBatch(h, 'eastwinds'))!;
    expect(b.envelopes.find(e => e.id === c.id)!.row).toMatchObject({ kind: 'council', reading: 'in', year: 2071 });
  });
});

describe('a kept line\'s own chips', () => {
  it('filled at keeping from the page\'s chips and the names its lines use, changeable, and sent with the line', async () => {
    const { h } = await worldDB();
    noteYearWorn({ year: 2071 });
    await keepPocket();
    const a = (await writeLine(undefined, undefined, { text: 'He tells nobody but Dawn.' }))!;
    const b = (await writeLine(a.page, undefined, { text: 'She is nine and keeps it for a year.' }))!;
    await setPageChips(a.page.id, { characterIds: ['siyuan'], placeIds: [] });
    const kept = (await keepLine(b.message!.id, true))!;
    expect(kept.kept).toBe(true);
    expect(kept.chips).toEqual({ characterIds: ['siyuan', 'dawn'], placeIds: [] });
    await setLineChips(kept.id, { characterIds: ['dawn'], placeIds: ['gate'] });
    // kept again later, chips he changed are kept
    await keepLine(kept.id, false);
    const again = (await keepLine(kept.id, true))!;
    expect(again.chips).toEqual({ characterIds: ['dawn'], placeIds: ['gate'] });
    const batch = (await readBatch(h, 'eastwinds'))!;
    expect(batch.envelopes.find(e => e.id === kept.id)!.row).toMatchObject({
      kind: 'kept', text: 'She is nine and keeps it for a year.', year: 2071, chips: { characterIds: ['dawn'], placeIds: ['gate'] },
    });
    // the page and its other line never travel
    expect(batch.envelopes.some(e => e.id === a.page.id || e.id === a.message!.id)).toBe(false);
  });

  it('in his own pages keeping adds no chips, even with a pocket kept', async () => {
    await freshDB();
    await keepPocket('eastwinds');
    const a = (await writeLine(undefined, undefined, { text: 'Dawn again.' }))!;
    const k = (await keepLine(a.message!.id, true))!;
    expect(k.kept).toBe(true);
    expect(k.chips).toBeUndefined();
    expect(pocketFor(await store.get('settings', 'app'), null)).toBeUndefined();
  });
});

describe('the waiting question', () => {
  it('the open one the bible changed last that the phone has not answered; none once all are', async () => {
    const { h } = await worldDB();
    await applyPocket(h, POCKET);
    expect(await waitingIn('eastwinds', POCKET)).toEqual({ id: 'q-new', question: 'Does Siyuan leave before the flood, or after?' });
    await resolveQuestion('q-new', true);
    expect((await waitingIn('eastwinds', POCKET))!.id).toBe('q-old');
    await resolveQuestion('q-old', true);
    expect(await waitingIn('eastwinds', POCKET)).toBeUndefined();
    // read from the world's notebook while his own pages are worn
    await resolveQuestion('q-old', false);
    await doff();
    expect((await waitingIn('eastwinds', POCKET))!.id).toBe('q-old');
    expect(await peek('nowhere', r => r.get('pages', 'q-old'))).toBeUndefined();
  });
});

describe('questions both ways', () => {
  it('This answers it on a bible question goes up as the page answered and its wise line; taken back, open again', async () => {
    const { h } = await worldDB();
    await applyPocket(h, POCKET);
    const q = (await store.get('pages', 'q-new'))!;
    const l = (await writeLine(q, undefined, { text: 'After. He stays one season too long.' }))!;
    await answerWith(l.page, l.message!);
    let b = (await readBatch(h, 'eastwinds'))!;
    expect(b.envelopes.find(e => e.table === 'pages' && e.id === 'q-new')!.row).toMatchObject({ kind: 'question', state: 'answered', title: 'Does Siyuan leave before the flood, or after?' });
    expect(b.envelopes.find(e => e.table === 'messages' && e.id === l.message!.id)!.row).toMatchObject({ pageId: 'q-new', wise: true, text: 'After. He stays one season too long.' });
    // the bible's own decision line (d:<id>) came down and never goes back up
    expect(b.envelopes.some(e => e.id === 'd:q-done' || e.id === 'q-done')).toBe(false);
    await answerWith((await store.get('pages', 'q-new'))!, (await messagesOf('q-new')).find(m => m.wise)!, false);
    b = (await readBatch(h, 'eastwinds'))!;
    expect(b.envelopes.find(e => e.table === 'pages' && e.id === 'q-new')!.row).toMatchObject({ state: 'open' });
  });

  it('Resolve goes up as answered and resolvedByTap with no wise line; a question asked here goes up open', async () => {
    const { h } = await worldDB();
    await applyPocket(h, POCKET);
    await resolveQuestion('q-old', true);
    const mine = await askQuestion('What does it cost Dawn to keep it?');
    const b = (await readBatch(h, 'eastwinds'))!;
    expect(b.envelopes.find(e => e.id === 'q-old')!.row).toMatchObject({ state: 'answered', resolvedByTap: true });
    expect(b.envelopes.find(e => e.id === mine.id)!.row).toMatchObject({ kind: 'question', state: 'open', title: 'What does it cost Dawn to keep it?' });
  });
});

describe('Research from a question', () => {
  it('the question carried, and the link kept both ways', async () => {
    const { h } = await worldDB();
    await applyPocket(h, POCKET);
    expect(await questionTitle('q-new')).toBe('Does Siyuan leave before the flood, or after?');
    const inquiry = await ask((await questionTitle('q-new'))!, 5, { pageId: 'q-new' });
    await linkAsked('q-new', inquiry.id);
    expect((await getInquiry(inquiry.id))!.pageId).toBe('q-new');
    expect((await store.get('pages', 'q-new'))!.asked).toEqual({ inquiryId: inquiry.id });
    const b = (await readBatch(h, 'eastwinds'))!;
    expect(b.envelopes.find(e => e.table === 'inquiries')!.row).toMatchObject({ pageId: 'q-new' });
    expect(b.envelopes.find(e => e.table === 'pages' && e.id === 'q-new')!.row).toMatchObject({ asked: { inquiryId: inquiry.id } });
  });
});

describe('the pocket is the worn world\'s only', () => {
  it('pocketFor names the world it was fetched for', async () => {
    await freshDB();
    await don('eastwinds');
    await keepPocket('eastwinds');
    const s = await store.get('settings', 'app');
    expect(pocketFor(s, 'eastwinds')).toBeTruthy();
    expect(pocketFor(s, 'other')).toBeUndefined();
    expect(pocketFor(s, null)).toBeUndefined();
  });
});
