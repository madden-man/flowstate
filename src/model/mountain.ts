// The mountain (PLAN-MOUNTAIN.md, R0): the seven signs down the Flow tab's one stream, the water's maths (section 4),
// and the readings he sets with the Depression meter and each sign's gate (section 8). Pure but for the four reads and
// writes at the bottom, which go through store like every model. No UI, no numbers shown from here: a reading is a state
// he sets, not a count (DESIGN.md rule 15).
//
// The water, crown to sea: the meter d gives the spring s = 1 - 0.8d; a gate b lets through p = 1 - 0.85b; below sign
// i runs q(i) = s * p(1) * ... * p(i). Neither floor reaches zero, so something always gets through.
import type { Flow, Millis, Reading } from '../db/schema';
import { keyState, store, type Read } from '../db/fields';
import { flows } from './flows';

export const CHAKRA_IDS = ['crown', 'third-eye', 'throat', 'heart', 'solar-plexus', 'sacral', 'root'] as const;
export type ChakraId = typeof CHAKRA_IDS[number];

/** The seven drawn signs (parts/Sign), in the same order: a crown, an eye, a speech bubble, a heart, a sun, a drop, a sprout. */
export type SignKind = 'crown' | 'eye' | 'voice' | 'heart' | 'sun' | 'drop' | 'sprout';

/** A stop on the stream. name is beside its sign on the mountain ("Heart"), pageName its page's header ("Heart chakra"),
 *  hue the voice formula's angle (DESIGN.md rule 3), gloss the print line under the large sign ("Heart · love and grief"). */
export interface Chakra { id: ChakraId; name: string; pageName: string; sign: SignKind; hue: number; gloss: string }

const stop = (id: ChakraId, name: string, sign: SignKind, hue: number, forWords: string): Chakra =>
  ({ id, name, pageName: `${name} chakra`, sign, hue, gloss: `${name} · ${forWords}` });

/** Summit to foot (BUILD-MOUNTAIN.md section 3). Crown's gloss is "letting go" since PLAN-TASKS.md section 2 (sleep is one of Root's basics). */
export const CHAKRAS: readonly Chakra[] = [
  stop('crown', 'Crown', 'crown', 305, 'letting go'),
  stop('third-eye', 'Third eye', 'eye', 275, 'seeing clearly'),
  stop('throat', 'Throat', 'voice', 250, 'speech'),
  stop('heart', 'Heart', 'heart', 150, 'love and grief'),
  stop('solar-plexus', 'Solar plexus', 'sun', 95, 'will and worth'),
  stop('sacral', 'Sacral', 'drop', 55, 'feeling'),
  stop('root', 'Root', 'sprout', 25, 'feeling safe'),
];

export const isChakraId = (id: unknown): id is ChakraId => (CHAKRA_IDS as readonly unknown[]).includes(id);

/** The stop with this id. */
export function chakraOf(id: ChakraId): Chakra {
  const c = CHAKRAS.find(x => x.id === id);
  if (!c) throw new Error(`No chakra ${String(id)}`);
  return c;
}

// ---- the water (PLAN-MOUNTAIN.md section 4) ----

const unit = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);

/** What the spring under the snow lets go, for the meter d: 1 on a clear day, 0.2 on the heaviest. */
export const spring = (d: number): number => 1 - 0.8 * unit(d);

/** What a gate b lets through: 1 open, 0.15 shut. */
export const pass = (b: number): number => 1 - 0.85 * unit(b);

/** The water below each sign, crown to root: seven values, each the spring times every gate down to and through that
 *  sign. gates are in CHAKRA_IDS order; a missing one is open. A sign closed high up starves every one below it. */
export function reach(d: number, gates: readonly number[]): number[] {
  let q = spring(d);
  return CHAKRA_IDS.map((_, i) => (q *= pass(gates[i] ?? 0)));
}

/** In a stretch carrying q: the share of motes showing, their pace (a dash fast, a dot slow), and the channel's width in
 *  px, so the picture still says it with Reduce Motion on. */
export function stretch(q: number): { share: number; pace: number; width: number } {
  const v = unit(q);
  return { share: 0.15 + 0.85 * v, pace: 0.3 + 1.2 * v, width: 1 + 2.5 * v };
}

/** How far above a sign the water pools, in the course's units (the mock's 328 by 476 box). */
export const POOL_UNITS = 26;

/** The pace factor a mote takes this many units above a sign whose gate is b: 1 out of reach of the pool, falling to
 *  1 - 0.75b right at the sign. Multiplies stretch's pace. */
export function pool(b: number, unitsAbove: number): number {
  const u = Number.isFinite(unitsAbove) ? Math.max(0, unitsAbove) : POOL_UNITS;
  const near = 1 - Math.min(1, u / POOL_UNITS);
  return 1 - 0.75 * unit(b) * near;
}

/** What reaches the sea: the water below the root. */
export const sea = (d: number, gates: readonly number[]): number => reach(d, gates)[CHAKRA_IDS.length - 1];

// ---- the readings (PLAN-MOUNTAIN.md section 8) ----

const DAY = 24 * 60 * 60_000;

/** Writes one reading, on release; never edited. value is clamped to 0..1 and sealed with the key; a locked journal
 *  throws LockedError, like every write. */
export async function writeReading(of: 'mountain' | ChakraId, value: number, at: Millis = Date.now()): Promise<void> {
  if (of !== 'mountain' && !isChakraId(of)) throw new Error(`Not a reading: ${String(of)}`);
  await store.put('readings', { id: crypto.randomUUID(), at, of, value: unit(value) });
}

/** The newest reading of the mountain and of each sign's gate; a gate never set is absent. A reading's value is sealed
 *  (fields.ts), so a locked journal has none to give: empty, as before the first reading (the mountain is behind the PIN). */
export async function latestReadings(): Promise<{ mountain?: Reading; gates: Partial<Record<ChakraId, Reading>> }> {
  if (keyState() === 'locked') return { gates: {} };
  const newest = async (of: Reading['of']) => {
    const [r] = await store.query('readings', t => t.where('[of+at]').between([of, -Infinity], [of, Infinity]).reverse().limit(1));
    return r;
  };
  const [mountain, ...gates] = await Promise.all([newest('mountain'), ...CHAKRA_IDS.map(newest)]);
  const out: { mountain?: Reading; gates: Partial<Record<ChakraId, Reading>> } = { gates: {} };
  const kept = (r: Read<Reading> | undefined) => r && !r.locked && Number.isFinite(r.value);
  if (kept(mountain)) out.mountain = mountain;
  CHAKRA_IDS.forEach((id, i) => { if (kept(gates[i])) out.gates[id] = gates[i]; });
  return out;
}

/** A reading older than a day is drawn dashed until touched (section 5, question 5). */
export const isStale = (reading: Pick<Reading, 'at'>, now: Millis = Date.now()): boolean => now - reading.at > DAY;

/** The flows whose drawings sit under this sign, in the flow list's order (model/flows.ts flows: order, then
 *  createdAt, then id). */
export async function flowsUnder(chakra: ChakraId): Promise<Read<Flow>[]> {
  return (await flows()).filter(f => f.chakra === chakra);
}
