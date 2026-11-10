// The Be tab's model (PLAN.md sections 4 and 6, DESIGN.md rule 11): two-pole validation, revisions,
// goals and their balances (pairs, open slots and the rows they share on the upright spread), the lean
// maths that turns a goal's weight into its height between the poles, and the antonym lookup. Every read and write goes through the fields layer.
// Lean detents and the lean line over time are package 4's. PLAN-SELF.md section 4 adds the creed, the five held, the
// refusals ("Not me") and delete, entire: a deleted paradox or goal is gone, kept nowhere.
import { byParadoxOrder, type Cadence, type Item, type Middle, type Paradox, type Pole, type Refusal } from '../db/schema';
import { store, type Read } from '../db/fields';
import { antonymsOf } from '../db/seed';

export type Status = Paradox['status'];
export const STATUSES: Status[] = ['active', 'resting', 'retired'];
export const CADENCES: Cadence[] = ['daily', 'weekly', 'monthly', 'yearly', 'once'];

// ---- the paradox rule ----

/** creed (PLAN-SELF.md section 4) is saved plainly, never a revision; left out, the paradox keeps the creed it has. */
export type ParadoxDraft = { poleA: Pole; poleB: Pole; middle?: Middle; creed?: string };

const tidy = (s?: string) => (s ?? '').trim();

const strip = <T>(row: T): T => {
  const copy = { ...(row as Record<string, unknown>) };
  delete copy.locked;
  return copy as T;
};

export function cleanPole(p: Pole): Pole {
  const out: Pole = { value: tidy(p.value), aspect: tidy(p.aspect) };
  const shadow = tidy(p.shadow);
  if (shadow) out.shadow = shadow;
  return out;
}

export function cleanMiddle(m?: Middle): Middle | undefined {
  const word = tidy(m?.word), scenario = tidy(m?.scenario);
  if (!word && !scenario) return undefined;
  const out: Middle = {};
  if (word) out.word = word;
  if (scenario) out.scenario = scenario;
  return out;
}

/** A paradox cannot be saved with one pole: both words must be written. The aspects may wait (the seeded
 *  thoughtful and reactive has none, and until 2026-11-10 that kept every edit to it from saving). */
export function canSaveParadox(d: ParadoxDraft): boolean {
  return [d.poleA.value, d.poleB.value].every(s => tidy(s).length > 0);
}

const samePole = (a: Pole, b: Pole) => a.value === b.value && a.aspect === b.aspect && (a.shadow ?? '') === (b.shadow ?? '');
const sameMiddle = (a?: Middle, b?: Middle) => (a?.word ?? '') === (b?.word ?? '') && (a?.scenario ?? '') === (b?.scenario ?? '');

/** True when the draft says what the paradox already says: the poles and the middle (the creed is sameCreed's). */
export function sameVersion(p: Pick<Paradox, 'poleA' | 'poleB' | 'middle'>, d: ParadoxDraft): boolean {
  return samePole(p.poleA, cleanPole(d.poleA)) && samePole(p.poleB, cleanPole(d.poleB)) && sameMiddle(p.middle, cleanMiddle(d.middle));
}

/** True when the draft leaves the creed as it is: the same line, or no creed in the draft at all. */
export function sameCreed(p: Pick<Paradox, 'creed'>, d: Pick<ParadoxDraft, 'creed'>): boolean {
  return d.creed === undefined || (p.creed ?? '') === tidy(d.creed);
}

/** The paradox with the draft's creed, written over the old one (no revision); an empty line removes it. */
function withCreed(p: Paradox, d: ParadoxDraft, now: number): Paradox {
  if (sameCreed(p, d)) return p;
  const next: Paradox = { ...p, updatedAt: now };
  const creed = tidy(d.creed);
  if (creed) next.creed = creed;
  else delete next.creed;
  return next;
}

/** The edited paradox: the old version goes onto revisions (struck through, never lost). */
export function revise(p: Paradox, d: ParadoxDraft, now = Date.now()): Paradox {
  if (sameVersion(p, d)) return p;
  const old: Paradox['revisions'][number] = { at: p.updatedAt, poleA: p.poleA, poleB: p.poleB };
  if (p.middle) old.middle = p.middle;
  const next: Paradox = { ...p, poleA: cleanPole(d.poleA), poleB: cleanPole(d.poleB), updatedAt: now, revisions: [...p.revisions, old] };
  const middle = cleanMiddle(d.middle);
  if (middle) next.middle = middle;
  else delete next.middle;
  return next;
}

export class OnePoleError extends Error {
  constructor() { super('A paradox needs both poles: both words'); this.name = 'OnePoleError'; }
}

// ---- five are held (PLAN-SELF.md section 3.4) ----

/** At most this many paradoxes are active; choosing what to hold is choosing what not to. */
export const HELD = 5;
/** At most this many "Not me" lines under one paradox. */
export const REFUSALS = 3;

/** True when this paradox may be active: fewer than HELD others are. id is the paradox itself, left out of the count. */
export function canHold(all: Pick<Paradox, 'id' | 'status'>[], id?: string): boolean {
  return all.filter(p => p.status === 'active' && p.id !== id).length < HELD;
}

export class HeldError extends Error {
  constructor() { super(`${HELD} paradoxes are held: one must rest before another is active`); this.name = 'HeldError'; }
}

/** A new paradox is active, or resting when HELD are already active. */
export async function createParadox(d: ParadoxDraft, now = Date.now()): Promise<Paradox> {
  if (!canSaveParadox(d)) throw new OnePoleError();
  const held = canHold(await store.all('paradoxes'));
  const p: Paradox = {
    id: crypto.randomUUID(), createdAt: now, updatedAt: now, status: held ? 'active' : 'resting',
    poleA: cleanPole(d.poleA), poleB: cleanPole(d.poleB), revisions: [],
  };
  const middle = cleanMiddle(d.middle);
  if (middle) p.middle = middle;
  const creed = tidy(d.creed);
  if (creed) p.creed = creed;
  await store.put('paradoxes', p);
  return p;
}

/**
 * Saves an edit (a new revision when the poles or the middle changed), the creed (written over, no revision) and the
 * status. Both poles still required. Going active while HELD others are throws HeldError and writes nothing; a
 * paradox already active stays saveable.
 */
export async function saveParadox(p: Paradox, d: ParadoxDraft, status: Status = p.status, now = Date.now()): Promise<Paradox> {
  if (!canSaveParadox(d)) throw new OnePoleError();
  if (status === 'active' && p.status !== 'active' && !canHold(await store.all('paradoxes'), p.id)) throw new HeldError();
  let next = withCreed(revise(p, d, now), d, now);
  if (status !== p.status) next = { ...next, status, updatedAt: now };
  if (next !== p) await store.put('paradoxes', strip(next));
  return next;
}

/** Deletes a paradox entirely (PLAN-SELF.md section 3.2): the row with its creed and refusals, its goals, its leans,
 *  and any page's link to it, in one transaction. Kept nowhere; resting and retired are the reversible ways down. */
export async function deleteParadox(id: string): Promise<void> {
  const [items, leans, pages] = await Promise.all([
    store.query('items', t => t.where('paradoxId').equals(id)),
    store.query('leans', t => t.where('[paradoxId+at]').between([id, -Infinity], [id, Infinity], true, true)),
    store.query('pages', t => t.where('paradoxIds').equals(id)),
  ]);
  const scrubbed = pages.map(pg => strip({ ...pg, paradoxIds: pg.paradoxIds.filter(x => x !== id) }));
  await store.many({ pages: scrubbed }, { paradoxes: [id], items: items.map(i => i.id), leans: leans.map(l => l.id) });
}

// ---- not me (PLAN-SELF.md section 3.4) ----

/** Adds a "Not me" line to a paradox. Undefined when the line is empty, REFUSALS are written, or there is no paradox. */
export async function addRefusal(paradoxId: string, text: string, now = Date.now()): Promise<Refusal | undefined> {
  const line = tidy(text);
  const p = await store.get('paradoxes', paradoxId);
  if (!line || !p || (p.refusals?.length ?? 0) >= REFUSALS) return undefined;
  const r: Refusal = { id: crypto.randomUUID(), text: line, at: now };
  await store.put('paradoxes', strip({ ...p, refusals: [...(p.refusals ?? []), r], updatedAt: now }));
  return r;
}

/** Edits a "Not me" line in place; emptied, it is removed. */
export async function saveRefusal(paradoxId: string, id: string, text: string, now = Date.now()): Promise<void> {
  const p = await store.get('paradoxes', paradoxId);
  const old = p?.refusals?.find(r => r.id === id);
  if (!p || !old) return;
  const line = tidy(text);
  if (line === old.text) return;
  const refusals = line ? p.refusals!.map(r => (r.id === id ? { ...r, text: line } : r)) : p.refusals!.filter(r => r.id !== id);
  const next: Paradox = strip({ ...p, refusals, updatedAt: now });
  if (!refusals.length) delete next.refusals;
  await store.put('paradoxes', next);
}

/** Antonyms from the seed's small list, offered as chips under pole B; never the one already written. */
export function antonymSuggestions(poleA: string, poleB = ''): string[] {
  const b = tidy(poleB).toLowerCase();
  return antonymsOf(poleA).filter(w => w !== b);
}

// ---- the three-word line ----

const poleWord = (p: Pole) => (p.shadow ? `${p.value} (${p.shadow})` : p.value);
const middleWord = (m?: Middle) => m?.word ?? m?.scenario;

/** "selfless · compassionate self-awareness · selfish": pole A, the middle (left out when empty), pole B. */
export const threeWords = (v: { poleA: Pole; poleB: Pole; middle?: Middle }) =>
  [poleWord(v.poleA), middleWord(v.middle), poleWord(v.poleB)].filter(Boolean).join(' · ');

/**
 * The notebook's three-word line under the spread: the current version in ink, and every earlier version
 * on its own line beneath, struck through, oldest first. Null when there is no middle and no revisions.
 */
export function threeWordLines(p: Pick<Paradox, 'poleA' | 'poleB' | 'middle' | 'revisions'>): { current: string; struck: string[] } | null {
  if (!middleWord(p.middle) && !p.revisions.length) return null;
  const current = threeWords(p);
  const struck: string[] = [];
  for (const r of p.revisions) { // pushed in order, so the array is oldest first
    const line = threeWords(r);
    if (line !== current && line !== struck[struck.length - 1]) struck.push(line);
  }
  return { current, struck };
}

// ---- who: the top of Be (PLAN-SELF.md section 3.3) ----

/** One creed line per held paradox, in the order of the list: his own line, else its three words. own is true when
 *  a creed is written (a locked read keeps it written but withheld, so its line falls back to the three words). */
export async function who(): Promise<{ paradox: Read<Paradox>; line: string; own: boolean }[]> {
  const held = (await store.all('paradoxes')).filter(p => p.status === 'active').sort(byParadoxOrder);
  return held.map(paradox => ({ paradox, line: paradox.creed || threeWords(paradox), own: paradox.creed !== undefined }));
}

// ---- reading the spreads ----

export type SpreadData = { paradox: Read<Paradox>; items: Read<Item>[] };

/** Every paradox with its goals (goals archived before delete existed left out), in the order of the list. */
export async function spreads(): Promise<SpreadData[]> {
  const all = (await store.all('paradoxes')).sort(byParadoxOrder);
  return Promise.all(all.map(async paradox => ({ paradox, items: await goalsOf(paradox.id) })));
}

/** V13: a paradox dragged to place `to` among `ids` (the Be list as shown). Every paradox shown is placed
 *  in the new order; the rest keep their places after them. Only rows whose place moved are written. */
export async function moveParadox(ids: string[], id: string, to: number, now = Date.now()): Promise<void> {
  const from = ids.indexOf(id);
  if (from < 0) return;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, id);
  const all = (await store.all('paradoxes')).sort(byParadoxOrder);
  const rest = all.filter(p => !next.includes(p.id)).map(p => p.id);
  const rows = new Map(all.map(p => [p.id, p]));
  const changed = [...next, ...rest].flatMap((pid, i) => {
    const p = rows.get(pid);
    return p && p.order !== i ? [{ ...p, order: i, updatedAt: now }] : [];
  });
  if (changed.length) await store.bulkPut('paradoxes', changed);
}

export async function goalsOf(paradoxId: string): Promise<Read<Item>[]> {
  const items = await store.query('items', t => t.where('paradoxId').equals(paradoxId));
  return items.filter(i => !i.archived).sort((a, b) => a.order - b.order);
}

// ---- pairs and open slots ----

export const otherPole = (p: Item['pole']): Item['pole'] => (p === 'a' ? 'b' : 'a');

/** The goal that balances this one, if it is still on the spread. */
export function pairOf<T extends Item>(item: T, items: T[]): T | undefined {
  if (!item.pairId) return undefined;
  const p = items.find(i => i.id === item.pairId && !i.archived);
  return p && p.pole !== item.pole ? p : undefined;
}

export type Slot = { forId: string; pole: Item['pole']; lean: number };

/** A goal whose balance is missing leaves a dashed slot at its height on the other page, until filled. */
export function openSlots(items: Item[]): Slot[] {
  const live = items.filter(i => !i.archived);
  return live.filter(i => !pairOf(i, live)).map(i => ({ forId: i.id, pole: otherPole(i.pole), lean: i.lean }));
}

/** "and on the selfish side?": the slot names the pole it sits on. */
export const slotLine = (poleValue: string) => `and on the ${poleValue} side?`;

/**
 * One row of the upright spread (DESIGN.md rule 11): a goal and its balance share a row, tied across the
 * seam; a goal without one shares its row with the dashed slot on the other side. The row's id is its
 * pole A goal (or its only goal). A pair's row sits at pole A's lean: the seed's pairs were set at different
 * heights for the old diagonal, and the first drag levels them (moveGoal).
 */
export type Row = { id: string; lean: number; a?: string; b?: string; slot?: Slot };

export function rowsOf(items: Item[]): Row[] {
  const live = items.filter(i => !i.archived);
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const i of live) {
    if (seen.has(i.id)) continue;
    seen.add(i.id);
    const p = pairOf(i, live);
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      const [a, b] = i.pole === 'a' ? [i, p] : [p, i];
      rows.push({ id: a.id, lean: a.lean, a: a.id, b: b.id });
    } else {
      // a balance already on another row (data that disagrees with itself) still keeps the goal on the spread
      const row: Row = { id: i.id, lean: i.lean, [i.pole]: i.id };
      if (!p) row.slot = { forId: i.id, pole: otherPole(i.pole), lean: i.lean };
      rows.push(row);
    }
  }
  return rows;
}

/** The row a goal sits on. */
export const rowOf = (rows: Row[], id: string) => rows.find(r => r.a === id || r.b === id);

// ---- lean maths ----

export const clampLean = (l: number) => Math.max(-1, Math.min(1, Number.isFinite(l) ? l : 0));
const round = (l: number) => Math.round(l * 1000) / 1000;
const EPS = 1e-6;

/** The centre of a row between the poles: lean -1 at the top of the band (pole A's rule), +1 at the bottom (pole B's). */
export function leanToY(lean: number, top: number, bottom: number): number {
  return top + ((clampLean(lean) + 1) / 2) * (bottom - top);
}

export function yToLean(y: number, top: number, bottom: number): number {
  if (bottom <= top) return 0;
  return round(clampLean(((y - top) / (bottom - top)) * 2 - 1));
}

export type Box = { id: string; lean: number; h: number };
/** A box that keeps its place: the row under the finger, the middle word on the seam. h defaults to the box's own. */
export type Pin = { id: string; top: number; h?: number };

/**
 * Lays the rows out by height. Each box is centred on its lean within [top, bottom]; boxes that would
 * overlap (the same lean, or near it) stack downward with a small gap, and if the stack runs past the
 * bottom it is pushed back up. overflow is how much taller the band must be for nothing to overlap.
 * Pinned boxes (the row under the finger, the middle word) keep their places and the rest flow around them.
 */
export function layoutColumn(boxes: Box[], top: number, bottom: number, gap = 6, pinned?: Pin | Pin[]): { tops: Record<string, number>; overflow: number } {
  const tops: Record<string, number> = {};
  const pins = (Array.isArray(pinned) ? pinned : pinned ? [pinned] : [])
    .map(p => ({ id: p.id, top: p.top, bottom: p.top + (p.h ?? boxes.find(b => b.id === p.id)?.h ?? 0) }))
    .sort((a, b) => a.top - b.top);
  const held = new Set(pins.map(p => p.id));
  const free = boxes.filter(b => !held.has(b.id));
  const want = (b: Box) => Math.max(top, Math.min(bottom - b.h, leanToY(b.lean, top, bottom) - b.h / 2));
  const order = [...free].sort((a, b) => want(a) - want(b) || a.lean - b.lean);
  const hit = (t: number, h: number) => pins.find(p => t < p.bottom + gap && t + h > p.top - gap);
  let cursor = top;
  const placed: { b: Box; t: number }[] = [];
  for (const b of order) {
    let t = Math.max(want(b), cursor);
    // flow around the pins: below one, or above it when the box wants to be above and there is room
    for (let k = 0, p = hit(t, b.h); p && k <= pins.length; k++, p = hit(t, b.h)) {
      const above = p.top - gap - b.h;
      t = want(b) + b.h / 2 < (p.top + p.bottom) / 2 && above >= cursor && !hit(above, b.h) ? above : p.bottom + gap;
    }
    placed.push({ b, t });
    cursor = t + b.h + gap;
  }
  // past the bottom: walk back up so the last box ends at the bottom, stepping over any pin on the way
  let limit = bottom;
  for (let k = placed.length - 1; k >= 0; k--) {
    const p = placed[k];
    if (p.t + p.b.h > limit) p.t = limit - p.b.h;
    for (let j = 0, q = hit(p.t, p.b.h); q && j <= pins.length; j++, q = hit(p.t, p.b.h)) p.t = Math.min(p.t, q.top - gap - p.b.h);
    limit = p.t - gap;
  }
  const first = placed.reduce((m, p) => Math.min(m, p.t), Infinity);
  const overflow = placed.length && first < top ? top - first : 0;
  if (overflow) for (const p of placed) p.t += overflow; // keep inside the band; the caller grows it
  for (const p of placed) tops[p.b.id] = p.t;
  for (const p of pins) tops[p.id] = p.top;
  return { tops, overflow };
}

/** Where a new goal lands: just below the lowest goal on the spread, or a little above the middle. */
export function nextFreeLean(items: Item[]): number {
  const live = items.filter(i => !i.archived);
  if (!live.length) return -0.5;
  return round(Math.min(0.9, Math.max(...live.map(i => i.lean)) + 0.3));
}

/**
 * A goal dropped at a new lean. Its balance shares its row on the upright spread, so the pair always moves
 * together and lands level (a pair the old diagonal had set at two heights is levelled here). Returns the
 * rows that changed.
 */
export function moveGoal<T extends Item>(items: T[], id: string, lean: number): T[] {
  const g = items.find(i => i.id === id);
  if (!g) return [];
  const to = round(clampLean(lean));
  const p = pairOf(g, items);
  const out: T[] = [];
  if (Math.abs(g.lean - to) >= EPS) out.push({ ...g, lean: to });
  if (p && Math.abs(p.lean - to) >= EPS) out.push({ ...p, lean: to });
  return out;
}

/** Which goals ride with this one while it is dragged: itself and its balance, the whole row. */
export function riders(items: Item[], id: string): string[] {
  const g = items.find(i => i.id === id);
  if (!g) return [];
  const p = pairOf(g, items);
  return p ? [g.id, p.id] : [g.id];
}

export async function dropGoal(items: Item[], id: string, lean: number): Promise<Item[]> {
  const changed = moveGoal(items, id, lean);
  if (changed.length) await store.bulkPut('items', changed.map(strip));
  return changed;
}

// ---- adding and editing goals ----

export type GoalDraft = { a?: string; b?: string; cadence?: Cadence; nextTo?: string; lean?: number };

/** Saves one or two goals. Both: the pair lands linked at the same height. One: its slot opens on the other page. */
export async function addGoals(paradoxId: string, d: GoalDraft): Promise<Item[]> {
  const existing = await store.query('items', t => t.where('paradoxId').equals(paradoxId));
  const texts = { a: tidy(d.a), b: tidy(d.b) };
  const sides = (['a', 'b'] as const).filter(s => texts[s]);
  if (!sides.length) return [];
  const lean = d.lean === undefined ? nextFreeLean(existing) : round(clampLean(d.lean));
  let order = existing.reduce((m, i) => Math.max(m, i.order), -1) + 1;
  const rows: Item[] = sides.map(pole => {
    const row: Item = { id: crypto.randomUUID(), paradoxId, pole, text: texts[pole], lean, doneLog: [], order: order++ };
    if (d.cadence) row.cadence = d.cadence;
    if (d.nextTo) row.nextTo = d.nextTo;
    return row;
  });
  if (rows.length === 2) {
    rows[0].pairId = rows[1].id;
    rows[1].pairId = rows[0].id;
    delete rows[1].nextTo; // the arrow runs from the goal that follows on its own page; the balance just sits level
  }
  await store.bulkPut('items', rows);
  return rows;
}

export type GoalEdit = { text: string; other?: string; cadence?: Cadence; nextTo?: string };

/**
 * Edits a goal from its sheet: its text, cadence and what it follows, and its balance on the other page.
 * Writing into an open slot makes the balance at the same height and links the two.
 * A goal emptied of text is left as it was (delete it instead, from its sheet).
 */
export async function saveGoal(id: string, e: GoalEdit): Promise<Item[]> {
  const g = await store.get('items', id);
  if (!g) return [];
  const items = await store.query('items', t => t.where('paradoxId').equals(g.paradoxId));
  const next: Item = strip({ ...g, text: tidy(e.text) || g.text });
  if (e.cadence) next.cadence = e.cadence; else delete next.cadence;
  if (e.nextTo && e.nextTo !== g.id) next.nextTo = e.nextTo; else delete next.nextTo;
  const out: Item[] = [next];
  const other = tidy(e.other);
  const pair = pairOf(g, items);
  if (pair) {
    if (other && other !== pair.text) out.push(strip({ ...pair, text: other }));
  } else if (other) {
    const order = items.reduce((m, i) => Math.max(m, i.order), -1) + 1;
    const fill: Item = { id: crypto.randomUUID(), paradoxId: g.paradoxId, pole: otherPole(g.pole), text: other, lean: g.lean, doneLog: [], order, pairId: g.id };
    if (next.cadence) fill.cadence = next.cadence;
    next.pairId = fill.id;
    out.push(fill);
  }
  await store.bulkPut('items', out);
  return out;
}

/** Archived (the way down before PLAN-SELF.md): the row stays, hidden. Its balance stays and shows an open slot again.
 *  deleteGoal is the sheet's way now; archived rows already written stay archived and unseen. */
export async function archiveGoal(id: string): Promise<void> {
  const g = await store.get('items', id);
  if (!g) return;
  await store.put('items', strip({ ...g, archived: true }));
}

/** Deletes a goal entirely (PLAN-SELF.md section 3.2), in one transaction: its balance stays and shows its open slot
 *  again, and a goal that followed it follows nothing. */
export async function deleteGoal(id: string): Promise<void> {
  const g = await store.get('items', id);
  if (!g) return;
  const items = await store.query('items', t => t.where('paradoxId').equals(g.paradoxId));
  const loosened = items.filter(i => i.id !== id && (i.pairId === id || i.nextTo === id)).map(i => {
    const next = strip({ ...i });
    if (next.pairId === id) delete next.pairId;
    if (next.nextTo === id) delete next.nextTo;
    return next;
  });
  await store.many({ items: loosened }, { items: [id] });
}

/** Goals this one may follow (the "follows" picker): every other goal on the spread but itself. */
export function followable<T extends Item>(items: T[], id?: string): T[] {
  return items.filter(i => !i.archived && i.id !== id);
}

/** A drawn arrow runs between goals that follow one another; a missing or archived target draws nothing. */
export function arrows(items: Item[]): { from: string; to: string }[] {
  const live = new Set(items.filter(i => !i.archived).map(i => i.id));
  return items.filter(i => live.has(i.id) && i.nextTo && live.has(i.nextTo) && i.nextTo !== i.id).map(i => ({ from: i.id, to: i.nextTo! }));
}
