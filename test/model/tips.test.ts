// What to do at each step (F2): done marks, the Five lines, the return time, the clock, what helped, the journal link,
// and the step sheet's revisions.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { PANIC } from '../../src/db/seed-flows';
import { store, setKey } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { moveDot, endEpisode, flowById } from '../../src/model/flows';
import { today } from '../../src/model/pages';
import {
  setDone, doneIds, setLines, setReturnAt, earliestReturn, returnFor, returnPhase, clockFrom, clockMinutes, clockWords,
  clockStill, washLeft, shownTips, tipText, whatHelped, linkToday, flowLinkOf, saveStep, earlierOf, moveTip, newTip,
  RETURN_MIN_MS,
} from '../../src/model/tips';

let fdb: Awaited<ReturnType<typeof freshDB>>;
beforeEach(async () => { fdb = await freshDB(); await ensureSeeded(); });

const MIN = 60_000;
const T0 = new Date(2026, 10, 8, 21, 36).getTime();

async function started() {
  const e = await moveDot('panic', [], 'panic-1', T0);
  return e!;
}

describe('done marks', () => {
  it('a tick writes { tipId, at } on the live episode once; an un-tick takes it off', async () => {
    const e = await started();
    await setDone(e.id, 'panic-1-less', true, T0 + MIN);
    await setDone(e.id, 'panic-1-less', true, T0 + 2 * MIN);
    let row = await store.get('episodes', e.id);
    expect(row!.done).toEqual([{ tipId: 'panic-1-less', at: T0 + MIN }]);
    expect(doneIds(row)).toEqual(new Set(['panic-1-less']));
    await setDone(e.id, 'panic-1-less', false);
    row = await store.get('episodes', e.id);
    expect(row!.done).toEqual([]);
  });
  it('an ended episode takes no ticks', async () => {
    const e = await started();
    await endEpisode(e.id, T0 + MIN);
    expect(await setDone(e.id, 'panic-1-less', true)).toBeUndefined();
    expect((await store.get('episodes', e.id))!.done).toEqual([]);
  });
});

describe('the Five lines', () => {
  it('are kept on the episode, trailing blanks dropped, and sealed with the key', async () => {
    const e = await started();
    await setLines(e.id, ['the lamp, still on', "Nala's water bowl", '', '', '']);
    expect((await store.get('episodes', e.id))!.lines).toEqual(['the lamp, still on', "Nala's water bowl"]);
    await setLines(e.id, ['', '']);
    expect((await store.get('episodes', e.id))!.lines).toBeUndefined();
  });
  it('never reach the journal', async () => {
    const e = await started();
    await setLines(e.id, ['the lamp']);
    expect(await store.all('messages')).toEqual([]);
  });
  it('are sealed at rest in the database', async () => {
    const salt = randomSalt();
    await setKey(await deriveKey('2468', salt, 1000), { salt, iterations: 1000 });
    const e = await started();
    await setLines(e.id, ['the lamp']);
    const raw = await fdb.episodes.get(e.id);
    expect(JSON.stringify(raw)).not.toContain('the lamp');
    expect((await store.get('episodes', e.id))!.lines).toEqual(['the lamp']);
  });
});

describe('the return time', () => {
  it('is at least twenty minutes away, rounded up to five', () => {
    const now = new Date(2026, 10, 8, 21, 52, 30).getTime();
    expect(new Date(earliestReturn(now)).toTimeString().slice(0, 5)).toBe('22:15');
    expect(earliestReturn(now) - now).toBeGreaterThanOrEqual(RETURN_MIN_MS);
  });
  it('a clock time is the next one 20 minutes to 24 hours away; too soon becomes the earliest', () => {
    const now = new Date(2026, 10, 8, 21, 50).getTime();
    expect(returnFor('22:30', now)).toBe(new Date(2026, 10, 8, 22, 30).getTime());
    expect(returnFor('07:40', now)).toBe(new Date(2026, 10, 9, 7, 40).getTime());
    expect(returnFor('22:00', now)).toBe(earliestReturn(now));
    expect(returnFor('21:40', now)).toBe(new Date(2026, 10, 9, 21, 40).getTime());
    for (const hh of ['00:00', '12:15', '21:49', '23:59']) {
      const t = returnFor(hh, now) - now;
      expect(t).toBeGreaterThanOrEqual(RETURN_MIN_MS);
      expect(t).toBeLessThanOrEqual(24 * 60 * MIN);
    }
  });
  it('is written to the live episode', async () => {
    const e = await started();
    await setReturnAt(e.id, T0 + 30 * MIN);
    expect((await store.get('episodes', e.id))!.returnAt).toBe(T0 + 30 * MIN);
  });
  it('the page asks "slower now?" twenty minutes after it was set, then "ready?" at the time', () => {
    const set = T0, back = T0 + 45 * MIN;
    expect(returnPhase(back, set, T0 + 5 * MIN)).toBe('waiting');
    expect(returnPhase(back, set, T0 + 21 * MIN)).toBe('slower');
    expect(returnPhase(back, set, back)).toBe('ready');
  });
});

describe('the clock', () => {
  it('counts from the peak mark once the dot reached it, else from the start', async () => {
    const flow = (await flowById('panic'))!;
    const e = await started();
    expect(clockFrom(flow, e)).toBe(T0);
    const e2 = await moveDot('panic', [], 'panic-2', T0 + 4 * MIN);
    expect(clockFrom(flow, e2!)).toBe(T0 + 4 * MIN);
    expect(clockMinutes(T0 + 4 * MIN, T0 + 10 * MIN + 30_000)).toBe(6);
  });
  it('reads in minutes in Day and Night and in words with no digit in Still', () => {
    expect(clockWords(6)).toBe('6 minutes in');
    expect(clockWords(1)).toBe('1 minute in');
    expect(clockWords(0)).toBe('under a minute in');
    for (const m of [0, 6, 30, 200]) expect(clockStill(m)).not.toMatch(/\d/);
  });
  it('the wash fades over the step\'s usual span', () => {
    expect(washLeft(T0, 60 * MIN, T0)).toBe(1);
    expect(washLeft(T0, 60 * MIN, T0 + 30 * MIN)).toBe(0.5);
    expect(washLeft(T0, 60 * MIN, T0 + 90 * MIN)).toBe(0);
  });
});

describe('what the page shows', () => {
  it('at most six rows, three in Still with the short words; struck rows never; a person row always (F6)', () => {
    const step = { tips: [...PANIC.steps[0].tips, { id: 'x', text: 'struck', struck: true }, { id: 'p', text: 'Text Ali', helper: 'person' as const }] };
    expect(shownTips(step, false).map(t => t.id)).toEqual([...PANIC.steps[0].tips.map(t => t.id), 'p']);
    // F4: in Still the Still row (Less coming in) goes, so the three are the next three
    expect(shownTips(step, true).map(t => t.id)).toEqual([...PANIC.steps[0].tips.slice(1, 4).map(t => t.id), 'p']);
    expect(tipText(PANIC.steps[0].tips[0], true)).toBe('Less coming in');
    expect(tipText(PANIC.steps[0].tips[0], false)).toMatch(/^Less coming in: leave the room/);
  });
  it('what helped: the ticks of the last episode in the order ticked, short words, wise lines left out', () => {
    const helped = whatHelped(PANIC, { done: [
      { tipId: 'panic-3-five', at: 3 }, { tipId: 'panic-1-less', at: 1 }, { tipId: 'panic-3-okay', at: 4 }, { tipId: 'gone', at: 5 },
    ] });
    expect(helped).toEqual(['Less coming in', 'Five things you can see']);
    expect(whatHelped(PANIC, undefined)).toEqual([]);
  });
});

describe('the journal link', () => {
  it('links today\'s page and the episode both ways; the page reads back the flow and the step', async () => {
    const e = await started();
    await moveDot('panic', ['panic-2', 'panic-3'], 'panic-4', T0 + 30 * MIN);
    const page = await linkToday(e.id, T0 + 40 * MIN);
    expect(page!.flow).toEqual({ episodeId: e.id });
    expect((await store.get('episodes', e.id))!.pageId).toBe(page!.id);
    expect((await today(new Date(T0 + 41 * MIN))).page!.id).toBe(page!.id);
    expect(await flowLinkOf(page!)).toEqual({
      href: '#/flow/panic/4', flow: 'Panic', startedAt: T0, endedAt: undefined, step: 'Under the skin', live: true,
    });
    await endEpisode(e.id, T0 + 70 * MIN);
    expect(await flowLinkOf(page!)).toMatchObject({ href: '#/flow/panic', endedAt: T0 + 70 * MIN, live: false });
  });
  it('a page already written today keeps its words and gains the link', async () => {
    const { writeLine } = await import('../../src/model/pages');
    const w = await writeLine(undefined, undefined, { text: 'the kitchen' }, T0 + MIN);
    const e = await started();
    const page = await linkToday(e.id, T0 + 2 * MIN);
    expect(page!.id).toBe(w!.page.id);
    expect((await store.all('messages')).map(m => m.text)).toEqual(['the kitchen']);
  });
});

describe('the step sheet', () => {
  it('a save writes the step and adds the new version to the revisions; unchanged writes nothing', async () => {
    const flow = (await flowById('panic'))!;
    const s = flow.steps[0];
    expect(await saveStep('panic', s.id, { ...s })).toEqual(flow);
    const tips = s.tips.map(t => (t.id === 'panic-1-name' ? { ...t, text: 'Too much in. Not danger.' } : t.id === 'panic-1-cold' ? { ...t, struck: true } : t));
    const next = await saveStep('panic', s.id, { name: 'Overwhelmed', line: s.line, said: s.said, usual: s.usual, tips }, T0);
    expect(next!.steps[0].name).toBe('Overwhelmed');
    expect(next!.revisions).toHaveLength(2);
    expect(next!.revisions[1]).toEqual({ at: T0, name: 'Panic', steps: next!.steps });
    const earlier = earlierOf(next!, s.id).map(w => w.text);
    expect(earlier).toEqual(expect.arrayContaining(['Overstimulated', 'Name it: too much in, not danger.', 'Cold water on your wrists and face']));
    expect(earlier).not.toContain('Overwhelmed');
    expect(earlierOf(next!, s.id).every(w => w.at === T0)).toBe(true);
  });
  it('tips move and new ones start empty; an empty tip is not saved', async () => {
    const flow = (await flowById('panic'))!;
    const s = flow.steps[0];
    const moved = moveTip(s.tips, 'panic-1-cold', 0);
    expect(moved[0].id).toBe('panic-1-cold');
    expect(moved).toHaveLength(s.tips.length);
    const next = await saveStep('panic', s.id, { ...s, tips: [...moved, newTip()] }, T0);
    expect(next!.steps[0].tips.map(t => t.id)).toEqual(moved.map(t => t.id));
  });
});
