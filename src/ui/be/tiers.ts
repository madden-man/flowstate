// What Be's tiered list draws from the tiers (PLAN-TIERS.md sections 3 and 6, B1), kept pure so it can be tested: the
// words of the five places, the run of slots the list is drawn from (heading, rows, landing rule, for each tier; then
// the Resting and Legacy shelves), the two dated lines, and what Still shows. No number, rank or count is ever made
// here (rule 15): the tier is said by its heading and the size of the word.
import type { Value } from '../../db/schema';
import type { Read } from '../../db/fields';
import { legacyDates, placeOf, tierSince, type Tier, type Tiers, type ValuePlace } from '../../model/values';
import { notebookDate } from '../date';

/** The five places in list order, each with its word: the headings, the shelves and the five words on an open value. */
export const PLACE_WORDS: readonly { place: ValuePlace; word: string }[] = [
  { place: 1, word: 'First' }, { place: 2, word: 'Second' }, { place: 3, word: 'Third' },
  { place: 'resting', word: 'Resting' }, { place: 'legacy', word: 'Legacy' },
];

export const placeWord = (p: ValuePlace) => PLACE_WORDS.find(x => x.place === p)!.word;

/** The key a place goes by in the DOM (data-place) and in slot keys: "1", "2", "3", "resting", "legacy". */
export const placeKey = (p: ValuePlace) => String(p);

export const TIERS: readonly Tier[] = [1, 2, 3];

/** The rows of a place, from the tiers read. */
export const rowsOf = (t: Tiers, p: ValuePlace): Read<Value>[] =>
  p === 1 ? t.first : p === 2 ? t.second : p === 3 ? t.third : p === 'resting' ? t.resting : t.legacy;

/**
 * The list as one run of slots, top to bottom (PLAN-TIERS.md section 5): for each tier its heading, its rows and, when
 * it has none, its landing rule; then the Resting word when something rests and its rows when that shelf is open; then
 * the Legacy word and rows the same. Every slot has a key unique across the run, so the list is one flat keyed run and a
 * row that changes place moves instead of being drawn again (B2's drag swaps past a heading as it swaps past a row).
 */
export type Slot =
  | { kind: 'heading'; key: string; place: Tier }
  | { kind: 'row'; key: string; place: ValuePlace; value: Read<Value> }
  | { kind: 'land'; key: string; place: ValuePlace }
  | { kind: 'shelf'; key: string; place: 'resting' | 'legacy'; open: boolean };

export function slots(t: Tiers, open: { resting: boolean; legacy: boolean }): Slot[] {
  const out: Slot[] = [];
  for (const p of TIERS) {
    out.push({ kind: 'heading', key: `heading-${p}`, place: p });
    const rows = rowsOf(t, p);
    for (const value of rows) out.push({ kind: 'row', key: value.id, place: p, value });
    if (!rows.length) out.push({ kind: 'land', key: `land-${p}`, place: p });
  }
  for (const p of ['resting', 'legacy'] as const) {
    const rows = rowsOf(t, p);
    if (!rows.length) continue;
    out.push({ kind: 'shelf', key: `shelf-${p}`, place: p, open: open[p] });
    if (open[p]) for (const value of rows) out.push({ kind: 'row', key: value.id, place: p, value });
  }
  return out;
}

/** Still (rule 13, PLAN-TIERS.md section 6): First's words alone; when First is empty, every held word in tier order. */
export const stillValues = (t: Tiers): Read<Value>[] => (t.first.length ? t.first : [...t.second, ...t.third]);

/** Under an open held value: "First since 11 / 12 / 26". Nothing for one resting or in Legacy. */
export function sinceLine(v: Pick<Value, 'status' | 'tier' | 'tierLog' | 'createdAt'>): string | undefined {
  const p = placeOf(v);
  if (typeof p !== 'number') return undefined;
  return `${placeWord(p)} since ${notebookDate(new Date(tierSince(v)))}`;
}

/** A Legacy row's dates, where the champions' rules would be: "11 / 7 / 26 to 11 / 12 / 26", or the from date alone. */
export function legacyLine(v: Pick<Value, 'tierLog' | 'createdAt'>): string {
  const { from, to } = legacyDates(v);
  return to === undefined ? notebookDate(new Date(from)) : `${notebookDate(new Date(from))} to ${notebookDate(new Date(to))}`;
}
