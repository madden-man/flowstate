// The Research walkthrough's driver, the shape of design/tiers's: walk.js loads this app afresh for every step, as
// app.html?step=<id>&light=<light>&n=<load>, so a step always starts from its own state. Before the first render
// setUp() writes the step's state through the app's own model (the key, the recorded questions asked and run, ./seed),
// pins the light and puts the route in the hash; once the page has drawn it posts { ready, n }. walk.js then shows this
// load and posts { act }: the step's taps are made on the real page (Settings and the key typed in, the question
// typed, a chip, Abstract, Write about it, To Council, Ask again). In the look step the run begins as the page opens,
// as it does in the app, and its first reply is held until the step is shown. { light } relights it in place.
import { saveSettings, settings } from '../../../src/ui/settings';
import { enterStill, leaveStill, still } from '../../../src/ui/light';
import { askLower, askWriting, KEY, newWriting, pasteKey } from './seed';
import { hold, pace, release, WRITING } from './recorded';

export type Light = 'day' | 'night' | 'still';
export type Step = 'sea' | 'nokey' | 'key' | 'ask' | 'look' | 'sides' | 'one' | 'paper' | 'write' | 'council' | 'lower' | 'asked' | 'again' | 'still';

/** Each step's light as designed (the relight control's first choice). */
export const DESIGNED: Record<Step, Light> = {
  sea: 'night', nokey: 'day', key: 'day', ask: 'day', look: 'night', sides: 'day', one: 'day', paper: 'day', write: 'day',
  council: 'day', lower: 'night', asked: 'day', again: 'day', still: 'still',
};

/** The paper the abstract, journal and council steps open: a + paper in the writing run (Family Process). */
export const PAPER = 'doi:10.1111/famp.70206';
/** A moment a reply while a run plays on screen, so each title is seen landing. */
const PACE = 650;

/** What the page must show before the load reports ready. */
const DRAWN: Record<Step, string> = {
  sea: '.mt-plate a.mt-circle', nokey: '[data-print="key"]', key: '[data-print="key"]', ask: '[data-print="leaves"]',
  look: 'p.rs-q', sides: '.rs-line', one: '.rs-line', paper: '.rs-line', write: '[data-research="paper"]',
  council: '[data-research="paper"]', lower: '.rs-line', asked: '.rs-asked .fs-list-line', again: '.rs-line', still: '.rs-line',
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

const NO_KEY: Step[] = ['sea', 'nokey', 'key'];
const WRITTEN: Step[] = ['sides', 'one', 'paper', 'write', 'council', 'asked', 'again', 'still'];

/** The step's state, before the first render: the key, the questions, the light, the route. */
export async function setUp(): Promise<void> {
  if (!step) return;
  // the breath before the page belongs to a cold open, not to every step
  try { sessionStorage.setItem('fs-threshold', String(Date.now())); } catch { /* the fakes always have it */ }
  pace(0);
  if (!NO_KEY.includes(step)) await pasteKey();
  let route = '/flow/research';
  if (step === 'sea') route = '/flow';
  if (step === 'look') {
    const w = await newWriting();
    hold();
    route = `/flow/research/${w.id}`;
  }
  if (step === 'lower' || step === 'asked') {
    const l = await askLower();
    route = `/flow/research/${l.id}`;
  }
  if (WRITTEN.includes(step)) {
    const w = await askWriting();
    route = step === 'write' || step === 'council' ? `/flow/research/${w.id}/${encodeURIComponent(PAPER)}` : `/flow/research/${w.id}`;
  }
  if (step === 'asked') route = '/flow/research/asked';
  pace(PACE);
  await light(asLight(q.get('light')) ?? DESIGNED[step]);
  const hash = `#${route}`;
  try { history.replaceState(null, '', hash); } catch { location.hash = hash; }
}

/** A tap where a thumb would put it: the middle of the element, as a click the app's own handlers read. */
function tap(el: Element | null | undefined): void {
  if (!el) return;
  const r = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
}
/** The nearest box that scrolls el. */
function scroller(el: Element | null | undefined): HTMLElement | null {
  let box = el?.parentElement ?? null;
  while (box && !(box.scrollHeight > box.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
  return box;
}
/** Scrolls el to the middle of the nearest box that scrolls it, smoothly, and nothing outside the app: a
 *  scrollIntoView would scroll the walkthrough's own page round the phone too. */
function centre(el: Element | null | undefined): void {
  const box = scroller(el);
  if (!el || !box) return;
  const b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
  box.scrollTo({ top: box.scrollTop + (r.top + r.bottom) / 2 - (b.top + b.bottom) / 2, behavior: 'smooth' });
}
const byText = (sel: string, text: string) => [...document.querySelectorAll<HTMLElement>(sel)].find(e => e.textContent?.trim() === text);

/** Types into a field as a thumb would, one letter at a time, through the field's own input event. */
async function type(field: HTMLInputElement | HTMLTextAreaElement, text: string, ms: number): Promise<void> {
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const set = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  for (let k = 1; k <= text.length; k++) {
    set.call(field, text.slice(0, k));
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(ms);
  }
}

let acted = false;
/** The step's taps, made once the page is shown. */
async function act(): Promise<void> {
  if (acted || !step) return;
  acted = true;
  switch (step) {
    case 'sea': {
      const c = byText('.mt-plate a.mt-circle', 'Research') ?? document.querySelector('.mt-plate a.mt-circle:last-of-type');
      centre(c);
      return;
    }
    case 'key': {
      await wait(500);
      tap(byText('.fs-new', 'Settings'));
      const input = await seen<HTMLInputElement>('[data-sheet="Settings"] [data-research] input');
      if (!input) return;
      await wait(700);
      centre(input);
      await wait(600);
      input.focus({ preventScroll: true });
      await type(input, KEY, 60);
      await wait(400);
      tap(document.querySelector('[data-research-save]'));
      return;
    }
    case 'ask': {
      const area = await seen<HTMLTextAreaElement>('textarea.rs-q');
      if (!area) return;
      await wait(400);
      await type(area, WRITING.question, 70);
      return;
    }
    case 'look': release(); return;
    case 'one': await wait(600); tap(document.querySelector('.rs-side[data-side="against"]')); return;
    case 'paper': {
      await wait(600);
      const line = document.querySelector(`.rs-line[data-paper-id="${PAPER}"]`);
      centre(line);
      await wait(500);
      tap(line?.querySelector('.rs-abs'));
      return;
    }
    case 'write': await wait(700); tap(byText('.rs-words button', 'Write about it')); return;
    case 'council': await wait(700); tap(byText('.rs-words button', 'To Council')); return;
    case 'again': {
      await wait(600);
      tap(byText('.fs-chips .fs-word', 'Ask again'));
      // once the new lines are in, back up the page to the old ones, struck
      await seen('[data-research="question"][data-on]', 4000);
      await seen('[data-research="question"][data-state="done"]:not([data-on])', 30_000);
      await wait(900);
      scroller(document.querySelector('.rs-earlier'))?.scrollTo({ top: 0, behavior: 'smooth' });
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
