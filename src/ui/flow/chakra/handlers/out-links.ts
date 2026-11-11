// Out of the app (PLAN-TASKS.md T4, sections 2, 3 and 5): the links the touches that leave build, and the return that
// says a touch is done (the one person he chose once is model/person.ts). No UI here (that is ./out.tsx). Every link is a navigation he
// completes in the other app: nothing is sent, dialled or written there by FlowState (DESIGN.md rule 22), and nothing
// here fetches.
import type { ChakraId } from '../../../../model/mountain';
import { smsHref } from '../../../../model/carried';

export { smsHref };
export { chosenPerson, choosePerson, reachHref } from '../../../../model/person';

/** The phone's Calendar on today (the walk's helper, origin/walk src/ui/flow/Tips.tsx CALENDAR_HREF). */
export const CALENDAR_HREF = 'calshow:';

/** Apple's reference date (2001-01-01T00:00:00Z), from which calshow: counts seconds. */
const APPLE_EPOCH = Date.UTC(2001, 0, 1);

/** The phone's Calendar opened on a time: calshow:<seconds since 2001-01-01 UTC>. With no time, on today. */
export function calshowHref(at?: number): string {
  if (at === undefined || !Number.isFinite(at)) return CALENDAR_HREF;
  return `${CALENDAR_HREF}${Math.floor((at - APPLE_EPOCH) / 1000)}`;
}

/** The phone, dialling nobody until he says so: tel:<digits and +>. Undefined with no number to call. */
export function telHref(tel: string | undefined): string | undefined {
  const to = (tel ?? '').replace(/[^\d+]/g, '');
  return to ? `tel:${to}` : undefined;
}

/** "HH:MM" from a time input as the next time the clock reads it: today, or tomorrow once today's has gone. */
export function nextAt(hhmm: string, now = Date.now()): number | undefined {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return undefined;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return undefined;
  const d = new Date(now);
  d.setHours(h, min, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

// ---- done when he comes back (section 5) ----

/** The sign's page, as the router has it. */
export const signHash = (chakra: ChakraId) => `#/flow/c/${chakra}`;

type Env = { doc?: Document; here?: () => string };

/** Once the page has gone (another app in front) and comes back on this sign, runs done, once. Coming back on another
 *  screen does nothing. Returns its undo. A tap that never leaves (a call cancelled, Messages not opened) is not done. */
export function doneOnReturn(chakra: ChakraId, done: () => void, env: Env = {}): () => void {
  const doc = env.doc ?? document;
  const here = env.here ?? (() => location.hash);
  let away = doc.visibilityState === 'hidden';
  let over = false;
  const off = () => { over = true; doc.removeEventListener('visibilitychange', look); };
  function look() {
    if (over) return;
    if (doc.visibilityState === 'hidden') { away = true; return; }
    if (!away) return;
    off();
    if (here().split('?')[0] === signHash(chakra)) done();
  }
  doc.addEventListener('visibilitychange', look);
  return off;
}
