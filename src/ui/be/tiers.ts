// What Be's tiered list draws from the tiers (PLAN-TIERS.md sections 3 and 6, B1; PLAN-FOLDS.md G0 and G1), kept pure
// so it can be tested: the words of the five places, which are folded, the run of slots the list is drawn from (for
// each place its heading, then, open, its rows or its landing rule), a folded place's run of words, the two dated
// lines, and what Still shows. No number, rank or count is ever made here (rule 15): the place is said by its heading,
// its stroke and the size of the word.
import type { BePlaceKey, Settings, Value } from '../../db/schema';
import type { Read } from '../../db/fields';
import { legacyDates, placeOf, tierSince, type Tiers, type ValuePlace } from '../../model/values';
import { notebookDate } from '../date';

/** The five places in list order, each with its word: the headings, the shelves and the five words on an open value. */
export const PLACE_WORDS: readonly { place: ValuePlace; word: string }[] = [
  { place: 1, word: 'First' }, { place: 2, word: 'Second' }, { place: 3, word: 'Third' },
  { place: 'resting', word: 'Resting' }, { place: 'legacy', word: 'Legacy' },
];

export const placeWord = (p: ValuePlace) => PLACE_WORDS.find(x => x.place === p)!.word;

/** The key a place goes by in the DOM (data-place) and in slot keys: "1", "2", "3", "resting", "legacy". */
export const placeKey = (p: ValuePlace) => String(p);

/** Folded by default (PLAN-FOLDS.md section 2.5): Resting and Legacy start folded, the three tiers open. */
const FOLDED_BY_DEFAULT: Record<BePlaceKey, boolean> = { '1': false, '2': false, '3': false, resting: true, legacy: true };

/** Whether a place is folded, from settings.beFolded (G0): what he last chose for it, else the default. */
export const isFolded = (kept: Settings['beFolded'], p: ValuePlace | BePlaceKey): boolean => {
  const k = placeKey(p as ValuePlace) as BePlaceKey;
  return kept?.[k] ?? FOLDED_BY_DEFAULT[k];
};

/** The rows of a place, from the tiers read. */
export const rowsOf = (t: Tiers, p: ValuePlace): Read<Value>[] =>
  p === 1 ? t.first : p === 2 ? t.second : p === 3 ? t.third : p === 'resting' ? t.resting : t.legacy;

/**
 * The list as one run of slots, top to bottom (PLAN-TIERS.md section 5, PLAN-FOLDS.md sections 5 and 6): for each of the
 * five places its heading; folded, nothing else (the heading carries the run of its words); open, its rows and, when it
 * has none, its landing rule. Resting and Legacy show only when something is on them. Every slot has a key unique across
 * the run, so the list is one flat keyed run and a row that changes place moves instead of being drawn again (the drag
 * swaps past a heading as it swaps past a row).
 * While a row is lifted (lifted: its id) there is somewhere to drop everywhere, and every place keeps its fold (G2): an
 * open place ends in its landing rule, its foot, the shelves as the tiers; a folded place is its heading alone (dashed,
 * its own landing), and when the lifted row rides there it is drawn right under it, the only row (infold); both shelves
 * show, empty or not, each at its kept fold.
 */
export type Slot =
  | { kind: 'heading'; key: string; place: ValuePlace; folded: boolean }
  | { kind: 'row'; key: string; place: ValuePlace; value: Read<Value>; infold?: boolean }
  | { kind: 'land'; key: string; place: ValuePlace };

export function slots(t: Tiers, folded: Settings['beFolded'], lifted: string | null = null): Slot[] {
  const out: Slot[] = [];
  const lifting = lifted !== null;
  for (const { place: p } of PLACE_WORDS) {
    const rows = rowsOf(t, p);
    const shelf = typeof p !== 'number';
    if (shelf && !rows.length && !lifting) continue;
    const shut = isFolded(folded, p);
    out.push({ kind: 'heading', key: `heading-${p}`, place: p, folded: shut });
    if (shut) {
      const riding = lifting ? rows.find(v => v.id === lifted) : undefined;
      if (riding) out.push({ kind: 'row', key: riding.id, place: p, value: riding, infold: true });
      continue;
    }
    for (const value of rows) out.push({ kind: 'row', key: value.id, place: p, value });
    if (!rows.length || lifting) out.push({ kind: 'land', key: `land-${p}`, place: p });
  }
  return out;
}

/** A folded place's line (PLAN-FOLDS.md section 2.4): its values' words in list order. Never a count (rule 15). */
export const runOf = (rows: readonly Pick<Value, 'word'>[]): string[] => rows.map(v => v.word);

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
