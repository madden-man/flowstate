// Example data for the Be walkthrough, on top of the app's own seed (selfless and selfish, thoughtful (obsessive) and
// reactive, their goals): written through the app's store (the fields layer, never Dexie directly) before the first
// render. Selfless and selfish has his Both line and two Not me lines; thoughtful and reactive has a middle word and
// no Both line, so the creed shows its three words in grey. The Both step starts without the line (it is typed
// there); the held step adds three more held paradoxes, so five are active. No PIN: the journal is open, and nothing
// is kept past the page (design/motion/src/fakes.ts).
import { store } from '../../../src/db/fields';
import type { Paradox } from '../../../src/db/schema';
import type { Step } from './driver';

/** His line for selfless and selfish: example data, typed into the real field in the Both step. */
export const CREED = 'I give, and I keep enough back to give again.';
/** The middle word on thoughtful and reactive. */
export const MIDDLE = 'deliberate';
/** The two refusals under selfless and selfish; the third is typed in the add step. */
export const REFUSED = ["I don't say yes to fill the silence.", "I don't keep score."];
export const THIRD = "I don't answer for someone who has not asked.";

const at = new Date(2026, 10, 9, 21, 30).getTime();

/** Three more held paradoxes for the held step: with the seeded two, five are active. */
const MORE: [string, string, string][] = [
  ['px-steady-spontaneous', 'steady', 'spontaneous'],
  ['px-private-open', 'private', 'open'],
  ['px-proud-humble', 'proud', 'humble'],
];

export async function seedDemo(step?: Step): Promise<void> {
  const rows: Paradox[] = [];
  const selfless = await store.get('paradoxes', 'px-selfless-selfish');
  if (selfless && !selfless.locked) {
    const next: Paradox = { ...selfless, updatedAt: at, refusals: REFUSED.map((text, k) => ({ id: `nm-${k + 1}`, text, at: at + k })) };
    if (step !== 'both') next.creed = CREED;
    delete (next as { locked?: boolean }).locked;
    rows.push(next);
  }
  const thoughtful = await store.get('paradoxes', 'px-thoughtful-reactive');
  if (thoughtful && !thoughtful.locked) {
    const next: Paradox = { ...thoughtful, middle: { word: MIDDLE }, updatedAt: at };
    delete (next as { locked?: boolean }).locked;
    rows.push(next);
  }
  if (step === 'held') {
    MORE.forEach(([id, a, b], k) => rows.push({
      id, createdAt: at + 60_000 * (k + 1), updatedAt: at + 60_000 * (k + 1), status: 'active',
      poleA: { value: a, aspect: '' }, poleB: { value: b, aspect: '' }, revisions: [],
    }));
  }
  await store.many({ paradoxes: rows });
}
