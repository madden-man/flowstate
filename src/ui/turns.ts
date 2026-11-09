// Turns between pages (DESIGN.md rules 28 and 29, PLAN-MOTION.md M2). The hash location (ui/route.tsx) calls
// turnBetween on every hashchange; this decides the kind from the two paths and runs it through parts/Turn:
//   tab-left, tab-right   another tab: the ink goes toward the side the new tab is on (TABS order)
//   open, close           a row into its page, and back: deeper is open, shallower is close
// parts.css (the M2 section) names what is captured under each kind: the page's ink, the header, the tab bar. The
// paper (the page colour, the lamp, the rules) is the root, and the root only cross-fades, so it never moves.
// A flow's small drawing and its name are named here, on the tapped row only and on the page, so they travel.
//
// No turn on first load or a deep link (no hashchange), on a replace (no hashchange), on an import's re-read (the
// Router's key, no hashchange), while the lock or the door is up, or in the moment the app comes up after the PIN.
import { useLayoutEffect } from 'preact/hooks';
import { turn, skipTurn } from './parts/Turn';

/** The bar: four words, and Questions as a ? mark in the serif (V2, PLAN-V2.md section 2), so DESIGN.md
 *  rule 7's four words stand. The mark carries its name for VoiceOver. Their order is the side a turn goes to. */
export const TABS: readonly { slug: string; word: string; label?: string }[] = [
  { slug: 'journal', word: 'Journal' },
  { slug: 'council', word: 'Council' },
  { slug: 'questions', word: '?', label: 'Questions' },
  { slug: 'be', word: 'Be' },
  { slug: 'flow', word: 'Flow' },
];

/** A duration token in ms, as the light has it now (Still's are slower; Reduce Motion's are zero). */
export function tokenMs(name: string): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return 0;
  return v.endsWith('ms') ? n : n * 1000;
}

/** Whether a thing may move at all: not under Reduce Motion, where every duration is zero and no transition ends. */
export const moves = () => !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  && tokenMs('--t-page') > 0;

export type TurnKind = 'tab-left' | 'tab-right' | 'open' | 'close';

const parts = (p: string) => p.split('/').filter(Boolean);

/** How deep a path sits in its section: the section's own page 0, the list of Pages 1, any one page 2. */
function depth(p: string): number {
  const [section, a] = parts(p);
  if (!a) return 0;
  return section === 'journal' && a === 'pages' ? 1 : 2;
}

/** A flow's page and the same flow at a step are one page (the dot moved): the first three parts say which. */
const pageOf = (p: string) => parts(p).slice(0, 2).join('/');

/** The flow a path is the page of, if it is one ("now" is the Right now page, not a flow). */
const flowOf = (p: string) => {
  const [section, id] = parts(p);
  return section === 'flow' && id && id !== 'now' ? id : undefined;
};

/** Which turn goes from one path to another, or none. */
export function kindOf(from: string, to: string): TurnKind | null {
  if (from === to) return null;
  const [a = ''] = parts(from), [b = ''] = parts(to);
  if (a !== b) {
    const ia = TABS.findIndex(t => t.slug === a), ib = TABS.findIndex(t => t.slug === b);
    if (ia >= 0 && ib >= 0) return ib < ia ? 'tab-left' : 'tab-right';
    // off the tabs (Voices) is deeper than any of them
    if (ia < 0 && ib < 0) return null;
    return ib < 0 ? 'open' : 'close';
  }
  if (a === 'flow' && pageOf(from) === pageOf(to)) return null;
  return depth(to) < depth(from) ? 'close' : 'open';
}

// ---- the page says it has drawn ----
// A page that reads the database before it can draw renders once empty. It says so with useDrawn(false) (parts/Page's
// `drawn`), and a turn waits for it to say true before the after picture, never longer than parts/Turn's cap.

let waiting = 0;
const wakers = new Set<() => void>();

export function useDrawn(drawn: boolean) {
  useLayoutEffect(() => {
    if (drawn) return;
    waiting++;
    return () => {
      waiting--;
      if (waiting) return;
      for (const w of wakers) w();
      wakers.clear();
    };
  }, [drawn]);
}

/** Resolves once every page on screen has drawn (at once, if none is waiting). */
export const pageDrawn = () => (waiting ? new Promise<void>(r => wakers.add(r)) : Promise.resolve());

// ---- when turns may run ----

let frameUp = false;
/** The app's frame (the tabs and their pages) says when it is up; the first frames after it comes up never turn,
 *  so the PIN opening the app onto a page (door.ts afterUnlock) shows that page plainly. While it is up, a touch
 *  during a turn goes through (below). */
export function useFrameUp() {
  useLayoutEffect(() => {
    let a = requestAnimationFrame(() => { a = requestAnimationFrame(() => { frameUp = true; }); });
    const off = passTouches();
    return () => { cancelAnimationFrame(a); frameUp = false; off(); };
  }, []);
}

// ---- a touch during a turn ----
// While a view transition runs, the browser hit-tests its pictures as the document element: a tap mid-turn would land
// on <html> and be lost (and a second tab tap is meant to go at once, rule 31: nothing delays a tap). So a touch that
// lands on <html> during one of these turns ends the turn at once and is handed to what is under it on the live
// page: the press itself (so parts/Press, a long press, a drag all start), and then its click.

const KINDS = new Set<string>(['tab-left', 'tab-right', 'open', 'close']);

function passTouches(): () => void {
  const html = document.documentElement;
  /** The press handed on, once it has been: the click waits for it, so the two reach the page in order. */
  let handed: Promise<unknown> | null = null;
  const under = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y);
    return el && el !== html ? el : null;
  };
  const down = (e: PointerEvent) => {
    if (!e.isTrusted) return; // the press handed on below
    handed = null;
    if (e.target !== html || !KINDS.has(html.dataset.turn ?? '')) return;
    e.stopImmediatePropagation();
    const again = new PointerEvent('pointerdown', e);
    // the turn's change is in the page within moments (its waits are cut short); the press goes to what is there
    handed = skipTurn().then(() => under(e.clientX, e.clientY)?.dispatchEvent(again));
  };
  const click = (e: MouseEvent) => {
    const was = handed;
    handed = null;
    if (!was || e.target !== html) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const { clientX: x, clientY: y } = e;
    void was.then(() => {
      const el = under(x, y);
      if (!el) return;
      const field = el.closest('textarea, input, [contenteditable]');
      if (field instanceof HTMLElement) { field.focus(); return; }
      (el.closest('a, button, label, [role="button"], [role="checkbox"]') ?? el).dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y }));
    });
  };
  // on the window, in the capture phase: before parts/Press and every page hears the touch
  addEventListener('pointerdown', down, true);
  addEventListener('click', click, true);
  return () => { removeEventListener('pointerdown', down, true); removeEventListener('click', click, true); };
}

const mayTurn = () => frameUp && document.visibilityState !== 'hidden'
  && !document.querySelector('[data-threshold], .fs-app[data-door]');

// ---- the paper stays ----
// The rules are the background of the page's writing column, so they would turn with the ink. For the length of a
// turn the column's own rules are put away ([data-paper]) and the same rules are drawn on the frame behind it, in the
// same place to the pixel (.fs-main::after, from these vars), where the root keeps them still. At the end the column
// takes them back where they already are.

const PAPER = ['--paper-x', '--paper-top', '--paper-w', '--paper-h', '--paper-y', '--paper-size'] as const;

/** The page's writing column: its ruled scroller (not the rail of earlier pages, not a check list under a spread). */
const column = () => [...document.querySelectorAll<HTMLElement>('.fs-page .fs-rules')].find(el => !el.closest('.fs-earlier, .fs-due'));

/** Where the column's rules are, and the column marked to lend them; nothing (a zero box) where it has none. */
function lendPaper(): Record<string, string> {
  const el = column(), main = document.querySelector('.fs-main');
  if (!el || !main) return Object.fromEntries(PAPER.map(k => [k, '0px']));
  const r = el.getBoundingClientRect(), m = main.getBoundingClientRect();
  const y = parseFloat(getComputedStyle(el).backgroundPositionY) || 0;
  el.dataset.paper = '';
  return {
    '--paper-x': `${r.left - m.left}px`, '--paper-top': `${r.top - m.top}px`, '--paper-w': `${r.width}px`, '--paper-h': `${r.height}px`,
    // background-attachment: local, so the rules ride the scroll and repeat on the column's scroll height
    '--paper-y': `${y - el.scrollTop}px`, '--paper-size': `${Math.max(el.scrollHeight, r.height)}px`,
  };
}

function takeBackPaper() {
  for (const el of document.querySelectorAll<HTMLElement>('[data-paper]')) delete el.dataset.paper;
}

// ---- what travels ----
// A shared name must be one element on each side. The row is found by its href, so only the tapped one is named.

const NAMES = { drawing: 'fs-drawing', title: 'fs-title' } as const;
let named: HTMLElement[] = [];
let generation = 0;

function name(el: Element | null | undefined, n: string): boolean {
  if (!(el instanceof HTMLElement || el instanceof SVGElement)) return false;
  (el as HTMLElement).style.setProperty('view-transition-name', n);
  named.push(el as HTMLElement);
  return true;
}

function unname() {
  for (const el of named) el.style.removeProperty('view-transition-name');
  named = [];
}

const row = (id: string) => document.querySelector(`.fs-flows a[href="#/flow/${CSS.escape(id)}"]`);
const page = () => document.querySelector('.fs-flowpage');

/** The list's side: the row's small drawing and its name. */
function nameRow(id: string) {
  const r = row(id);
  return { drawing: r?.querySelector('.fs-cycle'), title: r?.querySelector('.fs-list-line') };
}
/** The page's side: its drawing and the name in its header. */
function namePage() {
  return { drawing: page()?.querySelector('.fl-drawing .fs-cycle'), title: document.querySelector('.fs-hdr .fs-hdr-label') };
}

/** Starts the turn from one path to another, with go changing the route inside it. go always runs, at once. */
export async function turnBetween(from: string, to: string, go: () => void): Promise<void> {
  const kind = mayTurn() ? kindOf(from, to) : null;
  if (!kind) { go(); return; }
  const mine = ++generation;
  unname();
  takeBackPaper();
  // into a flow from the list, or back: the drawing and the name, from the side now on screen
  const into = kind === 'open' && to.startsWith('/flow/') && from === '/flow' ? flowOf(to) : undefined;
  const outOf = kind === 'close' && to === '/flow' ? flowOf(from) : undefined;
  const before = into ? nameRow(into) : outOf ? namePage() : undefined;
  const pairs: (keyof typeof NAMES)[] = [];
  for (const k of Object.keys(NAMES) as (keyof typeof NAMES)[]) if (before && name(before[k], NAMES[k])) pairs.push(k);
  await turn(kind, go, {
    vars: lendPaper(),
    ready: pageDrawn,
    settle: () => {
      const html = document.documentElement;
      for (const [k, v] of Object.entries(lendPaper())) html.style.setProperty(k, v);
      if (!pairs.length) return;
      const after = into ? namePage() : nameRow(outOf!);
      for (const k of pairs) {
        // a name on one side only would fade where it stood: both sides or neither
        if (!name(after[k], NAMES[k])) {
          for (const el of named) if (el.style.getPropertyValue('view-transition-name') === NAMES[k]) el.style.removeProperty('view-transition-name');
        }
      }
    },
  });
  if (mine === generation) { unname(); takeBackPaper(); }
}
