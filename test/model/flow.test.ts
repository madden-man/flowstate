import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { freshDB, writeSeedParadoxes } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { store } from '../../src/db/fields';
import type { Cadence, Item } from '../../src/db/schema';
import {
  isDue, onToday, nextDue, doneOn, periodOf, startOfWeek, withCheck, withoutToday, setDone, today,
  addLean, latestLean, leansOf, setLeanNote, snapLean, detentOf,
} from '../../src/model/flow';

beforeEach(async () => { await freshDB(); });

/** Local time, the phone's own clock. */
const L = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const item = (cadence: Cadence | undefined, done: number[] = [], extra: Partial<Item> = {}): Item =>
  ({ id: 'i', paradoxId: 'p', pole: 'a', text: 'x', lean: 0, order: 0, cadence, doneLog: done.map(at => ({ at })), ...extra });

describe('cadence', () => {
  it('daily is due every day until done that day', () => {
    expect(isDue(item('daily'), L(2026, 11, 7))).toBe(true);
    expect(isDue(item('daily', [L(2026, 11, 7, 0, 5)]), L(2026, 11, 7, 23, 59))).toBe(false);
    expect(isDue(item('daily', [L(2026, 11, 7, 23, 59)]), L(2026, 11, 8, 0, 1))).toBe(true);
  });

  it('weekly is once per ISO week: Monday starts it, Sunday ends it', () => {
    // 2026-11-08 is a Sunday, 2026-11-09 a Monday
    expect(new Date(startOfWeek(L(2026, 11, 8))).getDate()).toBe(2);
    expect(new Date(startOfWeek(L(2026, 11, 9))).getDate()).toBe(9);
    const doneMonday = item('weekly', [L(2026, 11, 2, 9)]);
    expect(isDue(doneMonday, L(2026, 11, 8, 23))).toBe(false);
    expect(isDue(doneMonday, L(2026, 11, 9, 0, 1))).toBe(true);
    // a week across the year end: Mon 2026-12-28 to Sun 2027-01-03
    expect(isDue(item('weekly', [L(2026, 12, 29)]), L(2027, 1, 3))).toBe(false);
    expect(isDue(item('weekly', [L(2026, 12, 29)]), L(2027, 1, 4))).toBe(true);
  });

  it('monthly is once per calendar month, month end included', () => {
    const done31 = item('monthly', [L(2026, 10, 31, 23, 30)]);
    expect(isDue(done31, L(2026, 10, 31, 23, 59))).toBe(false);
    expect(isDue(done31, L(2026, 11, 1, 0, 0))).toBe(true);
    expect(isDue(item('monthly', [L(2027, 2, 1)]), L(2027, 2, 28))).toBe(false);
    expect(nextDue(item('monthly', [L(2027, 1, 31)]), L(2027, 1, 31))).toBe(L(2027, 2, 1, 0));
  });

  it('yearly is once per year, until the new year', () => {
    const done = item('yearly', [L(2026, 1, 1, 0, 0)]);
    expect(isDue(done, L(2026, 12, 31, 23, 59))).toBe(false);
    expect(isDue(done, L(2027, 1, 1, 0, 0))).toBe(true);
    expect(periodOf('yearly', L(2026, 6, 1))).toEqual({ from: L(2026, 1, 1, 0), to: L(2027, 1, 1, 0) });
  });

  it('once is due until its first done, then shows only that day', () => {
    const once = item('once', [L(2026, 11, 7, 8)]);
    expect(isDue(item('once'), L(2030, 1, 1))).toBe(true);
    expect(isDue(once, L(2026, 11, 7, 9))).toBe(false);
    expect(onToday(once, L(2026, 11, 7, 9))).toBe(true);
    expect(onToday(once, L(2026, 11, 8, 9))).toBe(false);
    expect(nextDue(once, L(2026, 11, 8))).toBeNull();
  });

  it('no cadence, or archived, is never on today', () => {
    expect(onToday(item(undefined), L(2026, 11, 7))).toBe(false);
    expect(onToday(item('daily', [], { archived: true }), L(2026, 11, 7))).toBe(false);
    expect(nextDue(item(undefined))).toBeNull();
  });

  it('a weekly done earlier this week leaves today; done today stays (to be un-drawn)', () => {
    expect(onToday(item('weekly', [L(2026, 11, 3)]), L(2026, 11, 5))).toBe(false);
    expect(onToday(item('weekly', [L(2026, 11, 5, 7)]), L(2026, 11, 5, 21))).toBe(true);
    expect(nextDue(item('weekly', [L(2026, 11, 5)]), L(2026, 11, 5))).toBe(L(2026, 11, 9, 0));
    expect(nextDue(item('weekly'), L(2026, 11, 5, 15))).toBe(L(2026, 11, 5, 0));
  });

  describe('time zones: the day is the phone\'s local day', () => {
    const tz = process.env.TZ;
    afterEach(() => { process.env.TZ = tz; });
    it('a late evening in Denver is still that day, though it is tomorrow in UTC', () => {
      process.env.TZ = 'America/Denver';
      const evening = L(2026, 11, 7, 22, 30); // 05:30 UTC on 11/8
      expect(new Date(evening).getUTCDate()).toBe(8);
      expect(doneOn(item('daily', [evening]), L(2026, 11, 7, 8))).toBe(true);
      expect(isDue(item('daily', [evening]), L(2026, 11, 8, 6))).toBe(true);
    });
    it('a Sunday night in Tokyo is still that ISO week', () => {
      process.env.TZ = 'Asia/Tokyo';
      const sunday = L(2026, 11, 8, 23, 0); // Sunday local, Sunday 14:00 UTC
      expect(isDue(item('weekly', [L(2026, 11, 2, 1)]), sunday)).toBe(false);
      expect(isDue(item('weekly', [L(2026, 11, 2, 1)]), L(2026, 11, 9, 0, 30))).toBe(true);
    });
  });
});

describe('the done log', () => {
  it('checks once a day and un-draws only today', () => {
    const now = L(2026, 11, 7, 9);
    const log = withCheck([{ at: L(2026, 11, 6) }], now);
    expect(log).toHaveLength(2);
    expect(withCheck(log, now + 1000)).toBe(log);
    expect(withoutToday(log, now)).toEqual([{ at: L(2026, 11, 6) }]);
  });

  it('writes through the store and survives a re-read', async () => {
    await ensureSeeded(); await writeSeedParadoxes();
    const now = L(2026, 11, 7, 9);
    await setDone('it-own-sake', true, now);
    expect((await store.get('items', 'it-own-sake'))!.doneLog).toEqual([{ at: now }]);
    await setDone('it-own-sake', false, now + 60_000);
    expect((await store.get('items', 'it-own-sake'))!.doneLog).toEqual([]);
  });

  it("today's page groups the seed items by paradox, and leaves those with no cadence out", async () => {
    await ensureSeeded(); await writeSeedParadoxes();
    const now = L(2026, 11, 7, 9);
    const groups = await today(now);
    expect(groups.map(g => g.paradox.id)).toEqual(['px-selfless-selfish', 'px-thoughtful-reactive']);
    expect(groups[0].items.map(i => i.id)).toEqual(['it-volunteer', 'it-share', 'it-own-sake', 'it-breathing-room']);
    expect(groups[1].items).toEqual([]);
    await setDone('it-volunteer', true, L(2026, 11, 2));
    expect((await today(now))[0].items.map(i => i.id)).not.toContain('it-volunteer');
  });
});

describe('leans', () => {
  it('snaps to three detents and clamps to the poles', () => {
    expect(snapLean(-0.95)).toBe(-1);
    expect(snapLean(0.05)).toBe(0);
    expect(snapLean(1.6)).toBe(1);
    expect(snapLean(0.4)).toBe(0.4);
    expect(detentOf(0.5)).toBeUndefined();
  });

  it('a release writes a lean row; the latest is the one shown; a note is one line', async () => {
    await ensureSeeded(); await writeSeedParadoxes();
    await addLean('px-selfless-selfish', -0.3, { now: 10 });
    const b = await addLean('px-selfless-selfish', 3, { now: 20 });
    expect(b).toMatchObject({ paradoxId: 'px-selfless-selfish', at: 20, lean: 1, note: '' });
    expect((await latestLean('px-selfless-selfish'))!.id).toBe(b.id);
    await setLeanNote(b.id, '  more for me\nthis week ');
    expect((await store.get('leans', b.id))!.note).toBe('more for me this week');
    expect((await leansOf('px-selfless-selfish')).map(l => l.at)).toEqual([10, 20]);
    expect(await latestLean('px-thoughtful-reactive')).toBeUndefined();
  });
});
