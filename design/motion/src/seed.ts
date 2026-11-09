// Example data for the walkthrough, written through the app's own model and fields layer (never Dexie directly):
// today's page with the design mocks' lines, two earlier pages, three questions, a council with a few turns, and the
// music account connected through the app's own read of (fixture) Spotify. The paradoxes, their goals and the nine
// flows are the app's own seed (ensureSeeded, seedFlowsOnce), already written by the time this runs.
import { writeLine, askQuestion } from '../../../src/model/pages';
import { newCouncil, seat, speak } from '../../../src/model/council';
import { saveSettings } from '../../../src/ui/settings';
import { readPlaylists } from '../../../src/ui/music/state';
import { seedFlowsOnce } from '../../../src/db/seed';
import { DEMO_TOKENS } from './net';

const DAY = 86_400_000;

async function page(lines: string[], at: number): Promise<void> {
  let line = await writeLine(undefined, undefined, { text: lines[0] }, at);
  for (const [k, text] of lines.slice(1).entries()) line = await writeLine(line?.page, undefined, { text }, at + (k + 1) * 60_000);
}

export async function seedDemo(now = Date.now()): Promise<void> {
  await seedFlowsOnce();
  // two earlier pages, then today's (the lines are the design mocks' own, marked as example data on the page)
  await page(['Wait out the truly hard parts of life. They never last forever.', 'Boiling in my own soup today. Nothing to solve; something to sit through.'], now - 2 * DAY);
  await page(['Colour-coded journaling might give voice to new minds within.'], now - DAY);
  await page([
    '(Example data.)',
    "All this, and I'm reduced to simple journaling. I suppose at the end of the day, it's the simple things that make the most difference. #evergreen",
    "The hard part is naming what's actually bothering me. It isn't the move. It's the quiet after it.",
  ], now - 30 * 60_000);

  await askQuestion('What would the Mystic say to the Skeptic?', now - 3 * DAY);
  await askQuestion('Who are my models?', now - 2 * DAY);
  await askQuestion('How can I gauge my pleasure/pain barometer?', now - DAY);

  const c = await newCouncil({ now: now - DAY });
  for (const v of ['v-mystic', 'v-skeptic', 'v-warrior']) await seat(c.id, v, now - DAY);
  const turns: [string, string][] = [
    ['v-mystic', 'Listen to the quiet voices within, even when you may not agree with them.'],
    ['v-skeptic', 'And which voices are those, exactly? Name one.'],
    ['v-warrior', 'The one that says: stand tall, young one. Then get up.'],
    ['v-mystic', 'That one, yes. It never shouts.'],
  ];
  for (const [k, [voiceId, text]] of turns.entries()) await speak(c.id, text, { voiceId, now: now - DAY + k * 60_000 });

  // connected, as after a sign-in; the app's own first read lists the playlists and ticks the four he named
  await saveSettings({ spotify: { tokens: DEMO_TOKENS, connectedAt: now - DAY } });
  await readPlaylists();
}
