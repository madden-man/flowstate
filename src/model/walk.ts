// The walk (DESIGN.md rule 33): a step's things one at a time, and the flow's short list at rest. No UI, no writes.
import type { Flow, Step, Tip } from '../db/schema';
import { shownTips } from './tips';

/** The shown tips as the walk draws them: the cards, in their order, and the wise lines under the strip. */
export function walkCards(tips: Tip[]): { cards: Tip[]; wise: Tip[] } {
  return { cards: tips.filter(t => !t.wise), wise: tips.filter(t => t.wise) };
}

/** The next card after `from` that is not done, going round once; -1 when every card is done. */
export function nextOpen(cards: Pick<Tip, 'id'>[], isDone: (id: string) => boolean, from: number): number {
  for (let d = 1; d < cards.length; d++) {
    const k = (from + d) % cards.length;
    if (!isDone(cards[k].id)) return k;
  }
  return -1;
}

/** One row of a flow's short list: a step, by its place (from 1), and the first thing its walk offers. */
export type ShortRow = { k: number; stepId: string; name: string; text: string };

/** The whole flow on a few lines, for the page at rest: each step with the first thing to do there, in its short
 *  words where it has them. A step with nothing to do (only a wise line, or nothing) is left out. */
export function shortList(flow: Pick<Flow, 'steps'>): ShortRow[] {
  return flow.steps.flatMap((s: Step, i) => {
    const first = walkCards(shownTips(s, false)).cards[0];
    return first ? [{ k: i + 1, stepId: s.id, name: s.name, text: first.short ?? first.text }] : [];
  });
}
