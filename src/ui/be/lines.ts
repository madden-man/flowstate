// What Be draws from a value, kept pure so it can be tested (PLAN-VALUES.md C2): the colour rules on a list row, and
// the struck versions in the value sheet (DESIGN.md rule 10).
import type { Value, Voice } from '../../db/schema';
import { championsOf } from '../../model/values';

/** The voices whose rules a list row carries: the value's champions first, then its shadow's, each voice once, archived
 *  voices out (championsOf). Empty means nobody fights for it: the row draws one dashed rule instead. */
export function ruleIds(value: Pick<Value, 'champions'>, voices: Voice[]): string[] {
  const ids = [...championsOf(value, voices, 'value'), ...championsOf(value, voices, 'shadow')].map(d => d.voice.id);
  return [...new Set(ids)];
}

/** One struck version: an earlier word and shadow, or a word a paradox held that the value has no field for. */
export type Struck = { at: number; word: string; shadow?: string } | { at: number; text: string };

/** The value's earlier versions, newest first. A revision made from a paradox (seed.ts valuesFromParadoxesOnce) is the
 *  value's own first words, which the value still says, so only what the paradox had beside them is struck: pole A's
 *  bracket word (overdone) and pole B's aspect (shadowLooks). */
export function struckLines(value: Pick<Value, 'revisions'>): Struck[] {
  const out: Struck[] = [];
  for (const r of value.revisions) {
    if (r.fromParadox) {
      if (r.fromParadox.overdone) out.push({ at: r.at, text: r.fromParadox.overdone });
      if (r.fromParadox.shadowLooks) out.push({ at: r.at, text: r.fromParadox.shadowLooks });
    } else out.push(r.shadow ? { at: r.at, word: r.word, shadow: r.shadow } : { at: r.at, word: r.word });
  }
  return out.sort((a, b) => b.at - a.at);
}
