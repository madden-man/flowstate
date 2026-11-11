// Into the app (PLAN-TASKS.md T3, sections 2 and 3): the touches that open Journal, Council, Be, Questions or the sea's
// circles from a sign's page, each with what it carries, registered by sign and id (../touch.ts). Each one that leaves
// goes through ../carry.ts leaveFor, so the sign travels with him (printed beside the date where he lands, a tap comes
// back, rule 28) and its done is called when he comes back to the sign, never as he goes (section 5).
//   Crown        Core: Be, on "I determine my core."   Kept line: the day's star, one kept line; a tap opens its page.
//                Sit: Meditate, carrying nothing (sitFrom left empty, as from anywhere but a Sit tip).
//   Third eye    Ask: his line on one rule, then today's page with it asked and the answer rule open in italic.
//                Bring it: his line on one rule, then a new council with it as the first line.   Questions: the ? tab.
//   Throat       A voice: a council with nothing said, the voice chips ready ("Who sits?").
//   Heart        Letter: today's page, opening on "Dear" on its next rule; never sent.
//   Solar plexus Stand on: a held value where it stands on Be, its champions under it.   Spark it: Energize.
//   Sacral       Write from it: his word on one rule, then today's page with it as a line, the next rule ready.
// The app writes no words of its own (Letter's "Dear" is the plan's, unsaved until he writes after it). None of these is
// door: true, so through the door onTouch never reaches them and nothing of his opens there.
import type { ChakraId } from '../../../../model/mountain';
import { registerTouch, type TouchAct, type TouchHandler } from '../touch';
import { leaveFor, pageCarry } from '../carry';
import { askToday, bringIt, letterToday, voiceCouncil, writeFromIt } from '../../../../model/into';
import { FIXATION_FLOW } from '../../../../model/fixations';
import { sitFrom } from '../../Meditate';
import { IntoRule, KeptStar, StandOn } from './intoViews';

/** A touch that carries his line: the rule on the plate, and what is done with the line once he carries it. */
const ruled = (label: string, carry: (a: TouchAct, line: string) => Promise<void>): TouchHandler => ({
  View: (a: TouchAct) => <IntoRule a={a} label={label} carry={line => carry(a, line)} />,
});

export const INTO: readonly { chakra: ChakraId; id: string; handler: TouchHandler }[] = [
  { chakra: 'crown', id: 'core', handler: { act: a => leaveFor(a, '/be') } },
  { chakra: 'crown', id: 'kept-line', handler: { View: KeptStar } },
  { chakra: 'crown', id: 'sit', handler: { act: a => { sitFrom.value = null; leaveFor(a, '/flow/meditate'); } } },
  {
    chakra: 'third-eye', id: 'ask', handler: ruled('Ask', async (a, line) => {
      await askToday(a.chakra, line);
      pageCarry.value = { wise: true };
      leaveFor(a, '/journal');
    }),
  },
  {
    chakra: 'third-eye', id: 'bring-it', handler: ruled('Bring it', async (a, line) => {
      const { page } = await bringIt(a.chakra, line);
      leaveFor(a, `/council/${page.id}`, '/council');
    }),
  },
  { chakra: 'third-eye', id: 'questions', handler: { act: a => leaveFor(a, '/questions') } },
  {
    chakra: 'throat', id: 'a-voice', handler: {
      // a locked journal refuses the write (LockedError): the word stays lit and nothing leaves
      act: a => voiceCouncil(a.chakra).then(page => leaveFor(a, `/council/${page.id}`, '/council'), () => undefined),
    },
  },
  {
    chakra: 'heart', id: 'letter', handler: {
      act: a => letterToday(a.chakra).then(() => { pageCarry.value = { tail: 'Dear ' }; leaveFor(a, '/journal'); }, () => undefined),
    },
  },
  { chakra: 'solar-plexus', id: 'stand-on', handler: { View: StandOn } },
  { chakra: 'solar-plexus', id: 'spark-it', handler: { act: a => leaveFor(a, `/flow/${FIXATION_FLOW}`) } },
  {
    chakra: 'sacral', id: 'write-from-it', handler: ruled('Write from it', async (a, line) => {
      await writeFromIt(a.chakra, line);
      pageCarry.value = null;
      leaveFor(a, '/journal');
    }),
  },
];

for (const { chakra, id, handler } of INTO) registerTouch({ chakra, id }, handler);
