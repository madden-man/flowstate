// The Be tab's model (PLAN.md sections 4 and 6, DESIGN.md rule 11): two-pole validation, revisions,
// goals and their balances (pairs and open slots), the lean maths that turns a goal's weight into its
// height on its page, and the antonym lookup. Every read and write goes through the fields layer.
// Lean detents and the lean line over time are package 4's.
import type { Cadence, Item, Middle, Paradox, Pole } from '../db/schema';
import { store, type Read } from '../db/fields';
import { antonymsOf } from '../db/seed';

export type Status = Paradox['status'];
export const STATUSES: Status[] = ['active', 'resting', 'retired'];
export const CADENCES: Cadence[] = ['daily', 'weekly', 'monthly', 'yearly', 'once'];

// ---- the paradox rule ----

export type ParadoxDraft = { poleA: Pole; poleB: Pole; middle?: Middle };

const tidy = (s?: string) => (s ?? '').trim();

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

/** A paradox cannot be saved with one pole: both values and both aspects must be written. */
export function canSaveParadox(d: ParadoxDraft): boolean {
  return [d.poleA.value, d.poleA.aspect, d.poleB.value, d.poleB.aspect].every(s => tidy(s).length > 0);
}

const samePole = (a: Pole, b: Pole) => a.value === b.value && a.aspect === b.aspect && (a.shadow ?? '') === (b.shadow ?? '');
const sameMiddle = (a?: Middle, b?: Middle) => (a?.word ?? '') === (b?.word ?? '') && (a?.scenario ?? '') === (b?.scenario ?? '');

/** True when the draft says what the paradox already says. */
export function sameVersion(p: Pick<Paradox, 'poleA' | 'poleB' | 'middle'>, d: ParadoxDraft): boolean {
  return samePole(p.poleA, cleanPole(d.poleA)) && samePole(p.poleB, cleanPole(d.poleB)) && sameMiddle(p.middle, cleanMiddle(d.middle));
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
  constructor() { super('A paradox needs both poles: both values and both aspects'); this.name = 'OnePoleError'; }
}

export async function createParadox(d: ParadoxDraft, now = Date.now()): Promise<Paradox> {
  if (!canSaveParadox(d)) throw new OnePoleError();
  const p: Paradox = {
    id: crypto.randomUUID(), createdAt: now, updatedAt: now, status: 'active',
    poleA: cleanPole(d.poleA), poleB: cleanPole(d.poleB), revisions: [],
  };
  const middle = cleanMiddle(d.middle);
  if (middle) p.middle = middle;
  await store.put('paradoxes', p);
  return p;
}

/** Saves an edit (a new revision when anything changed) and the status. Both poles still required. */
export async function saveParadox(p: Paradox, d: ParadoxDraft, status: Status = p.status, now = Date.now()): Promise<Paradox> {
  if (!canSaveParadox(d)) throw new OnePoleError();
  let next = revise(p, d, now);
  if (status !== p.status) next = { ...next, status, updatedAt: now };
  if (next !== p) await store.put('paradoxes', strip(next));
  return next;
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

// ---- reading the spreads ----

export type SpreadData = { paradox: Read<Paradox>; items: Read<Item>[] };

const strip = <T>(row: T): T => {
  const copy = { ...(row as Record<string, unknown>) };
  delete copy.locked;
  return copy as T;
};

/** Every paradox with its goals (archived goals left out), oldest first. */
export async function spreads(): Promise<SpreadData[]> {
  const all = (await store.all('paradoxes')).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  return Promise.all(all.map(async paradox => ({ paradox, items: await goalsOf(paradox.id) })));
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

// ---- lean maths ----

export const clampLean = (l: number) => Math.max(-1, Math.min(1, Number.isFinite(l) ? l : 0));
const round = (l: number) => Math.round(l * 1000) / 1000;
const EPS = 1e-6;

/** The centre of a goal on its page: lean -1 at the top of the usable band, +1 at the bottom. */
export function leanToY(lean: number, top: number, bottom: number): number {
  return top + ((clampLean(lean) + 1) / 2) * (bottom - top);
}

export function yToLean(y: number, top: number, bottom: number): number {
  if (bottom <= top) return 0;
  return round(clampLean(((y - top) / (bottom - top)) * 2 - 1));
}

export type Box = { id: string; lean: number; h: number };

/**
 * Lays one page's goals out by height. Each box is centred on its lean within [top, bottom]; boxes that
 * would overlap (the same lean, or near it) stack downward with a small gap, and if the stack runs past
 * the bottom it is pushed back up. overflow is how much taller the band must be for nothing to overlap.
 * A pinned box (the one under the finger) keeps its place and the rest flow around it.
 */
export function layoutColumn(boxes: Box[], top: number, bottom: number, gap = 6, pinned?: { id: string; top: number }): { tops: Record<string, number>; overflow: number } {
  const tops: Record<string, number> = {};
  const free = boxes.filter(b => b.id !== pinned?.id);
  const want = (b: Box) => Math.max(top, Math.min(bottom - b.h, leanToY(b.lean, top, bottom) - b.h / 2));
  const order = [...free].sort((a, b) => want(a) - want(b) || a.lean - b.lean);
  const fixed = pinned ? boxes.find(b => b.id === pinned.id) : undefined;
  const pin = fixed && pinned ? { top: pinned.top, bottom: pinned.top + fixed.h } : undefined;
  let cursor = top;
  const placed: { b: Box; t: number }[] = [];
  for (const b of order) {
    let t = Math.max(want(b), cursor);
    // flow around the pinned box: if it would overlap, go below it (or above it when the box wants to be above)
    if (pin && t < pin.bottom + gap && t + b.h > pin.top - gap) {
      const above = pin.top - gap - b.h;
      t = want(b) + b.h / 2 < (pin.top + pin.bottom) / 2 && above >= cursor ? above : pin.bottom + gap;
    }
    placed.push({ b, t });
    cursor = t + b.h + gap;
  }
  // past the bottom: walk back up so the last box ends at the bottom
  let limit = bottom;
  for (let k = placed.length - 1; k >= 0; k--) {
    const p = placed[k];
    if (p.t + p.b.h > limit) p.t = limit - p.b.h;
    limit = p.t - gap;
    if (pin && p.t < pin.bottom + gap && p.t + p.b.h > pin.top - gap && p.t + p.b.h > pin.top) {
      p.t = Math.min(p.t, pin.top - gap - p.b.h);
      limit = p.t - gap;
    }
  }
  const first = placed.reduce((m, p) => Math.min(m, p.t), Infinity);
  const overflow = placed.length && first < top ? top - first : 0;
  if (overflow) for (const p of placed) p.t += overflow; // keep inside the band; the caller grows it
  for (const p of placed) tops[p.b.id] = p.t;
  if (pinned) tops[pinned.id] = pinned.top;
  return { tops, overflow };
}

/** Where a new goal lands: just below the lowest goal on the spread, or a little above the middle. */
export function nextFreeLean(items: Item[]): number {
  const live = items.filter(i => !i.archived);
  if (!live.length) return -0.5;
  return round(Math.min(0.9, Math.max(...live.map(i => i.lean)) + 0.3));
}

/**
 * A goal dropped at a new lean. A pair follows when it shared the goal's lean before the move; a pair
 * that was set to a different height stays where it was. Returns the rows that changed.
 */
export function moveGoal<T extends Item>(items: T[], id: string, lean: number): T[] {
  const g = items.find(i => i.id === id);
  if (!g) return [];
  const to = round(clampLean(lean));
  if (Math.abs(g.lean - to) < EPS) return [];
  const out: T[] = [{ ...g, lean: to }];
  const p = pairOf(g, items);
  if (p && Math.abs(p.lean - g.lean) < EPS) out.push({ ...p, lean: to });
  return out;
}

/** Which goals ride with this one while it is dragged (itself and a pair at the same height). */
export function riders(items: Item[], id: string): string[] {
  const g = items.find(i => i.id === id);
  if (!g) return [];
  const p = pairOf(g, items);
  return p && Math.abs(p.lean - g.lean) < EPS ? [g.id, p.id] : [g.id];
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
 * A goal emptied of text is left as it was (archive it instead; nothing is deleted).
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

/** Archived, never deleted. Its balance stays and shows an open slot again. */
export async function archiveGoal(id: string): Promise<void> {
  const g = await store.get('items', id);
  if (!g) return;
  await store.put('items', strip({ ...g, archived: true }));
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
