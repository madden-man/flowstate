// The paradox rule (PLAN.md sections 4 and 6): two-pole validation, revisions, the three-word line and the antonym
// lookup, through the fields layer. The goals, their pairs and slots, the lean maths and the spread that read them
// left with the spread (PLAN-VALUES.md C6): Be is values now, and nothing in the app reads a paradox. This half is kept
// for the paradoxes still in the database and backups (seed.ts valuesFromParadoxesOnce makes values of them).
import type { Middle, Paradox, Pole } from '../db/schema';
import { store } from '../db/fields';
import { antonymsOf } from '../db/seed';

export type Status = Paradox['status'];
export const STATUSES: Status[] = ['active', 'resting', 'retired'];

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

const strip = <T>(row: T): T => {
  const copy = { ...(row as Record<string, unknown>) };
  delete copy.locked;
  return copy as T;
};
