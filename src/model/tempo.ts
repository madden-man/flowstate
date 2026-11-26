// Tap tempo (PLAN-WORLDS.md section 6, W6): a tempo only if he taps one. Pure: the taps' times in, beats a minute out.
// A pause longer than GAP_MS starts the count again, so the last run of taps is the tempo; the median interval of its
// last few taps keeps one stray tap from moving it.

/** A pause this long between taps starts a new tempo. */
export const GAP_MS = 2000;
/** Taps a tempo is read from: the last eight, so it follows a change in a few beats. */
const KEEP = 8;

/** The taps that count: the last run with no gap over GAP_MS, at most KEEP. */
export function runOf(taps: readonly number[]): number[] {
  let from = taps.length - 1;
  while (from > 0 && taps[from] - taps[from - 1] <= GAP_MS) from--;
  return taps.slice(Math.max(from, taps.length - KEEP));
}

/** Beats a minute from the taps (ms timestamps, oldest first), a whole number from 30 to 300; undefined before two. */
export function bpmOf(taps: readonly number[]): number | undefined {
  const run = runOf(taps);
  if (run.length < 2) return undefined;
  const gaps = run.slice(1).map((t, i) => t - run[i]).sort((a, b) => a - b);
  const mid = gaps.length % 2 ? gaps[(gaps.length - 1) / 2] : (gaps[gaps.length / 2 - 1] + gaps[gaps.length / 2]) / 2;
  if (!(mid > 0)) return undefined;
  return Math.min(300, Math.max(30, Math.round(60000 / mid)));
}
