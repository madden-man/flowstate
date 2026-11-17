// The blockers walkthrough's driver, on design/tasks' pattern: walk.js loads this app afresh for every step, as
// app.html?step=<id>&light=<light>&n=<load>, so a step always starts from its own state. Before the first render
// setUp() writes the step's state through the app's own model (the light, a live episode, a resolved question, a line
// on today's page, questions on the ? tab, the PIN and the door), says the arrival has been seen, and puts the route in
// the hash; once the page has drawn it posts { ready, n }. walk.js then shows this load and posts { act }: the step's
// touches are made on the real page, through the real controls (a thumb scrolling the page, a click on a Blockers row
// or a step word, a long press on a row, a tap on Resolve or Edit). { light } relights it in place. Every touch of his
// own still answers.
import { saveSettings, settings } from '../../../src/ui/settings';
import { enterStill, leaveStill, still } from '../../../src/ui/light';
import { writeReading } from '../../../src/model/mountain';
import { resolveAsk, STARTER_DECK } from '../../../src/model/acts';
import { askInJournal } from '../../../src/model/into';
import { askQuestion, resolveQuestion, writeLine } from '../../../src/model/pages';
import { startEpisode } from '../../../src/model/flows';
import { choosePin, relock } from '../../../src/ui/lock/pin';
import { markArrived } from '../../../src/ui/flow/mountain/arrival';
import { TODAY } from './clock';
import { connectMusic } from './seed';

export type Light = 'day' | 'night' | 'still';
export type Step =
  | 'blockers' | 'drawing' | 'walk' | 'running' | 'decide' | 'draft' | 'asks' | 'resolve' | 'next' | 'deck' | 'journal'
  | 'qtab' | 'qpage' | 'still' | 'door';

/** Each step's light as designed (the relight control's first choice): the morning on the sign, the evening's questions. */
export const DESIGNED: Record<Step, Light> = {
  blockers: 'day', drawing: 'day', walk: 'day', running: 'night', decide: 'day', draft: 'day', asks: 'night', resolve: 'night',
  next: 'night', deck: 'night', journal: 'night', qtab: 'day', qpage: 'day', still: 'still', door: 'night',
};

const DAY = 864e5;
/** Root's deck (model/acts.ts STARTER_DECK): the three that show first, and the fourth. */
const ROOT = STARTER_DECK.root;
/** The ? tab's questions (example data). */
const QUESTIONS = { open: ['Do I call Dad back this week?', 'What do I want the mornings to be?'], resolved: 'Is the Tuesday class worth keeping?' };
/** His answer under the question carried to today's page (example data). */
const ANSWER = 'Sam, and the dog asleep on my feet.';

const q = new URLSearchParams(location.search);
const step: Step | undefined = (q.get('step') ?? '') in DESIGNED ? (q.get('step') as Step) : undefined;
const load = q.get('n') ?? '';
const asLight = (l: string | null | undefined): Light | undefined => (l === 'day' || l === 'night' || l === 'still' ? l : undefined);

/** Each step's route, filled in by setUp where it needs an id (the question page). */
let route = '/flow/c/root';
const ROUTES: Partial<Record<Step, string>> = { walk: '/flow/panic', draft: '/flow/gripping', journal: '/journal', qtab: '/questions' };

/** What the page must show before the load reports ready. */
const drawnOf = (s: Step) => (
  s === 'walk' ? '.fs-flowpage[data-flow="panic"] .fl-drawing' : s === 'draft' ? '.fs-flowpage[data-flow="gripping"] .fl-drawing'
    : s === 'journal' ? '.fs-col .fs-msg.fs-wise' : s === 'qtab' ? '.fs-qlist .fs-qitem' : s === 'qpage' ? '.fs-qtitle'
      : s === 'door' ? '.ck-page[data-door] .ck-plate' : '.ck-page .ck-plate');

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
  // locked (the door step), the pin is set in memory and the write is refused: the light still turns, nothing is kept
  if (settings.peek().light !== pin) await saveSettings({ light: pin }).catch(() => undefined);
  if (l === 'still') enterStill();
  else if (still.peek()) leaveStill();
}

/** The step's state, before the first render. */
export async function setUp(): Promise<void> {
  if (!step) return;
  await light(asLight(q.get('light')) ?? DESIGNED[step]);
  // Root part shut, as he set it this evening
  await writeReading('root', 0.55);
  route = ROUTES[step] ?? '/flow/c/root';
  // Spotify connected, so Root's shelf shows its five covers
  if (route === '/flow/c/root') await connectMusic();
  // What if running, on its third step, since a quarter of an hour ago
  if (step === 'running') await startEpisode('whatif', ['whatif-1', 'whatif-2', 'whatif-3'], TODAY - 15 * 60e3);
  // the first of Root's three resolved on an earlier visit; the slots kept from then, so the fourth stands in its place
  if (step === 'next') {
    try { localStorage.setItem('fs-asks-slots', JSON.stringify({ root: ['root-1', 'root-2', 'root-3'] })); } catch { /* the deck order */ }
    await resolveAsk('root', 'root-1', true, TODAY - DAY);
  }
  // two resolved earlier in the week, so the sheet has its Resolved list with dates
  if (step === 'deck') {
    await resolveAsk('root', 'root-1', true, TODAY - 3 * DAY);
    await resolveAsk('root', 'root-3', true, TODAY - DAY);
  }
  // a question carried to today's page from Root, and his answer under it
  if (step === 'journal') {
    const r = await askInJournal('root', ROOT[1], TODAY - 10 * 60e3);
    await writeLine(r.page, undefined, { text: ANSWER }, TODAY - 8 * 60e3);
  }
  if (step === 'qtab' || step === 'qpage') {
    const done = await askQuestion(QUESTIONS.resolved, TODAY - 6 * DAY);
    const asked = [];
    for (const [k, t] of QUESTIONS.open.entries()) asked.push(await askQuestion(t, TODAY - (4 - k) * DAY));
    await resolveQuestion(done.id, true, TODAY - 2 * DAY);
    if (step === 'qpage') route = `/questions/${asked[1].id}`;
  }
  if (step === 'door') {
    // a PIN set (few rounds: a demo key), the ring without the PIN on, then locked as the phone relocks
    await choosePin('3569', 1000);
    await saveSettings({ flowDoor: true });
    relock();
  }
  markArrived();
  const hash = `#${route}`;
  try { history.replaceState(null, '', hash); } catch { location.hash = hash; }
}

const click = async (sel: string) => { const el = await seen<HTMLElement>(sel); el?.click(); return el; };

/** The page's own column (the sign's page scrolls in .fs-sheetof), else the app's document. */
const scrollerOf = (el: Element): Element => el.closest('.fs-sheetof') ?? document.scrollingElement ?? document.documentElement;

/** Scrolls the page as a thumb would until the thing stands near the top of the screen (only the app's scroller moves).
 *  The page may draw again while its blocks are read (their held room, then the rows), so the thing is found afresh
 *  and the scroll made again until it holds. */
async function bring(sel: string, from = 0.12): Promise<HTMLElement | null> {
  let el: HTMLElement | null = null;
  for (let k = 0; k < 8; k++) {
    el = await seen<HTMLElement>(sel);
    if (!el) return null;
    const sc = scrollerOf(el);
    const view = sc === document.scrollingElement ? { top: 0, height: innerHeight } : sc.getBoundingClientRect();
    const want = Math.min(sc.scrollHeight - sc.clientHeight, Math.max(0, sc.scrollTop + el.getBoundingClientRect().top - view.top - view.height * from));
    if (Math.abs(sc.scrollTop - want) < 4 && el.isConnected) return el;
    sc.scrollTo({ top: want, behavior: k ? 'auto' : 'smooth' });
    await wait(k ? 250 : 700);
  }
  return el;
}

/** A long press where a finger would make it, on the thing's middle, then let go where it was. */
async function longPress(el: HTMLElement, ms = 700): Promise<void> {
  const r = el.getBoundingClientRect();
  const at = { clientX: r.left + r.width / 3, clientY: r.top + r.height / 2, bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0 };
  el.dispatchEvent(new PointerEvent('pointerdown', at));
  await wait(ms);
  el.dispatchEvent(new PointerEvent('pointerup', at));
  window.dispatchEvent(new PointerEvent('pointerup', at));
}

/** A step word on the flow's drawing (parts/Cycle: a group with role button, named by its step). */
async function word(name: string): Promise<Element | null> {
  return seen(`.fs-flowpage .fl-drawing .fs-cycle-word[aria-label="${name}"]`);
}
const tapOn = (el: Element | null) => el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

const BLOCK = '[data-blockers]:not([data-wait]) .bk-row';
const ASKS = '[data-asks="root"]:not(.wait) .ck-ask';

let acted = false;
/** The step's touches, made once the page is shown. */
async function act(): Promise<void> {
  if (acted || !step) return;
  acted = true;
  switch (step) {
    // the foot of Root's page: the pair and the line, the gate, Blockers
    case 'blockers':
    case 'running':
      await seen(BLOCK);
      await wait(500);
      await bring('.ck-for', 0.06);
      return;
    case 'drawing':
      await seen(BLOCK);
      await wait(400);
      await bring('.ck-for', 0.06);
      await wait(700);
      await click('[data-blockers] .bk-row[data-flow="panic"]');
      return;
    case 'walk':
      await wait(900);
      tapOn(await word('The wave'));
      return;
    case 'decide': {
      await seen(BLOCK);
      await bring('.ck-for', 0.06);
      await wait(500);
      const row = await seen<HTMLElement>('[data-blockers] .bk-row[data-flow="night"]');
      if (row) await longPress(row);
      await wait(900);
      await click('.fs-sheet[data-sheet="Root blockers"] .bk-pick[data-flow="night"]');
      return;
    }
    case 'asks':
    case 'next':
    case 'still':
      await seen(step === 'still' ? BLOCK : ASKS);
      await wait(400);
      await bring(step === 'still' ? '.ck-for' : '[data-asks="root"]', step === 'still' ? 0.06 : 0.2);
      return;
    case 'resolve':
      await seen(ASKS);
      await wait(400);
      await bring('[data-asks="root"]', 0.2);
      await wait(600);
      await click('[data-asks="root"] .ck-ask-row [role="checkbox"]');
      return;
    case 'deck':
      await seen(ASKS);
      await wait(400);
      await bring('[data-asks="root"]', 0.2);
      await wait(600);
      await click('.ck-asks-edit .fs-word');
      return;
    case 'journal':
      // the page has turned to today and its caret sits under his answer; the question in view
      await wait(600);
      (document.activeElement as HTMLElement | null)?.blur?.();
      return;
    case 'door':
      await wait(400);
      await bring('.ck-page[data-door] [data-ground]', 0.3);
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
