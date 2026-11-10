// The picks (PLAN-PICKS.md section 3, P0): what the On row offers at the fifteen steps that ask for something on.
// Plain data, one const per flow, every title one Tommy rated, liked, listed, owns or put on a playlist himself.
// A pick is a title and its kind, nothing more: no darts note is seeded, stored or shown (Tommy, 2026-11-10). Albums
// carry their Spotify album id, so a cover plays from the cover cache the ♪ grid fills; nothing here is fetched.
// Why each title is on its step, the bench and what was kept off live in the plan only, never in the app.
//
// The On row itself is in the flow's seed file (its helper is 'on'); this file gives its step the picks and the one
// line its sheet prints (onLine). withPicks lays them on a flow's seed; seed.ts seedPicksOnce gives a journal that
// already has the flows the same, once. test/fixtures/picks-titles.json guards every title.
import type { OnPick, PickKind, Step } from '../schema';
import type { FlowSeed } from '../seed-flows';

/** One step's picks: the step, the On row on it (a tip id), the printed line, the picks in their order. */
export type StepPicks = { stepId: string; tipId: string; onLine?: string; picks: OnPick[] };

/** A pick's id: the step, then its title in plain letters ("panic-4" and "New Girl" is "pk-panic-4-new-girl"). */
export const pickId = (stepId: string, title: string) =>
  `pk-${stepId}-${title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

const album = (stepId: string, by: string, title: string, albumId: string): OnPick =>
  ({ id: pickId(stepId, title), kind: 'album', title, by, albumId });
const line = (stepId: string, title: string, kind: Exclude<PickKind, 'album'>): OnPick =>
  ({ id: pickId(stepId, title), kind, title });

// ---------------------------------------------------------------- 3.1 Panic

export const PANIC_PICKS: StepPicks[] = [
  {
    stepId: 'panic-1', tipId: 'panic-1-album', picks: [
      album('panic-1', 'Gia Margaret', 'Romantic Piano', '4TFQoPpiHkSsYDbhfXMqCM'),
      album('panic-1', 'Tom Ashbrook', 'Solitudes', '1Zrfkm3Oc8xhCLGCGmmKev'),
      album('panic-1', 'S. Carey', 'All We Grow', '7hoiuRyh1XBh4YUOB0ZeGx'),
    ],
  },
  {
    stepId: 'panic-4', tipId: 'panic-4-album', picks: [
      album('panic-4', 'Lord Huron', 'Lonesome Dreams', '2ZDjruwuzzzT8JMJRXvLtl'),
      album('panic-4', 'The Head And The Heart', 'The Head and the Heart', '3MhJ8lLj98SPgtiH16ZmXo'),
      album('panic-4', 'Of Monsters and Men', 'My Head Is An Animal (The Cabin Sessions)', '1oQYM3uKcmLBHvdO7vzRLo'),
      line('panic-4', 'New Girl', 'show'),
      line('panic-4', "Ferris Bueller's Day Off", 'film'),
      line('panic-4', 'A Short Hike', 'switch'),
    ],
  },
];

// ---------------------------------------------------------------- 3.2 Depress

export const DEPRESS_PICKS: StepPicks[] = [
  {
    stepId: 'depress-3', tipId: 'depress-3-absorb', picks: [
      album('depress-3', 'Watsky', 'x Infinity', '6CcTNttjHJN3WGR5igg4MR'),
      album('depress-3', 'Logic', 'The Incredible True Story', '5dOpbgAmJeyoakKQ0QLWkR'),
      album('depress-3', 'Lil Dicky', 'Professional Rapper', '7IhHBoBPWlCSrr8DCmP5ot'),
      line('depress-3', 'Celeste', 'switch'),
      line('depress-3', 'Knives Out', 'film'),
      line('depress-3', 'Steins;Gate', 'show'),
    ],
  },
  {
    stepId: 'depress-4', tipId: 'depress-4-music', onLine: 'One that keeps you company, then one that lifts.', picks: [
      album('depress-4', 'Sleeping At Last', 'Atlas: I', '1E9iqjfSf5I5hPNfI1DRIh'),
      album('depress-4', 'Sufjan Stevens', 'Carrie & Lowell', '0U8DeqqKDgIhIiWOdqiQXE'),
      album('depress-4', 'Novo Amor', 'Birthplace', '0tWckYjFI6ioZptLr42J3p'),
    ],
  },
  {
    stepId: 'depress-5', tipId: 'depress-5-walk', onLine: 'One album is about one walk.', picks: [
      album('depress-5', 'The Oh Hellos', 'Through the Deep, Dark Valley', '7cJyN85qjzHZBjeo9LRry8'),
      album('depress-5', 'Lord Huron', 'Strange Trails', '3yoNZlqerJnsnMN5EDwwBS'),
      album('depress-5', 'Passion Pit', 'Gossamer', '14JU5SskmcyckE5I8PY6lv'),
    ],
  },
];

// ---------------------------------------------------------------- 3.3 Energize

export const ENERGIZE_PICKS: StepPicks[] = [
  {
    stepId: 'energize-3', tipId: 'energize-3-on', picks: [
      album('energize-3', 'Tycho', 'Dive', '4CBUbnGFz2iKFJjYqRIwst'),
      album('energize-3', 'Lena Raine', 'Celeste (Original Soundtrack)', '5OZHQ7KG8k04IOkF50fACO'),
      album('energize-3', 'GoGo Penguin', 'v2.0 (Deluxe Edition)', '7rXrjbrYcXG8EkqXpt0weK'),
      line('energize-3', 'Mr. Bean', 'show'),
    ],
  },
  {
    stepId: 'energize-5', tipId: 'energize-5-crash', picks: [
      album('energize-5', 'Jack Johnson', 'In Between Dreams', '7tTc46dNdE6GGuiQsssWxo'),
      album('energize-5', 'Bahamas', 'Bahamas Is Afie', '2UqlVTULRPG2qm8Bico9CK'),
      line('energize-5', "We're the Millers", 'film'),
      line('energize-5', '21 Jump Street', 'film'),
      line('energize-5', 'Letterkenny', 'show'),
    ],
  },
];

// ---------------------------------------------------------------- 3.4 Fight

export const FIGHT_PICKS: StepPicks[] = [
  {
    stepId: 'fight-3', tipId: 'fight-3-on', onLine: 'Five songs is about twenty minutes.', picks: [
      album('fight-3', 'Tycho', 'Awake', '0GjrPTT00KWsalUi8jnpR9'),
      album('fight-3', 'Sigur Rós', 'Takk...', '12tw1A9HmwE3MHvPfHhdoP'),
      album('fight-3', 'Bon Iver', 'Bon Iver, Bon Iver', '2LpfNj3vB5rOXfaawLcOBg'),
    ],
  },
  {
    stepId: 'fight-5', tipId: 'fight-5-distract', picks: [
      line('fight-5', 'Cunk on Earth', 'show'),
      line('fight-5', 'What We Do in the Shadows', 'show'),
      line('fight-5', 'Celeste', 'switch'),
    ],
  },
  {
    stepId: 'fight-6', tipId: 'fight-6-between', picks: [
      line('fight-6', 'KPop Demon Hunters', 'film'),
      line('fight-6', 'The Big Sick', 'film'),
      line('fight-6', 'Spiritfarer', 'switch'),
    ],
  },
];

// ---------------------------------------------------------------- 3.5 What if

export const WHATIF_PICKS: StepPicks[] = [
  {
    stepId: 'whatif-3', tipId: 'whatif-3-on', onLine: 'You know how this one ends.', picks: [
      line('whatif-3', 'Back to the Future', 'film'),
      line('whatif-3', 'Elf', 'film'),
      line('whatif-3', 'Iron Man', 'film'),
    ],
  },
  {
    // Tommy, 2026-11-10: the saved film belongs on the far side of the thing; two lines, no covers, no printed line
    stepId: 'whatif-5', tipId: 'whatif-5-on', picks: [
      line('whatif-5', 'Wake Up Dead Man', 'film'),
      line('whatif-5', 'The Holdovers', 'film'),
    ],
  },
];

// ---------------------------------------------------------------- 3.6 Replay

export const REPLAY_PICKS: StepPicks[] = [
  {
    stepId: 'replay-3', tipId: 'replay-3-absorb', picks: [
      line('replay-3', 'Super Mario Bros.', 'switch'),
      line('replay-3', 'Letterkenny', 'show'),
      line('replay-3', 'Wordle', 'phone'),
    ],
  },
];

// ---------------------------------------------------------------- 3.7 3 a.m.

export const NIGHT_PICKS: StepPicks[] = [
  {
    stepId: 'night-4', tipId: 'night-4-dull', onLine: 'Screens wait for seven.', picks: [
      album('night-4', 'Tom Ashbrook', 'Nocturnes', '6gVzVC5RUQAPJaMcnP9zjI'),
      album('night-4', 'Sigur Rós', 'Ágætis byrjun', '1DMMv1Kmoli3Y9fVEZDUVC'),
      album('night-4', 'Hammock', 'Raising Your Voice... Trying to Stop an Echo', '5oixCadw77lgY0qTWMPm5r'),
    ],
  },
];

// ---------------------------------------------------------------- 3.8 Shutdown

export const SHUTDOWN_PICKS: StepPicks[] = [
  {
    stepId: 'shutdown-4', tipId: 'shutdown-4-album', picks: [
      album('shutdown-4', 'Novo Amor', 'Birthplace', '0tWckYjFI6ioZptLr42J3p'),
      album('shutdown-4', 'S. Carey', 'Hundred Acres', '4H1xbaXxVDmHnFQ5ifzyM4'),
      line('shutdown-4', 'Over the Garden Wall', 'show'),
      line('shutdown-4', 'Frieren: Beyond Journeys End', 'show'),
      line('shutdown-4', 'My Neighbor Totoro', 'film'),
    ],
  },
];

// 3.9 Shame: nothing on at every step (Tommy, 2026-11-10: the empty steps stay empty until he recommends).

/** Every step's picks, flow by flow in the list's order. */
export const PICKS: StepPicks[] = [
  ...PANIC_PICKS, ...DEPRESS_PICKS, ...ENERGIZE_PICKS, ...FIGHT_PICKS, ...WHATIF_PICKS, ...REPLAY_PICKS, ...NIGHT_PICKS, ...SHUTDOWN_PICKS,
];

/** A step with its seed picks laid on, when it has any. */
export function stepWithPicks(step: Step): Step {
  const p = PICKS.find(x => x.stepId === step.id);
  if (!p) return step;
  return { ...step, picks: structuredClone(p.picks), ...(p.onLine ? { onLine: p.onLine } : {}) };
}

/** A flow's seed with each step's picks laid on (the seed files wrap their export in this). */
export const withPicks = (seed: FlowSeed): FlowSeed => ({ ...seed, steps: seed.steps.map(stepWithPicks) });

/** An album pick's Spotify uri, as the albums table keys it. */
export const albumUriOf = (p: Pick<OnPick, 'albumId'>) => (p.albumId ? `spotify:album:${p.albumId}` : undefined);
