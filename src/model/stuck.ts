// What stuck's axis (PLAN-ENERGIZE.md section 3 step 7, X4): where a day sits on the page's time line, which months
// (or years) are named along the top, and where each stint's ribbon runs. Pure, no UI. The axis runs from the start of
// the month the first stint began in to now, by the phone's own calendar; a label sits at the true start of its month,
// and labels are thinned so none ever runs into the next or into "now". A drawing, never a count (DESIGN.md rule 15):
// nothing here sums, ranks or returns a number for show; the positions are fractions of the line, for the page to draw.
import type { Millis, Stint } from '../db/schema';

const DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The nearest two labels may sit, as a fraction of the line: about four letters of print on a 390pt phone. */
export const LABEL_GAP = 0.13;
/** Past this many months the axis names years instead of months ("a span over a few years labels years"). */
export const YEARS_AFTER = 36;

export type Axis = { start: Millis; now: Millis };
/** One label on the axis: its words and where it starts, 0 at the left, 1 at now. */
export type Label = { text: string; at: number };
/** One ribbon: where it starts and how far it runs along the line, 0 to 1; open while the stint is on. */
export type Run = { at: number; length: number; open: boolean };

/** Local midnight on the first of the month t falls in. */
export const monthStart = (t: Millis) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };

/** The axis for these stints: from the start of the earliest one's month to now. Never shorter than a day. */
export function axisOf(stints: Pick<Stint, 'from'>[], now: Millis): Axis {
  const first = Math.min(now, ...stints.map(s => s.from));
  return { start: monthStart(first), now: Math.max(now, monthStart(first) + DAY) };
}

/** Where t sits on the line, clamped to it. */
export const place = (a: Axis, t: Millis) => Math.min(1, Math.max(0, (t - a.start) / (a.now - a.start)));

/** A stint as a ribbon: from its start to its end, or to now while it is on. One the stroke would not show keeps
 *  length 0, and the page draws it as a dot. */
export function runOf(a: Axis, s: Stint): Run {
  const at = place(a, s.from);
  return { at, length: Math.max(0, place(a, s.to ?? a.now) - at), open: s.to === undefined };
}

/** Every month start (or every January, for years) from the axis start up to now, before any thinning. */
function marks(a: Axis, years: boolean): Label[] {
  const out: Label[] = [];
  const d = new Date(a.start);
  let y = d.getFullYear(), m = d.getMonth();
  if (years && m !== 0) { y++; m = 0; }
  for (;;) {
    const t = new Date(y, m, 1).getTime();
    if (t >= a.now) break;
    out.push({ text: years ? String(y) : MONTHS[m], at: place(a, t) });
    if (years) y++; else if (++m === 12) { m = 0; y++; }
  }
  return out;
}

/**
 * The labels along the top: every month at its true place, or every second, third or sixth month once they would sit
 * closer than LABEL_GAP (counted from the first month, so the axis start is always named); every year past
 * YEARS_AFTER months, thinned the same way. Any label too close to "now" at the right edge is dropped; "now" is the
 * page's own word and is not in the list.
 */
export function labelsOf(a: Axis, gap = LABEL_GAP): Label[] {
  const months = (new Date(a.now).getFullYear() - new Date(a.start).getFullYear()) * 12
    + new Date(a.now).getMonth() - new Date(a.start).getMonth();
  const years = months > YEARS_AFTER;
  const all = marks(a, years);
  // the spacing of one step as a fraction of the line, at its shortest (February, a year of 365 days), so no two
  // labels a step apart are ever closer than gap
  const one = (years ? 365 : 28) * DAY / (a.now - a.start);
  const step = [1, 2, 3, 6, 12, 24, 60].find(n => n * one >= gap) ?? 120;
  return all.filter((_, i) => i % step === 0).filter(l => 1 - l.at >= gap);
}
