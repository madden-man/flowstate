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
