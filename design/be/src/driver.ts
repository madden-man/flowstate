// The Be walkthrough's driver, design/energize's shape: walk.js loads this app afresh for every step, as
// app.html?step=<id>&light=<light>&n=<load>, so a step always starts from its own state and going Previous or Next
// never shows what the last step or a tap left behind. Before the first render setUp() puts the light and the route
// in place (./seed has written the step's example data); once the page has drawn it posts { ready, n }. walk.js then
// shows this load and posts { act }: the step's taps are made on the real page (a creed line, a pole word, Edit,
// "+ Not me", a goal, Delete twice), so the sheet rises and the row goes as they do in the app. { light } relights it
// in place. Every tap of his own still answers.
import { saveSettings, settings } from '../../../src/ui/settings';
import { enterStill, leaveStill, still } from '../../../src/ui/light';
import { CREED, THIRD } from './seed';

export type Light = 'day' | 'night' | 'still';
export type Step = 'creed' | 'line' | 'word' | 'both' | 'notme' | 'addnot' | 'held' | 'goal' | 'paradox' | 'still';

/** Each step's light as designed (the relight control's first choice). */
export const DESIGNED: Record<Step, Light> = {
  creed: 'day', line: 'day', word: 'day', both: 'night', notme: 'day', addnot: 'day', held: 'day', goal: 'day', paradox: 'day', still: 'still',
};

const SELFLESS = 'px-selfless-selfish', THOUGHTFUL = 'px-thoughtful-reactive';

/** Each step's route. */
const ROUTE: Record<Step, string> = {
  creed: '/be', line: '/be', word: `/be/${SELFLESS}`, both: `/be/${SELFLESS}`, notme: `/be/${SELFLESS}`, addnot: `/be/${SELFLESS}`,
  held: '/be', goal: `/be/${SELFLESS}`, paradox: `/be/${THOUGHTFUL}`, still: '/be',
};

/** What the page must show before the load reports ready. */
const laid = (id: string) => `#be-${id} [data-laid="true"]`;
const DRAWN: Record<Step, string> = {
  creed: '.fs-who-line', line: '.fs-who-line', word: laid(SELFLESS), both: laid(SELFLESS), notme: laid(SELFLESS), addnot: laid(SELFLESS),
  held: '.fs-who-line', goal: laid(SELFLESS), paradox: laid(THOUGHTFUL), still: '.fs-who-line',
};

const q = new URLSearchParams(location.search);
export const step: Step | undefined = (q.get('step') ?? '') in DESIGNED ? (q.get('step') as Step) : undefined;
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

/** The step's state, before the first render: the light and the route. */
export async function setUp(): Promise<void> {
  if (!step) return;
  await light(asLight(q.get('light')) ?? DESIGNED[step]);
  const hash = `#${ROUTE[step]}`;
  try { history.replaceState(null, '', hash); } catch { location.hash = hash; }
}

/** Types into a field as a thumb would, one letter at a time, through the field's own input event. */
async function type(field: HTMLInputElement | HTMLTextAreaElement, text: string, ms = 70): Promise<void> {
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const set = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  const from = field.value;
  for (let k = 1; k <= text.length; k++) {
    set.call(field, from + text.slice(0, k));
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(ms);
  }
}

/** Taps a thing on the page once it is there, and lets what it opens settle (a sheet's rise is --t-page). */
async function tap(sel: string, settle = 700): Promise<HTMLElement | null> {
  const el = await seen<HTMLElement>(sel);
  if (!el) return null;
  el.click();
  await wait(settle);
  return el;
}

const into = (el: Element | null) => el?.scrollIntoView({ block: 'center' });

/** Delete, the two taps on the same row: the armed row shows a moment, then the second tap. */
async function deleteTwice(sheet: string): Promise<void> {
  const row = await seen<HTMLElement>(`${sheet} .fs-delete`);
  if (!row) return;
  into(row);
  await wait(500);
  row.click();
  await wait(1800);
  document.querySelector<HTMLElement>(`${sheet} .fs-delete.armed`)?.click();
}

let acted = false;
/** The step's taps, made once the page is shown. */
async function act(): Promise<void> {
  if (acted || !step) return;
  acted = true;
  await wait(450);
  switch (step) {
    case 'line':
      await tap(`[data-who="${SELFLESS}"]`);
      return;
    case 'word':
      await tap(`#be-${SELFLESS} .fs-pole.b button`);
      return;
    case 'both': {
      if (!(await tap(`#be-${SELFLESS} .fs-spread-words .fs-word`))) return;
      const both = await seen<HTMLTextAreaElement>('[data-sheet="The paradox"] textarea[aria-label="Both, in a sentence"]');
      if (!both) return;
      into(both);
      both.focus({ preventScroll: true });
      await wait(400);
      await type(both, CREED);
      return;
    }
    case 'notme':
      into(document.querySelector(`#be-${SELFLESS} .fs-notme`));
      return;
    case 'addnot': {
      into(document.querySelector(`#be-${SELFLESS} .fs-notme`));
      await wait(300);
      if (!(await tap(`#be-${SELFLESS} .fs-notme-add`, 300))) return;
      const field = await seen<HTMLTextAreaElement>(`#be-${SELFLESS} textarea.fs-notme-line`);
      if (!field) return;
      into(field);
      await type(field, THIRD);
      return;
    }
    case 'held': {
      const add = [...document.querySelectorAll<HTMLElement>('.fs-be-top .fs-word')].find(b => b.textContent === 'New paradox');
      if (!add) return;
      add.click();
      const top = await seen<HTMLInputElement>('[data-sheet="New paradox"] input[aria-label="Top: value"]');
      if (!top) return;
      await wait(700);
      await type(top, 'patient', 110);
      await wait(200);
      const notes = [...document.querySelectorAll('[data-sheet="New paradox"] .fs-note')];
      into(notes.find(n => n.textContent?.includes('are held')) ?? null);
      return;
    }
    case 'goal':
      if (!(await tap(`#be-${SELFLESS} [data-goal="it-volunteer"]`))) return;
      await deleteTwice('[data-sheet="Fill both"]');
      await wait(700);
      into(document.querySelector('[data-slot-for="it-breathing-room"]'));
      return;
    case 'still':
      // the row, not the line: the spread opens under it and the creed stays at the top
      await tap(`#be-${SELFLESS} .fs-dichotomy`);
      return;
    case 'paradox':
      if (!(await tap(`#be-${THOUGHTFUL} .fs-spread-words .fs-word`))) return;
      await deleteTwice('[data-sheet="The paradox"]');
      return;
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
