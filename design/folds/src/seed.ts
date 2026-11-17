// Example data for the folds walkthrough (PLAN-FOLDS.md G3): the tiers walkthrough's (design/tiers/src/seed.ts), sorted
// as he left it on 11 / 12: honesty and courage in First, presence and patience in Second, craft in Third, play
// resting, perfection in Legacy. A step's folds before its taps are kept through the app's own settings
// (Settings.beFolded, PLAN-FOLDS.md section 4), as a tap on a heading keeps them.
import { saveSettings } from '../../../src/ui/settings';
import type { BePlaceKey } from '../../../src/db/schema';
import { seedDemo as seedTiers, sortTiers } from '../../tiers/src/seed';

export { byWord } from '../../tiers/src/seed';

export async function seedDemo(): Promise<void> {
  await seedTiers();
  await sortTiers();
}

/** The places folded before the step begins; every other place at its default (the tiers open, the shelves folded). */
export async function keepFolds(folded: Partial<Record<BePlaceKey, boolean>>): Promise<void> {
  if (Object.keys(folded).length) await saveSettings({ beFolded: folded });
}
