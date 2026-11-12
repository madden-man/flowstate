// The tiers walkthrough's driver, the shape of design/values's: walk.js loads this app afresh for every step, as
// app.html?step=<id>&light=<light>&n=<load>, so a step always starts from its own state. Before the first render
// setUp() sorts the list for the steps after the sort (./seed), pins the light and puts the route in the hash; once the
// page has drawn it posts { ready, n }. walk.js then shows this load and posts { act }: the step's touches are made on
// the real page. The lifted steps are driven as test/e2e/be-drag.spec.ts drives the drag, with touch pointer events
// dispatched where a thumb would be: a long press on the row's word, then a carry in short moves to the landing rule
// or heading, and no pointerup, so the row is held there. While a row is held the page takes no touch of its own
// (a stray mouse over the phone would move it); every other step still answers. { light } relights it in place.
import { saveSettings, settings } from '../../../src/ui/settings';
import { enterStill, leaveStill, still } from '../../../src/ui/light';
import { byWord, letGo, sortTiers } from './seed';

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

const frames = (n = 2) => new Promise<void>(r => { const f = (k: number) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); });
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
async function seen<T extends Element>(sel: string, ms = 4000): Promise<T | null> {
  for (const until = performance.now() + ms; performance.now() < until; await wait(25)) {
    const el = document.querySelector<T>(sel);
    if (el) return el;
  }
  return null;
}

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
const lifted = () => document.querySelector<HTMLElement>('.fs-values .fs-be-row.lift');

/** A tap where a thumb would put it: the middle of the element, as a click the app's own handlers read. */
function tap(el: Element): void {
  const r = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
}

/** One touch pointer event at (x, y), on whatever is under it, a frame after the last (be-drag.spec.ts's fire). */
async function fire(type: string, x: number, y: number): Promise<void> {
  const el = document.elementFromPoint(x, y) ?? document.body;
  el.dispatchEvent(new PointerEvent(type, { pointerId: 11, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
  await frames(1);
}

/** While a row is held the page takes no touch of its own: a real pointer (trusted) stops at the window. */
function holdThePose(): void {
  const stop = (e: Event) => { if (e.isTrusted) { e.stopImmediatePropagation(); e.preventDefault(); } };
  for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'click', 'contextmenu', 'touchstart', 'touchmove', 'touchend', 'wheel']) {
    addEventListener(t, stop, { capture: true, passive: false });
  }
}

type Hold = { x: number; y: number; grab: number; h: number };
/** A long press on a row's word, held until it lifts. */
async function lift(word: string): Promise<Hold | null> {
  const w = rowOf(word)?.querySelector('.fs-dichotomy');
  if (!w) return null;
  w.scrollIntoView({ block: 'nearest' });
  await frames(2);
  const b = w.getBoundingClientRect();
  const x = b.left + b.width / 3, y = b.top + b.height / 2;
  await fire('pointerdown', x, y);
  for (let k = 0; k < 60 && !lifted(); k++) await wait(25);
  const r = lifted()?.getBoundingClientRect();
  if (!r) return null;
  await frames(3);
  const r2 = lifted()!.getBoundingClientRect();
  return { x, y, grab: y - r2.top, h: r.height };
}

/** Carries the held row in short moves until its top edge is just past the middle of `to`, measured as if the row
 *  were not in the list (a slot below it sits a row higher once it is taken out), as be-drag.spec.ts's carry. */
async function carry(hold: Hold, to: Element): Promise<void> {
  const t = to.getBoundingClientRect(), r = lifted()!.getBoundingClientRect();
  const below = t.top >= r.bottom - 1;
  const top = t.top - (below ? hold.h : 0) + t.height / 2 + 3;
  const y = top + hold.grab;
  const steps = 16;
  const from = hold.y;
  for (let i = 1; i <= steps; i++) { await fire('pointermove', hold.x, from + ((y - from) * i) / steps); await wait(16); }
  hold.y = y;
}

const list = () => document.querySelector<HTMLElement>('.fs-values');
const landOf = (place: string) => document.querySelector(`.fs-values [data-land="${place}"]`);

/** Until the list has not scrolled for a few frames (the edge scroll runs while the finger sits near an edge). */
async function scrollSettles(): Promise<void> {
  const sc = list();
  if (!sc) return;
  let last = sc.scrollTop, still = 0;
  for (let k = 0; k < 400 && still < 8; k++) { await frames(1); still = sc.scrollTop === last ? still + 1 : 0; last = sc.scrollTop; }
}

/** Lifts a row and carries it to a landing rule (or holds it where it lifted), and leaves it held there. The list is
 *  first scrolled so the rule sits mid-list, as a thumb would scroll before it reached for it, so the finger comes to
 *  rest outside the edge bands where it can; where it cannot (Legacy is the foot), the list is at its end and stops. */
async function pose(word: string, place?: string): Promise<void> {
  holdThePose();
  const hold = await lift(word);
  const sc = list();
  if (!hold || !place || !sc) return;
  const first = landOf(place);
  if (!first) return;
  const lr = sc.getBoundingClientRect(), t = first.getBoundingClientRect();
  sc.scrollTop += (t.top + t.bottom) / 2 - (lr.top + lr.bottom) / 2;
  // the finger has not moved: the row is drawn where it now is in the list
  await fire('pointermove', hold.x, hold.y);
  for (let k = 0; k < 4; k++) {
    const target = landOf(place);
    if (!target) return;
    await carry(hold, target);
    await scrollSettles();
    if (lifted()?.dataset.place === place) return;
  }
}

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
      if (b) tap(b);
      await wait(1100);
      await pose('honesty');
      return;
    }
    case 'cross': await wait(500); await pose('honesty', '1'); return;
    case 'rest': await wait(500); await pose('craft', 'resting'); return;
    case 'letgo': await wait(500); await pose('patience', 'legacy'); return;
    case 'legacy': {
      await wait(450);
      const b = document.querySelector<HTMLElement>('.fs-be-shelf[data-shelf="legacy"] button');
      if (b) tap(b);
      await wait(350);
      list()?.scrollTo({ top: list()!.scrollHeight, behavior: 'smooth' });
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
