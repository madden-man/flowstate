// The mountain (PLAN-MOUNTAIN.md, R0): the seven signs down the Flow tab's one stream, the water's maths (section 4),
// and the readings he sets with the Depression meter and each sign's gate (section 8). Pure but for the four reads and
// writes at the bottom, which go through store like every model. No UI, no numbers shown from here: a reading is a state
// he sets, not a count (DESIGN.md rule 15).
//
// The water, crown to sea: the meter d gives the spring s = 1 - 0.8d; a gate b lets through p = 1 - 0.85b; below sign
// i runs q(i) = s * p(1) * ... * p(i). Neither floor reaches zero, so something always gets through.
import type { Episode, Flow, Millis, Reading } from '../db/schema';
import { SEED_CHAKRAS } from '../db/schema';
import { BLOCKER_DRAFTS, SEED_ALSO_UNDER } from '../db/seed/blockers';
import { BLOCKERS_PASS } from '../db/seed';
import { keyState, store, type Read } from '../db/fields';
import { flows, liveEpisode } from './flows';

export const CHAKRA_IDS = ['crown', 'third-eye', 'throat', 'heart', 'solar-plexus', 'sacral', 'root'] as const;
export type ChakraId = typeof CHAKRA_IDS[number];

/** The seven drawn signs (parts/Sign), in the same order: a crown, an eye, a speech bubble, a heart, a sun, a drop, a sprout. */
export type SignKind = 'crown' | 'eye' | 'voice' | 'heart' | 'sun' | 'drop' | 'sprout';

/** A stop on the stream. name is beside its sign on the mountain ("Heart"), pageName its page's header ("Heart chakra"),
 *  hue the voice formula's angle (DESIGN.md rule 3), gloss the mountain's print line for the sign ("Heart · love and
 *  grief"). line and versus are what the sign is for (PLAN-SIGN-LINES.md section 2, L1): line the italic starter under
 *  the pair on its page, in the wiser second person, a want and what is in its way, 70 characters at most (lint DL23),
 *  his to rewrite (model/acts.ts lineOf); versus the struggle it comes down to, what he wants and what works against
 *  it, fixed print (parts/Versus). On the sign's page the pair stands where the gloss was. */
export interface Chakra {
  id: ChakraId; name: string; pageName: string; sign: SignKind; hue: number; gloss: string;
  line: string; versus: readonly [string, string];
}

const stop = (id: ChakraId, name: string, sign: SignKind, hue: number, forWords: string, line: string, versus: readonly [string, string]): Chakra =>
  ({ id, name, pageName: `${name} chakra`, sign, hue, gloss: `${name} · ${forWords}`, line, versus });

/** Summit to foot (BUILD-MOUNTAIN.md section 3). Crown's gloss is "letting go" since PLAN-TASKS.md section 2 (sleep is
 *  one of Root's basics). The lines and pairs are PLAN-SIGN-LINES.md section 2's, verbatim; one stop a line, so the
 *  lint can read each line (DL23). */
export const CHAKRAS: readonly Chakra[] = [
  stop('crown', 'Crown', 'crown', 305, 'letting go', 'You want to rest in something larger. You keep a hand on everything.', ['Letting go', 'holding on']),
  stop('third-eye', 'Third eye', 'eye', 275, 'seeing clearly', 'You want to see what is true. The old story speaks first.', ['Seeing', 'the story']),
  stop('throat', 'Throat', 'voice', 250, 'speech', 'You want to be heard as you are. Saying it risks the answer.', ['Saying it', 'swallowing it']),
  stop('heart', 'Heart', 'heart', 150, 'love and grief', 'You want to love and be loved. What you love can be lost.', ['Opening', 'guarding']),
  stop('solar-plexus', 'Solar plexus', 'sun', 95, 'will and worth', 'You want to act and to matter. One failure reads like a verdict.', ['Will', 'shame']),
  stop('sacral', 'Sacral', 'drop', 55, 'feeling', 'You want to feel alive. Feeling lets the pain in too.', ['Feeling', 'numbing']),
  stop('root', 'Root', 'sprout', 25, 'feeling safe', 'You want to be safe. The alarm rings when nothing is wrong.', ['Safety', 'fear']),
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

// ---- the blockers (PLAN-BLOCKERS.md section 5, K0) ----

/** Lists the sign: its own (chakra) or a second listing (alsoUnder). */
const listsSign = (f: Pick<Flow, 'chakra' | 'alsoUnder'>, chakra: ChakraId) => f.chakra === chakra || !!f.alsoUnder?.includes(chakra);

/** A blocker row: the flow and its live episode, if one is open (its row comes first and says the step he is on). */
export type Blocker = { flow: Read<Flow>; live?: Read<Episode> };

/** What blocks this sign: the flows whose chakra or alsoUnder names it and whose offSigns does not, live ones first,
 *  then the flow list's order (flows: order, then createdAt, then id). Drafts are among them. Locked, the flows come
 *  as the list gives them (no words), so the rows can hold their room. */
export async function blockersOf(chakra: ChakraId): Promise<Blocker[]> {
  if (!isChakraId(chakra)) throw new Error(`Not a sign: ${String(chakra)}`);
  const under = (await flows()).filter(f => listsSign(f, chakra) && !f.offSigns?.includes(chakra));
  const rows = await Promise.all(under.map(async flow => ({ flow, live: await liveEpisode(flow.id) })));
  return [...rows.filter(r => r.live), ...rows.filter(r => !r.live)].map(r => (r.live ? r : { flow: r.flow }));
}

/** How many rows a sign's Blockers list has on a journal as seeded (its own seed flows, the second listings, the
 *  drafts): the room ui/flow/chakra/Blockers.tsx holds on its first paint before it has ever read the sign. */
export function seededBlockerCount(chakra: ChakraId): number {
  const own = Object.values(SEED_CHAKRAS).filter(c => c === chakra).length;
  const also = Object.values(SEED_ALSO_UNDER).filter(cs => cs.includes(chakra)).length;
  return own + also + BLOCKER_DRAFTS.filter(f => f.chakra === chakra).length;
}

/** Whether the one-time blockers pass (db/seed.ts seedBlockersOnce) has run on this journal: until it has, a sign's
 *  list is missing its second listings and drafts, so the page holds its room rather than draw a list about to grow. */
export async function blockersSeeded(): Promise<boolean> {
  return !!(await store.get('settings', 'app'))?.cleaned?.includes(BLOCKERS_PASS);
}

/** Every flow listed under this sign, struck ones too, in the flow list's order, each with whether it is struck: the
 *  long press's sheet (PLAN-BLOCKERS.md section 2, decision 13). A second listing is one whose chakra is another sign
 *  ("also Crown"); a candidate carries draft. */
export async function blockerSheetOf(chakra: ChakraId): Promise<{ flow: Read<Flow>; struck: boolean }[]> {
  if (!isChakraId(chakra)) throw new Error(`Not a sign: ${String(chakra)}`);
  return (await flows()).filter(f => listsSign(f, chakra)).map(flow => ({ flow, struck: !!flow.offSigns?.includes(chakra) }));
}

/** Changes one flow's clear sign fields as one unit; a flow not there, or a change that leaves it as it was, writes
 *  nothing. Refuses while locked (LockedError). */
async function changeSigns(flowId: string, change: (f: Read<Flow>) => Partial<Pick<Flow, 'alsoUnder' | 'offSigns'>> | null, now: Millis): Promise<Read<Flow> | undefined> {
  return store.unit(async u => {
    const f = await u.get('flows', flowId);
    if (!f) return undefined;
    const patch = change(f);
    if (!patch) return f;
    const next: Read<Flow> = { ...f, ...patch, updatedAt: now };
    for (const k of ['alsoUnder', 'offSigns'] as const) if (!next[k]?.length) delete next[k];
    await u.put('flows', next);
    return next;
  });
}

/** Strikes a flow off a sign it is listed under (on), or puts it back (off): offSigns, rule 10's struck, never deleted.
 *  The flow is kept whole and is still reached by hand-offs and the door. A sign it is not listed under writes nothing.
 *  Returns the flow. */
export async function strikeOff(flowId: string, chakra: ChakraId, on: boolean, now: Millis = Date.now()): Promise<Read<Flow> | undefined> {
  if (!isChakraId(chakra)) throw new Error(`Not a sign: ${String(chakra)}`);
  return changeSigns(flowId, f => {
    const off = new Set(f.offSigns ?? []);
    if (!listsSign(f, chakra) || off.has(chakra) === on) return null;
    if (on) off.add(chakra); else off.delete(chakra);
    return { offSigns: CHAKRA_IDS.filter(c => off.has(c)) };
  }, now);
}

/** Lists a flow under a sign ("+ blocker" choosing a flow that is there): a second listing (alsoUnder) unless it is the
 *  flow's own sign, and not struck there. Returns the flow. */
export async function listUnder(flowId: string, chakra: ChakraId, now: Millis = Date.now()): Promise<Read<Flow> | undefined> {
  if (!isChakraId(chakra)) throw new Error(`Not a sign: ${String(chakra)}`);
  return changeSigns(flowId, f => {
    const struck = !!f.offSigns?.includes(chakra);
    if (listsSign(f, chakra) && !struck) return null;
    const also = f.chakra === chakra || f.alsoUnder?.includes(chakra) ? f.alsoUnder : [...(f.alsoUnder ?? []), chakra];
    return { alsoUnder: also, offSigns: f.offSigns?.filter(c => c !== chakra) };
  }, now);
}
