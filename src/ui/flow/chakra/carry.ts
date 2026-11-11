// The sign travels with him (PLAN-TASKS.md T3, sections 3 and 5; DESIGN.md rule 28). A touch that leaves a sign's page
// for one of the app's own (Journal, Council, Be, Questions, Meditate, Energize) goes through leaveFor: it remembers
// the sign, the touch, where it landed and the touch's done, then routes there. While he is anywhere under that place,
// its header prints the sign small, in print, beside the date (./SignBack.tsx), and a tap on it comes back to the sign's
// page. Done is called when he comes back to the sign (section 5: a touch that leaves surges on the return, not on the
// going), once its page is drawn, so whatever hangs off done (the surge) finds the page there; arriving anywhere else
// on the Flow tab (the mountain, another sign) lets the touch go without it. Held in memory only: nothing is written.
//
// pageCarry is what a journal page opens with (ui/journal/PageView.tsx reads it once as it mounts): the next rule's
// first words, unsaved until he writes (Letter's "Dear"), and whether that rule opens as the answer, in italic as the
// wiser second person (Ask, rule 17).
import { signal } from '@preact/signals';
import type { ChakraId } from '../../../model/mountain';
import type { TouchAct } from './touch';

/** A touch that left its sign: which sign and touch, the path it landed under, and its done, not yet called. */
export type Travel = { chakra: ChakraId; touch: string; under: string; done: () => void };
export const travel = signal<Travel | null>(null);

/** What today's journal page opens with, once. */
export type PageCarry = { tail?: string; wise?: boolean };
export const pageCarry = signal<PageCarry | null>(null);

/** The page of a sign. */
export const signPath = (chakra: ChakraId) => `/flow/c/${chakra}`;

const pathOf = (hash: string): string => {
  const h = decodeURI(hash.replace(/^#/, '')).split('?')[0].replace(/\/+$/, '');
  return h.startsWith('/') ? h || '/' : `/${h}`;
};

/** True when path is the place itself or a page under it ("/council" holds "/council/abc"). */
export const isUnder = (path: string, under: string): boolean => path === under || path.startsWith(`${under}/`);

/** The sign to print beside the date on the page at this path: the one a touch carried him here from, if any. */
export function signAt(path: string, t: Travel | null = travel.value): ChakraId | undefined {
  return t && isUnder(path, t.under) ? t.chakra : undefined;
}

/** Leaves the sign's page for `to` (a hash path), carrying the sign. under is the place that counts as still there
 *  (the section: a council opened at /council/abc is under /council); it defaults to `to`. */
export function leaveFor(a: Pick<TouchAct, 'chakra' | 'touch' | 'done' | 'route'>, to: string, under = to): void {
  travel.value = { chakra: a.chakra, touch: a.touch.id, under, done: a.done };
  a.route(to);
}

/** Waits for the sign's page to be drawn (its touch words on the plate), then a frame more; at most a few seconds. */
function whenDrawn(chakra: ChakraId, then: () => void): void {
  const sel = `.ck-page[data-chakra="${chakra}"] .ck-touches`;
  const go = () => requestAnimationFrame(() => then());
  if (document.querySelector(sel)) { go(); return; }
  const mo = new MutationObserver(() => { if (document.querySelector(sel)) { mo.disconnect(); clearTimeout(t); go(); } });
  const t = setTimeout(() => { mo.disconnect(); then(); }, 4000);
  mo.observe(document.body, { childList: true, subtree: true });
}

/** Where he is now: back at the sign calls its done once the page is there; anywhere else on the Flow tab lets it go. */
export function arrived(path: string): void {
  const t = travel.peek();
  if (!t || isUnder(path, t.under)) return;
  if (path === signPath(t.chakra)) {
    travel.value = null;
    whenDrawn(t.chakra, t.done);
    return;
  }
  if (isUnder(path, '/flow')) travel.value = null;
}

if (typeof window !== 'undefined') addEventListener('hashchange', () => arrived(pathOf(location.hash)));
