// What a "Said for it" row draws from a confirmed line, kept pure so it can be tested (PLAN-VALUES.md section 3 step 10,
// C5): where it leads, its day in the notebook's print, its words on one line, its voice's rule, and the shadow's word
// when the line was spoken for the shadow. No number is drawn anywhere (rule 15).
import type { Value, Voice } from '../../db/schema';
import type { Said } from '../../model/values';
import { notebookDate } from '../date';
import { voiceColour } from '../voice';
import { hrefOf } from '../journal/href';

/** How many lines show before "Earlier". */
export const SAID_SHOWN = 5;

export type SaidRow = {
  id: string;
  href: string;
  date: string;
  text: string;
  /** The speaking voice's colour; absent for plain ink (the rule stays ink). */
  colour?: string;
  deep: boolean;
  /** The shadow's word, for a line spoken for the shadow. */
  shadow?: string;
};

export function saidRow(s: Said, value: Pick<Value, 'shadow'>, voices: Map<string, Pick<Voice, 'colour' | 'shade'>>): SaidRow {
  const v = s.message.voiceId ? voices.get(s.message.voiceId) : undefined;
  return {
    id: s.message.id,
    href: hrefOf({ id: s.pageId, kind: s.kind }),
    date: notebookDate(new Date(s.message.at)),
    text: s.message.text.replace(/\s+/g, ' ').trim(),
    colour: v ? voiceColour(v.colour, v.shade) : undefined,
    deep: v?.shade === 'deep',
    shadow: s.side === 'shadow' ? value.shadow || undefined : undefined,
  };
}
