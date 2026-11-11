// Into the app (PLAN-TASKS.md T3): what each touch carries into Journal and Council, and the stars it reads kept lines
// as. Every line carried is the one he wrote; the app writes none of its own; the page a touch lands on is today's,
// linked to the sign.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import { store } from '../../src/db/fields';
import { linksOf, messagesOf, questions, today, writeLine, setKept } from '../../src/model/pages';
import { councilById, councilPages, speak } from '../../src/model/council';
import { askToday, bringIt, keptStar, letterToday, oneLine, voiceCouncil, writeFromIt } from '../../src/model/into';
import { STARS_MAX, starOfDay, starsOf } from '../../src/model/stars';

beforeEach(async () => { await freshDB(); });

const T0 = new Date(2026, 10, 11, 9, 30).getTime();

describe('one rule holds one line', () => {
  it('breaks and runs of space are one space, trimmed; nothing written is empty', () => {
    expect(oneLine('  What am I\n not   seeing? ')).toBe('What am I not seeing?');
    expect(oneLine(' \n ')).toBe('');
  });
  it('a touch refuses to carry nothing', async () => {
    await expect(askToday('third-eye', '   ', T0)).rejects.toThrow();
    await expect(writeFromIt('sacral', '', T0)).rejects.toThrow();
    await expect(bringIt('third-eye', '\n', T0)).rejects.toThrow();
    expect(await store.all('pages')).toEqual([]);
  });
});

describe('Ask', () => {
  it('writes his line on today\'s page, linked to the sign, and asks it: a question titled by it, linked both ways', async () => {
    const r = await askToday('third-eye', 'What am I not seeing?', T0);
    const t = await today(new Date(T0));
    expect(t.page!.id).toBe(r.page.id);
    expect(t.page!.sign).toEqual({ chakra: 'third-eye' });
    const ms = await messagesOf(r.page.id);
    expect(ms.map(m => [m.text, !!m.wise, m.voiceId])).toEqual([['What am I not seeing?', false, undefined]]);
    const qs = await questions();
    expect(qs.map(q => [q.title, q.state, q.askedFrom])).toEqual([['What am I not seeing?', 'open', r.page.id]]);
    expect((await linksOf(t.page!)).map(l => l.label)).toEqual(['Asked']);
  });
  it('on a page already written on, the line goes after what is there and the day stays whole', async () => {
    const first = await writeLine(undefined, undefined, { text: 'Morning.' }, T0 - 1000);
    await askToday('third-eye', 'Why now?', T0);
    const ms = await messagesOf(first!.page.id);
    expect(ms.map(m => m.text)).toEqual(['Morning.', 'Why now?']);
    expect((await store.all('pages')).filter(p => p.kind === 'entry')).toHaveLength(1);
  });
});

describe('Write from it and Letter', () => {
  it('Write from it puts his word on today\'s page as a line, linked to the sign', async () => {
    const r = await writeFromIt('sacral', ' restless ', T0);
    expect(r.page.sign).toEqual({ chakra: 'sacral' });
    expect((await messagesOf(r.page.id)).map(m => m.text)).toEqual(['restless']);
    expect(await questions()).toEqual([]);
  });
  it('Letter links today\'s page to the sign and writes nothing on it: "Dear" is the page\'s, unsaved until he writes', async () => {
    const p = await letterToday('heart', T0);
    expect(p.sign).toEqual({ chakra: 'heart' });
    expect((await today(new Date(T0))).page!.id).toBe(p.id);
    expect(await store.all('messages')).toEqual([]);
  });
  it('the latest sign is the one the page is linked to', async () => {
    await writeFromIt('sacral', 'restless', T0);
    const p = await letterToday('heart', T0 + 1000);
    expect(p.sign).toEqual({ chakra: 'heart' });
    expect((await messagesOf(p.id)).map(m => m.text)).toEqual(['restless']);
  });
});

describe('Bring it and A voice', () => {
  it('Bring it opens a new council with his question as its first line, in ink, linked to the sign', async () => {
    const r = await bringIt('third-eye', 'Should I take the job?', T0);
    const c = await councilById(r.page.id);
    expect(c!.page.sign).toEqual({ chakra: 'third-eye' });
    expect(c!.page.title).toBeUndefined();
    expect(c!.messages.map(m => [m.text, m.voiceId])).toEqual([['Should I take the job?', undefined]]);
  });
  it('A voice opens a council with nothing said; today\'s empty one again rather than another', async () => {
    const a = await voiceCouncil('throat', T0);
    expect((await councilById(a.id))!.messages).toEqual([]);
    expect(a.sign).toEqual({ chakra: 'throat' });
    const b = await voiceCouncil('throat', T0 + 60_000);
    expect(b.id).toBe(a.id);
    expect(await councilPages()).toHaveLength(1);
    // once something is said there, the next is a new one
    await speak(a.id, 'Say it plainly.', { now: T0 + 120_000 });
    const c = await voiceCouncil('throat', T0 + 180_000);
    expect(c.id).not.toBe(a.id);
    expect(await store.all('messages')).toHaveLength(1);
  });
});

describe('the stars are kept lines', () => {
  const kept = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, at: T0 + i }));
  it('one star per kept line, newest first, at most STARS_MAX, each where its id puts it every time', () => {
    const sky = starsOf(kept(55));
    expect(sky).toHaveLength(STARS_MAX);
    expect(sky[0].id).toBe('m54');
    expect(sky.every(s => s.x >= 0 && s.x < 1 && s.y >= 0 && s.y < 1)).toBe(true);
    expect(starsOf(kept(55))).toEqual(sky);
    // a star does not move when another line is kept
    const m3 = starsOf(kept(5)).find(s => s.id === 'm3');
    expect(starsOf(kept(9)).find(s => s.id === 'm3')).toEqual(m3);
  });
  it('the day\'s star is the same all day; with nothing kept there is none', () => {
    expect(starOfDay(kept(12), '2026-11-11')).toEqual(starOfDay(kept(12), '2026-11-11'));
    const days = new Set(Array.from({ length: 10 }, (_, d) => starOfDay(kept(12), `2026-11-${10 + d}`)!.id));
    expect(days.size).toBeGreaterThan(1);
    expect(starOfDay([], '2026-11-11')).toBeUndefined();
  });
  it('Kept line reads the day\'s star as his kept line and the page it was kept on', async () => {
    expect(await keptStar(T0)).toBeUndefined();
    const r = await writeLine(undefined, undefined, { text: 'The quiet voices know the way.' }, T0 - 86_400_000);
    await setKept(r!.message!, true);
    const s = await keptStar(T0);
    expect(s!.kept.message.text).toBe('The quiet voices know the way.');
    expect(s!.kept.page.id).toBe(r!.page.id);
    expect(s!.star.id).toBe(r!.message!.id);
  });
});
