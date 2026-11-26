// The Sunday question's wall clock (PLAN-PUSH.md section 5). Pure: no I/O, no
// clock of its own. Generalised from Semper Dulce's denverParts to any IANA zone.
//
// A "week" is named by the local date of its Sunday ("2026-11-22"): weekday 0 is
// Sunday, as in Date.getDay(), so the week a push belongs to starts on the day it
// is usually sent. The phone and the server name weeks the same way.

export interface Schedule {
  /** IANA zone the phone last reported, e.g. "America/Denver". */
  tz: string;
  /** 0 Sunday to 6 Saturday. */
  weekday: number;
  /** 0 to 23, local. */
  hour: number;
  /** 0 to 59, local. */
  minute: number;
}

export interface ZoneParts {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
  /** 0 Sunday to 6 Saturday, local. */
  weekday: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

const formatter = (tz: string): Intl.DateTimeFormat => {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    });
    formatters.set(tz, f);
  }
  return f;
};

/** True when the runtime knows the zone by its IANA name. */
export function isValidZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.length === 0 || tz.length > 64) return false;
  // Names only ("Asia/Tokyo", "UTC", "Etc/GMT+5"); no raw offsets like "+09:00".
  if (!/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(tz)) return false;
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

/** The wall clock in `tz` at instant `date`. */
export function zoneParts(date: Date, tz: string): ZoneParts {
  const p: Record<string, string> = {};
  for (const x of formatter(tz).formatToParts(date)) p[x.type] = x.value;
  const y = +p.year;
  const m = +p.month;
  const d = +p.day;
  const h = +p.hour % 24;
  return { y, m, d, h, min: +p.minute, weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

const iso = (t: number): string => new Date(t).toISOString().slice(0, 10);

/** The week a local date belongs to: the local date of its Sunday. */
export function weekOf(parts: Pick<ZoneParts, 'y' | 'm' | 'd' | 'weekday'>): string {
  return iso(Date.UTC(parts.y, parts.m - 1, parts.d - parts.weekday));
}

export interface Due {
  /** Send now. */
  due: boolean;
  /** The local week this run falls in; stamp it as lastSentWeek after a send. */
  week: string;
}

/**
 * Is the check-in due for this device at `now`? It is when, in the device's zone,
 * it is the chosen weekday, at or past the chosen time, and nothing has been sent
 * this local week. A late or skipped hourly run still sends later the same local
 * day; once the day is over the week is missed rather than sent on Monday.
 */
export function isDue(schedule: Schedule, lastSentWeek: string | undefined, now: Date): Due {
  const p = zoneParts(now, schedule.tz);
  const week = weekOf(p);
  const onDay = p.weekday === schedule.weekday;
  const past = p.h * 60 + p.min >= schedule.hour * 60 + schedule.minute;
  return { due: onDay && past && lastSentWeek !== week, week };
}
