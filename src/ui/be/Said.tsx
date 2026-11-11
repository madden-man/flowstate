// "Said for it" under an open value (PLAN-VALUES.md C5 owns this file; C2 left the seam): the lines confirmed for the
// value or its shadow, newest first, each a way back to its council. Empty until C5 fills it.
import type { Value } from '../../db/schema';
import type { Read } from '../../db/fields';

export function Said(_: { value: Read<Value> }) {
  return null;
}
