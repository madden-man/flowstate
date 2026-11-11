import { openDB, type FlowDB } from '../../src/db/schema';
import { init } from '../../src/db/fields';

let n = 0;
/** A fresh, empty database for each test, with the fields layer pointed at it. */
export async function freshDB(): Promise<FlowDB> {
  const db = openDB(`flowstate-test-${Date.now()}-${n++}`);
  await db.open();
  await init(db);
  return db;
}

/** The notebook's two paradoxes and their goals, as a journal from before the values held them (PLAN-VALUES.md C1:
 *  a fresh install seeds values and no paradoxes, so a test of the older Be screens writes them itself). */
export async function writeSeedParadoxes(): Promise<void> {
  const { seedParadoxes } = await import('../../src/db/seed');
  const { store } = await import('../../src/db/fields');
  const { paradoxes, items } = seedParadoxes();
  await store.many({ paradoxes, items });
}
