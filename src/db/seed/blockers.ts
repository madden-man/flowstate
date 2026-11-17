// The blockers under each sign (PLAN-BLOCKERS.md section 4, K0): the three second listings and the six new candidates.
// A candidate ships as a name, a shape and step words only, marked draft, until Tommy chooses (K5 writes the said lines,
// tips, safety lines and a shape of its own for each one he keeps; the rest leave the seed). The names, shapes and step
// words are the plan's, verbatim. The shapes are stand-ins borrowed from the nine drawings that exist (section 4).
// Written once by seed.ts seedBlockersOnce, never by a Dexie version.
import type { ChakraId } from '../../model/mountain';
import type { FlowSeed } from '../seed-flows';

/** The signs a seed flow is listed under besides its own (section 4, "Also here"): 3 a.m. under Root, Replay under
 *  Crown, What if under Third eye. */
export const SEED_ALSO_UNDER: Readonly<Record<string, readonly ChakraId[]>> = {
  night: ['root'],
  replay: ['crown'],
  whatif: ['third-eye'],
};

/** The day the candidates were planned; each draft's dates and first revision carry it. */
export const BLOCKERS_AT = Date.UTC(2026, 10, 17, 12);

const draft = (id: string, name: string, chakra: ChakraId, diagram: FlowSeed['diagram'], order: number, words: readonly string[]): FlowSeed => ({
  id, name, order, diagram, chakra, draft: true,
  steps: words.map((w, i) => ({ id: `${id}-${i + 1}`, name: w, tips: [] })),
});

/** The six new candidates, one under each sign but Root, after the seed flows on the list. */
export const BLOCKER_DRAFTS: readonly FlowSeed[] = [
  draft('gripping', 'Gripping', 'crown', 'ring', 10, ['Planning', 'Re-planning', 'Checking', 'Tighter']),
  draft('cant-choose', "Can't choose", 'third-eye', 'fork', 11, ['Two doors', 'More research', 'Asking everyone', 'Neither']),
  draft('swallowed-it', 'Swallowed it', 'throat', 'stairs', 12, ['Almost said', 'Let it pass', 'Rehearsing', 'Resenting']),
  draft('missing-someone', 'Missing someone', 'heart', 'curve', 13, ['A reminder', 'The wave', 'Aching', 'Easing']),
  draft('cant-start', "Can't start", 'solar-plexus', 'valley', 14, ['Should', 'Putting off', 'Dread', 'One small piece']),
  draft('numbing', 'Numbing', 'sacral', 'coil', 15, ['Restless', 'Reaching', 'Scrolling', 'Hollow']),
];
