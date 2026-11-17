// The blockers walkthrough's day: "today" is pinned to Tuesday 2026-11-17, the day the blockers were planned, so every
// date on the page (the journal's header, a resolved question's date, the ? list) reads the same on any day it is
// opened. As design/research/src/clock.ts: before any of the app's modules are evaluated (this is main.ts's first
// import), Date is replaced with one whose now starts at 21:40 that evening, local time, and runs on at the real rate;
// a Date made from a value is untouched.
const Real = Date;
/** The pinned evening: 2026-11-17 21:40, by the phone's own calendar. */
export const TODAY = new Real(2026, 10, 17, 21, 40).getTime();
const t0 = Real.now();
const now = () => TODAY + (Real.now() - t0);

class PinnedDate extends Real {
  constructor(...a: unknown[]) {
    if (a.length === 0) super(now());
    else super(...(a as [string | number | Date]));
  }
  static now(): number { return now(); }
}

Object.defineProperty(globalThis, 'Date', { value: PinnedDate, configurable: true, writable: true });
