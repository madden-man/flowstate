// The Sunday question's clock (PLAN-PUSH.md sections 4 and 5, N1). Pure: no network, no storage, no DOM. Given the
// schedule, the week it was last shown or answered, and now in the phone's own local time, is the in-app line due?
// It is due from the chosen weekday and time until the next one, once a week. A week is named by the date of the
// occurrence that began it ("2026-11-22" for Sunday 22 November), so moving the time on the same day names the same
// week and never asks twice. Wall-clock maths only (new Date(y, m, d, h, min) and setDate), so a week that crosses a
// daylight saving change still asks at 10:00 by the phone's clock.
// N2's server keeps its own copy of this shape (netlify/functions/lib/due.mts), in the stored time zone, not the phone's.

/** When the question asks: a weekday (0 is Sunday, as Date.getDay), an hour and a minute, local. */
export type CheckinSchedule = { weekday: number; hour: number; minute: number };

/** settings.checkin (PLAN-PUSH.md section 5): the switch for the question itself, when it asks, his line, and the
 *  week it was last shown or answered (weekKey). Clear, like the rest of settings: it is one sentence he chose to
 *  show, and N3's service worker reads a copy of it with no key. */
export type Checkin = CheckinSchedule & {
  on: boolean; line: string; lastShownWeek?: string;
  /** N3: he switched the push on, on this phone (push/push.ts). Absent is off. An import keeps this phone's own value. */
  push?: boolean;
};

/** His own sentence from the ask (PLAN-PUSH.md section 1). */
export const CHECKIN_LINE = 'Is there anything on your mind?';

/** Sunday 10:00, on (decided 2026-11-25). An absent settings.checkin reads as this. */
export const CHECKIN_DEFAULT: Checkin = { on: true, weekday: 0, hour: 10, minute: 0, line: CHECKIN_LINE };

/** The question as it stands: the stored one over the defaults; an emptied line reads as the default line. */
export function checkinOf(s: { checkin?: Partial<Checkin> }): Checkin {
  const c = { ...CHECKIN_DEFAULT, ...s.checkin };
  return c.line.trim() ? c : { ...c, line: CHECKIN_LINE };
}

const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The latest occurrence of the schedule at or before now, in local wall-clock time. */
export function lastOccurrence(now: number | Date, s: CheckinSchedule): Date {
  const d = new Date(now);
  const back = (d.getDay() - s.weekday + 7) % 7;
  const o = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back, s.hour, s.minute);
  // later today than now: last week's (setDate keeps the wall clock across a daylight saving change)
  if (o.getTime() > d.getTime()) o.setDate(o.getDate() - 7);
  return o;
}

/** The week now falls in, named by the date its occurrence fell on: "2026-11-22". */
export const weekKey = (now: number | Date, s: CheckinSchedule): string => dateKey(lastOccurrence(now, s));

/**
 * True when the in-app line should show now: the question is on, this week's occurrence has come, and it has not
 * been shown or answered this week. since (the journal's seededAt) keeps a journal begun after this week's
 * occurrence from asking until the next one.
 */
export function checkinDue(c: Checkin, now: number | Date, since?: number): boolean {
  if (!c.on) return false;
  const o = lastOccurrence(now, c);
  if (since !== undefined && o.getTime() < since) return false;
  return dateKey(o) !== c.lastShownWeek;
}
