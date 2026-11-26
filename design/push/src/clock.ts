// The Sunday question walkthrough's days: before any of the app's modules are evaluated (this is main.ts's first
// import), Date is replaced with one whose now starts at the step's own moment, local time, and runs on at the real
// rate; a Date made from a value is untouched (as design/blockers/src/clock.ts). Settings is read on Wednesday morning,
// three days after last Sunday's push arrived; the question asks on Sunday 29 November at 10:00.
const Real = Date;

/** Each step's moment, by the phone's own calendar. */
const AT: Record<string, [number, number, number, number, number]> = {
  question: [2026, 10, 25, 9, 30],
  notify: [2026, 10, 25, 9, 31],
  sendnow: [2026, 10, 25, 9, 33],
  pin: [2026, 10, 29, 10, 0],
  landing: [2026, 10, 29, 10, 1],
  later: [2026, 10, 29, 12, 30],
  safari: [2026, 10, 25, 9, 35],
};
const step = new URLSearchParams(location.search).get('step') ?? '';
const [y, m, d, h, min] = AT[step] ?? AT.question;
/** The step's moment. */
export const TODAY = new Real(y, m, d, h, min).getTime();
/** Last Sunday's push: 22 November, 10:00. */
export const LAST_SUNDAY = new Real(2026, 10, 22, 10, 0).getTime();
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
