// The values walkthrough's driver, the shape of design/energize's: walk.js loads this app afresh for every step, as
// app.html?step=<id>&light=<light>&n=<load>, so a step always starts from its own state. Before the first render
// setUp() writes the step's own lines through the app's model (today's council on honesty, today's journal page, the
// earlier councils "Said for it" reads), pins
// the light and puts the route in the hash; once the page has drawn it posts { ready, n }. walk.js then shows this
// load and posts { act }: the step's taps are made on the real page (a value row, "+ champion", New council, a line
// and its "Spoke for" chip), so the word travels, the sheet rises and the label is drawn as they do in the app.
// { light } relights it in place. Every tap of his own still answers.
import { saveSettings, settings } from '../../../src/ui/settings';
import { enterStill, leaveStill, still } from '../../../src/ui/light';
import { newCouncil, speak } from '../../../src/model/council';
import { speakFor } from '../../../src/model/values';
import { writeLine } from '../../../src/model/pages';
import { byWord, seedSaid } from './seed';

export type Light = 'day' | 'night' | 'still';
export type Step = 'be' | 'new' | 'shadow' | 'champion' | 'champions' | 'seats' | 'for' | 'deep' | 'journal' | 'said' | 'still';

/** Each step's light as designed (the relight control's first choice). */
export const DESIGNED: Record<Step, Light> = {
  be: 'day', new: 'day', shadow: 'day', champion: 'day', champions: 'day',
  seats: 'night', for: 'night', deep: 'night', journal: 'day', said: 'day', still: 'still',
};

/** What the page must show before the load reports ready. */
const DRAWN: Record<Step, string> = {
  be: '.fs-be-row', new: '.fs-be-row', shadow: '.fs-be-row', champion: '.fs-value-body', champions: '.fs-champ-voice',
  seats: '.fs-new', for: '.fs-council .fs-msg', deep: '.fs-council .fs-msg', journal: '.fs-col .fs-msg[data-line]',
  said: '.fs-said-for', still: '.fs-be-row',
};

/** The value "New value" is given in the new step: example words, typed into the real fields. */
export const NEW_VALUE = { word: 'courage', shadow: 'safety' };

/** Today's council on honesty: Warrior, Skeptic, Warrior; Mystic last on the deep step. */
const TODAY_LINES: [string, string][] = [
  ['v-warrior', 'He asked what I thought. I told him it was fine. It was not fine.'],
  ['v-skeptic', 'Was it kindness, or were you saving yourself the evening?'],
  ['v-warrior', 'The evening. So I owe him the real answer.'],
];
const MYSTIC_LINE = 'He asked at the door, with his coat on. Tomorrow, when he can hear it.';

/** Today's journal page: plain ink, Architect, Warrior, plain ink. */
const JOURNAL: [string | undefined, string][] = [
  [undefined, 'Slept badly. Still turning over what I said to him at the door.'],
  ['v-architect', 'Write the list first. Then the call.'],
  ['v-warrior', 'Call him before noon and say the part I left out.'],
  [undefined, 'Then breakfast.'],
];

const q = new URLSearchParams(location.search);
const step: Step | undefined = (q.get('step') ?? '') in DESIGNED ? (q.get('step') as Step) : undefined;
const load = q.get('n') ?? '';
const asLight = (l: string | null | undefined): Light | undefined => (l === 'day' || l === 'night' || l === 'still' ? l : undefined);

const frames = (n = 2) => new Promise<void>(r => { const f = (k: number) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); });
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
async function seen<T extends Element>(sel: string, ms = 4000, match?: (el: T) => boolean): Promise<T | null> {
  for (const until = performance.now() + ms; performance.now() < until; await wait(25)) {
    const all = [...document.querySelectorAll<T>(sel)];
    const el = match ? all.find(match) : all[0];
    if (el) return el;
  }
  return null;
}
const withText = (text: string) => (el: Element) => el.textContent?.trim() === text;

async function light(l: Light): Promise<void> {
  const pin = l === 'still' ? 'night' : l;
  if (settings.peek().light !== pin) await saveSettings({ light: pin });
  if (l === 'still') enterStill();
  else if (still.peek()) leaveStill();
}

/** A tap where a thumb would put it: the middle of the element, as a click the app's own handlers read. */
function tap(el: Element): void {
  const r = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
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

let ids: Record<string, string> = {};

/** Today's council on honesty, its champions seated; the deep step has Warrior's third line already confirmed. */
async function council(): Promise<string> {
  const page = await newCouncil({ valueId: ids.honesty, now: Date.now() - 20 * 60_000 });
  const lines: string[] = [];
  for (const [voiceId, text] of TODAY_LINES) lines.push((await speak(page.id, text, { voiceId })).id);
  if (step === 'deep') {
    await speakFor(lines[2], { valueId: ids.honesty, side: 'value' });
    await speak(page.id, MYSTIC_LINE, { voiceId: 'v-mystic' });
  }
  return page.id;
}

async function journal(): Promise<void> {
  let line = await writeLine(undefined, undefined, { text: JOURNAL[0][1] });
  for (const [voiceId, text] of JOURNAL.slice(1)) line = await writeLine(line!.page, undefined, { text, voiceId });
}

/** The step's state, before the first render: the light, its lines, the route. */
export async function setUp(): Promise<void> {
  if (!step) return;
  // the breath before the page belongs to a cold open, not to every step
  try { sessionStorage.setItem('fs-threshold', String(Date.now())); } catch { /* the fakes always have it */ }
  if (step === 'said') await seedSaid();
  ids = await byWord();
  await light(asLight(q.get('light')) ?? DESIGNED[step]);
  let route = '/be';
  if (step === 'champion' || step === 'said') route = `/be/${ids.honesty}`;
  else if (step === 'champions') route = '/be/champions';
  else if (step === 'seats') route = '/council';
  else if (step === 'for' || step === 'deep') route = `/council/${await council()}`;
  else if (step === 'journal') { await journal(); route = '/journal'; }
  const hash = `#${route}`;
  try { history.replaceState(null, '', hash); } catch { location.hash = hash; }
}

/** Taps a council line, then the chip under "Spoke for" in the reply bar. */
async function spokeFor(lineText: string, chip: string): Promise<void> {
  const line = await seen<HTMLElement>('.fs-council .fs-msg', 4000, el => !!el.textContent?.includes(lineText));
  if (!line) return;
  line.scrollIntoView({ block: 'center' });
  await wait(300);
  tap(line);
  const b = await seen<HTMLElement>('.fs-composer-wrap [aria-label="Spoke for"] button', 4000, withText(chip));
  await wait(600);
  if (b) tap(b);
}

let acted = false;
/** The step's taps, made once the page is shown. */
async function act(): Promise<void> {
  if (acted || !step) return;
  acted = true;
  switch (step) {
    case 'new': {
      await wait(450);
      const b = await seen<HTMLElement>('.fs-be-top .fs-word', 2000, withText('New value'));
      if (!b) return;
      tap(b);
      const word = await seen<HTMLInputElement>('.fs-valuesheet input[aria-label="Value"]');
      if (!word) return;
      await wait(500);
      await type(word, NEW_VALUE.word);
      const shadow = document.querySelector<HTMLInputElement>('.fs-valuesheet input[aria-label="Shadow"]');
      if (shadow) await type(shadow, NEW_VALUE.shadow);
      return;
    }
    case 'shadow': {
      await wait(450);
      const row = await seen<HTMLElement>(`#be-${ids.honesty} .fs-dichotomy`);
      if (row) tap(row);
      return;
    }
    case 'champion': {
      await wait(450);
      const b = await seen<HTMLElement>(`#be-${ids.honesty} .fs-champside[aria-label="Fighting for it"] .fs-champ-add button`);
      if (b) tap(b);
      return;
    }
    case 'seats': {
      await wait(450);
      const b = await seen<HTMLElement>('.fs-new', 2000, withText('New council'));
      if (!b) return;
      tap(b);
      const honesty = await seen<HTMLElement>('[aria-label="For what"] button', 4000, withText('honesty'));
      await wait(500);
      if (honesty) tap(honesty);
      return;
    }
    case 'for':
      await wait(450);
      await spokeFor(TODAY_LINES[2][1], 'honesty');
      return;
    case 'deep':
      await wait(450);
      await spokeFor(MYSTIC_LINE, 'discretion');
      return;
    case 'journal': {
      await wait(450);
      const line = await seen<HTMLElement>('.fs-col .fs-msg[data-line] p', 4000, el => !!el.textContent?.includes('Call him'));
      if (!line) return;
      tap(line);
      const b = await seen<HTMLElement>('.fs-col [aria-label="Spoke for"] button', 4000, withText('honesty'));
      await wait(600);
      if (b) tap(b);
      return;
    }
    case 'said':
      await wait(300);
      document.querySelector(`#be-${ids.honesty} .fs-value-acts`)?.scrollIntoView({ block: 'end', behavior: 'smooth' });
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
