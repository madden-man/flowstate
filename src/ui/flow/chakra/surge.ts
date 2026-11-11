// The water answers (PLAN-TASKS.md section 5, T2): a touch done releases a share of the pool above its sign as one
// surge down the course to the sea, then the pool fills again, because the reading has not changed. It never writes
// the gate. After a surge the gate's handle goes dashed (R2's stale state) until he sets it or leaves the page; and the
// first return to the Flow tab in the same unlock shows the surge run from that sign to the sea, once.
//
// It hangs off onTouchDone (./touch.ts), so every touch that says it is done surges, the ones in the place (T2) and the
// ones into and out of the app (T3, T4) alike. What is pooled is R2's: a gate b part shut over water q holds back b * q
// (mountain/water.ts, `held`), and fills back toward it at POOL_FILL a second.
//
// Nothing surges in Still (rule 13: no pool, no surge), under Reduce Motion (nothing travels), or through the door (the
// journal is locked, so there is no reading to pool behind and the mountain is behind the PIN). An open gate holds
// nothing back, so a touch there sends nothing and asks nothing. No tally anywhere: what is kept is which signs owe the
// mountain a surge, cleared when it has run, and which gates ask, cleared when set or left.
import { signal } from '@preact/signals';
import { effect } from '@preact/signals';
import { CHAKRA_IDS, latestReadings, reach, spring, type ChakraId } from '../../../model/mountain';
import { keyState } from '../../../db/fields';
import { gate as lockGate } from '../../lock/pin';
import { light } from '../../light';
import { onTouchDone, type TouchDone } from './touch';

/** The share of the pool one touch lets go. */
export const SHARE = 0.6;
/** Less than this let go is not seen, so it is not sent (nor asked about). */
export const FLOOR = 0.02;
/** How quickly a shut gate's pool fills again, a second (R2's FILL, mountain/water.ts). */
export const POOL_FILL = 0.45;

const unit = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);

/** What a gate b holds back over water q reaching it: R2's pool when full. */
export const pooledAt = (gate: number, above: number): number => unit(gate) * unit(above);

/** What a touch lets go from a pool holding `pooled`: SHARE of it, or 0 when that is too little to see. */
export function letGo(pooled: number, share = SHARE): number {
  const out = unit(pooled) * unit(share);
  return out < FLOOR ? 0 : out;
}

/** The pool `seconds` after it was left holding `left`, filling back toward `full` (the gate unchanged). */
export function refill(left: number, full: number, seconds: number): number {
  if (!(seconds > 0)) return left;
  return full - (full - left) * Math.exp(-POOL_FILL * seconds);
}

/** What reaches a sign from above, given the meter and the gates (CHAKRA_IDS order). */
export function aboveOf(chakra: ChakraId, d: number, gates: readonly number[]): number {
  const i = CHAKRA_IDS.indexOf(chakra);
  return i <= 0 ? spring(d) : reach(d, gates)[i - 1];
}

/** A surge let go: on which sign, how much (0 to 1), and when. The sign's plate runs it while it is open. */
export type Surge = { chakra: ChakraId; amp: number; at: number };
export const surge = signal<Surge | null>(null);

/** The gates that ask (dashed until he sets them or leaves their page). */
export const asking = signal<ReadonlySet<ChakraId>>(new Set());
/** Whether this sign's gate asks. Reads the signal, so a page drawing it redraws when it changes. */
export const asks = (c: ChakraId): boolean => asking.value.has(c);
/** He set the gate, or left its page: it asks no more. */
export function settle(c: ChakraId): void {
  if (!asking.peek().has(c)) return;
  const next = new Set(asking.peek());
  next.delete(c);
  asking.value = next;
}

/** The signs that owe the mountain a surge, in the order they were let go. */
let owed: ChakraId[] = [];
/** Takes what the mountain owes: each sign once, then none. */
export function takeOwed(): ChakraId[] { const out = owed; owed = []; return out; }
export const owedNow = (): readonly ChakraId[] => owed;

const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Why a touch done sends nothing, or null when it may surge. */
export function quiet(): 'still' | 'locked' | 'calm' | null {
  if (light.peek() === 'still') return 'still';
  if (keyState() === 'locked') return 'locked';
  if (calm()) return 'calm';
  return null;
}

/** A touch done: reads the gate it sits behind and lets go a share of what it holds. Returns the surge, or null. The
 *  gate asks even under Reduce Motion, when nothing travels (the asking is not motion). */
export async function answer(d: TouchDone, readings = latestReadings): Promise<Surge | null> {
  const why = quiet();
  if (why === 'still' || why === 'locked') return null;
  const r = await readings().catch(() => null);
  if (!r) return null;
  const gates = CHAKRA_IDS.map(id => r.gates[id]?.value ?? 0);
  const g = gates[CHAKRA_IDS.indexOf(d.chakra)];
  const amp = letGo(pooledAt(g, aboveOf(d.chakra, r.mountain?.value ?? 0, gates)));
  if (!amp) return null;
  // asked while the gate is as he left it; a reading written since the touch is his answer already
  if (!asking.peek().has(d.chakra)) asking.value = new Set([...asking.peek(), d.chakra]);
  if (why === 'calm') return null;
  const s: Surge = { chakra: d.chakra, amp, at: d.at };
  surge.value = s;
  if (!owed.includes(d.chakra)) owed = [...owed, d.chakra];
  return s;
}

onTouchDone(d => { void answer(d); });

// locking forgets it all: the next unlock owes the mountain nothing and no gate asks
let last = lockGate.peek();
effect(() => {
  const g = lockGate.value;
  if (g === 'locked' && last !== 'locked') { owed = []; asking.value = new Set(); surge.value = null; }
  last = g;
});

/** For tests. */
export function forgetSurges(): void { owed = []; asking.value = new Set(); surge.value = null; }
