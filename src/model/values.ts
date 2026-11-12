// Be's values, their shadows and their champions (PLAN-VALUES.md section 5, C1). A value is a word he is building, its
// shadow a value too (the quieter one behind it), and any voice may fight for either side, many to many; the links
// live on the value row. A line is confirmed as spoken for a value after it is spoken (speakFor), never before.
// Every read and write goes through store: words and whys are sealed, so a change to them is a read then a sealed
// rewrite in store.unit; ids, order and labels are clear, so those changes run in store.tx. Nothing here writes a word.
import { byValuePlace, placeOf, PLACES, tierOf, type Message, type Millis, type PageKind, type Tier, type Value, type ValuePlace, type ValueSide, type Voice } from '../db/schema';
import { store, tombstone, type Read } from '../db/fields';
import { allVoices, chipVoices, championsOf, newCouncil } from './council';
import { MANIFESTO } from '../db/seed';

export { championsOf };
/** The notebook's line over Be's list, "I determine my core." (C2), so the UI reads it here, not from db/seed. */
export const CORE = MANIFESTO[0];
export type { ValueSide, Tier, ValuePlace };
export { tierOf, placeOf };

const tidy = (s?: string) => (s ?? '').trim();
const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const strip = <T>(row: T): T => { const copy = { ...(row as Record<string, unknown>) }; delete copy.locked; return copy as T; };

// ---- the lists ----

const by = (status: Value['status']) => async (): Promise<Read<Value>[]> =>
  (await store.all('values')).filter(v => v.status === status).sort(byValuePlace);

/** The values he holds, First, then Second, then Third, each in his order (PLAN-TIERS.md section 4): so Champions,
 *  "Who sits?" and the Spoke for chips follow the tiers without knowing about them. */
export const held = by('held');

/** The values put down for now, in his order: under Resting. */
export const resting = by('resting');

/** The values he used to hold, in his order: under Legacy (PLAN-TIERS.md section 2). */
export const legacy = by('legacy');

export type Tiers = { first: Read<Value>[]; second: Read<Value>[]; third: Read<Value>[]; resting: Read<Value>[]; legacy: Read<Value>[] };

/** Be's list in one read: each tier, Resting and Legacy, each in his order. */
export async function tiers(): Promise<Tiers> {
  const all = (await store.all('values')).sort(byValuePlace);
  const at = (p: ValuePlace) => all.filter(v => placeOf(v) === p);
  return { first: at(1), second: at(2), third: at(3), resting: at('resting'), legacy: at('legacy') };
}

// ---- writing a value ----

export type ValueDraft = { word: string; shadow?: string; looks?: string };
export type ValueStatus = Value['status'];

export class NoWordError extends Error {
  constructor() { super('A value needs its word'); this.name = 'NoWordError'; }
}

/** A new value, held at the foot of Second (PLAN-TIERS.md section 2): after the placed ones, as it has no order until
 *  placed. Its shadow and looks may wait. */
export async function createValue(d: ValueDraft, now = Date.now()): Promise<Value> {
  const word = tidy(d.word);
  if (!word) throw new NoWordError();
  const v: Value = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, status: 'held', tier: 2, word, champions: [], revisions: [] };
  const shadow = tidy(d.shadow), looks = tidy(d.looks);
  if (shadow) v.shadow = shadow;
  if (looks) v.looks = looks;
  await store.put('values', v);
  return v;
}

/**
 * Saves the value sheet: the word, the shadow and what living it looks like (where it sits is placeValue's). A change
 * to the word or the shadow on a later day than the value was made keeps the old pair as a revision (shown struck,
 * rule 10), once per day of editing, as a line's text is kept (model/pages.ts revise); looks is written over. The champions and their whys
 * are the stored row's, read in the same unit, so a why set since the sheet opened is kept.
 */
export function saveValue(value: Pick<Value, 'id'>, d: ValueDraft, now = Date.now()): Promise<Value> {
  const word = tidy(d.word);
  if (!word) return Promise.reject(new NoWordError());
  return store.unit(async u => {
    const v = await u.get('values', value.id);
    if (!v) throw new Error('No such value');
    const shadow = tidy(d.shadow) || undefined, looks = tidy(d.looks) || undefined;
    const words = word !== v.word || (shadow ?? '') !== (v.shadow ?? '');
    const same = !words && (looks ?? '') === (v.looks ?? '');
    if (same) return strip(v);
    let revisions = v.revisions;
    if (words && dayKey(v.createdAt) !== dayKey(now) && !revisions.some(r => dayKey(r.at) === dayKey(now))) {
      revisions = [...revisions, { at: now, word: v.word, ...(v.shadow ? { shadow: v.shadow } : {}) }];
    }
    const next: Value = strip({ ...v, word, revisions, updatedAt: now });
    if (shadow) next.shadow = shadow; else delete next.shadow;
    if (looks) next.looks = looks; else delete next.looks;
    await u.put('values', next);
    return next;
  });
}

// ---- placing a value (PLAN-TIERS.md section 4) ----

/** The tier a value not held comes back to by the tap path: the one it left (Second for one from before the tiers). */
export const returnsTo = (v: Pick<Value, 'tier'>): Tier => tierOf(v);

type Log = NonNullable<Value['tierLog']>;

/** The log with one more move, one entry a day: a move on the same day as the last entry takes its place, and a move
 *  that ends the day where the day before ended leaves no entry for the day. An empty log first gets where the value
 *  was at its making, so the dated lines need nothing else (that entry folds away when it was made today). */
export function logged(log: Log | undefined, from: ValuePlace, createdAt: Millis, to: ValuePlace, now: Millis): Log {
  let out: Log = log?.length ? [...log] : [{ at: createdAt, to: from }];
  if (dayKey(out[out.length - 1].at) === dayKey(now)) out = out.slice(0, -1);
  if (out.length && out[out.length - 1].to === to) return out;
  return [...out, { at: now, to }];
}

/**
 * Puts a value in a place: a tier, Resting or Legacy, at index within that place's rows as they stand without it
 * (omitted, or past the end, is the foot). One transaction over clear fields only, so a sealed row is never rewritten:
 * status and tier, a line on tierLog when its place changed, and order renumbered as one sequence across every value,
 * written only on the rows whose number moved. A value going to Resting or Legacy keeps its tier, so the tap path
 * brings it back to the tier it left (returnsTo). No tier has a cap, and nothing else steps down.
 */
export function placeValue(id: string, to: ValuePlace, index?: number, now = Date.now()): Promise<void> {
  return store.tx(['values'], async tb => {
    const all = (await tb('values').toArray()).sort(byValuePlace);
    const v = all.find(x => x.id === id);
    if (!v) throw new Error('No such value');
    const from = placeOf(v);
    const others = all.filter(x => x.id !== id);
    const order: Value[] = [];
    for (const p of PLACES) {
      const rows = others.filter(x => placeOf(x) === p);
      if (p === to) rows.splice(Math.max(0, Math.min(rows.length, index ?? rows.length)), 0, v);
      order.push(...rows);
    }
    for (let i = 0; i < order.length; i++) {
      const x = order[i];
      if (x.id === id) {
        const change: Partial<Value> = { order: i, updatedAt: now };
        if (typeof to === 'number') { change.status = 'held'; change.tier = to; } else change.status = to;
        if (from !== to) change.tierLog = logged(v.tierLog, from, v.createdAt, to, now);
        if (from !== to || x.order !== i) await tb('values').update(id, change);
      } else if (x.order !== i) await tb('values').update(x.id, { order: i, updatedAt: now });
    }
  });
}

// ---- the dated lines (PLAN-TIERS.md section 4): dates only, never a length or a count ----

/** The first of the run of entries at the log's end that all say `p`, or undefined when the last entry is elsewhere. */
const enteredAt = (log: Log | undefined, p: ValuePlace): Millis | undefined => {
  let at: Millis | undefined;
  for (let i = (log?.length ?? 0) - 1; i >= 0 && log![i].to === p; i--) at = log![i].at;
  return at;
};

/** When a held value came into the tier it is in ("First since 11 / 12 / 26"): its making, when the log has nothing. */
export const tierSince = (v: Pick<Value, 'status' | 'tier' | 'tierLog' | 'createdAt'>): Millis => enteredAt(v.tierLog, placeOf(v)) ?? v.createdAt;

/** A Legacy value's dates ("11 / 7 / 26 to 11 / 12 / 26"): from its first day held (its making, when the log never
 *  shows it held) to the day it went to Legacy; time resting is not marked. With no log there is no end. */
export function legacyDates(v: Pick<Value, 'tierLog' | 'createdAt'>): { from: Millis; to?: Millis } {
  const from = v.tierLog?.find(e => typeof e.to === 'number')?.at ?? v.createdAt;
  const to = enteredAt(v.tierLog, 'legacy');
  return to === undefined ? { from } : { from, to };
}

/**
 * Deletes a value (two taps in the UI), in one transaction: the row goes and onto the deleted list (so a merge import
 * of an older file never brings it back), every line spoken for it loses its label and keeps its words, and a council
 * called on it forgets it.
 */
export function deleteValue(id: string, now = Date.now()): Promise<void> {
  return store.tx(['values', 'messages', 'pages', 'settings'], async tb => {
    await tb('values').delete(id);
    await tb('messages').filter(m => m.for?.valueId === id).modify(m => { delete m.for; m.updatedAt = now; });
    await tb('pages').filter(p => !!p.valueIds?.includes(id)).modify(p => {
      p.valueIds = p.valueIds!.filter(x => x !== id);
      if (!p.valueIds.length) delete p.valueIds;
      p.updatedAt = now;
    });
    await tombstone(tb, [id]);
  });
}

// ---- champions ----

const isOn = (voiceId: string, side: ValueSide) => (c: { voiceId: string; side: ValueSide }) => c.voiceId === voiceId && c.side === side;

/** A voice takes up a side of a value. Twice changes nothing; a voice may be on both sides of one value. */
export function champion(valueId: string, voiceId: string, side: ValueSide, now = Date.now()): Promise<Value> {
  return store.unit(async u => {
    const v = await u.get('values', valueId);
    if (!v) throw new Error('No such value');
    if (v.champions.some(isOn(voiceId, side))) return strip(v);
    if (!(await u.get('voices', voiceId))) throw new Error('No such voice');
    const next: Value = strip({ ...v, champions: [...v.champions, { voiceId, side, at: now }], updatedAt: now });
    await u.put('values', next);
    return next;
  });
}

/** A voice leaves a side of a value; its why goes with it. Its lines spoken for the value keep their labels. */
export function unchampion(valueId: string, voiceId: string, side: ValueSide, now = Date.now()): Promise<Value> {
  return store.unit(async u => {
    const v = await u.get('values', valueId);
    if (!v) throw new Error('No such value');
    if (!v.champions.some(isOn(voiceId, side))) return strip(v);
    const next: Value = strip({ ...v, champions: v.champions.filter(c => !isOn(voiceId, side)(c)), updatedAt: now });
    await u.put('values', next);
    return next;
  });
}

/** His one sentence for what fighting for this side means to this voice; an empty one clears it. */
export function setWhy(valueId: string, voiceId: string, side: ValueSide, why: string, now = Date.now()): Promise<Value> {
  return store.unit(async u => {
    const v = await u.get('values', valueId);
    if (!v) throw new Error('No such value');
    const c = v.champions.find(isOn(voiceId, side));
    if (!c) throw new Error('Not a champion of this value');
    const text = tidy(why);
    if ((c.why ?? '') === text) return strip(v);
    const champions = v.champions.map(x => {
      if (x !== c) return x;
      const { why: _, ...rest } = x;
      return text ? { ...rest, why: text } : rest;
    });
    const next: Value = strip({ ...v, champions, updatedAt: now });
    await u.put('values', next);
    return next;
  });
}

export type Fight = { value: Read<Value>; side: ValueSide };

const fightsIn = (values: Read<Value>[], voiceId: string): Fight[] =>
  values.flatMap(value => (['value', 'shadow'] as const).filter(side => value.champions.some(isOn(voiceId, side))).map(side => ({ value, side })));

/** What a voice fights for: each held value, and each held value's shadow, it champions, in list order (a value
 *  before its shadow). An archived voice is not drawn, so it fights for nothing shown; its links are kept. */
export async function fightsFor(voiceId: string): Promise<Fight[]> {
  const voice = await store.get('voices', voiceId);
  if (!voice || voice.archived) return [];
  return fightsIn(await held(), voiceId);
}

/** The Champions segment: every voice in the chip row (archived ones out, and in Still the deep twins), in chip order,
 *  each with what it fights for. A voice that fights for nothing is still listed. */
export async function byVoice(still = false): Promise<{ voice: Read<Voice>; fights: Fight[] }[]> {
  const [vs, values] = await Promise.all([allVoices(), held()]);
  return chipVoices(vs, still).map(voice => ({ voice, fights: fightsIn(values, voice.id) }));
}

// ---- speaking for ----

export type SpokeFor = NonNullable<Message['for']>;
export type Said = { message: Read<Message>; pageId: string; kind: PageKind; side: ValueSide };

/** "Said for it": the lines confirmed for this value or its shadow, newest first, each with its page, up to limit. */
export async function saidFor(valueId: string, limit = Infinity): Promise<Said[]> {
  const ms = (await store.query('messages', t => t.filter(m => m.for?.valueId === valueId))).sort((a, b) => b.at - a.at).slice(0, limit);
  const pages = new Map((await Promise.all([...new Set(ms.map(m => m.pageId))].map(id => store.get('pages', id)))).filter(p => !!p).map(p => [p!.id, p!]));
  return ms.flatMap(message => {
    const page = pages.get(message.pageId);
    return page ? [{ message, pageId: page.id, kind: page.kind, side: message.for!.side }] : [];
  });
}

/** Confirms a line as spoken for a value or its shadow, after it was spoken; undefined takes the label away. The label
 *  is clear, so the line's sealed words are not rewritten. */
export function speakFor(messageId: string, f: SpokeFor | undefined, now = Date.now()): Promise<void> {
  return store.tx(['messages', 'values'], async tb => {
    const m = await tb('messages').get(messageId);
    if (!m) throw new Error('No such message');
    if (f && !(await tb('values').get(f.valueId))) throw new Error('No such value');
    await tb('messages').where('id').equals(messageId).modify(x => {
      if (f) x.for = { valueId: f.valueId, side: f.side }; else delete x.for;
      x.updatedAt = now;
    });
  });
}

/** "Call a council" on a value: a new council about it, its champions seated (model/council.ts newCouncil). */
export const callCouncil = (valueId: string, now = Date.now()) => newCouncil({ valueId, now });
