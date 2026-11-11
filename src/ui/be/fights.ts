// Who fights for what, as the champion screens draw it, kept pure so it can be tested (PLAN-VALUES.md section 2, "Many
// to many, by taps"; C3). A link is a voice on a side of a value; un-pressing one that holds a why takes two taps.
import type { Value, ValueSide } from '../../db/schema';
import type { Read } from '../../db/fields';

/** The sides a value can be fought for on: its word, and its shadow when it has one. */
export const sidesOf = (v: Pick<Value, 'shadow'>): ValueSide[] => (v.shadow ? ['value', 'shadow'] : ['value']);

/** True when the voice fights for this side of the value (archived or not: the link is kept either way). */
export const fightsOn = (v: Pick<Value, 'champions'>, voiceId: string, side: ValueSide): boolean =>
  v.champions.some(c => c.voiceId === voiceId && c.side === side);

/** His sentence for this champion, or undefined. */
export const whyOf = (v: Pick<Value, 'champions'>, voiceId: string, side: ValueSide): string | undefined =>
  v.champions.find(c => c.voiceId === voiceId && c.side === side)?.why || undefined;

/** Letting go of this link takes a second tap: it holds a why, and the why goes with it. */
export const twoTaps = (v: Pick<Value, 'champions'>, voiceId: string, side: ValueSide): boolean => !!whyOf(v, voiceId, side);

/** The word a side is drawn with. */
export const sideWord = (v: Pick<Value, 'word' | 'shadow'>, side: ValueSide): string => (side === 'shadow' ? v.shadow ?? '' : v.word);

export type Offer = { value: Read<Value>; side: ValueSide; word: string; on: boolean };

/** A voice's chips (the voice's sheet and the voice sheet's "Fights for"): every held value, then every held value's
 *  shadow, each in his list order, pressed when the voice fights for it. A locked or wordless value is left out. */
export function offersFor(values: Read<Value>[], voiceId: string): { values: Offer[]; shadows: Offer[] } {
  const shown = values.filter(v => v.status === 'held' && !v.locked && v.word);
  const offer = (value: Read<Value>, side: ValueSide): Offer => ({ value, side, word: sideWord(value, side), on: fightsOn(value, voiceId, side) });
  return {
    values: shown.map(v => offer(v, 'value')),
    shadows: shown.filter(v => v.shadow).map(v => offer(v, 'shadow')),
  };
}

/** The key a link is armed under (one at a time). */
export const linkKey = (valueId: string, voiceId: string, side: ValueSide) => `${valueId}:${voiceId}:${side}`;
