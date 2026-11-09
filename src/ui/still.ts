// Still, the session (PLAN.md section 8, DESIGN.md rule 13). light.ts holds whether Still is on; this file
// holds what one Still session knows: when it began, how long you have been typing, whether the ring has
// asked "Enough for now?" yet, and which kept line sits at the top. None of it is written to the data:
// entering or leaving Still changes nothing in the journal. The only thing kept between sessions is the
// list of kept-line ids Still has already shown (ids, no text), so the next session shows the next line.
import { signal, computed } from '@preact/signals';
import { still, enterStill, leaveStill } from './light';
import { tick } from './parts/Haptic';
import { bell } from './parts/Sound';
import { turn } from './parts/Turn';
import { keptLines } from '../model/pages';

/** Twelve minutes of typing, once a session (Tommy, 2026-11-07). */
export const ENOUGH_MS = 12 * 60_000;
/** A pause longer than this is not typing: only this much of it counts toward the twelve minutes. */
export const TYPING_GAP_MS = 5_000;

export type StillSession = { since: number; typedMs: number; lastKeyAt?: number; keys: number; asked: boolean; answered: boolean };

export const freshSession = (since: number): StillSession => ({ since, typedMs: 0, keys: 0, asked: false, answered: false });

/** One keystroke in a composer: the time since the last one counts, up to a short gap; idle time does not. */
export function keystroke(s: StillSession, t: number): StillSession {
  const gap = s.lastKeyAt === undefined ? 0 : Math.max(0, Math.min(t - s.lastKeyAt, TYPING_GAP_MS));
  const typedMs = s.typedMs + gap;
  return { ...s, typedMs, lastKeyAt: t, keys: s.keys + 1, asked: s.asked || typedMs >= ENOUGH_MS };
}

/** The kept line for a new Still session: the oldest not yet shown, starting over once all have been. */
export function pickKept(kept: { id: string; at: number }[], seen: string[]): { id?: string; seen: string[] } {
  const order = [...kept].sort((a, b) => a.at - b.at);
  const ids = new Set(order.map(k => k.id));
  const known = seen.filter(id => ids.has(id));
  const fresh = order.filter(k => !known.includes(k.id));
  const pick = (fresh.length ? fresh : order)[0];
  if (!pick) return { seen: known };
  return { id: pick.id, seen: [...(fresh.length ? known : []), pick.id] };
}

// ---- state ----

const session = signal<StillSession | null>(null);
/** The session for the Still that is on now, if any; a session left over from an earlier Still is ignored. */
export const current = computed(() => {
  const s = still.value, x = session.value;
  return s && x && x.since === s.since ? x : null;
});
/** The ring is asking: past twelve minutes of typing this session, not yet answered. */
export const asking = computed(() => !!current.value?.asked && !current.value.answered);
/** The kept line at the top of the page in Still, for this session. */
export const keptLine = signal<{ since: number; text: string } | null>(null);

const SEEN_KEY = 'fs-still-seen';
const readSeen = (): string[] => {
  try { const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; }
  catch { return []; }
};
const writeSeen = (ids: string[]) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids)); } catch { /* private mode: rotation starts over */ } };

/** Chooses this session's kept line once; every page in the session shows the same one. */
export async function loadKeptLine(): Promise<void> {
  const s = still.peek();
  if (!s || keptLine.peek()?.since === s.since) return;
  const kept = await keptLines();
  if (still.peek()?.since !== s.since) return;
  const pick = pickKept(kept.map(k => ({ id: k.message.id, at: k.message.at })), readSeen());
  writeSeen(pick.seen);
  const k = kept.find(x => x.message.id === pick.id);
  keptLine.value = { since: s.since, text: k?.message.text ?? '' };
}

// ---- the circle (DESIGN.md rule 29, PLAN-MOTION.md M4) ----
// A tap on the moon opens the dark from the moon as a circle; a tap on the ring closes it back into the ring. The
// light itself changes inside the turn's update, the first frame the browser can show it (the turn has to picture
// the old light before the new one is in the page); the tick and the tone stay in the tap. Where there is no moon on
// screen (the lock threshold, a page with no header) there is nothing to open from, and the light just changes
// with today's --t-light cross-fade, as it does wherever the browser has no view transitions.

/** The moon or the ring in the page header, where the circle opens from: its centre and the distance to the
 *  farthest corner of the screen, as the vars parts.css reads. Null when none is on screen. */
export function fromMoon(): Record<string, string> | null {
  if (typeof document === 'undefined') return null;
  const w = window.innerWidth, h = window.innerHeight;
  for (const el of document.querySelectorAll<HTMLElement>('.fs-hdr .fs-moon')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom <= 0 || r.right <= 0 || r.top >= h || r.left >= w) continue;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const far = Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
    return { '--still-x': `${x}px`, '--still-y': `${y}px`, '--still-r': `${Math.ceil(far)}px` };
  }
  return null;
}

/** Still begins: the state and a fresh session, nothing else. */
function begin(): void {
  if (still.peek()) return;
  enterStill();
  session.value = freshSession(still.peek()!.since);
}

/** A tap on the moon or the ring has asked for a change the turn has not made yet: a second tap is the same tap. */
let turning = false;

/** Entering Still with no circle (after the PIN through the door): one tick and the long low tone. */
export function settle(): void {
  if (still.peek()) return;
  begin();
  tick('still');
  bell('settle');
}

/** Entering Still by the moon, or by "Dim the page" on a flow's tip as if the moon had been tapped: the tick and the
 *  tone in the tap, and the dark opens from the moon. */
export function settleFromMoon(): void {
  if (still.peek() || turning) return;
  const vars = fromMoon();
  tick('still');
  bell('settle');
  if (!vars) { begin(); return; }
  turning = true;
  const go = () => { turning = false; begin(); };
  // the update always runs, even in a skipped turn; the finally is for a browser that throws before it does
  void turn('still', go, { vars }).finally(() => turning && go());
}

/** The ring: back to the light of the sky, the dark closing into the ring. No tick, no bell. */
export function rise(): void {
  if (turning) return;
  const vars = still.peek() && fromMoon();
  if (!vars) { leaveStill(); return; }
  turning = true;
  const go = () => { turning = false; leaveStill(); };
  void turn('wake', go, { vars }).finally(() => turning && go());
}

/** A keystroke in a composer while Still is on. Outside Still nothing is counted. */
export function noteKeystroke(t = Date.now()): void {
  const s = still.peek();
  if (!s) return;
  const x = session.peek();
  session.value = keystroke(x && x.since === s.since ? x : freshSession(s.since), t);
}

/** "Keep writing" or "Close the page": either way the ring never asks again this session. */
export function answerEnough(): void {
  const x = current.peek();
  if (x) session.value = { ...x, answered: true };
}

/** For tests. */
export function resetStillSession(): void {
  session.value = null;
  keptLine.value = null;
}
