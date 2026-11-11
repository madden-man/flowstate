// Be's champions (PLAN-VALUES.md C3 owns this file; C2 left these two seams). Champions is the second segment,
// #/be/champions, under the same "Values | Champions" bar; ChampionsOf is the slot inside an open value, between its
// looks line and "Said for it", where the champions of each side are drawn. Both are empty until C3 fills them.
import type { Value } from '../../db/schema';
import type { Read } from '../../db/fields';

/** The Champions segment's page body: each voice and what it fights for (step 5). */
export function Champions() {
  return null;
}

/** Under an open value: who fights for it, then who fights for its shadow (steps 3 and 4). */
export function ChampionsOf(_: { value: Read<Value> }) {
  return null;
}
