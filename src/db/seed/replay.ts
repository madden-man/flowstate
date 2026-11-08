// Replay, the coil (PLAN-FLOWS.md 3.5): going back over something already done, a conversation, a look, a failure.
// Four steps in along the coil and out by the straight exit. The social hangover after time with people is this flow
// (post-event processing), so it carries no flow of its own. The page's print from the research, with the language
// audit applied (PLAN-FLOWS-WORDS.md, Replay: "swap" said once, "how" loosens it). The plan gives no line in Tommy's
// own words, so `line` is left for him. The peak is Heavier, the tightest turn.
// Spans: minutes for the sting, an hour of whys, hours heavier, a couple of hours to write it and be done.
import type { FlowSeed } from '../seed-flows';

export const REPLAY: FlowSeed = {
  id: 'replay',
  name: 'Replay',
  order: 6,
  diagram: 'coil',
  steps: [
    {
      id: 'replay-1',
      name: 'That stung',
      said: "It landed, and now the replay wants to start. It's a loop with one exit, and the exit is a question.",
      usualShort: 'A loop with one exit.',
      spanMin: 30,
      tips: [
        { id: 'replay-1-name', text: 'Name it: this is the replay', short: 'Name it' },
      ],
    },
    {
      id: 'replay-2',
      name: 'Why did I',
      said: 'Every "why" tightens the coil. "How did it unfold, moment by moment" loosens it.',
      usualShort: 'How, not why.',
      spanMin: 60,
      tips: [
        { id: 'replay-2-how', text: '"How", not "why": how did it unfold, moment by moment', short: 'How, not why' },
        { id: 'replay-2-next', text: 'One concrete next step.', wise: true },
      ],
    },
    {
      id: 'replay-3',
      name: 'Heavier',
      said: 'Eight minutes of something absorbing beat eight minutes of replaying, in people with depression. Pick the eight minutes.',
      usual: 'hours; days, after time with people',
      usualShort: 'Heavy, and it lifts.',
      spanMin: 4 * 60,
      peak: true,
      tips: [
        { id: 'replay-3-absorb', text: 'Eight minutes of something absorbing', short: 'Something absorbing' },
        { id: 'replay-3-album', text: 'An album', helper: 'music' },
        { id: 'replay-3-you', text: 'Talk to yourself by your name, or as "you"', short: 'Talk to yourself as "you"' },
      ],
    },
    {
      id: 'replay-4',
      name: 'How, not why',
      said: "You're out of the coil. What happened, and what you'd do next time: that's the whole entry.",
      usualShort: 'Out of the coil.',
      spanMin: 2 * 60,
      tips: [
        { id: 'replay-4-write', text: 'Write what happened, and what next time', short: 'What happened, what next', helper: 'journal' },
      ],
    },
  ],
};
