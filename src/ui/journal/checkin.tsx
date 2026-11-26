// The Sunday question in the app (PLAN-PUSH.md section 4, N1). No network: the clock is push/due.ts, the words are his
// (settings.checkin.line). Two ways in, one landing:
//   the quiet line: on the first Journal open on or after the chosen time that week, his question is the line under
//     the page where the backup line goes (UpdateToast.tsx QuietLine); a tap lands, Later puts it away until next week.
//   the address #/journal?ask=checkin (N3's notification tap opens it): once the PIN has opened the journal, CheckinAsk
//     lands the same way and takes the query off the address.
// The landing is Third eye's Ask (model/into.ts askCheckin): today's page with his question written as a line and asked,
// the page linked to the week (page.checkin), and the answer rule open under it in italic (Turn to answer, rule 17).
// Nothing is counted and nothing is badged.
// With worlds (PLAN-WORLDS.md section 3): the question is the personal notebook's. Its settings are on home's row (checkin
// is not a BOOK_KEYS field), the quiet line waits for his own pages (it is neither shown nor counted as shown while a
// world is worn), and a landing takes the world off first, as the door does (app.tsx DoorFrame), so the page and the
// question it writes are his own and never a world's, never in its outbox, never on the bridge.
import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { askCheckin } from '../../model/into';
import { checkinDue, checkinOf, weekKey } from '../../push/due';
import { settings, saveSettings } from '../settings';
import { dataVersion } from '../sheets';
import { pageCarry } from './carry';
import { flushOpenPage } from './PageView';
import { pushKnock } from '../../push/push';
import { wear, wornWorld } from '../notebook';

/** The query N3's notification opens the app with: `#/journal?ask=checkin`. public/push-sw.js keeps its value as
 *  CHECKIN_URL ('/' + CHECKIN_HASH); test/push/push-sw.test.ts reads both files to keep them in step. */
export const ASK_CHECKIN = 'checkin';
export const CHECKIN_HASH = `#/journal?ask=${ASK_CHECKIN}`;

/** The quiet line this launch: decided once, the first time the Journal shows (null until then). */
export const checkinUp = signal<boolean | null>(null);

/** True while a landing runs or once one has run in this load, so the live episode opened on load (app.tsx) never
 *  takes the page from under it. */
export let checkinLanded = false;

/** Is the question due now? If so it counts as shown this week from this moment (lastShownWeek), so it shows once. */
export function takeCheckin(now = Date.now()): boolean {
  // a world worn: the Journal is the world's, and the question waits for his own pages
  if (wornWorld.peek() !== null) return false;
  const s = settings.peek();
  const c = checkinOf(s);
  if (!checkinDue(c, now, s.seededAt)) return false;
  void saveSettings({ checkin: { ...c, lastShownWeek: weekKey(now, c) } }).catch(() => undefined);
  return true;
}

let landing: Promise<void> | null = null;

/**
 * The landing: today's page with his question written and asked, linked to this week, the answer rule open under it.
 * The week counts as shown, the quiet line goes, and the address is left at #/journal. Safe to call twice: a second
 * call while one runs waits for it, and the same day the question is not written twice (askCheckin).
 */
export function landCheckin(route: (to: string, replace?: boolean) => void, now = Date.now()): Promise<void> {
  if (landing) return landing;
  checkinLanded = true;
  checkinUp.value = false;
  landing = (async () => {
    // what he was typing on the open page is filed first, in the notebook it belongs to; then the world comes off
    await flushOpenPage();
    if (wornWorld.peek() !== null) await wear(null);
    const c = checkinOf(settings.peek());
    const week = weekKey(now, c);
    await askCheckin(week, c.line, now);
    if (c.lastShownWeek !== week) await saveSettings({ checkin: { ...c, lastShownWeek: week } });
    route('/journal', true);
    // the journal page reads its carry once, as it mounts: the next frame, it mounts again on the page as written
    await new Promise(r => requestAnimationFrame(r));
    pageCarry.value = { wise: true };
    dataVersion.value++;
  })().finally(() => { landing = null; });
  return landing;
}

/** In the frame (app.tsx), so it only runs with the journal open: lands when the address asks for the question, or
 *  when the service worker's message says the notification was tapped (N3, push/push.ts pushKnock: on iOS the
 *  address may never change for an app already open). A knock while locked waits here until the PIN opens it. */
export function CheckinAsk() {
  const { query, route } = useLocation();
  const asked = query.ask === ASK_CHECKIN;
  const knocked = pushKnock.value;
  useEffect(() => {
    if (!asked && !knocked) return;
    pushKnock.value = false;
    // a locked journal refuses the write: the address stays, and the next open lands
    landCheckin(route).catch(() => { checkinLanded = false; });
  }, [asked, knocked]);
  return null;
}
