// Shutdown, the stairs (PLAN-FLOWS.md 3.5): going still, foggy or far away under overload. Three steps down and a
// ramp back up. Still first (3.7): the Still row is the first tip of every step, above the body rows. The words are
// the defense cascade's (Kozlowska 2015), never the contested polyvagal ones, and every tip is clinical practice
// with no trial behind it, so the page claims no more than that. The page's print with the language audit applied
// (PLAN-FLOWS-WORDS.md, Shutdown: "It's holding, not failing", no "fight-or-flight"). The plan gives no line in
// Tommy's own words, so `line` is left for him. No source times a shutdown: the spans are minutes down the stairs
// and up to an hour on the ramp. The peak is Far away, the bottom step.
import type { FlowSeed } from '../seed-flows';
import { withPicks } from './picks';

/** The Still row, first on every step (3.7, Still first). */
const still = (step: string) => ({ id: `${step}-still`, text: 'Less coming in: dim the page', short: 'Dim the page', helper: 'still' as const });

export const SHUTDOWN: FlowSeed = withPicks({
  id: 'shutdown',
  name: 'Shutdown',
  order: 8,
  diagram: 'stairs',
  steps: [
    {
      id: 'shutdown-1',
      name: 'Too much',
      said: "Your body pulled a brake. It's holding, not failing, and this is a known state with a known way out.",
      usualShort: 'A brake, with a way out.',
      spanMin: 10,
      tips: [
        still('shutdown-1'),
        { id: 'shutdown-1-name', text: 'Name it: my body pulled a brake', short: 'Name it' },
      ],
    },
    {
      id: 'shutdown-2',
      name: 'Stuck',
      said: 'Weight first, words later. The body thaws from the ground up.',
      usualShort: 'Weight first, words later.',
      spanMin: 20,
      tips: [
        still('shutdown-2'),
        { id: 'shutdown-2-feet', text: 'Feet on the floor; stomp, or shift your weight', short: 'Feet on the floor' },
        { id: 'shutdown-2-chair', text: 'Feel the chair pressing your back', short: 'The chair at your back' },
      ],
    },
    {
      id: 'shutdown-3',
      name: 'Far away',
      said: 'Far away is common, and it passes; about six in ten people with depression have felt it. A voice or a face brings you back faster than thinking does.',
      usualShort: 'Common, and it passes.',
      spanMin: 30,
      peak: true,
      tips: [
        still('shutdown-3'),
        { id: 'shutdown-3-voice', text: "A trusted voice, or someone's eyes", short: 'A voice, or a face' },
        { id: 'shutdown-3-breath', text: 'Slow the breath', helper: 'ring' },
      ],
    },
    {
      id: 'shutdown-4',
      name: 'Thawing',
      said: 'The quiet now is the repair. Rest is the task.',
      usualShort: 'The quiet is the repair.',
      spanMin: 60,
      tips: [
        still('shutdown-4'),
        { id: 'shutdown-4-rest', text: 'Rest, with nothing to finish', short: 'Rest' },
        { id: 'shutdown-4-album', text: 'An album, or the TV', helper: 'on' },
      ],
    },
  ],
});
