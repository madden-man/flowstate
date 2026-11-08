// Depress, the valley (PLAN-FLOWS.md 3.2): six steps down the near slope, across the floor and up the far slope.
// The page's print from the research, with the language audit applied (PLAN-FLOWS-WORDS.md sections 2 and 3):
// validate then inform, speech register, one idea per said line and none repeating a tip, US words. The plan gives no
// line in Tommy's own words for these steps, so `line` is left for him to write and the said line carries each step.
// Numbers stay natural ("half") in Day and Night; usualShort is words only, Still's one line.
import type { FlowSeed } from '../seed-flows';

const DAY = 24 * 60;

export const DEPRESS: FlowSeed = {
  id: 'depress',
  name: 'Depress',
  order: 2,
  diagram: 'valley',
  steps: [
    {
      id: 'depress-1',
      name: 'Sliding',
      said: "You caught it early, and that counts. A dip starts with doing less, so the routine you keep today is the floor it can't go under.",
      usual: 'hours to days',
      usualShort: 'Early is the easiest place to turn it.',
      spanMin: 2 * DAY,
      tips: [
        { id: 'depress-1-wake', text: 'Same wake time and meals, whatever the night was', short: 'Same wake time' },
        { id: 'depress-1-light', text: 'Daylight early, outside if you can', short: 'Daylight early' },
        { id: 'depress-1-look', text: 'Put one thing you look forward to on the calendar', short: 'One thing to look forward to' },
        { id: 'depress-1-drink', text: 'No alcohol tonight; it lifts, then drops', short: 'No alcohol tonight' },
      ],
    },
    {
      id: 'depress-2',
      name: 'Pulling in',
      // the audit's line, without "It isn't" and without the unsourced "three weeks" (PLAN-FLOWS-WORDS.md section 4)
      said: "Pulling in is what a dip does, and you're not failing. The way out runs backwards: the doing comes first, and the wanting comes after.",
      usual: 'days',
      usualShort: 'The doing comes first.',
      spanMin: 7 * DAY,
      tips: [
        { id: 'depress-2-small', text: 'One small thing, with a time on it: the dishes at four', short: 'One small thing, with a time' },
        { id: 'depress-2-next', text: 'The smallest next step, easiest first', short: 'The smallest next step' },
        { id: 'depress-2-person', text: 'Message one person', short: 'Message one person' },
        { id: 'depress-2-up', text: 'Out of bed by day, even to the couch', short: 'Out of bed by day' },
        // Avoidance, folded in (PLAN-FLOWS.md 3.5, F4): the engine of pulling in, so "do the small version" sits here
        { id: 'depress-2-avoid', text: "The thing you've been putting off: do the small version", short: 'The small version' },
      ],
    },
    {
      id: 'depress-3',
      name: "Head won't stop",
      said: 'The why-questions are the loop, not the answer. A how is what loosens it.',
      usualShort: 'How, not why.',
      spanMin: DAY,
      tips: [
        { id: 'depress-3-how', text: 'Ask how: what happened, and one thing you can do now', short: 'What happened, and one thing' },
        { id: 'depress-3-you', text: 'Talk to yourself as "you", or by your name', short: 'Talk to yourself as "you"' },
        { id: 'depress-3-absorb', text: 'Eight minutes of something absorbing', short: 'Something absorbing' },
        { id: 'depress-3-write', text: 'Write it down once, then one action', short: 'Write it once', helper: 'journal' },
      ],
    },
    {
      id: 'depress-4',
      name: 'The bottom',
      said: 'This is the floor, and the floor is where it turns. Many dips are over in weeks; half are done inside three months.',
      usual: 'most dips are shorter than two weeks',
      usualShort: 'The floor is where it turns.',
      spanMin: 14 * DAY,
      peak: true,
      tips: [
        { id: 'depress-4-tiny', text: 'One tiny thing, at your better time of day', short: 'One tiny thing' },
        { id: 'depress-4-eat', text: 'Eat something, drink water', short: 'Water and food' },
        { id: 'depress-4-music', text: 'Music you choose', helper: 'music' },
        { id: 'depress-4-decide', text: 'No big decisions now.', wise: true },
        // the safety line (PLAN-FLOWS-WORDS.md, The bottom): printed, never a row to tick; 988 only, Tommy is in the US
        { id: 'depress-4-988', text: "If you're thinking about suicide, call or text 988. Someone answers, any hour.", print: true },
      ],
    },
    {
      id: 'depress-5',
      name: 'A little light',
      said: 'That lift is real, and it came from something you did. In people with depression, one thirty-minute walk lifted energy within the hour.',
      usualShort: 'Small, and real.',
      spanMin: 3 * DAY,
      tips: [
        { id: 'depress-5-walk', text: 'A walk, any length', short: 'A walk' },
        { id: 'depress-5-again', text: 'Do again what lifted you, as small as it was', short: 'Do it again' },
        { id: 'depress-5-say', text: "Say what lifted, in plain words, on today's page", short: 'Write what lifted', helper: 'journal' },
      ],
    },
    {
      id: 'depress-6',
      name: 'Climbing out',
      said: "You're on the far slope now. The climb is real on the days it feels flat, too.",
      usual: 'half of all dips are done by three months',
      usualShort: 'The far slope, climbing.',
      spanMin: 30 * DAY,
      tips: [
        { id: 'depress-6-keep', text: 'Keep the routine that worked; no five new goals', short: 'Keep the routine' },
        { id: 'depress-6-calendar', text: 'Keep putting good things on the calendar', short: 'Keep the calendar' },
        { id: 'depress-6-wobble', text: 'A wobble is part of climbing, not sliding.', wise: true },
        { id: 'depress-6-easy', text: 'Go easy: do what you can, and decide what can wait', short: 'Go easy' },
      ],
    },
  ],
};
