// Shame, the fork (PLAN-FLOWS.md 3.5): a sudden drop after a mistake or being seen. Four steps down to the fork and
// up the third path. The page's print from the research, with the language audit applied (PLAN-FLOWS-WORDS.md,
// Shame: "has a door in it", "One specific repair, then it's done", "Before you reply, notice the pull to hide or
// hit back"). The plan gives no line in Tommy's own words, so `line` is left for him. The peak is I'm worthless, the
// whole-self verdict. Its hit-back branch hands off to Fight (3.7, one episode, two flows): a printed line that is a
// link, never a row to tick. Spans: minutes for the sting, an hour or two for the verdict and the fork, hours for
// the repair.
import type { FlowSeed } from '../seed-flows';

export const SHAME: FlowSeed = {
  id: 'shame',
  name: 'Shame',
  order: 9,
  diagram: 'fork',
  steps: [
    {
      id: 'shame-1',
      name: 'Seen',
      said: 'Exposed is a feeling, and a loud one, and it peaks fast. The pull to hide or hit back is the shame talking, not your next step.',
      usualShort: 'It peaks fast.',
      spanMin: 15,
      tips: [
        { id: 'shame-1-name', text: 'Name it: shame', short: 'Name it' },
      ],
    },
    {
      id: 'shame-2',
      name: "I'm worthless",
      said: '"I am bad" is a verdict on the whole of you, and it\'s the one that drags everything down. "I did a bad thing" has a door in it.',
      usualShort: 'A thing you did, not all of you.',
      spanMin: 60,
      peak: true,
      tips: [
        { id: 'shame-2-reword', text: 'Reword "I am bad" as "I did a bad thing"', short: 'Say "I did a bad thing"' },
        { id: 'shame-2-friend', text: "Talk to yourself the way you'd talk to a friend", short: 'As you would to a friend' },
      ],
    },
    {
      id: 'shame-3',
      name: 'Hide or hit back',
      said: "Both pulls lead away from the person and the fix. Notice the pull before you answer; you don't have to take either.",
      usualShort: 'Notice the pull.',
      spanMin: 60,
      tips: [
        { id: 'shame-3-notice', text: 'Before you reply, notice the pull to hide or hit back', short: 'Notice the pull' },
        { id: 'shame-3-fight', text: "If it's hot: the Fight flow.", print: true, handoff: { flowId: 'fight', stepId: 'fight-1' } },
      ],
    },
    {
      id: 'shame-4',
      name: 'I did a thing',
      said: "One specific repair, then it's done. Guilt points at the amends; that's the path that curves back up.",
      usualShort: 'One repair, then done.',
      spanMin: 3 * 60,
      tips: [
        { id: 'shame-4-repair', text: 'One specific repair', short: 'One repair' },
        { id: 'shame-4-own', text: 'Own it in short phrases', short: 'Own it' },
      ],
    },
  ],
};
