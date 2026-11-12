// Example data for the values walkthrough (PLAN-VALUES.md section 2's word map), on top of the app's own seed (the
// voices, and the two values a fresh install holds: selfless | selfish, thoughtful | reactive). Written through the
// app's own model, never Dexie directly: four more values (honesty | discretion first, then play | caution,
// discipline | rest, wonder | certainty), their champions and whys. The record step adds two earlier councils on
// honesty whose lines were confirmed for it (seedSaid), so "Said for it" shows there and nowhere before it. Wonder
// has no champion on either side, so it carries the dashed rule. No PIN: the journal is open, and nothing is kept past the page (design/motion/src/fakes.ts).
import { champion, createValue, held, placeValue, setWhy, speakFor } from '../../../src/model/values';
import { newCouncil, speak } from '../../../src/model/council';
import type { ValueSide } from '../../../src/db/schema';

const at = (m: number, d: number, h: number, min = 0) => new Date(2026, m - 1, d, h, min).getTime();

/** The values in his order, top to bottom. The first two of the fresh install's keep their ids. */
const NEW = [
  { word: 'honesty', shadow: 'discretion', looks: 'Saying the true thing while it can still help.' },
  { word: 'play', shadow: 'caution' },
  { word: 'discipline', shadow: 'rest' },
  { word: 'wonder', shadow: 'certainty' },
];
export const ORDER = ['honesty', 'selfless', 'thoughtful', 'play', 'discipline', 'wonder'];

type Link = [voiceId: string, side: ValueSide, why?: string];
/** Who fights for what, in the order they took it up. */
const CHAMPIONS: Record<string, Link[]> = {
  honesty: [
    ['v-warrior', 'value', 'I say it to their face, and I stay in the room after.'],
    ['v-skeptic', 'value', 'I check it is true before I call it honest.'],
    ['v-mystic', 'shadow', 'Not every true thing is mine to say tonight.'],
  ],
  selfless: [['v-mystic', 'value'], ['v-meaning-maker', 'value'], ['v-sensualist', 'shadow']],
  thoughtful: [['v-skeptic', 'value'], ['v-architect', 'value'], ['v-warrior', 'shadow']],
  play: [['v-joker', 'value'], ['v-explorer', 'value'], ['v-sensualist', 'value'], ['v-engineer', 'shadow']],
  discipline: [['v-architect', 'value'], ['v-engineer', 'value'], ['v-sensualist', 'shadow']],
  wonder: [],
};

/** Earlier councils on honesty: each line [voiceId, text], the last one confirmed for honesty. */
const EARLIER: { at: number; lines: [string, string][] }[] = [
  { at: at(11, 8, 22, 5), lines: [['v-warrior', 'I want to tell the whole table what I think of it.'], ['v-skeptic', 'Is it honest, or is it only loud?']] },
  { at: at(11, 10, 21, 30), lines: [['v-mystic', 'Write it down first, then decide.'], ['v-warrior', 'Then tell him tonight, not in a letter.']] },
];

/** Every held value by its word. */
export async function byWord(): Promise<Record<string, string>> {
  return Object.fromEntries((await held()).map(v => [v.word, v.id]));
}

export async function seedDemo(): Promise<void> {
  const made = at(11, 6, 20);
  for (const d of NEW) await createValue(d, made);
  const ids = await byWord();
  for (const [word, links] of Object.entries(CHAMPIONS)) {
    let k = 0;
    for (const [voiceId, side, why] of links) {
      await champion(ids[word], voiceId, side, made + ++k);
      if (why) await setWhy(ids[word], voiceId, side, why, made + k);
    }
  }
  // his order: each value moved to its place in Second in turn (every one of them is there)
  const want = ORDER.map(w => ids[w]);
  for (let to = 0; to < want.length; to++) {
    const now = (await held()).map(v => v.id);
    if (now[to] !== want[to]) await placeValue(want[to], 2, to, made + 100 + to);
  }
}

/** The record: the earlier councils on honesty, each with its last line confirmed for honesty. */
export async function seedSaid(): Promise<void> {
  const ids = await byWord();
  for (const c of EARLIER) {
    const page = await newCouncil({ valueId: ids.honesty, now: c.at });
    let last = '';
    for (let k = 0; k < c.lines.length; k++) {
      const [voiceId, text] = c.lines[k];
      last = (await speak(page.id, text, { voiceId, now: c.at + k * 60_000 })).id;
    }
    await speakFor(last, { valueId: ids.honesty, side: 'value' }, c.at + 5 * 60_000);
  }
}
