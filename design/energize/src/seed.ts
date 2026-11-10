// Example data for the Energize walkthrough, on top of the app's own seed (the paradoxes, the voices and the nine
// flows from ensureSeeded): the passes the app runs once the journal is open (the flows, the picks, the fixations,
// the doctor line) are run here first, so the first render already has the three and the deck, and then a little
// history is written through the app's store (the fields layer, never Dexie directly) so What stuck has ribbons:
// Conduit on from 8 / 1 to 10 / 20, Jazz piano 9 / 5 to 9 / 26 and 10 / 10 to 10 / 22, Learning Chinese 8 / 10 to
// 8 / 24. The three stay as seeded: FlowState since 11 / 7, East Winds since 8 / 20, Japan Trip since 10 / 28. No
// PIN: the journal is open, and nothing is kept past the page (design/motion/src/fakes.ts).
import { store } from '../../../src/db/fields';
import { moveDoctorLineOnce, seedFixationsOnce, seedFlowsOnce, seedPicksOnce } from '../../../src/db/seed';
import type { Fixation, Stint } from '../../../src/db/schema';

const day = (m: number, d: number) => new Date(2026, m - 1, d).getTime();

/** The past stints, by fixation id: each one closed, in the slot it sat in. */
const PAST: Record<string, Stint[]> = {
  'fx-conduit': [{ from: day(8, 1), to: day(10, 20), slot: 0 }],
  'fx-learning-chinese': [{ from: day(8, 10), to: day(8, 24), slot: 2 }],
  'fx-jazz-piano': [{ from: day(9, 5), to: day(9, 26), slot: 2 }, { from: day(10, 10), to: day(10, 22), slot: 2 }],
};

/** East Winds' Next line: his own words in the app, example data here. */
export const EAST_WINDS_NEXT = 'The harbour scene in chapter 9';

export async function seedDemo(): Promise<void> {
  await seedFlowsOnce();
  await seedPicksOnce();
  await seedFixationsOnce();
  await moveDoctorLineOnce();
  const rows: Fixation[] = [];
  for (const [id, stints] of Object.entries(PAST)) {
    const f = await store.get('fixations', id);
    if (!f || f.locked || f.stints.length) continue;
    rows.push({ ...f, createdAt: stints[0].from, stints, updatedAt: stints.at(-1)!.to });
  }
  const east = await store.get('fixations', 'fx-east-winds');
  if (east && !east.locked) rows.push({ ...east, next: EAST_WINDS_NEXT });
  await store.many({ fixations: rows });
}
