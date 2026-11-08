// The seed flows (PLAN-FLOWS.md sections 3 and 5): plain data, one exported const per flow, written once each by
// seed.ts (seedFlowsOnce). Every text here is editable by Tommy, and the seed text stays as the flow's first
// revision, so his rewrite is his and the original stays readable.
//
// Whose words: a step's `line` is Tommy's own (the notebook, verbatim). `said`, `usual`, `usualShort` and the tips
// are the page's print, from the research in PLAN-FLOWS.md 3.1, with the language audit (PLAN-FLOWS-WORDS.md
// section 3) applied: the false-alarm frame in place of "It isn't", speech register ("it's", "you're"), no clinic words.
// Nothing here is generated.
//
// Adding a flow (F3, F4): a new file under ./seed/ (F3: depress, energize, fight; F4: whatif, replay, night, shutdown,
// shame), its import, and one line in SEED_FLOWS. A tip added to a flow already seeded goes in SEED_TIPS_LATER too.
import type { Flow } from './schema';
import { DEPRESS } from './seed/depress';
import { ENERGIZE } from './seed/energize';
import { FIGHT } from './seed/fight';
import { WHATIF } from './seed/whatif';
import { REPLAY } from './seed/replay';
import { NIGHT } from './seed/night';
import { SHUTDOWN } from './seed/shutdown';
import { SHAME } from './seed/shame';

/** A seed flow as written here: the row without its dates and first revision, which seedFlow adds. */
export type FlowSeed = Omit<Flow, 'createdAt' | 'updatedAt' | 'revisions' | 'sealed'>;

/** The day the flows were planned; every seed revision carries it. */
export const SEED_FLOWS_AT = Date.UTC(2026, 10, 8, 12);

/** Panic, the ring (PLAN-FLOWS.md 3.1). Four steps; the dotted arc from the last back to the first carries no step. */
export const PANIC: FlowSeed = {
  id: 'panic',
  name: 'Panic',
  order: 1,
  diagram: 'ring',
  line: 'Wait out the truly hard parts. They never last forever.',
  steps: [
    {
      id: 'panic-1',
      name: 'Overstimulated',
      line: 'Too much coming in at once.',
      said: "Too much is coming in, and your body is reading it as danger. It's a false alarm: real, loud, and not dangerous. Less in, a slower breath out, and this settles here more often than not.",
      usual: 'builds over minutes; often settles here',
      usualShort: 'It builds, and it often settles here.',
      spanMin: 30,
      tips: [
        { id: 'panic-1-less', text: 'Less coming in: leave the room, lights and sound off, or dim this page', short: 'Less coming in', helper: 'still' },
        { id: 'panic-1-album', text: 'Earplugs, or one quiet album', short: 'One quiet album', helper: 'music' },
        { id: 'panic-1-out', text: 'Out longer than in: four in, six out', short: 'Out longer than in', helper: 'ring' },
        { id: 'panic-1-cold', text: 'Cold water on your wrists and face', short: 'Cold water on your wrists' },
        { id: 'panic-1-name', text: 'Name it: too much in, not danger.', wise: true },
        { id: 'panic-1-let', text: 'Let it be there.', wise: true },
      ],
    },
    {
      id: 'panic-2',
      // the audit's "The wave" (PLAN-FLOWS-WORDS.md, Panic the peak): "Panic" inside the Panic flow read twice
      name: 'The wave',
      line: 'The wave. Loud, fast, certain.',
      said: "This is adrenaline, and it's already on its way out: it halves every few minutes. Peaks come inside ten minutes, and most of these are over in twenty.",
      usual: 'peaks inside ten minutes; most are done in twenty',
      usualShort: 'It peaks, and it passes.',
      spanMin: 60,
      peak: true,
      tips: [
        { id: 'panic-2-ring', text: 'Breathe with the ring: in four, out six', short: 'Breathe with the ring', helper: 'ring' },
        { id: 'panic-2-cold', text: 'Cold water on your face', short: 'Cold water on your face' },
        { id: 'panic-2-crest', text: "Let it crest. You don't have to go anywhere.", wise: true },
        { id: 'panic-2-tense', text: 'Tense, then let go on the out-breath' },
        { id: 'panic-2-wait', text: "Wait with it. You don't have to fix it.", wise: true },
      ],
    },
    {
      id: 'panic-3',
      name: 'Settling',
      line: 'Back to discomfort. Shaky, but here.',
      // the audit swaps "The worst is behind you" (reassurance) for a checkable fact; the minutes since the peak
      // are F2's clock, so the seed says it in words
      said: "Your heart has already slowed since the peak. Shaky is what draining feels like. It takes about an hour, and it's on schedule.",
      usual: 'the heart slows in minutes; the slow hormone drains for about an hour',
      usualShort: 'Shaky is draining.',
      spanMin: 90,
      tips: [
        { id: 'panic-3-five', text: 'Five things you can see, then four you can hear, three you can touch', short: 'Five things you can see', helper: 'five' },
        { id: 'panic-3-window', text: 'Stand, and walk to a window' },
        { id: 'panic-3-shake', text: 'Shake out your hands; drop your shoulders' },
        { id: 'panic-3-okay', text: "You're okay. It's passing.", wise: true },
        { id: 'panic-3-tea', text: 'Something small and ordinary: make tea', short: 'Make tea' },
        // Avoidance, folded in (PLAN-FLOWS.md 3.5, F4): "do the small version". Leaving is what teaches the brain it
        // would have kept rising, so the step after the peak says go back, for a minute, rather than not at all
        { id: 'panic-3-avoid', text: 'If you left, go back for a minute: the small version', short: 'Go back, for a minute' },
      ],
    },
    {
      id: 'panic-4',
      name: 'Under the skin',
      line: 'Gross. Lingering. Under the skin.',
      said: "Tired and gross is what afterwards feels like, and it's the last part. It drains over hours, not minutes. All you owe it is water, food and something easy.",
      usual: 'hours; tired is normal, and it has no fixed length',
      usualShort: 'Slow, and it drains.',
      spanMin: 360,
      tips: [
        { id: 'panic-4-water', text: 'Water, then something to eat', short: 'Water, then food' },
        { id: 'panic-4-album', text: 'An album, or the TV', helper: 'music' },
        { id: 'panic-4-shower', text: 'A warm shower' },
        { id: 'panic-4-walk', text: 'A slow walk around the block' },
        { id: 'panic-4-pick', text: "Don't pick at it yet. It's draining.", wise: true },
        { id: 'panic-4-write', text: 'Write it down, later', helper: 'journal' },
        // a hand-off (PLAN-FLOWS.md 3.7: Panic's tail into Depress)
        { id: 'panic-4-depress', text: 'If it stays heavy for days: the Depress flow.', print: true, handoff: { flowId: 'depress', stepId: 'depress-1' } },
      ],
    },
  ],
};

/** Every seed flow, in the list's order. F3 and F4 add theirs here, one line each. */
export const SEED_FLOWS: FlowSeed[] = [
  PANIC,
  DEPRESS,
  ENERGIZE,
  FIGHT,
  WHATIF,
  REPLAY,
  NIGHT,
  SHUTDOWN,
  SHAME,
];

/**
 * Tips added to a seed flow after it was first written (F4: the Avoidance tip on Panic and Depress, the hand-offs
 * into Depress). A journal that already has the flow gets each once, in its seed place (seed.ts seedFlowsOnce), as
 * a new revision; one Tommy has struck or deleted is never brought back.
 */
export const SEED_TIPS_LATER: string[] = [
  'panic-3-avoid', 'panic-4-depress', 'depress-2-avoid', 'energize-5-depress', 'fight-1-depress',
];

/** A seed as a flows row: dated, with its seed text as the first revision. */
export function seedFlow(seed: FlowSeed, at = SEED_FLOWS_AT): Flow {
  const copy = structuredClone(seed);
  return { ...copy, createdAt: at, updatedAt: at, revisions: [{ at, name: copy.name, steps: structuredClone(copy.steps) }] };
}
