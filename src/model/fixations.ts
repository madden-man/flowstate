// The fixations (PLAN-ENERGIZE.md sections 2 and 5, X1): the three on Energize, the deck behind them, the swap, Finished
// instead, Deal me one, the span words on a card and the ribbons for What stuck. Every read and write goes through
// store, so a name and a next line are sealed. No UI. A span is a duration, never a run of days (DESIGN.md rule 15): nothing
// here counts days done, has a day to miss or adds anything up for show; the total held only orders the ribbons.
import type { Fixation, Millis, Stint } from '../db/schema';
import { store, type Read } from '../db/fields';
import { startOfDay } from './flow';
import { spanWords } from './flows';

/** The flow the three sit under, keyed by id in code as model/pace.ts keys paces (section 5). */
export const FIXATION_FLOW = 'energize';
/** Three slots, always (section 2): 0, 1 and 2, the cards in their order. */
export const SLOTS = 3;

const DAY = 86_400_000;
const MIN = 60_000;

/** The three slots in order; an empty slot is undefined (a dashed slot, DESIGN.md rule 11). */
export type Three = [Read<Fixation> | undefined, Read<Fixation> | undefined, Read<Fixation> | undefined];

// ---------------------------------------------------------------- reading one

/** The stint it is on now, the last one with no to; undefined when it is not on. */
export const openStint = (f: Pick<Fixation, 'stints'>): Stint | undefined => {
  const last = f.stints.at(-1);
  return last && last.to === undefined ? last : undefined;
};
export const isOn = (f: Pick<Fixation, 'stints'>) => !!openStint(f);
/** On deck: neither on nor finished. */
export const onDeck = (f: Pick<Fixation, 'stints' | 'finishedAt'>) => !isOn(f) && f.finishedAt === undefined;
/** When it last came off ("last on 10 / 22"); undefined for one never on ("never on") or on now. */
export const lastOn = (f: Pick<Fixation, 'stints'>): Millis | undefined => (isOn(f) ? undefined : f.stints.at(-1)?.to);
/** Since when it has waited on deck: the day it last came off, or the day it was made for one never on. */
export const waitingSince = (f: Pick<Fixation, 'stints' | 'createdAt'>): Millis => f.stints.at(-1)?.to ?? f.createdAt;

/**
 * A stint's span in words, by the phone's own calendar (a day starts at local midnight, so a month end or a clock
 * change is counted in days as the calendar has them): "today" for one on since today, then "1 day", "13 days",
 * "2 weeks", "12 weeks", "about 7 months", "about 2 years". A closed stint that began and ended on one day reads in
 * minutes or hours (model/flows.ts spanWords), never under a minute. to is now for one still on.
 */
export function stintWords(from: Millis, to: Millis, open = true): string {
  const days = Math.round((startOfDay(to) - startOfDay(from)) / DAY);
  if (days <= 0) return open ? 'today' : spanWords(Math.max(1, Math.round((to - from) / MIN)));
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`;
  if (days < 182) return `${Math.round(days / 7)} weeks`;
  if (days < 730) return `about ${Math.round(days / 30.44)} months`;
  return `about ${Math.round(days / 365.25)} years`;
}

/** The span of a stint as the card or a ribbon says it: up to now for the one on, up to its to for one closed. */
export const spanOfStint = (s: Stint, now = Date.now()) => stintWords(s.from, s.to ?? now, s.to === undefined);

// ---------------------------------------------------------------- reading all

/** Every fixation, finished ones included, oldest first. */
export async function fixations(): Promise<Read<Fixation>[]> {
  return (await store.all('fixations')).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

export const fixationById = (id: string) => store.get('fixations', id);

/** The three slots in slot order. Two on in one slot (an old merge) shows the one on longest; the other waits. */
export async function three(): Promise<Three> {
  const out: Three = [undefined, undefined, undefined];
  const on = (await fixations()).filter(isOn).sort((a, b) => openStint(a)!.from - openStint(b)!.from);
  for (const f of on) {
    const slot = openStint(f)!.slot;
    if (slot >= 0 && slot < SLOTS && !out[slot]) out[slot] = f;
  }
  return out;
}

/**
 * The deck: neither on nor finished, longest waiting first. Waiting counts from the day it last came off, or the day
 * it was made for one never on, one clock for both (waitingSince); a tie goes to the older, then by id.
 */
export async function deck(): Promise<Read<Fixation>[]> {
  return (await fixations()).filter(onDeck)
    .sort((a, b) => waitingSince(a) - waitingSince(b) || a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

/** One ribbon on What stuck: a fixation and every time it was on, oldest first. */
export type Ribbon = { fixation: Read<Fixation>; stints: Stint[] };

/**
 * What stuck (X4): every fixation that has been on at least once, finished ones included, with its stints; longest held
 * first (the time held, summed up to now, only orders them and is never returned), a tie to the one first on. One never
 * on has nothing to draw and is left out.
 */
export async function ribbons(now = Date.now()): Promise<Ribbon[]> {
  const held = (f: Fixation) => f.stints.reduce((t, s) => t + Math.max(0, (s.to ?? now) - s.from), 0);
  return (await fixations()).filter(f => f.stints.length)
    .map(f => ({ f, held: held(f) }))
    .sort((a, b) => b.held - a.held || a.f.stints[0].from - b.f.stints[0].from || a.f.id.localeCompare(b.f.id))
    .map(({ f }) => ({ fixation: f, stints: [...f.stints].sort((a, b) => a.from - b.from) }));
}

// ---------------------------------------------------------------- writing

const closed = (f: Fixation, at: Millis): Fixation =>
  isOn(f) ? { ...f, stints: f.stints.map((s, i) => (i === f.stints.length - 1 ? { ...s, to: Math.max(s.from, at) } : s)), updatedAt: at } : f;
const opened = (f: Fixation, slot: number, at: Millis): Fixation => ({ ...f, stints: [...f.stints, { from: at, slot }], updatedAt: at });
const moved = (f: Fixation, slot: number, at: Millis): Fixation =>
  ({ ...f, stints: f.stints.map((s, i) => (i === f.stints.length - 1 ? { ...s, slot } : s)), updatedAt: at });
const usable = (f: Read<Fixation> | undefined): f is Read<Fixation> => !!f && !f.locked;

/**
 * Puts id in slot, in one transaction. The one there comes off (its stint closed) and goes back on deck. If id is on in
 * another slot the two trade places, each keeping its stint and its since date (a trade is not a new start); into an
 * empty slot it simply moves. id already in slot, finished, unknown, or a row read locked: nothing is written and
 * undefined comes back. Returns the rows written.
 */
export async function swap(slot: number, id: string, at = Date.now()): Promise<Fixation[] | undefined> {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SLOTS) return undefined;
  const incoming = await fixationById(id);
  if (!usable(incoming) || incoming.finishedAt !== undefined) return undefined;
  const there = (await three())[slot];
  if (there?.locked) return undefined;
  if (there?.id === id) return undefined;
  const from = openStint(incoming);
  const write: Fixation[] = [];
  if (from) {
    write.push(moved(incoming, slot, at));
    if (there) write.push(moved(there, from.slot, at));
  } else {
    write.push(opened(incoming, slot, at));
    if (there) write.push(closed(there, at));
  }
  await store.many({ fixations: write });
  return write;
}

/** Finished instead (section 2): retired, its stint closed, its slot left empty. Never deleted. Undefined when it is
 *  already finished, unknown or read locked. */
export async function finish(id: string, at = Date.now()): Promise<Fixation | undefined> {
  const f = await fixationById(id);
  if (!usable(f) || f.finishedAt !== undefined) return undefined;
  const row = { ...closed(f, at), finishedAt: at, updatedAt: at };
  await store.put('fixations', row);
  return row;
}

/** "+ fixation": a new one on deck, never on. The name is his, trimmed; an empty name writes nothing. */
export async function add(name: string, hue: number, at = Date.now()): Promise<Fixation | undefined> {
  const n = name.trim();
  if (!n) return undefined;
  const row: Fixation = { id: crypto.randomUUID(), name: n, hue: normalHue(hue), createdAt: at, stints: [], updatedAt: at };
  await store.put('fixations', row);
  return row;
}

/** A hue angle in 0 to 360, as the wheel gives it. */
const normalHue = (h: number) => ((Math.round(h) % 360) + 360) % 360;

/** One field of one row, written back whole; nothing when it is unknown or read locked. */
async function edit(id: string, change: (f: Fixation) => Fixation | undefined): Promise<Fixation | undefined> {
  const f = await fixationById(id);
  if (!usable(f)) return undefined;
  const row = change(f);
  if (!row) return undefined;
  await store.put('fixations', row);
  return row;
}

/** Edit (X3): a new name; an empty one writes nothing. */
export const rename = (id: string, name: string, at = Date.now()) =>
  edit(id, f => (name.trim() ? { ...f, name: name.trim(), updatedAt: at } : undefined));

/** Edit (X3): a new hue on the wheel. */
export const recolour = (id: string, hue: number, at = Date.now()) => edit(id, f => ({ ...f, hue: normalHue(hue), updatedAt: at }));

/**
 * Edit (X3), the since date: moves the start of the stint it is on now. Never after now and never before the stint
 * before it ended; nothing when it is not on.
 */
export const setSince = (id: string, from: Millis, at = Date.now()) => edit(id, f => {
  if (!isOn(f)) return undefined;
  const before = f.stints.at(-2)?.to ?? -Infinity;
  const since = Math.min(at, Math.max(before, from));
  return { ...f, stints: f.stints.map((s, i) => (i === f.stints.length - 1 ? { ...s, from: since } : s)), updatedAt: at };
});

/** The Next line, his own, never generated (section 2); an empty line takes it away. */
export const setNext = (id: string, next: string | undefined, at = Date.now()) => edit(id, f => {
  const { next: _was, ...rest } = f;
  const line = next?.trim();
  return line ? { ...rest, next: line, updatedAt: at } : { ...rest, updatedAt: at };
});

/**
 * Deal me one (section 2): one from the deck at random, never one in exclude (the one just taken off, the last one
 * dealt). random is Math.random's shape, for tests. Undefined when nothing is left to deal. Writes nothing: a deal is
 * a suggestion, and the tap on it is the swap.
 */
export async function deal(exclude: string[] = [], random: () => number = Math.random): Promise<Read<Fixation> | undefined> {
  const out = new Set(exclude);
  const pool = (await deck()).filter(f => !out.has(f.id));
  if (!pool.length) return undefined;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}
