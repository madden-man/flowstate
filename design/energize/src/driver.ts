// The Energize walkthrough's driver. Unlike design/motion's (one app driven from step to step), walk.js loads this
// app afresh for every step, as app.html?step=<id>&light=<light>&n=<load>, so a step always starts from its own state
// and going Previous or Next never shows what the last step or a tap left behind. Before the first render setUp()
// writes the step's state through the app's own model (the light, a ride named by Spark it) and puts the route in the
// hash; once the page has drawn it posts { ready, n }. walk.js then shows this load and posts { act }: the step's taps
// are made on the real page (the card, the deck row, Deal me one, "+ fixation"), so the sheet rises, the row travels
// and the ring goes out as they do in the app. { light } relights it in place. Every tap of his own still answers.
import { saveSettings, settings } from '../../../src/ui/settings';
import { enterStill, leaveStill, still } from '../../../src/ui/light';
import { moveDot } from '../../../src/model/flows';
import { spark } from '../../../src/model/fixations';

export type Light = 'day' | 'night' | 'still';
export type Step = 'page' | 'tap' | 'swap' | 'deal' | 'add' | 'ride' | 'stuck' | 'list' | 'still';

/** Each step's light as designed (the relight control's first choice). */
export const DESIGNED: Record<Step, Light> = {
  page: 'day', tap: 'day', swap: 'day', deal: 'night', add: 'day', ride: 'day', stuck: 'day', list: 'day', still: 'still',
};

/** Each step's route. */
const ROUTE: Record<Step, string> = {
  page: '/flow/energize', tap: '/flow/energize', swap: '/flow/energize', deal: '/flow/energize', add: '/flow/energize',
  ride: '/flow/energize/3', stuck: '/flow/energize/stuck', list: '/flow', still: '/flow/energize',
};

/** What the page must show before the load reports ready. */
const DRAWN: Record<Step, string> = {
  page: '[data-fx-slot="2"]', tap: '[data-fx-slot="2"]', swap: '[data-fx-slot="2"]', deal: '[data-fx-slot="2"]', add: '[data-fx-slot="2"]',
  ride: '.fx-ride', stuck: '.fx-rib', list: '.fl-flow', still: '[data-fx-slot="2"]',
};

/** The name "+ fixation" is given in the add step: example data, typed into the real field. */
export const NEW_NAME = 'Darts';

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

/** The step's state, before the first render: the light, the ride, the route. */
export async function setUp(): Promise<void> {
  if (!step) return;
  await light(asLight(q.get('light')) ?? DESIGNED[step]);
  if (step === 'ride') {
    // Spark it on East Winds (the dot on Spark, the ride named), then the dot on through Build to Locked in
    const s = await spark('fx-east-winds');
    if (s) await moveDot('energize', ['energize-2'], 'energize-3');
  }
  const hash = `#${ROUTE[step]}`;
  try { history.replaceState(null, '', hash); } catch { location.hash = hash; }
}

/** Opens the deck sheet on the third card, Japan Trip, as a tap does; resolves once the sheet is up. */
async function openDeck(): Promise<boolean> {
  const card = await seen<HTMLElement>('[data-fx-slot="2"]');
  if (!card) return false;
  card.click();
  const row = await seen('.fx-sheet .fx-deckrow');
  // the sheet's rise is --t-page; let it settle before the next tap
  await wait(700);
  return !!row;
}

/** Types into a field as a thumb would, one letter at a time, through the field's own input event. */
async function type(input: HTMLInputElement, text: string): Promise<void> {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  for (let k = 1; k <= text.length; k++) {
    set.call(input, text.slice(0, k));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(110);
  }
}

let acted = false;
/** The step's taps, made once the page is shown. */
async function act(): Promise<void> {
  if (acted || !step) return;
  acted = true;
  switch (step) {
    case 'tap':
      await wait(450);
      await openDeck();
      return;
    case 'swap': {
      await wait(450);
      if (!(await openDeck())) return;
      document.querySelector<HTMLElement>('.fx-sheet .fx-deckrow[data-fx="fx-jazz-piano"]')?.click();
      return;
    }
    case 'deal':
      await wait(450);
      if (!(await openDeck())) return;
      document.querySelector<HTMLElement>('.fx-sheet [data-deal]')?.click();
      return;
    case 'add': {
      await wait(450);
      if (!(await openDeck())) return;
      document.querySelector<HTMLElement>('.fx-sheet .fx-acts .add')?.click();
      const input = await seen<HTMLInputElement>('.fx-sheet .fx-new input');
      if (!input) return;
      await wait(500);
      await type(input, NEW_NAME);
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
  if (step) await seen(DRAWN[step]);
  await frames();
  post({ ready: true, step });
}
