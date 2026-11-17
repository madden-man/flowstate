// The tiers walkthrough's driver, the shape of design/values's: walk.js loads this app afresh for every step, as
// app.html?step=<id>&light=<light>&n=<load>, so a step always starts from its own state. Before the first render
// setUp() sorts the list for the steps after the sort (./seed), pins the light and puts the route in the hash; once the
// page has drawn it posts { ready, n }. walk.js then shows this load and posts { act }: the step's touches are made on
// the real page (./touch): the lifted steps a long press on the row's word, then a carry to the landing rule, the
// heading or, for Resting and Legacy, which stay folded under a lift (PLAN-FOLDS.md G2), onto the place's folded line,
// and no pointerup, so the row is held there. { light } relights it in place.
import { saveSettings, settings } from '../../../src/ui/settings';
import { enterStill, leaveStill, still } from '../../../src/ui/light';
import { byWord, letGo, sortTiers } from './seed';
import { frames, headingOf, pose, seen, tap, wait } from './touch';

export type Light = 'day' | 'night' | 'still';
export type Step = 'start' | 'lift' | 'cross' | 'sorted' | 'tap' | 'rest' | 'letgo' | 'legacy' | 'still';

/** Each step's light as designed (the relight control's first choice). */
export const DESIGNED: Record<Step, Light> = {
  start: 'day', lift: 'day', cross: 'day', sorted: 'day', tap: 'day', rest: 'day', letgo: 'day', legacy: 'day', still: 'still',
};

/** The steps drawn from the sorted list (honesty and courage in First, craft in Third). */
const SORTED: Step[] = ['sorted', 'tap', 'rest', 'letgo', 'legacy', 'still'];

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

/** The step's state, before the first render: the list as sorted, the light, the route. */
export async function setUp(): Promise<void> {
  if (!step) return;
  // the breath before the page belongs to a cold open, not to every step
  try { sessionStorage.setItem('fs-threshold', String(Date.now())); } catch { /* the fakes always have it */ }
  if (SORTED.includes(step)) await sortTiers();
  if (step === 'legacy') await letGo();
  ids = await byWord();
  await light(asLight(q.get('light')) ?? DESIGNED[step]);
  const route = step === 'tap' ? `/be/${ids.honesty}` : '/be';
  const hash = `#${route}`;
  try { history.replaceState(null, '', hash); } catch { location.hash = hash; }
}

const rowOf = (word: string) => document.getElementById(`be-${ids[word]}`);

let acted = false;
/** The step's touches, made once the page is shown. */
async function act(): Promise<void> {
  if (acted || !step) return;
  acted = true;
  await seen('.fs-be-row');
  switch (step) {
    case 'lift': {
      // presence is open, so the lift folds it
      await wait(400);
      const b = rowOf('presence')?.querySelector('.fs-dichotomy');
      tap(b);
      await wait(1100);
      await pose(rowOf('honesty'));
      return;
    }
    case 'cross': await wait(500); await pose(rowOf('honesty'), '1'); return;
    case 'rest': await wait(500); await pose(rowOf('craft'), 'resting'); return;
    case 'letgo': await wait(500); await pose(rowOf('patience'), 'legacy'); return;
    case 'legacy': {
      await wait(450);
      // Legacy starts folded: a tap on its heading opens it, and the list is taken to its foot
      tap(headingOf('legacy'));
      await wait(350);
      const sc = document.querySelector<HTMLElement>('.fs-values');
      sc?.scrollTo({ top: sc.scrollHeight, behavior: 'smooth' });
      return;
    }
    default:
      return;
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
  if (step) await seen(step === 'tap' ? '.fs-value-body' : '.fs-be-row');
  await frames();
  post({ ready: true, step });
}
