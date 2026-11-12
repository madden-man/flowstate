// Example data for the tiers walkthrough (PLAN-TIERS.md section 3), written through the app's own model, never Dexie
// directly. The fresh install's two values (selfless, thoughtful) are deleted, and seven of his own are made on 11 / 6
// in his order: honesty, courage, presence, patience, craft held (all in Second, as every value is after the update),
// play resting (put down before the tiers came in, so it stays resting) and perfection, held since 8 / 3 and let go to
// Legacy this morning. sortTiers() is the list once he has sorted it (steps 4 on): honesty and courage carried up to
// First, craft down to Third, all this morning; letGo() puts patience in Legacy too (step 8).
import { champion, createValue, deleteValue, held, placeValue, setWhy, tiers } from '../../../src/model/values';
import type { ValueSide } from '../../../src/db/schema';

const at = (m: number, d: number, h: number, min = 0) => new Date(2026, m - 1, d, h, min).getTime();

const VALUES = [
  { word: 'honesty', shadow: 'discretion', looks: 'Saying the true thing while it can still help.' },
  { word: 'courage', shadow: 'safety' },
  { word: 'presence', shadow: 'planning' },
  { word: 'patience', shadow: 'urgency' },
  { word: 'craft', shadow: 'enough' },
  { word: 'play', shadow: 'caution' },
];
const PERFECTION = { word: 'perfection', shadow: 'good enough' };

type Link = [voiceId: string, side: ValueSide, why?: string];
/** Who fights for what, in the order they took it up. */
const CHAMPIONS: Record<string, Link[]> = {
  honesty: [
    ['v-warrior', 'value', 'I say it to their face, and I stay in the room after.'],
    ['v-skeptic', 'value', 'I check it is true before I call it honest.'],
    ['v-mystic', 'shadow', 'Not every true thing is mine to say tonight.'],
  ],
  courage: [['v-warrior', 'value'], ['v-explorer', 'value'], ['v-architect', 'shadow']],
  presence: [['v-mystic', 'value'], ['v-sensualist', 'value']],
  patience: [['v-architect', 'value'], ['v-meaning-maker', 'value'], ['v-warrior', 'shadow']],
  craft: [['v-engineer', 'value'], ['v-architect', 'value']],
  play: [['v-joker', 'value'], ['v-explorer', 'value']],
  perfection: [['v-architect', 'value'], ['v-skeptic', 'value']],
};

/** Every value, held or not, by its word. */
export async function byWord(): Promise<Record<string, string>> {
  const t = await tiers();
  return Object.fromEntries([...t.first, ...t.second, ...t.third, ...t.resting, ...t.legacy].map(v => [v.word, v.id]));
}

export async function seedDemo(): Promise<void> {
  for (const v of await held()) await deleteValue(v.id, at(11, 6, 19));
  const made = at(11, 6, 20);
  for (let k = 0; k < VALUES.length; k++) await createValue(VALUES[k], made + k);
  await createValue(PERFECTION, at(8, 3, 21));
  const ids = await byWord();
  for (const [word, links] of Object.entries(CHAMPIONS)) {
    let k = 0;
    for (const [voiceId, side, why] of links) {
      await champion(ids[word], voiceId, side, made + 10 + ++k);
      if (why) await setWhy(ids[word], voiceId, side, why, made + 10 + k);
    }
  }
  // his order in Second, then play put down before the tiers, and perfection let go this morning
  for (let k = 0; k < 5; k++) await placeValue(ids[VALUES[k].word], 2, k, made + 100 + k);
  await placeValue(ids.play, 'resting', 0, at(11, 9, 22));
  await placeValue(ids.perfection, 'legacy', 0, at(11, 12, 8, 40));
}

/** Sorted this morning: honesty and courage up to First, craft down to Third. */
export async function sortTiers(): Promise<void> {
  const ids = await byWord();
  await placeValue(ids.honesty, 1, 0, at(11, 12, 9, 5));
  await placeValue(ids.courage, 1, 1, at(11, 12, 9, 6));
  await placeValue(ids.craft, 3, 0, at(11, 12, 9, 8));
}

/** Patience let go to Legacy, under perfection. */
export async function letGo(): Promise<void> {
  const ids = await byWord();
  await placeValue(ids.patience, 'legacy', 1, at(11, 12, 9, 20));
}
