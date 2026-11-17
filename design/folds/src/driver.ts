// The folds walkthrough's driver (PLAN-FOLDS.md G3), the shape of design/tiers's: walk.js loads this app afresh for
// every step, as app.html?step=<id>&light=<light>&n=<load>, so a step always starts from its own state. Before the
// first render setUp() keeps the folds the step begins with (./seed keepFolds, the app's own Settings.beFolded), pins
// the light and puts the route in the hash; once the page has drawn it posts { ready, n }. walk.js then shows this load
// and posts { act }: the step's taps are made on the real page, the folds by taps on the headings, the lifts by touch
// pointer events (design/tiers/src/touch): a long press on craft's word and a carry, with no pointerup (held) for lift,
// cross and into, and a pointerup for landed. { light } relights it in place.
import { saveSettings, settings } from '../../../src/ui/settings';
import { enterStill, leaveStill, still } from '../../../src/ui/light';
import type { BePlaceKey } from '../../../src/db/schema';
import { byWord, keepFolds } from './seed';
import { drop, frames, headingOf, pose, seen, tap, wait } from '../../tiers/src/touch';

export type Light = 'day' | 'night' | 'still';
export type Step = 'places' | 'fold' | 'glance' | 'lift' | 'cross' | 'into' | 'landed' | 'open' | 'shelves' | 'still';

/** Each step's light as designed (the relight control's first choice). */
export const DESIGNED: Record<Step, Light> = {
  places: 'day', fold: 'day', glance: 'day', lift: 'day', cross: 'day', into: 'day', landed: 'day', open: 'day', shelves: 'night', still: 'still',
};

/** The places each step begins folded (the rest at their defaults: tiers open, Resting and Legacy folded). */
const FOLDED: Record<Step, Partial<Record<BePlaceKey, boolean>>> = {
  places: {}, fold: {}, glance: { 2: true },
  lift: { 2: true }, cross: { 2: true }, into: { 2: true }, landed: { 2: true },
  open: { 2: true, 3: true },
  shelves: { 1: true, 2: true, 3: true },
  // Still shows First's words even with First folded (rule 13)
  still: { 1: true },
};

const q = new URLSearchParams(location.search);
const step: Step | undefined = (q.get('step') ?? '') in DESIGNED ? (q.get('step') as Step) : undefined;
const load = q.get('n') ?? '';
const asLight = (l: string | null | undefined): Light | undefined => (l === 'day' || l === 'night' || l === 'still' ? l : undefined);

async function light(l: Light): Promise<void> {
  const pin = l === 'still' ? 'night' : l;
  if (settings.peek().light !== pin) await saveSettings({ light: pin });
  if (l === 'still') enterStill();
  else if (still.peek()) leaveStill();
}

let ids: Record<string, string> = {};

/** The step's state, before the first render: the folds it begins with, the light, the route. */
export async function setUp(): Promise<void> {
  if (!step) return;
  // the breath before the page belongs to a cold open, not to every step
  try { sessionStorage.setItem('fs-threshold', String(Date.now())); } catch { /* the fakes always have it */ }
  await keepFolds(FOLDED[step]);
  ids = await byWord();
  await light(asLight(q.get('light')) ?? DESIGNED[step]);
  try { history.replaceState(null, '', '#/be'); } catch { location.hash = '#/be'; }
}

const rowOf = (word: string) => document.getElementById(`be-${ids[word]}`);
/** What the step's page has drawn once it is up: Still has no headings, the shelves step no rows. */
const drawnMark = () => (step === 'still' ? '.fs-be-row' : '.fs-be-head');

let acted = false;
/** The step's taps and touches, made once the page is shown. */
async function act(): Promise<void> {
  if (acted || !step) return;
  acted = true;
  await seen(drawnMark());
  switch (step) {
    case 'fold': await wait(500); tap(headingOf('2')); return;
    case 'glance': await wait(450); tap(headingOf('1')); await wait(250); tap(headingOf('3')); return;
    case 'lift': await wait(500); await pose(rowOf('craft')); return;
    // into the gap under honesty: First's second row
    case 'cross': await wait(500); await pose(rowOf('craft'), rowOf('honesty') ?? undefined); return;
    case 'into': await wait(500); await pose(rowOf('craft'), '2'); return;
    case 'landed': {
      await wait(400);
      const hold = await pose(rowOf('craft'), '2');
      await wait(250);
      if (hold) await drop(hold);
      return;
    }
    case 'open': await wait(500); tap(rowOf('honesty')?.querySelector('.fs-dichotomy')); return;
    case 'shelves': await wait(450); tap(headingOf('resting')); await wait(250); tap(headingOf('legacy')); return;
    default: return;
  }
}

const post = (msg: object) => { try { parent.postMessage({ fs: true, n: load, ...msg }, '*'); } catch { /* no parent */ } };

export function startDriver(): void {
  addEventListener('message', e => {
    if (e.source !== parent || !e.data || typeof e.data !== 'object' || !e.data.fs) return;
    const d = e.data as { act?: boolean; light?: Light | 'design' };
    if (d.light && step) {
      const l = d.light === 'design' ? DESIGNED[step] : asLight(d.light);
      if (l) void light(l).then(() => post({ lit: l }));
    }
    if (d.act) {
      void act().then(() => post({ acted: step }), err => { console.warn('walkthrough: could not act', step, err); post({ acted: step, failed: true }); });
    }
  });
}

/** Posts ready once the app has drawn the step's page and two frames have passed. */
export async function whenDrawn(): Promise<void> {
  for (let k = 0; k < 200 && !document.querySelector('.fs-app'); k++) await wait(25);
  if (step) await seen(drawnMark());
  await frames();
  post({ ready: true, step });
}
