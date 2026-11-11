// Where each touch word is printed on a sign's plate (PLAN-TASKS.md T1, the mock design/tasks/index.html): beside the
// stream, never on the sign. x and y are fractions of the plate as it shows (the page's width, the plate's height); a
// word anchored 'end' ends at x. Words in one column stand a thumb apart (--hit), so their targets never overlap.
// The word after the dot is where a touch lands when it leaves the place, as the mock prints it ("Core · Be").
import type { Lands } from '../../../model/acts';
import type { ChakraId } from '../../../model/mountain';

export type At = { x: number; y: number; end?: boolean };

const L = (x: number, y: number): At => ({ x, y });
const R = (x: number, y: number): At => ({ x, y, end: true });

export const WORDS: Readonly<Record<ChakraId, Readonly<Record<string, At>>>> = {
  crown: { 'let-go': L(.53, .58), core: R(.95, .12), 'kept-line': L(.05, .14), sit: L(.36, .9) },
  'third-eye': { 'look-far': R(.95, .44), ask: L(.05, .5), 'bring-it': L(.05, .63), questions: L(.05, .76) },
  throat: { 'say-it-here': L(.05, .3), 'a-voice': L(.05, .7), send: R(.95, .52), call: R(.95, .65) },
  heart: { grieve: L(.05, .86), reach: R(.95, .6), letter: R(.95, .73), hold: R(.95, .86) },
  'solar-plexus': { reword: L(.05, .56), 'stand-on': L(.05, .87), 'spark-it': R(.95, .88), 'i-will': L(.05, .74) },
  sacral: { feel: L(.05, .72), 'write-from-it': L(.05, .85), hold: R(.95, .72), move: R(.95, .85) },
  root: { five: L(.05, .74), breathe: R(.95, .3), basics: L(.05, .3), reach: R(.95, .43) },
};

/** Where a touch that leaves the place lands, as printed after its word; none for the place and the phone. */
const PLACE_WORD: Partial<Record<Lands, string>> = {
  today: 'Journal', 'kept-page': 'Journal', council: 'Council', be: 'Be', questions: '?', meditate: 'Meditate',
  energize: 'Energize', messages: 'Messages', calendar: 'Calendar', spotify: '♪',
};
export const landsWord = (l: Lands): string | undefined => PLACE_WORD[l];

/** A word with no place set (a touch added later) stands in a column at the left, under the others. */
export function atOf(chakra: ChakraId, id: string, k: number): At {
  return WORDS[chakra]?.[id] ?? L(.05, Math.min(.92, .2 + k * .13));
}
