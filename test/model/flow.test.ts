// The phone's own calendar (src/model/flow.ts): local midnight, the ISO week, the month, the year.
import { describe, it, expect, afterEach } from 'vitest';
import { startOfDay, startOfWeek, startOfMonth, startOfYear } from '../../src/model/flow';

/** Local time, the phone's own clock. */
const L = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();

describe('the calendar', () => {
  it('a week starts on Monday: Sunday belongs to the week before', () => {
    // 2026-11-08 is a Sunday, 2026-11-09 a Monday
    expect(startOfWeek(L(2026, 11, 8))).toBe(L(2026, 11, 2, 0));
    expect(startOfWeek(L(2026, 11, 9))).toBe(L(2026, 11, 9, 0));
    // a week across the year end: Mon 2026-12-28 to Sun 2027-01-03
    expect(startOfWeek(L(2027, 1, 3))).toBe(L(2026, 12, 28, 0));
  });

  it('a day, a month and a year start at local midnight', () => {
    expect(startOfDay(L(2026, 11, 7, 23, 59))).toBe(L(2026, 11, 7, 0));
    expect(startOfMonth(L(2026, 10, 31, 23, 30))).toBe(L(2026, 10, 1, 0));
    expect(startOfYear(L(2026, 6, 1))).toBe(L(2026, 1, 1, 0));
  });

  describe('time zones: the day is the phone\'s local day', () => {
    const tz = process.env.TZ;
    afterEach(() => { process.env.TZ = tz; });
    it('a late evening in Denver is still that day, though it is tomorrow in UTC', () => {
      process.env.TZ = 'America/Denver';
      const evening = L(2026, 11, 7, 22, 30); // 05:30 UTC on 11/8
      expect(new Date(evening).getUTCDate()).toBe(8);
      expect(startOfDay(evening)).toBe(L(2026, 11, 7, 0));
    });
    it('a Sunday night in Tokyo is still that ISO week', () => {
      process.env.TZ = 'Asia/Tokyo';
      expect(startOfWeek(L(2026, 11, 8, 23, 0))).toBe(L(2026, 11, 2, 0));
    });
  });
});
