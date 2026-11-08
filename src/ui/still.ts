// Still, the session (PLAN.md section 8, DESIGN.md rule 13). light.ts holds whether Still is on; this file
// holds what one Still session knows: when it began, how long you have been typing, whether the ring has
// asked "Enough for now?" yet, and which kept line sits at the top. None of it is written to the data:
// entering or leaving Still changes nothing in the journal. The only thing kept between sessions is the
// list of kept-line ids Still has already shown (ids, no text), so the next session shows the next line.
import { signal, computed } from '@preact/signals';
import { still, enterStill, leaveStill } from './light';
import { tick } from './parts/Haptic';
import { bell } from './parts/Sound';
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

/** Entering Still, by the moon (the only way in since V6): one tick and the long low tone. */
export function settle(): void {
  if (still.peek()) return;
  enterStill();
  session.value = freshSession(still.peek()!.since);
  tick('still');
  bell('settle');
}

/** The ring: back to the light of the sky. No tick, no bell. */
export function rise(): void {
  leaveStill();
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
