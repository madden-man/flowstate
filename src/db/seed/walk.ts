// The walk's audit (2026-11-11, Tommy: "audit whether we really need different action items per step - maybe just
// keep the really important ones... i want to simplify"). Every step keeps the few things that do the most, three
// where it can; the rest left the seeds, and seed.ts walkOnce strikes them once on a journal that already has them
// (rule 10: struck, never deleted, so each reads in its step sheet's Earlier and can be written back).
//
// What went, and why: a thing said twice in one flow (cold water on Fight's climb, a walk beside an On row that is
// the walk); a second wise line where one carries the step; the gentlest of several small things (tea, a shower);
// advice that is a rule for another day rather than a thing to do now (coffee, alcohol, double the estimate).
// Each id carries the seed's words: a tip he has rewritten is his, and stays.
import type { TipHelper } from '../schema';

export const WALK_TRIM: Record<string, string> = {
  'panic-1-let': 'Let it be there.',
  'panic-2-tense': 'Tense, then let go on the out-breath',
  'panic-2-wait': "Wait with it. You don't have to fix it.",
  'panic-3-shake': 'Shake out your hands; drop your shoulders',
  'panic-3-tea': 'Something small and ordinary: make tea',
  'panic-4-shower': 'A warm shower',
  'panic-4-walk': 'A slow walk around the block',
  'depress-1-drink': 'No alcohol tonight; it lifts, then drops',
  'depress-2-next': 'The smallest next step, easiest first',
  'depress-2-up': 'Out of bed by day, even to the couch',
  'depress-3-you': 'Talk to yourself as "you", or by your name',
  'depress-6-easy': 'Go easy: do what you can, and decide what can wait',
  'energize-1-coffee': 'Note the last coffee; none within six hours of bed',
  'energize-3-cap': 'Stop the block near ninety minutes, the day near four hours',
  'energize-4-double': 'Double any time estimate before you say yes',
  'energize-5-eat': 'Eat something',
  'energize-5-walk': 'Move it into the body: a walk',
  'energize-5-list': "Five minutes of tomorrow's list at bedtime",
  'fight-1-always': 'Swap "always" and "never" for the one event',
  'fight-1-mood': 'Is this the mood talking?',
  'fight-2-stop': 'Stop, step back, notice, then go on',
  'fight-2-cold': 'Cold water on your face, unless you have a heart condition',
  'fight-3-walk': 'Walk, music, a shower, slow breathing',
  'fight-3-none': 'No texts, no venting, not yet.',
  'fight-4-cold': "If you went cold, that's flooding too: the same twenty minutes, and gentle movement",
  'whatif-3-wake': 'Same wake time tomorrow',
  'replay-3-album': 'An album',
};

/** Rows that become a card that does something: Messages (person) and the phone's Calendar. */
export const WALK_HELPERS: Record<string, TipHelper> = {
  'depress-2-person': 'person',
  'shutdown-3-voice': 'person',
  'depress-1-look': 'calendar',
  'depress-6-calendar': 'calendar',
};
