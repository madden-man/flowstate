// The door's state in this load (PLAN-FLOWS.md 3.7, F5). Through the door nothing is written: a tap on a Right now
// line, a tap on a step word or a drag of the dot only moves the dot held here. The PIN, asked by the moon or the
// Flow word in the header, writes it: the step he is on becomes a mark (the first mark of a new episode, or the
// next of the live one). Then the word he tapped does what it says: the moon settles into Still, Flow opens the list.
// Meditate S3: #/flow/meditate passes too, and a sit of a minute or more ended there is held here like the dot; the
// PIN writes it.
import { signal } from '@preact/signals';
import { moveDot } from '../../model/flows';
import { keepSit, type SitFrom } from '../../model/sits';
import type { Sit } from '../../db/schema';
import { settle } from '../still';
import { tick } from '../parts/Haptic';

/** Where the dot was put through the door, not written yet. */
export const doorDot = signal<{ flowId: string; stepId: string } | null>(null);

/** The sits of a minute or more ended while the journal was locked (Meditate S3), oldest first, not written yet; one
 *  sent from a flow's tip keeps where from, so the PIN ticks the tip too. */
export const doorSits = signal<{ sit: Sit; from?: SitFrom }[]>([]);

/** What asked for the PIN (the keypad's sheet is up while this is set), and so what happens once it opens. */
export type DoorAsk = 'still' | 'flow';
export const doorAsking = signal<DoorAsk | null>(null);

export function askPin(then: DoorAsk): void {
  tick('sheet');
  doorAsking.value = then;
}

/** The PIN has opened the journal: write the dot and the held sits, then do what the tapped word means. Returns
 *  whether it wrote. */
export async function afterUnlock(route: (to: string) => void): Promise<boolean> {
  const dot = doorDot.value;
  const then = doorAsking.value;
  const sits = doorSits.value;
  doorDot.value = null;
  doorAsking.value = null;
  doorSits.value = [];
  if (dot) await moveDot(dot.flowId, [], dot.stepId);
  for (const { sit, from } of sits) await keepSit(sit, from);
  if (then === 'still') settle();
  if (then === 'flow') route('/flow');
  return !!dot || sits.length > 0;
}
