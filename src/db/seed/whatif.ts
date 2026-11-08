// What if, the curve (PLAN-FLOWS.md 3.5): worry that runs in words, faces the future and climbs toward a known event.
// Five steps up the climb, over the peak the night before, down the drop at the thing and onto the flat after it.
// The page's print from the research, with the language audit applied (PLAN-FLOWS-WORDS.md): validate then inform,
// speech register, one idea per said line, nothing the rows repeat. "Nine in ten" stays a natural frequency in Day
// and Night; usualShort, Still's one line, is words only. The plan gives no line in Tommy's own words, so `line` is
// left for him. The peak is the night before: the worry tops out before the thing, not during it.
// Spans: days on the climb, a day of what-ifs, the evening before, a couple of hours for the thing itself, and a
// day after it, when an untouched episode ends.
import type { FlowSeed } from '../seed-flows';

const HOUR = 60, DAY = 24 * HOUR;

export const WHATIF: FlowSeed = {
  id: 'whatif',
  name: 'What if',
  order: 5,
  diagram: 'curve',
  steps: [
    {
      id: 'whatif-1',
      name: "Something's coming",
      said: "The dread has a date on it. Worry climbs toward the thing and drops the moment it starts; you're on the climb, the part that hurts.",
      usual: 'days, building toward the thing',
      usualShort: 'It climbs, then it drops.',
      spanMin: 3 * DAY,
      tips: [
        { id: 'whatif-1-predict', text: 'Write the worry down as a prediction, to check after', short: 'Write it as a prediction', helper: 'prediction' },
        { id: 'whatif-1-later', text: 'Put the worry off to a set time today', short: 'A set time for it' },
      ],
    },
    {
      id: 'whatif-2',
      name: 'What if',
      said: "Nine in ten logged worries didn't happen. That's the base rate for the thing you're picturing.",
      usualShort: 'Most of these never happen.',
      spanMin: 2 * DAY,
      tips: [
        { id: 'whatif-2-how', text: 'Ask "what can I do about this, step by step?"', short: 'What can I do, step by step?' },
        { id: 'whatif-2-time', text: 'Worry at the set time, then stop', short: 'The set time, then stop' },
      ],
    },
    {
      id: 'whatif-3',
      name: 'Night before',
      said: "The night before is the peak of the curve, not the thing itself. Expect the feeling instead of fighting it; it's already as high as it gets.",
      usualShort: 'This is the top of it.',
      spanMin: 12 * HOUR,
      peak: true,
      tips: [
        { id: 'whatif-3-expect', text: 'Expect the feeling, and let it be as high as it is', short: 'Expect it' },
        { id: 'whatif-3-out', text: 'Out longer than in', helper: 'ring' },
        { id: 'whatif-3-wake', text: 'Same wake time tomorrow', short: 'Same wake time' },
        // a hand-off (PLAN-FLOWS.md 3.5: "it tips into Panic only at its peak")
        { id: 'whatif-3-panic', text: 'If it tips into panic: the Panic flow.', print: true, handoff: { flowId: 'panic', stepId: 'panic-1' } },
      ],
    },
    {
      id: 'whatif-4',
      name: 'The thing',
      said: 'Here it is, and the curve has already turned.',
      usualShort: 'The curve has turned.',
      spanMin: 2 * HOUR,
      tips: [
        { id: 'whatif-4-line', text: "One line: what's actually happening", short: "What's happening" },
      ],
    },
    {
      id: 'whatif-5',
      name: 'It was fine',
      said: "Mark how it went. The relief belongs to what happened, not to the worrying, and that's what teaches next time.",
      usualShort: 'Mark it, and let it go.',
      spanMin: DAY,
      tips: [
        { id: 'whatif-5-mark', text: 'Mark it against the prediction: happened, or didn\'t', short: 'Mark how it went' },
      ],
    },
  ],
};
