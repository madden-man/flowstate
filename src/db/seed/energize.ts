// Energize, the landing arc (PLAN-FLOWS.md 3.3): five steps up to the crest and down one of two paths. The page's
// print from the research, with the language audit applied (PLAN-FLOWS-WORDS.md): speech register, one idea per said
// line, no instruction the rows already hold. No line in Tommy's own words in the plan, so `line` is left for him.
// The boundary (hypomania) is not a step: it is one gentle print line, in every light, with "doctor" for the audit's
// "GP". It was the flow's restLine until PLAN-ENERGIZE.md X5 moved it under The tip's rows (the rest page is the three
// now); seed.ts moveDoctorLineOnce does the same once for the flow already on the phone. The flow is never called mania.
import type { FlowSeed } from '../seed-flows';
import { withPicks } from './picks';

/** The boundary line (X5), and its tip's id on The tip. */
export const DOCTOR_LINE = 'Highs most days for a week without needing sleep: talk to your doctor.';
export const DOCTOR_TIP = 'energize-4-doctor';
export const DOCTOR_STEP = 'energize-4';

export const ENERGIZE: FlowSeed = withPicks({
  id: 'energize',
  name: 'Energize',
  order: 3,
  diagram: 'arc',
  steps: [
    {
      id: 'energize-1',
      name: 'Spark',
      said: "Something lit up, and it's usable. A clear goal is what turns it into focus.",
      usualShort: 'This is usable.',
      spanMin: 60,
      tips: [
        { id: 'energize-1-task', text: 'One task, and its next small step', short: 'One task' },
        { id: 'energize-1-notch', text: 'A task a notch above easy', short: 'A notch above easy' },
      ],
    },
    {
      id: 'energize-2',
      name: 'Build',
      said: "You're climbing, and the climb is the good part. A notch above easy is where this lands as focus.",
      usualShort: 'The climb is the good part.',
      spanMin: 60,
      tips: [
        { id: 'energize-2-coffee', text: 'The second coffee feeds the tip, not the work', short: 'Skip the second coffee' },
        { id: 'energize-2-phone', text: 'Phone face down, notifications off', short: 'Phone face down' },
      ],
    },
    {
      id: 'energize-3',
      name: 'Locked in',
      said: "This is the sweet spot. It lasts about an hour at a stretch, and a few hours a day.",
      usual: 'an hour to ninety minutes at a time; about four hours a day',
      usualShort: 'The sweet spot, for a while.',
      spanMin: 90,
      tips: [
        { id: 'energize-3-timer', text: 'A timer, 25 to 50 minutes; extend it once', short: 'A timer', helper: 'timer' },
        { id: 'energize-3-park', text: 'Park new ideas on the page, each with a when', short: 'Park new ideas', helper: 'journal' },
        // PLAN-PICKS.md 3.3 (P0): lyrics cost reading and writing more than instrumental music does
        { id: 'energize-3-on', text: 'One wordless record', helper: 'on' },
      ],
    },
    {
      id: 'energize-4',
      name: 'The tip',
      // the audit's two sentences; the three instructions it dropped are the rows below
      said: "Wired and scattered means you're past the top, and from here more isn't better. If tomorrow is flat, that's the sleep, not you.",
      usualShort: 'Past the top. Land it.',
      spanMin: 120,
      peak: true,
      tips: [
        { id: 'energize-4-pulse', text: 'Check your pulse; racing is the cue to land', short: 'Racing means land' },
        { id: 'energize-4-out', text: 'Out longer than in, under ten breaths a minute', short: 'Out longer than in', helper: 'ring' },
        { id: 'energize-4-ideas', text: 'Write the extra ideas down, each with a when', short: 'Write the ideas down', helper: 'journal' },
        { id: 'energize-4-sleep', text: 'Big messages and decisions after sleep.', wise: true },
        // X5: the boundary, printed under the rows (a print line is no row, so it counts toward no cap)
        { id: DOCTOR_TIP, text: DOCTOR_LINE, print: true },
      ],
    },
    {
      id: 'energize-5',
      name: 'Landing, or the crash',
      said: "The energy ends either way, and both paths come back to level. Flat and foggy after a push is the sleep and the caffeine, not you.",
      usual: 'flat for a day or two after a push',
      usualShort: 'Both paths come back to level.',
      spanMin: 2 * 24 * 60,
      tips: [
        { id: 'energize-5-stop', text: 'Stop mid-sentence, so tomorrow starts easy', short: 'Stop mid-sentence' },
        // Meditate S3 (PLAN-MEDITATE.md): landing, the circle and the rain
        { id: 'energize-5-sit', text: 'Sit with the rain', helper: 'sit' },
        { id: 'energize-5-night', text: 'Protect the night: sleep comes first', short: 'Sleep first' },
        { id: 'energize-5-crash', text: 'In the crash: something easy on, the usual coffee, and judge it after sleep', short: 'Something easy on', helper: 'on' },
        // a hand-off (PLAN-FLOWS.md 3.7: Energize's crash into Depress; burnout is Energize leading into Depress, 3.5)
        { id: 'energize-5-depress', text: 'If the crash runs on for days: the Depress flow.', print: true, handoff: { flowId: 'depress', stepId: 'depress-1' } },
      ],
    },
  ],
});
