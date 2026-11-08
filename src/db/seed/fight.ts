// Fight, the mountain (PLAN-FLOWS.md 3.4): six steps up a steep climb, over the summit's fork and down the long slope
// to repair. The page's print from the research, with the language audit applied (PLAN-FLOWS-WORDS.md): speech
// register ("you're going, and when you'll be back"), "No texts, no venting, not yet." for the two negated
// imperatives, one idea per said line. Softened (PLAN-FLOWS.md 3.7): the cooling step reads "Slower now?", never a
// pulse under a hundred. Nothing on this flow says "calm down", and nothing is scored.
import type { FlowSeed } from '../seed-flows';

export const FIGHT: FlowSeed = {
  id: 'fight',
  name: 'Fight',
  order: 4,
  diagram: 'mountain',
  steps: [
    {
      id: 'fight-1',
      name: 'Trigger',
      said: 'Something happened, and a story about it arrived in the same second. The heat is real; the story is the part you can still put down.',
      usualShort: 'The story is the part you can put down.',
      spanMin: 15,
      tips: [
        { id: 'fight-1-name', text: `Name it: "I'm angry"`, short: 'Name it' },
        { id: 'fight-1-fact', text: 'The fact in one line, the story in another', short: 'The fact, then the story' },
        { id: 'fight-1-always', text: 'Swap "always" and "never" for the one event', short: 'Just this one event' },
        { id: 'fight-1-mood', text: 'Is this the mood talking?', short: 'Is this the mood?' },
      ],
    },
    {
      id: 'fight-2',
      name: 'Climb',
      said: 'Your pulse is climbing with it, and past a point words stop going in and come out worse. Leave before the sentence, not after.',
      usualShort: 'Leave before the sentence.',
      spanMin: 15,
      tips: [
        { id: 'fight-2-pulse', text: 'Check your pulse; at about a hundred, leave', short: 'Racing means leave' },
        { id: 'fight-2-stop', text: 'Stop, step back, notice, then go on', short: 'Stop, step back' },
        { id: 'fight-2-out', text: 'Out longer than in', helper: 'ring' },
        { id: 'fight-2-cold', text: 'Cold water on your face, unless you have a heart condition', short: 'Cold water on your face' },
        { id: 'fight-2-word', text: 'Your break word, instead of the sentence', short: 'Your break word' },
      ],
    },
    {
      id: 'fight-3',
      name: 'Flooded',
      said: 'This is flooding: tunnel sight, tunnel hearing, and nothing said now will land. Twenty minutes is the least it takes to clear.',
      usual: 'twenty minutes at the least, with a time to come back',
      usualShort: 'It clears, with time away.',
      spanMin: 60,
      peak: true,
      tips: [
        // the return time (F2's Timer fills the time in); the line may go to the person it is for (3.7, open question 8)
        { id: 'fight-3-going', text: `Say "I'm going, back at 7:40"`, short: "Say you're going, and when", helper: 'timer' },
        { id: 'fight-3-none', text: 'No texts, no venting, not yet.' },
        { id: 'fight-3-walk', text: 'Walk, music, a shower, slow breathing', short: 'Walk, or music', helper: 'ring' },
        { id: 'fight-3-hot', text: 'Hot. Leave now.', wise: true },
      ],
    },
    {
      id: 'fight-4',
      name: 'Said it, or left',
      said: 'If you left: the shorter road, and it counts. If you said it: the slope is longer and still reaches the floor. Either way the next hour is the body, not the argument.',
      usualShort: 'Either way, it reaches the floor.',
      spanMin: 30,
      tips: [
        { id: 'fight-4-own', text: `After an outburst, own it: "I messed up, I can see my part"`, short: 'Own it' },
        { id: 'fight-4-easy', text: 'Go easy on yourself; it makes the amends easier', short: 'Go easy on yourself' },
        { id: 'fight-4-cold', text: "If you went cold, that's flooding too: the same twenty minutes, and gentle movement", short: 'Gone cold is flooding too' },
      ],
    },
    {
      id: 'fight-5',
      name: 'Cooling',
      // Softened (3.7): a self-rated heat, not a pulse count
      line: 'Slower now?',
      said: 'The spike cleared in minutes; the rest takes about an hour. Replaying it is the one thing that keeps it up.',
      usual: 'twenty minutes at least; about an hour; longer if replayed',
      usualShort: 'It cools, slowly.',
      spanMin: 60,
      tips: [
        { id: 'fight-5-want', text: 'What did Tommy want, in there?', wise: true },
        { id: 'fight-5-side', text: 'Look at it once from the side, then let it be', short: 'Once, from the side' },
        { id: 'fight-5-distract', text: 'If you catch the replay, distract on purpose', short: 'Distract on purpose', helper: 'music' },
        { id: 'fight-5-write', text: 'Write it later, from a distance: what happened, and what next time', short: 'Write it later', helper: 'journal' },
      ],
    },
    {
      id: 'fight-6',
      name: 'Repair',
      said: 'Coming back is the step that builds trust, and the words matter less than the coming back.',
      usualShort: 'Coming back is what counts.',
      spanMin: 24 * 60,
      tips: [
        { id: 'fight-6-back', text: '"Can I take that back?" or "Let me try again"', short: 'Can I take that back?' },
        { id: 'fight-6-part', text: `"I'm sorry," and your part, in a few short words`, short: 'Own your part' },
        { id: 'fight-6-between', text: 'Between fights, the friendship is what makes repairs work', short: 'The friendship does the work' },
      ],
    },
  ],
};
