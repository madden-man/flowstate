// 3 a.m., the clock (PLAN-FLOWS.md 3.5): awake in bed, checking the time, trying harder. Five steps round the clock
// face from waking at three to the same alarm at seven. Still first (3.7): on this flow reading is the hardest thing
// on the page, so the Still row is the first tip of every step, above the body rows; Still itself stays a choice
// (DESIGN.md rule 13). The page's print from the research, with the language audit applied (PLAN-FLOWS-WORDS.md,
// 3 a.m.: "Seven still comes, whatever the night does" for the app word "pinned"). The plan gives no line in Tommy's
// own words, so `line` is left for him. The caution the plan carries (M7: sleep restriction may be unsafe with any
// history of hypomania) is the flow's restLine, like Energize's boundary, never a step and never a clinic word.
// Spans are tens of minutes (the night is lived in twenty-minute stretches); the alarm's hour closes the episode.
// The peak is Lying there, the trying.
import type { FlowSeed } from '../seed-flows';

/** The Still row, first on every step (3.7, Still first). */
const still = (step: string) => ({ id: `${step}-still`, text: 'Dim the page', helper: 'still' as const });

export const NIGHT: FlowSeed = {
  id: 'night',
  name: '3 a.m.',
  order: 7,
  diagram: 'clock',
  restLine: "If you've had highs that needed no sleep, talk to your doctor before cutting back time in bed.",
  steps: [
    {
      id: 'night-1',
      name: 'Awake again',
      said: 'Awake at three is common, and one bad night changes very little about the next day.',
      usualShort: 'Common, and it passes.',
      spanMin: 20,
      tips: [
        still('night-1'),
        { id: 'night-1-clock', text: 'Turn the clock away', short: 'Clock away' },
      ],
    },
    {
      id: 'night-2',
      name: 'What time is it',
      said: 'Checking the time is the one thing shown to keep you awake longer. The clock stays turned away for that reason.',
      usualShort: 'Leave the time alone.',
      spanMin: 10,
      tips: [
        still('night-2'),
        { id: 'night-2-leave', text: 'Leave the clock turned away; seven comes either way', short: 'Seven comes either way' },
      ],
    },
    {
      id: 'night-3',
      name: 'Lying there',
      said: 'Trying harder is what keeps you awake; the bed is for sleeping, not trying. Seven still comes, whatever the night does.',
      usual: 'about twenty minutes, then up',
      usualShort: 'The bed is for sleeping.',
      spanMin: 20,
      peak: true,
      tips: [
        still('night-3'),
        { id: 'night-3-up', text: 'Up after about twenty minutes; back when sleepy', short: 'Up, then back when sleepy' },
        { id: 'night-3-out', text: 'Out longer than in', helper: 'ring' },
      ],
    },
    {
      id: 'night-4',
      name: 'Up',
      said: 'Dull and dim: this is the bed being retrained.',
      usualShort: 'Dull and dim.',
      spanMin: 30,
      tips: [
        still('night-4'),
        { id: 'night-4-dull', text: 'Something dull in dim light, away from bright screens', short: 'Something dull, in dim light' },
        { id: 'night-4-back', text: 'Back to bed when sleepy', short: 'Back when sleepy' },
      ],
    },
    {
      id: 'night-5',
      name: 'Same alarm',
      said: "Up at the same time, and no nap. That's what makes tonight better than last night.",
      usualShort: 'The same time, every morning.',
      spanMin: 60,
      tips: [
        still('night-5'),
        { id: 'night-5-wake', text: 'Same wake time, no naps', short: 'Same wake time' },
        { id: 'night-5-light', text: 'Daylight early, outside if you can', short: 'Daylight early' },
      ],
    },
  ],
};
