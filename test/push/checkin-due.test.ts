// The Sunday question's clock (PLAN-PUSH.md N1, src/push/due.ts): due from Sunday 10:00 until the next Sunday 10:00,
// once a week, by the phone's wall clock, across both daylight saving changes.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CHECKIN_DEFAULT, CHECKIN_LINE, checkinDue, checkinOf, lastOccurrence, weekKey, type Checkin } from '../../src/push/due';

// Mountain time has both changes in 2026: forward on Sunday 8 March, back on Sunday 1 November
let tz: string | undefined;
beforeAll(() => { tz = process.env.TZ; process.env.TZ = 'America/Denver'; });
afterAll(() => { process.env.TZ = tz; });

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const q = (patch: Partial<Checkin> = {}): Checkin => ({ ...CHECKIN_DEFAULT, ...patch });

describe('checkinDue', () => {
  it('the zone is the one the tests ask for', () => {
    expect(new Date(at(2026, 7, 1)).getTimezoneOffset()).toBe(360);
    expect(new Date(at(2026, 12, 1)).getTimezoneOffset()).toBe(420);
  });

  it('is not due before 10:00 on Sunday, and is at 10:01', () => {
    expect(checkinDue(q({ lastShownWeek: '2026-11-15' }), at(2026, 11, 22, 9, 59))).toBe(false);
    expect(checkinDue(q({ lastShownWeek: '2026-11-15' }), at(2026, 11, 22, 10, 1))).toBe(true);
    expect(weekKey(at(2026, 11, 22, 9, 59), q())).toBe('2026-11-15');
    expect(weekKey(at(2026, 11, 22, 10, 1), q())).toBe('2026-11-22');
  });

  it('is not due once shown this week', () => {
    expect(checkinDue(q({ lastShownWeek: '2026-11-22' }), at(2026, 11, 22, 10, 1))).toBe(false);
    expect(checkinDue(q({ lastShownWeek: '2026-11-22' }), at(2026, 11, 28, 23, 59))).toBe(false);
  });

  it('is still due on the Wednesday of the same week if never shown', () => {
    expect(checkinDue(q({ lastShownWeek: '2026-11-15' }), at(2026, 11, 25, 8, 0))).toBe(true);
    expect(checkinDue(q(), at(2026, 11, 25, 8, 0))).toBe(true);
    expect(weekKey(at(2026, 11, 25, 8, 0), q())).toBe('2026-11-22');
  });

  it('is due again the next Sunday', () => {
    expect(checkinDue(q({ lastShownWeek: '2026-11-22' }), at(2026, 11, 29, 9, 59))).toBe(false);
    expect(checkinDue(q({ lastShownWeek: '2026-11-22' }), at(2026, 11, 29, 10, 0))).toBe(true);
  });

  it('is never due with the question off', () => {
    expect(checkinDue(q({ on: false }), at(2026, 11, 22, 10, 1))).toBe(false);
  });

  it('waits for the next occurrence in a journal begun after this one', () => {
    const seeded = at(2026, 11, 24, 12, 0);
    expect(checkinDue(q(), at(2026, 11, 25, 8, 0), seeded)).toBe(false);
    expect(checkinDue(q(), at(2026, 11, 29, 10, 1), seeded)).toBe(true);
  });

  it('asks at 10:00 by the clock on the day the clocks go back, and the week after', () => {
    expect(checkinDue(q({ lastShownWeek: '2026-10-25' }), at(2026, 11, 1, 9, 59))).toBe(false);
    expect(checkinDue(q({ lastShownWeek: '2026-10-25' }), at(2026, 11, 1, 10, 1))).toBe(true);
    const o = lastOccurrence(at(2026, 11, 4, 12), q());
    expect([o.getDate(), o.getHours(), o.getMinutes()]).toEqual([1, 10, 0]);
    // the Saturday before the change still belongs to the week begun before it
    const back = lastOccurrence(at(2026, 11, 1, 9, 0), q());
    expect([back.getMonth(), back.getDate(), back.getHours()]).toEqual([9, 25, 10]);
    expect(weekKey(at(2026, 10, 31, 23, 0), q())).toBe('2026-10-25');
  });

  it('asks at 10:00 by the clock on the day the clocks go forward, and the week after', () => {
    expect(checkinDue(q({ lastShownWeek: '2026-03-01' }), at(2026, 3, 8, 9, 59))).toBe(false);
    expect(checkinDue(q({ lastShownWeek: '2026-03-01' }), at(2026, 3, 8, 10, 1))).toBe(true);
    const o = lastOccurrence(at(2026, 3, 14, 23, 0), q());
    expect([o.getDate(), o.getHours()]).toEqual([8, 10]);
    // a Sunday 10:00 seen from just before the next one, across the change, is the one before it
    const prev = lastOccurrence(at(2026, 3, 8, 9, 30), q());
    expect([prev.getMonth(), prev.getDate(), prev.getHours()]).toEqual([2, 1, 10]);
  });

  it('names the week by its Sunday whatever the time, so a moved time never asks twice', () => {
    expect(weekKey(at(2026, 11, 22, 10, 1), q())).toBe(weekKey(at(2026, 11, 22, 10, 1), q({ hour: 9 })));
    expect(checkinDue(q({ hour: 9, lastShownWeek: '2026-11-22' }), at(2026, 11, 22, 10, 1))).toBe(false);
  });
});

describe('checkinOf', () => {
  it('reads an absent question as Sunday 10:00 with his line, and an emptied line as that line', () => {
    expect(checkinOf({})).toEqual({ on: true, weekday: 0, hour: 10, minute: 0, line: CHECKIN_LINE });
    expect(checkinOf({ checkin: { ...CHECKIN_DEFAULT, line: '  ' } }).line).toBe(CHECKIN_LINE);
    expect(checkinOf({ checkin: { ...CHECKIN_DEFAULT, line: 'What is heavy?', hour: 9 } })).toMatchObject({ line: 'What is heavy?', hour: 9 });
  });
});
