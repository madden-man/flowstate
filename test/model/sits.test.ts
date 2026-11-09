// The sits (PLAN-MEDITATE.md S2): under a minute writes nothing, a minute or more one row with its sound and length,
// "last sat" is the newest, and "Write it down" links today's page to the sit both ways.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import { store } from '../../src/db/fields';
import { today, writeLine } from '../../src/model/pages';
import { sitOf, keepSit, lastSit, satMinutes, minutesWords, linkSitToday, sitLinkOf, SIT_LENGTHS } from '../../src/model/sits';

beforeEach(async () => { await freshDB(); });

const MIN = 60_000;
const T0 = new Date(2026, 10, 9, 7, 39).getTime();

describe('a sit is kept', () => {
  it('a sit ended inside its first minute writes nothing', () => {
    expect(sitOf(T0, T0 + 59_999, 'rain', 10)).toBeNull();
    expect(sitOf(T0, T0, 'quiet')).toBeNull();
  });
  it('a sit of a minute or more is one row with its sound and its chosen length', async () => {
    const s = sitOf(T0, T0 + 10 * MIN, 'bowl', 10)!;
    expect(s).toMatchObject({ startedAt: T0, endedAt: T0 + 10 * MIN, sound: 'bowl', minutes: 10 });
    await keepSit(s);
    expect(await store.all('sits')).toEqual([s]);
  });
  it('an open sit has no minutes', () => {
    const s = sitOf(T0, T0 + MIN, 'quiet', 0)!;
    expect(s).not.toHaveProperty('minutes');
    expect(sitOf(T0, T0 + 2 * MIN, 'rain')).not.toHaveProperty('minutes');
  });
  it('the lengths are open, 5, 10 and 20', () => {
    expect(SIT_LENGTHS).toEqual([0, 5, 10, 20]);
  });
  it('a sit says its own length in whole minutes, never under one', () => {
    expect(satMinutes({ startedAt: T0, endedAt: T0 + 12 * MIN + 20_000 })).toBe(12);
    expect(satMinutes({ startedAt: T0, endedAt: T0 + 5 * MIN - 30 })).toBe(5);
    expect(satMinutes({ startedAt: T0, endedAt: T0 + MIN })).toBe(1);
    expect(minutesWords(1)).toBe('1 minute');
    expect(minutesWords(12)).toBe('12 minutes');
  });
});

describe('last sat', () => {
  it('is undefined before the first sit, then the newest by when it began', async () => {
    expect(await lastSit()).toBeUndefined();
    const older = sitOf(T0 - 24 * 60 * MIN, T0 - 23 * 60 * MIN, 'ocean')!;
    const newer = sitOf(T0, T0 + 5 * MIN, 'rain', 5)!;
    await keepSit(newer);
    await keepSit(older);
    expect((await lastSit())!.id).toBe(newer.id);
  });
});

describe('write it down', () => {
  it('links today\'s page and the sit both ways; the page reads back the sit', async () => {
    const s = sitOf(T0, T0 + 12 * MIN, 'rain')!;
    await keepSit(s);
    const page = await linkSitToday(s.id, T0 + 13 * MIN);
    expect(page!.sit).toEqual({ sitId: s.id });
    expect((await store.get('sits', s.id))!.pageId).toBe(page!.id);
    expect((await today(new Date(T0 + 14 * MIN))).page!.id).toBe(page!.id);
    expect(await sitLinkOf(page!)).toEqual({ href: '#/flow/meditate', startedAt: T0, endedAt: T0 + 12 * MIN, sound: 'rain' });
  });
  it('a page already written today keeps its words and gains the link', async () => {
    const w = await writeLine(undefined, undefined, { text: 'the kitchen' }, T0 - MIN);
    const s = sitOf(T0, T0 + 2 * MIN, 'ocean')!;
    await keepSit(s);
    const page = await linkSitToday(s.id, T0 + 3 * MIN);
    expect(page!.id).toBe(w!.page.id);
    expect((await store.all('messages')).map(m => m.text)).toEqual(['the kitchen']);
  });
  it('a sit that is not there links nothing', async () => {
    expect(await linkSitToday('gone')).toBeUndefined();
    expect(await sitLinkOf({})).toBeUndefined();
  });
});
