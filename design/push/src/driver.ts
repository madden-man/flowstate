// The Sunday question walkthrough's driver, on design/blockers' pattern: walk.js loads this app afresh for every step,
// as app.html?step=<id>&light=<light>&n=<load>, so a step always starts from its own state. Before the first render
// setUp() writes the step's state through the app's own model (the light, the question, the journal's age, the PIN,
// the push state the Settings row draws) and puts the route in the hash; once the page has drawn the step's screen it
// posts { ready, n }. walk.js then shows this load and posts { act }: the step's touch is made on the real page (a tap
// on Notify me). { light } relights it in place. Every touch of his own still answers: Allow, the PIN's keys, Later.
// The lock screen (step 4) is iOS's and is drawn by walk.js itself; it never loads this app.
import { saveSettings, settings } from '../../../src/ui/settings';
import { enterStill, leaveStill, still } from '../../../src/ui/light';
import { openSheet } from '../../../src/ui/sheets';
import { choosePin, relock } from '../../../src/ui/lock/pin';
import { checkinOf, CHECKIN_LINE } from '../../../src/push/due';
import type { PushState } from '../../../src/push/push';
import { CHECKIN_HASH } from '../../../src/ui/journal/checkin';
import { LAST_SUNDAY, TODAY } from './clock';
import { demoPush } from './demo';

export type Light = 'day' | 'night' | 'still';
export type Step = 'question' | 'notify' | 'sendnow' | 'pin' | 'landing' | 'later' | 'safari';

/** Each step's light as designed (the relight control's first choice): Wednesday morning, Sunday morning. */
export const DESIGNED: Record<Step, Light> = {
  question: 'day', notify: 'day', sendnow: 'day', pin: 'day', landing: 'day', later: 'day', safari: 'day',
};

const DAY = 864e5;
const q = new URLSearchParams(location.search);
const step: Step | undefined = (q.get('step') ?? '') in DESIGNED ? (q.get('step') as Step) : undefined;
const load = q.get('n') ?? '';
const asLight = (l: string | null | undefined): Light | undefined => (l === 'day' || l === 'night' || l === 'still' ? l : undefined);

/** The installed app everywhere but the Safari step. */
export const standalone = step !== 'safari';

/** The Settings steps: the push state the real PushRows draws. */
const PUSH: Partial<Record<Step, PushState>> = { question: 'off', notify: 'off', sendnow: 'on', safari: 'needsHomeScreen' };
const SETTINGS = new Set<Step>(['question', 'notify', 'sendnow', 'safari']);

/** What the page must show before the load reports ready. */
const drawnOf = (s: Step) => (
  SETTINGS.has(s) ? '[data-sheet="Settings"] [data-checkin] [data-push]'
    : s === 'pin' ? '[data-lock] .fs-threshold-keypad'
      : s === 'landing' ? '.fs-msg.fs-wise textarea'
        : '[data-checkin-line]');

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
  // locked (the PIN step), the pin is set in memory and the write is refused: the light still turns, nothing is kept
  if (settings.peek().light !== pin) await saveSettings({ light: pin }).catch(() => undefined);
  if (l === 'still') enterStill();
  else if (still.peek()) leaveStill();
}

/** The step's state, before the first render. */
export async function setUp(): Promise<void> {
  if (!step) return;
  // a journal begun weeks ago; his question, Sunday 10:00, last asked last Sunday (so this Sunday's is due)
  await saveSettings({
    seededAt: TODAY - 40 * DAY,
    // exported last week (example data), so the export's own line is not due and the question stands alone
    lastBackupAt: TODAY - 5 * DAY,
    checkin: { ...checkinOf(settings.peek()), on: true, line: CHECKIN_LINE, weekday: 0, hour: 10, minute: 0, lastShownWeek: '2026-11-22', push: step === 'sendnow' },
  });
  await light(asLight(q.get('light')) ?? DESIGNED[step]);
  let route = '/journal';
  const push = PUSH[step];
  if (push) {
    (globalThis as { fsPush?: unknown }).fsPush = demoPush(push, LAST_SUNDAY);
  }
  // the notification's tap opens the app at #/journal?ask=checkin (public/push-sw.js)
  if (step === 'pin' || step === 'landing') route = CHECKIN_HASH.slice(1);
  if (step === 'pin') {
    // a PIN set (few rounds: a demo key), then locked as the phone relocks: 3569 opens it here
    await choosePin('3569', 1000);
    relock();
  }
  const hash = `#${route}`;
  try { history.replaceState(null, '', hash); } catch { location.hash = hash; }
}

/** The nearest scroller above the thing (the Settings sheet's body), else the app's document. */
function scrollerOf(el: Element): Element {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return document.scrollingElement ?? document.documentElement;
}

/** Scrolls the sheet at once until the thing stands near the top of the screen. */
async function bring(sel: string, from = 0.12): Promise<void> {
  for (let k = 0; k < 6; k++) {
    const el = await seen<HTMLElement>(sel);
    if (!el) return;
    const sc = scrollerOf(el);
    const view = sc === document.scrollingElement ? { top: 0, height: innerHeight } : sc.getBoundingClientRect();
    const want = Math.min(sc.scrollHeight - sc.clientHeight, Math.max(0, sc.scrollTop + el.getBoundingClientRect().top - view.top - view.height * from));
    if (Math.abs(sc.scrollTop - want) < 4) return;
    sc.scrollTop = want;
    await wait(120);
  }
}

let acted = false;
/** The step's touch, made once the page is shown. */
async function act(): Promise<void> {
  if (acted || !step) return;
  acted = true;
  if (step === 'notify') {
    await wait(500);
    (await seen<HTMLElement>('[data-push-switch]'))?.click();
    await seen('[data-ios="permission"]');
  }
  if (step === 'landing') await wait(300);
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

/** Posts ready once the app has drawn the step's screen (the Settings row brought into view) and two frames have passed. */
export async function whenDrawn(): Promise<void> {
  for (let k = 0; k < 200 && !document.querySelector('.fs-app, .fs-page, [data-threshold]'); k++) await wait(25);
  // Settings, risen from the journal's header (the route's first render closes any sheet opened before it)
  if (step && SETTINGS.has(step)) { await seen('.fs-hdr'); await wait(100); openSheet.value = 'settings'; }
  if (step) await seen(drawnOf(step));
  if (step && SETTINGS.has(step)) {
    // the sheet has risen; the Sunday question's row near the top of it
    await wait(450);
    await bring('[data-sheet="Settings"] [data-checkin]', 0.22);
  }
  await frames();
  post({ ready: true, step });
}
