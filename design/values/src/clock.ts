// The walkthrough's day: "today" is pinned to Wednesday 2026-11-11, the day the values plan was written, so every
// date on the page (the header, the "Said for it" rows) reads the same on any day it is opened. Before any of the
// app's modules are evaluated (this is main.ts's first import), Date is replaced with one whose now starts at 09:12
// that morning, local time, and runs on at the real rate; a Date made from a value is untouched (as design/energize).
const Real = Date;
/** The pinned morning: 2026-11-11 09:12, by the phone's own calendar. */
export const TODAY = new Real(2026, 10, 11, 9, 12).getTime();
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
