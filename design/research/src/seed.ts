// Example data for the Research walkthrough, written through the app's own model (src/research/store.ts and run.ts),
// never Dexie directly. On top of the app's own first-run seed (the voices, the values, the flows): the key pasted in
// Settings (example data: "Ends in 0000"), and the two recorded questions asked and run to their end by the app's own
// run, at once, before the first render. "Does expressive writing help mental health?" is asked this morning (three
// journal papers on +, one on −, one ruled neither and lifted); "Does writing about a loss lower grief?" last night
// (nothing found for +, a preprint on −). No PIN: the journal is open, and nothing is kept past the page.
import { saveResearchKey } from '../../../src/research/store';
import { ask, startRun } from '../../../src/research/run';
import { loadSettings } from '../../../src/ui/settings';
import type { Inquiry } from '../../../src/research/types';
import { LOWER, WRITING } from './recorded';

/** The key typed into Settings in the key step, and saved for every step after it. Example data. */
export const KEY = 'sk-ant-example-0000';

const at = (m: number, d: number, h: number, min = 0) => new Date(2026, m - 1, d, h, min).getTime();

export async function pasteKey(): Promise<void> {
  await saveResearchKey(KEY);
  await loadSettings();
}

/** A question asked and run to its end on its recording (the recorded port answers at once while pace is 0). */
async function asked(question: string, when: number): Promise<Inquiry> {
  const q = await ask(question, when);
  await startRun(q);
  return q;
}

export const askWriting = (when = at(11, 13, 9, 12)) => asked(WRITING.question, when);
export const askLower = () => asked(LOWER.question, at(11, 12, 21, 50));
/** The writing question asked and not yet run: its page begins the run itself. */
export const newWriting = () => ask(WRITING.question, at(11, 13, 9, 12));
