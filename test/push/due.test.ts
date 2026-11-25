import { describe, expect, it } from 'vitest';
import { isDue, isValidZone, weekOf, zoneParts, type Schedule } from '../../netlify/functions/lib/due.mts';

const sunday10 = (tz: string): Schedule => ({ tz, weekday: 0, hour: 10, minute: 0 });
const at = (iso: string) => new Date(iso);

describe('zoneParts', () => {
  it('reads the wall clock and weekday in a zone', () => {
    // 2026-11-22 is a Sunday.
    expect(zoneParts(at('2026-11-22T17:00:00Z'), 'America/Denver')).toEqual({ y: 2026, m: 11, d: 22, h: 10, min: 0, weekday: 0 });
    expect(zoneParts(at('2026-11-22T01:00:00Z'), 'Asia/Tokyo')).toEqual({ y: 2026, m: 11, d: 22, h: 10, min: 0, weekday: 0 });
  });

  it('gives hour 0 at midnight, never 24', () => {
    expect(zoneParts(at('2026-11-23T07:00:00Z'), 'America/Denver').h).toBe(0);
  });
});

describe('weekOf', () => {
  it('names a week by its Sunday', () => {
    expect(weekOf({ y: 2026, m: 11, d: 22, weekday: 0 })).toBe('2026-11-22');
    expect(weekOf({ y: 2026, m: 11, d: 28, weekday: 6 })).toBe('2026-11-22');
    expect(weekOf({ y: 2027, m: 1, d: 2, weekday: 6 })).toBe('2026-12-27');
  });
});

describe('isValidZone', () => {
  it('accepts IANA names and refuses the rest', () => {
    expect(isValidZone('America/Denver')).toBe(true);
    expect(isValidZone('Asia/Tokyo')).toBe(true);
    expect(isValidZone('UTC')).toBe(true);
    expect(isValidZone('Mars/Olympus')).toBe(false);
    expect(isValidZone('+09:00')).toBe(false);
    expect(isValidZone('')).toBe(false);
    expect(isValidZone(9)).toBe(false);
    expect(isValidZone('A'.repeat(80))).toBe(false);
  });
});

describe('isDue', () => {
  const denver = sunday10('America/Denver');

  it('is due at Sunday 10:00 Denver in winter (17:00 UTC, MST)', () => {
    expect(isDue(denver, undefined, at('2026-11-22T16:00:00Z')).due).toBe(false);
    expect(isDue(denver, undefined, at('2026-11-22T17:00:00Z'))).toEqual({ due: true, week: '2026-11-22' });
  });

  it('is due at Sunday 10:00 Denver in summer (16:00 UTC, MDT)', () => {
    expect(isDue(denver, undefined, at('2026-07-12T15:00:00Z')).due).toBe(false);
    expect(isDue(denver, undefined, at('2026-07-12T16:00:00Z')).due).toBe(true);
  });

  it('follows the spring change on the Sunday it happens (2026-03-08)', () => {
    // 02:00 MST jumps to 03:00 MDT; 10:00 that morning is 16:00 UTC.
    expect(isDue(denver, undefined, at('2026-03-08T15:00:00Z')).due).toBe(false);
    expect(isDue(denver, undefined, at('2026-03-08T16:00:00Z')).due).toBe(true);
  });

  it('follows the fall change on the Sunday it happens (2026-11-01)', () => {
    // 02:00 MDT falls back to 01:00 MST; 10:00 that morning is 17:00 UTC.
    expect(isDue(denver, undefined, at('2026-11-01T16:00:00Z')).due).toBe(false);
    expect(isDue(denver, undefined, at('2026-11-01T17:00:00Z')).due).toBe(true);
  });

  it('sends a time skipped by spring forward at the first run after it', () => {
    const s: Schedule = { tz: 'America/Denver', weekday: 0, hour: 2, minute: 30 };
    expect(isDue(s, undefined, at('2026-03-08T08:00:00Z')).due).toBe(false); // 01:00 MST
    expect(isDue(s, undefined, at('2026-03-08T09:00:00Z')).due).toBe(true); // 03:00 MDT
  });

  it('sends a repeated fall-back hour once', () => {
    const s: Schedule = { tz: 'America/Denver', weekday: 0, hour: 1, minute: 0 };
    const first = isDue(s, undefined, at('2026-11-01T07:00:00Z')); // 01:00 MDT
    expect(first.due).toBe(true);
    expect(isDue(s, first.week, at('2026-11-01T08:00:00Z')).due).toBe(false); // 01:00 MST again
  });

  it('is due at Sunday 10:00 Tokyo, which is Sunday 01:00 UTC', () => {
    const tokyo = sunday10('Asia/Tokyo');
    expect(isDue(tokyo, undefined, at('2026-11-22T00:00:00Z')).due).toBe(false);
    expect(isDue(tokyo, undefined, at('2026-11-22T01:00:00Z'))).toEqual({ due: true, week: '2026-11-22' });
  });

  it('is not due on Saturday UTC when Tokyo is already Sunday morning early', () => {
    // Saturday 23:00 UTC is Sunday 08:00 Tokyo: right day, too early.
    expect(isDue(sunday10('Asia/Tokyo'), undefined, at('2026-11-21T23:00:00Z')).due).toBe(false);
  });

  it('is due when UTC is still Saturday (Kiritimati, UTC+14)', () => {
    // Saturday 20:00 UTC is Sunday 10:00 at UTC+14.
    expect(isDue(sunday10('Pacific/Kiritimati'), undefined, at('2026-11-21T20:00:00Z'))).toEqual({ due: true, week: '2026-11-22' });
  });

  it('is due when UTC is already Monday (Honolulu, evening schedule)', () => {
    // Sunday 20:00 in Honolulu (UTC-10) is Monday 06:00 UTC.
    const s: Schedule = { tz: 'Pacific/Honolulu', weekday: 0, hour: 20, minute: 0 };
    expect(isDue(s, undefined, at('2026-11-23T06:00:00Z'))).toEqual({ due: true, week: '2026-11-22' });
  });

  it('is due in a zone west of UTC where local Sunday 10:00 is Sunday UTC (New York)', () => {
    expect(isDue(sunday10('America/New_York'), undefined, at('2026-11-22T15:00:00Z')).due).toBe(true);
  });

  it('is not due twice in one week', () => {
    const first = isDue(denver, undefined, at('2026-11-22T17:00:00Z'));
    expect(isDue(denver, first.week, at('2026-11-22T18:00:00Z')).due).toBe(false);
    expect(isDue(denver, first.week, at('2026-11-23T03:00:00Z')).due).toBe(false); // Sunday 20:00
  });

  it('is due again the next week', () => {
    expect(isDue(denver, '2026-11-22', at('2026-11-29T17:00:00Z'))).toEqual({ due: true, week: '2026-11-29' });
  });

  it('still sends late the same local day after skipped runs', () => {
    expect(isDue(denver, '2026-11-15', at('2026-11-23T06:00:00Z')).due).toBe(true); // Sunday 23:00
  });

  it('does not send on Monday for a missed Sunday', () => {
    expect(isDue(denver, '2026-11-15', at('2026-11-23T07:00:00Z')).due).toBe(false); // Monday 00:00
  });

  it('respects the minute: 10:15 waits for the 11:00 run', () => {
    const s: Schedule = { tz: 'America/Denver', weekday: 0, hour: 10, minute: 15 };
    expect(isDue(s, undefined, at('2026-11-22T17:00:00Z')).due).toBe(false);
    expect(isDue(s, undefined, at('2026-11-22T18:00:00Z')).due).toBe(true);
  });

  it('handles half-hour zones (Kolkata, UTC+5:30)', () => {
    // Runs land at hh:30 local. 04:00 UTC is 09:30; 05:00 UTC is 10:30.
    const s = sunday10('Asia/Kolkata');
    expect(isDue(s, undefined, at('2026-11-22T04:00:00Z')).due).toBe(false);
    expect(isDue(s, undefined, at('2026-11-22T05:00:00Z')).due).toBe(true);
    expect(isDue({ ...s, minute: 30 }, undefined, at('2026-11-22T04:00:00Z')).due).toBe(false);
    expect(isDue({ ...s, hour: 9, minute: 30 }, undefined, at('2026-11-22T04:00:00Z')).due).toBe(true);
  });

  it('works for a weekday other than Sunday', () => {
    const wed: Schedule = { tz: 'Asia/Tokyo', weekday: 3, hour: 7, minute: 0 };
    // Wednesday 2026-11-25 07:00 JST is Tuesday 22:00 UTC.
    expect(isDue(wed, undefined, at('2026-11-24T22:00:00Z'))).toEqual({ due: true, week: '2026-11-22' });
  });
});
