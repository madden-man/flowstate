// The tiers walkthrough's day: "today" is pinned to Thursday 2026-11-12, the day the tiers came in, so every date on
// the page (the header, "First since", a Legacy row's dates) reads the same on any day it is opened. As
// design/values/src/clock.ts: before any of the app's modules are evaluated (this is main.ts's first import), Date is
// replaced with one whose now starts at 09:30 that morning, local time, and runs on at the real rate; a Date made from
// a value is untouched.
const Real = Date;
/** The pinned morning: 2026-11-12 09:30, by the phone's own calendar. */
export const TODAY = new Real(2026, 10, 12, 9, 30).getTime();
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
