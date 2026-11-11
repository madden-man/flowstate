// Be's values, their shadows and their champions (PLAN-VALUES.md section 5, C1). A value is a word he is building, its
// shadow a value too (the quieter one behind it), and any voice may fight for either side, many to many; the links
// live on the value row. A line is confirmed as spoken for a value after it is spoken (speakFor), never before.
// Every read and write goes through store: words and whys are sealed, so a change to them is a read then a sealed
// rewrite in store.unit; ids, order and labels are clear, so those changes run in store.tx. Nothing here writes a word.
import { byValueOrder, type Message, type PageKind, type Value, type ValueSide, type Voice } from '../db/schema';
import { store, tombstone, type Read } from '../db/fields';
import { allVoices, chipVoices, championsOf, newCouncil } from './council';
import { MANIFESTO } from '../db/seed';

export { championsOf };
/** The notebook's line over Be's list, "I determine my core." (C2), so the UI reads it here, not from db/seed. */
export const CORE = MANIFESTO[0];
export type { ValueSide };

const tidy = (s?: string) => (s ?? '').trim();
const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const strip = <T>(row: T): T => { const copy = { ...(row as Record<string, unknown>) }; delete copy.locked; return copy as T; };

// ---- the lists ----

/** The values he holds, in his order: Be's list. */
export async function held(): Promise<Read<Value>[]> {
  return (await store.all('values')).filter(v => v.status === 'held').sort(byValueOrder);
}

/** The values put down for now, in the same order: under Resting. */
export async function resting(): Promise<Read<Value>[]> {
  return (await store.all('values')).filter(v => v.status === 'resting').sort(byValueOrder);
}

// ---- writing a value ----

export type ValueDraft = { word: string; shadow?: string; looks?: string };
export type ValueStatus = Value['status'];

export class NoWordError extends Error {
  constructor() { super('A value needs its word'); this.name = 'NoWordError'; }
}

/** A new value, held, after the placed ones (it has no order until dragged). Its shadow and looks may wait. */
export async function createValue(d: ValueDraft, now = Date.now()): Promise<Value> {
  const word = tidy(d.word);
  if (!word) throw new NoWordError();
  const v: Value = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, status: 'held', word, champions: [], revisions: [] };
  const shadow = tidy(d.shadow), looks = tidy(d.looks);
  if (shadow) v.shadow = shadow;
  if (looks) v.looks = looks;
  await store.put('values', v);
  return v;
}

/**
 * Saves the value sheet: the word, the shadow, what living it looks like, and the status. A change to the word or the
 * shadow on a later day than the value was made keeps the old pair as a revision (shown struck, rule 10), once per day
 * of editing, as a line's text is kept (model/pages.ts revise); looks is written over. The champions and their whys
 * are the stored row's, read in the same unit, so a why set since the sheet opened is kept.
 */
export function saveValue(value: Pick<Value, 'id'>, d: ValueDraft, status?: ValueStatus, now = Date.now()): Promise<Value> {
  const word = tidy(d.word);
  if (!word) return Promise.reject(new NoWordError());
  return store.unit(async u => {
    const v = await u.get('values', value.id);
    if (!v) throw new Error('No such value');
    const shadow = tidy(d.shadow) || undefined, looks = tidy(d.looks) || undefined;
    const words = word !== v.word || (shadow ?? '') !== (v.shadow ?? '');
    const same = !words && (looks ?? '') === (v.looks ?? '') && (status ?? v.status) === v.status;
    if (same) return strip(v);
    let revisions = v.revisions;
    if (words && dayKey(v.createdAt) !== dayKey(now) && !revisions.some(r => dayKey(r.at) === dayKey(now))) {
      revisions = [...revisions, { at: now, word: v.word, ...(v.shadow ? { shadow: v.shadow } : {}) }];
    }
    const next: Value = strip({ ...v, word, revisions, status: status ?? v.status, updatedAt: now });
    if (shadow) next.shadow = shadow; else delete next.shadow;
    if (looks) next.looks = looks; else delete next.looks;
    await u.put('values', next);
    return next;
  });
}

/** A value dragged to place `to` among `ids` (the list as shown). Every value shown is placed in the new order; the
 *  rest keep their places after them. Only rows whose place moved are written (order is clear). */
export function moveValue(ids: string[], id: string, to: number, now = Date.now()): Promise<void> {
  const from = ids.indexOf(id);
  if (from < 0) return Promise.resolve();
  const next = [...ids];
  next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, id);
  return store.tx(['values'], async tb => {
    const all = (await tb('values').toArray()).sort(byValueOrder);
    const rest = all.filter(v => !next.includes(v.id)).map(v => v.id);
    const rows = new Map(all.map(v => [v.id, v]));
    const order = [...next, ...rest];
    for (let i = 0; i < order.length; i++) {
      const v = rows.get(order[i]);
      if (v && v.order !== i) await tb('values').update(v.id, { order: i, updatedAt: now });
    }
  });
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
