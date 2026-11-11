// The app's own seed passes, run before the first render so the mountain has its eight flows under their signs, the
// picks, the fixations and the doctor line from the first frame (as design/energize/src/seed.ts does). No readings are
// seeded here: each step writes its own (driver.ts), so a step's meter and gates are exactly what its sentence names.
// No PIN: the journal is open, and nothing is kept past the page (design/motion/src/fakes.ts).
import { moveDoctorLineOnce, seedFixationsOnce, seedFlowsOnce, seedPicksOnce } from '../../../src/db/seed';

export async function seedDemo(): Promise<void> {
  await seedFlowsOnce();
  await seedPicksOnce();
  await seedFixationsOnce();
  await moveDoctorLineOnce();
}
