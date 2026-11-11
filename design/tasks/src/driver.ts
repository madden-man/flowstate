// The tasks walkthrough's driver, on design/mountain's pattern: walk.js loads this app afresh for every step, as
// app.html?step=<id>&light=<light>&n=<load>, so a step always starts from its own state. Before the first render
// setUp() writes the step's state through the app's own model (the light, the gates, today's basics, the music, the
// PIN and the door), says the arrival has been seen, and puts the route in the hash; once the page has drawn it posts
// { ready, n }. walk.js then shows this load and posts { act }: the step's touches are made on the real page, through
// the real controls (a click on a touch word, letters typed into its rule, a held thumb by its own keys, a long press
// on a cover), so the stone sinks, the ranges clear, the surge runs and the sign travels as they do in the app.
// { light } relights it in place. Every touch of his own still answers.
import { saveSettings, settings } from '../../../src/ui/settings';
import { enterStill, leaveStill, still } from '../../../src/ui/light';
import { writeReading, type ChakraId } from '../../../src/model/mountain';
import { setBasic } from '../../../src/model/acts';
import { choosePin, relock } from '../../../src/ui/lock/pin';
import { markArrived } from '../../../src/ui/flow/mountain/arrival';
import { connectMusic } from './seed';

export type Light = 'day' | 'night' | 'still';
export type Step =
  | 'held' | 'place' | 'grieve' | 'look-far' | 'basics' | 'surge' | 'ask' | 'back' | 'stand-on' | 'send' | 'i-will'
  | 'shelf' | 'signs' | 'door' | 'sea';

/** Each step's light as designed (the relight control's first choice): the evening it starts, the morning after. */
export const DESIGNED: Record<Step, Light> = {
  held: 'night', place: 'night', grieve: 'night', 'look-far': 'day', basics: 'day', surge: 'night', ask: 'day', back: 'day',
  'stand-on': 'day', send: 'night', 'i-will': 'day', shelf: 'night', signs: 'night', door: 'night', sea: 'night',
};

const SIGN: Partial<Record<Step, ChakraId>> = {
  place: 'heart', grieve: 'heart', 'look-far': 'third-eye', basics: 'root', surge: 'sacral', ask: 'third-eye', back: 'third-eye',
  'stand-on': 'solar-plexus', send: 'throat', 'i-will': 'solar-plexus', shelf: 'heart', door: 'root', sea: 'heart',
};

/** Each step's route: its sign's page, the mountain, or today's page. */
const routeOf = (s: Step) => (s === 'held' ? '/flow' : s === 'signs' ? '/journal' : `/flow/c/${SIGN[s]}`);

/** What the page must show before the load reports ready. */
const drawnOf = (s: Step) => (s === 'held' ? '.mt-plate' : s === 'signs' ? '.fs-page' : s === 'door' ? '.ck-page[data-door] .ck-plate' : '.ck-page .ck-plate');

/** The gates each step starts from, as he set them before: the Heart part shut is the evening's block. */
const GATES: Partial<Record<Step, Partial<Record<ChakraId, number>>>> = {
  held: { heart: 0.85 }, place: { heart: 0.7 }, grieve: { heart: 0.7 }, surge: { sacral: 0.6 }, ask: { 'third-eye': 0.5 },
  back: { 'third-eye': 0.5 }, shelf: { heart: 0.7 }, sea: { heart: 0.85 },
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

/** The step's state, before the first render. */
export async function setUp(): Promise<void> {
  if (!step) return;
  await light(asLight(q.get('light')) ?? DESIGNED[step]);
  for (const [id, v] of Object.entries(GATES[step] ?? {})) await writeReading(id as ChakraId, v);
  // slept is already lit this morning; ate and water are lit on the step
  if (step === 'basics') await setBasic('slept', true);
  if (step === 'shelf' || step === 'signs') await connectMusic();
  if (step === 'door') {
    // a PIN set (few rounds: a demo key), the ring without the PIN on, then locked as the phone relocks
    await choosePin('3569', 1000);
    await saveSettings({ flowDoor: true });
    relock();
  }
  markArrived();
  const hash = `#${routeOf(step)}`;
  try { history.replaceState(null, '', hash); } catch { location.hash = hash; }
}

const click = async (sel: string) => { const el = await seen<HTMLElement>(sel); el?.click(); return el; };
const touch = (id: string) => click(`.ck-touches .ck-touch[data-touch="${id}"]`);

/** Types into an input as fingers would, a letter at a time, through its own input handler. */
async function type(sel: string, text: string, every = 55): Promise<HTMLInputElement | null> {
  const el = await seen<HTMLInputElement>(sel);
  if (!el) return null;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  for (let k = 1; k <= text.length; k++) {
    set.call(el, text.slice(0, k));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    if (every) await wait(every);
  }
  return el;
}
const enter = (el: Element | null) => el?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

/** The nearest thing that scrolls round el (the page's own column), or the app's document. */
function scrollerOf(el: Element): Element {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return document.scrollingElement ?? document.documentElement;
}

/** Brings a thing into view on the phone's screen, as a thumb scrolling would (only the app's own scroller moves). */
async function bring(sel: string): Promise<HTMLElement | null> {
  const el = await seen<HTMLElement>(sel);
  if (!el) return null;
  const sc = scrollerOf(el);
  const box = el.getBoundingClientRect();
  const view = sc === document.scrollingElement ? { top: 0, height: innerHeight } : sc.getBoundingClientRect();
  sc.scrollTo({ top: sc.scrollTop + box.top - view.top + box.height / 2 - view.height / 2, behavior: 'smooth' });
  return el;
}

/** A long press where a finger would make it, on the thing's middle, then let go where it was. */
async function longPress(el: HTMLElement, ms = 700): Promise<void> {
  const r = el.getBoundingClientRect();
  const at = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0 };
  el.dispatchEvent(new PointerEvent('pointerdown', at));
  await wait(ms);
  el.dispatchEvent(new PointerEvent('pointerup', at));
  window.dispatchEvent(new PointerEvent('pointerup', at));
}

let acted = false;
/** The step's touches, made once the page is shown. */
async function act(): Promise<void> {
  if (acted || !step) return;
  acted = true;
  switch (step) {
    case 'grieve': {
      await wait(900);
      await touch('grieve');
      enter(await type('.ck-stage input', 'Grandpa Joe', 90));
      return;
    }
    case 'look-far': {
      await wait(900);
      await touch('look-far');
      // a thumb held on the view, by the surface's own keys (Space down, never up): the ranges clear on the breath
      const s = await seen<HTMLElement>('.ck-stage .pl-thumb');
      s?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
      return;
    }
    case 'basics':
      await wait(900);
      await touch('basics');
      await wait(900);
      await click('.ck-stage .pl-lantern[data-basic="ate"]');
      await wait(700);
      await click('.ck-stage .pl-lantern[data-basic="water"]');
      return;
    case 'surge':
      await wait(900);
      await touch('feel');
      enter(await type('.ck-stage input', 'restless', 90));
      return;
    case 'ask':
      await wait(900);
      await touch('ask');
      enter(await type('.ck-stage [data-into="ask"] input', 'What am I not seeing?', 60));
      return;
    case 'back':
      await touch('ask');
      enter(await type('.ck-stage [data-into="ask"] input', 'What am I not seeing?', 0));
      await seen('.fs-hdr-r [data-sign-back="third-eye"]');
      await wait(1600);
      await click('.fs-hdr-r [data-sign-back="third-eye"]');
      return;
    case 'stand-on':
      await wait(900);
      await touch('stand-on');
      await wait(2200);
      await click('.ck-stage .ck-values .ck-value');
      return;
    case 'send':
      await wait(900);
      await touch('send');
      await type('.ck-stage [data-out="send"] input', 'I didn’t like how we left it.', 60);
      return;
    case 'i-will': {
      await wait(900);
      await touch('i-will');
      await type('.ck-stage [data-out="i-will"] input.out-rule', 'Walk to the lake', 60);
      await wait(400);
      const t = await seen<HTMLInputElement>('.ck-stage [data-out="i-will"] input.out-time');
      if (t) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(t, '18:30');
        t.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }
    case 'shelf': {
      await seen('.ck-shelf .fs-tile');
      await bring('.ck-shelf');
      await wait(1200);
      const cells = document.querySelectorAll<HTMLElement>('.ck-shelf [data-pick]');
      if (cells[1]) await longPress(cells[1]);
      return;
    }
    case 'signs':
      await wait(700);
      await click('button[aria-label="Music"]');
      await wait(500);
      await click('.fs-music-seg button:first-child');
      return;
    case 'sea':
      await wait(700);
      await touch('grieve');
      enter(await type('.ck-stage input', 'Grandpa Joe', 0));
      await wait(1800);
      await click('.fs-hdr-l a[href="#/flow"]');
      return;
    default:
      return;
  }
}

const post = (msg: object) => { try { parent.postMessage({ fs: true, n: load, ...msg }, '*'); } catch { /* no parent */ } };

export function startDriver(): void {
  // a click inside the phone gives the app the keys: the arrows it does not use itself still turn the walkthrough's steps
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
  for (let k = 0; k < 200 && !document.querySelector('.fs-app, .fs-page'); k++) await wait(25);
  if (step) await seen(drawnOf(step));
  await frames();
  post({ ready: true, step });
}
