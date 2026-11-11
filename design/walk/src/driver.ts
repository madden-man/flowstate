// The walk walkthrough's driver, as design/energize's: walk.js loads this app afresh for every step, as
// app.html?step=<id>&light=<light>&n=<load>, so a step always starts from its own state. Before the first render
// setUp() writes the step's state through the app's own model (the light, the dot on a step) and puts the route in the
// hash; once the page has drawn it posts { ready, n }. walk.js then shows this load and posts { act }: the step's taps
// are made on the real page (a check ticked, Next), so the check is drawn and the strip turns as they do in the app.
// { light } relights it in place. Every tap of his own still answers.
import { saveSettings, settings } from '../../../src/ui/settings';
import { enterStill, leaveStill, still } from '../../../src/ui/light';
import { moveDot } from '../../../src/model/flows';

export type Light = 'day' | 'night' | 'still';
export type Step = 'short' | 'one' | 'done' | 'on' | 'ring' | 'text' | 'calendar' | 'help' | 'still';

/** Each step's light as designed (the relight control's first choice). */
export const DESIGNED: Record<Step, Light> = {
  short: 'day', one: 'day', done: 'day', on: 'night', ring: 'night', text: 'day', calendar: 'day', help: 'night', still: 'still',
};

/** Each step's route. */
const ROUTE: Record<Step, string> = {
  short: '/flow/panic', one: '/flow/panic/1', done: '/flow/panic/4', on: '/flow/panic/4', ring: '/flow/panic/2', text: '/flow/panic/3',
  calendar: '/flow/depress/1', help: '/flow/depress/4', still: '/flow/panic/2',
};

/** The live episode a step opens on: the flow, the steps the dot passed, the step it is on. */
const LIVE: Partial<Record<Step, [flow: string, via: string[], to: string]>> = {
  done: ['panic', ['panic-1', 'panic-2', 'panic-3'], 'panic-4'],
  on: ['panic', ['panic-1', 'panic-2', 'panic-3'], 'panic-4'],
  ring: ['panic', ['panic-1'], 'panic-2'],
  text: ['panic', ['panic-1', 'panic-2'], 'panic-3'],
};

/** What the page must show before the load reports ready. */
const DRAWN: Record<Step, string> = {
  short: '.fl-short-row', one: '.fl-card', done: '.fl-card', on: '.fl-card', ring: '.fl-hold', text: '.fl-card', calendar: '.fl-card', help: '.fl-988', still: '.fl-card',
};

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

/** The step's state, before the first render: the light, the dot, the route. */
export async function setUp(): Promise<void> {
  if (!step) return;
  await light(asLight(q.get('light')) ?? DESIGNED[step]);
  const live = LIVE[step];
  if (live) await moveDot(live[0], live[1], live[2]);
  const hash = `#${ROUTE[step]}`;
  try { history.replaceState(null, '', hash); } catch { location.hash = hash; }
}

/** The card in front once the strip has come to rest on `tip`; Next is tapped until it is. */
async function turnTo(tip: string): Promise<void> {
  for (let k = 0; k < 6; k++) {
    if (document.querySelector(`.fl-card[aria-current="step"][data-tip="${tip}"]`)) return;
    document.querySelector<HTMLElement>('.fl-next .fs-word')?.click();
    await wait(900);
  }
}

let acted = false;
/** The step's taps, made once the page is shown. */
async function act(): Promise<void> {
  if (acted || !step) return;
  acted = true;
  await wait(600);
  switch (step) {
    case 'done':
      // the plain thing ticked: its check is drawn, and the strip turns to the next card by itself
      document.querySelector<HTMLElement>('[data-tip="panic-4-water"] [role="checkbox"]')?.click();
      return;
    case 'on': await turnTo('panic-4-album'); return;
    case 'text': await turnTo('panic-3-person'); return;
    case 'calendar': await turnTo('depress-1-look'); return;
    case 'help': document.querySelector('.fl-988')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return;
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
  if (step) await seen(DRAWN[step]);
  await frames();
  post({ ready: true, step });
}
