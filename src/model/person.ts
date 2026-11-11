// The one person he chose once (PLAN-TASKS.md T4, section 3: Send, Call and Reach go to "a person he chose once"). The
// person is the one the flows already keep: the person tip "One person, written when calm" (Panic's, PLAN-FLOWS.md F6),
// else the first person tip with a name on any flow. Choosing one from a sign writes it there, so he chooses once for
// the whole app. Sealed with the step (fields.ts); a locked journal has no person to give.
import type { Read } from '../db/fields';
import { store } from '../db/fields';
import type { Flow } from '../db/schema';
import { cleanPerson, fillTime, savePerson, smsHref, type Person } from './carried';

/** Where a person is kept: the tip that holds it. */
type Slot = { flowId: string; stepId: string; tipId: string; person?: Person };

/** The person slots in the flows, the first one his: Panic's "One person" first, then the rest in flow order. */
async function slots(): Promise<Slot[]> {
  const flows = (await store.all('flows')).filter((f): f is Read<Flow> => !f.locked)
    .sort((a, b) => (a.id === 'panic' ? -1 : b.id === 'panic' ? 1 : a.order - b.order));
  return flows.flatMap(f => f.steps.flatMap(s => s.tips
    .filter(t => t.helper === 'person' && !t.struck)
    .map(t => ({ flowId: f.id, stepId: s.id, tipId: t.id, person: t.person }))));
}

const named = (p?: Person): p is Person => !!p?.name.trim();

/** The person he chose once, or undefined (none named yet, or a locked journal). */
export async function chosenPerson(): Promise<Person | undefined> {
  return (await slots()).map(s => s.person).find(named);
}

/** Keeps the person chosen in the sheet: on the slot already holding his person, else the first. Returns it cleaned;
 *  a person with no name keeps nothing. */
export async function choosePerson(p: Person): Promise<Person | undefined> {
  const person = cleanPerson(p);
  if (!person.name) return undefined;
  const all = await slots();
  const slot = all.find(s => named(s.person)) ?? all[0];
  if (slot) await savePerson(slot.flowId, slot.stepId, slot.tipId, person);
  return person;
}

/** Messages to the person, his own words written when calm in the body ({time} filled as the person row fills it). */
export const reachHref = (p: Person, now = Date.now()) => smsHref(p.tel, fillTime(p.text, undefined, now));
