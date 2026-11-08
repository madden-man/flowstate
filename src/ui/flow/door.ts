// The door's state in this load (PLAN-FLOWS.md 3.7, F5). Through the door nothing is written: a tap on a Right now
// line, a tap on a step word or a drag of the dot only moves the dot held here. The PIN, asked by the moon or the
// Flow word in the header, writes it: the step he is on becomes a mark (the first mark of a new episode, or the
// next of the live one). Then the word he tapped does what it says: the moon settles into Still, Flow opens the list.
import { signal } from '@preact/signals';
import { moveDot } from '../../model/flows';
import { settle } from '../still';
import { tick } from '../parts/Haptic';

/** Where the dot was put through the door, not written yet. */
export const doorDot = signal<{ flowId: string; stepId: string } | null>(null);

/** What asked for the PIN (the keypad's sheet is up while this is set), and so what happens once it opens. */
export type DoorAsk = 'still' | 'flow';
export const doorAsking = signal<DoorAsk | null>(null);

export function askPin(then: DoorAsk): void {
  tick('sheet');
  doorAsking.value = then;
}

/** The PIN has opened the journal: write the dot, then do what the tapped word means. Returns whether it wrote. */
export async function afterUnlock(route: (to: string) => void): Promise<boolean> {
  const dot = doorDot.value;
  const then = doorAsking.value;
  doorDot.value = null;
  doorAsking.value = null;
  if (dot) await moveDot(dot.flowId, [], dot.stepId);
  if (then === 'still') settle();
  if (then === 'flow') route('/flow');
  return !!dot;
}
