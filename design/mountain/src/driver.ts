// The mountain walkthrough's driver, on design/energize's pattern: walk.js loads this app afresh for every step, as
// app.html?step=<id>&light=<light>&n=<load>, so a step always starts from its own state. Before the first render
// setUp() writes the step's state through the app's own model (the light, the readings of the meter and the gates, an
// episode on a drawing, a ride on Energize), says whether the arrival has been seen this unlock, and puts the route in
// the hash; once the page has drawn it posts { ready, n }. walk.js then shows this load and posts { act }: the step's
// touches are made on the real page, through the controls' own key handlers (the meter and the gates are sliders) and
// real clicks, so the snow falls, the pool backs up, the surge runs and the sign travels as they do in the app.
// { light } relights it in place. Every touch of his own still answers.
import { saveSettings, settings } from '../../../src/ui/settings';
import { enterStill, leaveStill, still } from '../../../src/ui/light';
import { moveDot } from '../../../src/model/flows';
import { writeReading, type ChakraId } from '../../../src/model/mountain';
import { spark } from '../../../src/model/fixations';
import { markArrived } from '../../../src/ui/flow/mountain/arrival';

export type Light = 'day' | 'night' | 'still';
export type Step = 'arrive' | 'water' | 'heavy' | 'close' | 'open' | 'tap' | 'page' | 'live' | 'root' | 'sea' | 'still';

/** Each step's light as designed (the relight control's first choice). */
export const DESIGNED: Record<Step, Light> = {
  arrive: 'night', water: 'day', heavy: 'night', close: 'night', open: 'night', tap: 'day', page: 'day',
  live: 'night', root: 'day', sea: 'night', still: 'still',
};

/** Each step's route. */
const ROUTE: Record<Step, string> = {
  arrive: '/flow', water: '/flow', heavy: '/flow', close: '/flow', open: '/flow', tap: '/flow',
  page: '/flow/c/throat', live: '/flow/depress/4', root: '/flow/c/root', sea: '/flow', still: '/flow',
};

/** What the page must show before the load reports ready. */
const DRAWN: Record<Step, string> = {
  arrive: '.mt-plate', water: '.mt-plate[data-arrive="done"]', heavy: '.mt-plate', close: '.mt-plate', open: '.mt-plate',
  tap: '.mt-plate', page: '.ck-page .ck-plate', live: '.ck-page[data-front="depress"] .ck-plate', root: '.ck-page .ck-plate',
  sea: '.mt-plate', still: '.mt-plate',
};

/** The readings each step starts from: the meter, then any gates. */
const READINGS: Partial<Record<Step, { d?: number; gates?: Partial<Record<ChakraId, number>> }>> = {
  open: { gates: { heart: 0.9 } },
  page: { gates: { throat: 0.35 } },
  live: { d: 0.45 },
  still: { d: 0.7, gates: { throat: 0.9, sacral: 0.6 } },
};

const q = new URLSearchParams(location.search);
const step: Step | undefined = (q.get('step') ?? '') in DESIGNED ? (q.get('step') as Step) : undefined;
const load = q.get('n') ?? '';
const asLight = (l: string | null | undefined): Light | undefined => (l === 'day' || l === 'night' || l === 'still' ? l : undefined);

const frames = (n = 2) => new Promise<void>(r => { const f = (k: number) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); });
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
async function seen<T extends Element>(sel: string, ms = 6000): Promise<T | null> {
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

/** The step's state, before the first render: the light, the readings, an episode, the arrival, the route. */
export async function setUp(): Promise<void> {
  if (!step) return;
  await light(asLight(q.get('light')) ?? DESIGNED[step]);
  const r = READINGS[step];
  if (r?.d !== undefined) await writeReading('mountain', r.d);
  for (const [id, v] of Object.entries(r?.gates ?? {})) await writeReading(id as ChakraId, v);
  // the dot on the Heart's drawing at The bottom, the step that carries the 988 line
  if (step === 'live') await moveDot('depress', ['depress-1', 'depress-2', 'depress-3'], 'depress-4');
  // a ride open on Energize: the dot rides its circle in the sea
  if (step === 'sea') await spark('fx-east-winds');
  // only the first step comes together; every other one opens later in the same unlock, already there
  if (step !== 'arrive') markArrived();
  const hash = `#${ROUTE[step]}`;
  try { history.replaceState(null, '', hash); } catch { location.hash = hash; }
}

/** Presses a key on a slider, as a hand on a keyboard would: keydown then keyup, through the control's own handlers. */
function key(el: Element, k: string, up = false): void {
  el.dispatchEvent(new KeyboardEvent(up ? 'keyup' : 'keydown', { key: k, bubbles: true, cancelable: true }));
}

/** Moves a slider by n steps of a twentieth, one press every `every` ms, then lets go (the one write, on key up). */
async function slide(sel: string, k: string, n: number, every: number): Promise<void> {
  const el = await seen<HTMLElement>(sel);
  if (!el) return;
  for (let j = 0; j < n; j++) { key(el, k); await wait(every); }
  key(el, k, true);
}

/** The nearest thing that scrolls round el (the page's own column), or the app's document. */
function scrollerOf(el: Element): Element {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return document.scrollingElement ?? document.documentElement;
}

/** Brings a thing into view on the phone's screen, as a thumb scrolling would. Only the app's own scroller moves:
 *  scrollIntoView would scroll the walkthrough page around the phone too. */
async function bring(sel: string, block: 'center' | 'start' | 'end' = 'center'): Promise<HTMLElement | null> {
  const el = await seen<HTMLElement>(sel);
  if (!el) return null;
  const sc = scrollerOf(el);
  const box = el.getBoundingClientRect();
  const view = sc === document.scrollingElement ? { top: 0, height: innerHeight } : sc.getBoundingClientRect();
  const off = box.top - view.top;
  // 'end' moves only if the thing is below the screen's foot (the tab bar's height kept clear), never up
  const by = block === 'start' ? off - 60 : block === 'end' ? Math.max(0, off + box.height - view.height + 70) : off + box.height / 2 - view.height / 2;
  sc.scrollTo({ top: sc.scrollTop + by, behavior: 'smooth' });
  return el;
}

let acted = false;
/** The step's touches, made once the page is shown. */
async function act(): Promise<void> {
  if (acted || !step) return;
  acted = true;
  switch (step) {
    case 'heavy':
      // the meter rises to seven tenths: the snow comes down while it rises, the cloud over the summit
      await wait(900);
      await slide('.mt-meter-rule[role="slider"]', 'ArrowRight', 14, 160);
      return;
    case 'close':
      await wait(900);
      await slide('[role="slider"][aria-label="Heart gate"]', 'ArrowRight', 18, 90);
      return;
    case 'open':
      // the pool above the shut Heart has backed up; then the gate goes open in one move and the water goes
      await wait(2400);
      await slide('[role="slider"][aria-label="Heart gate"]', 'Home', 1, 60);
      return;
    case 'tap':
      await wait(1100);
      document.querySelector<HTMLElement>('a.mt-stop[data-chakra="heart"]')?.click();
      return;
    case 'live':
      await wait(1800);
      await bring('.ck-page .fl-prints [data-tip="depress-4-988"]');
      return;
    case 'sea':
      await wait(700);
      await bring('.mt-plate a.mt-circle', 'end');
      return;
    default:
      return;
  }
}

const post = (msg: object) => { try { parent.postMessage({ fs: true, n: load, ...msg }, '*'); } catch { /* no parent */ } };

export function startDriver(): void {
  // a click inside the phone gives the app the keys: the arrows it does not use itself (a gate or the meter takes them)
  // still turn the walkthrough's steps, as they do outside the phone
  addEventListener('keydown', e => {
    if (e.defaultPrevented || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    const t = e.target as Element | null;
    if (t?.closest?.('input,textarea,[contenteditable],[role="slider"]')) return;
    post({ key: e.key });
  });
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
