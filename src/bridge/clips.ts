// Clips (PLAN-WORLDS.md section 5, W6): a take's audio goes up on its own, never inside an envelope, and only after the
// take's row has been acknowledged (so Music Companion always has the row a clip belongs to). Handed a world's notebook
// (fields.ts handed or handedWorld) and that world's id, never the personal notebook.
//
// Which takes still owe a clip: those with no `clip` mark whose row is no longer waiting in the outbox. A clip goes as
// `POST ?op=clip&world&take&rev` with the take's own `at` as its rev (it never changes, so a resend after a lost answer
// is "same"), its body the bytes as recorded and its content type the recorder's (audioType, parameters dropped by the
// function). Acknowledged (stored, same or older), the take is marked `clip: { world, at }` through writeDown, outside
// the outbox, so the mark itself never sends the take again. Offline, nothing is marked and the next carry tries again.
// A take moved to another world keeps its mark (model/move.ts): its clip is not sent twice.
import type { Handed } from '../db/fields';
import type { Take } from '../db/schema';
import { CLEARS, CLIP_MAX_BYTES } from './protocol';
import { BridgeError, postClip } from './net';

/** The takes of this notebook that owe a clip now. Locked: none. */
export async function owed(h: Handed): Promise<Take[]> {
  if (!h.open()) return [];
  const waiting = new Set((await h.db.outbox.toArray()).filter(o => o.table === 'takes').map(o => o.id));
  const takes = await h.query('takes', t => t.toCollection());
  return takes.filter(t => !t.locked && !t.clip && !waiting.has(t.id) && t.audio.byteLength > 0) as Take[];
}

/** A function's answer that will be the same however often it is asked: too large (413), not a type it takes (415), or
 *  a request it calls wrong (400, 422). Anything else (a 5xx, a 401 while a token is changed) is tried again. */
const ASIDE: Record<number, NonNullable<Take['clip']>['aside']> = { 413: 'size', 415: 'refused', 400: 'refused', 422: 'refused' };

/**
 * Sends every clip owed, one at a time, and marks each acknowledged. Returns how many were acknowledged. Offline stops
 * it (BridgeError 'offline', the rest left for the next carry); nothing else does: a clip too large to carry (over
 * CLIP_MAX_BYTES, never sent, or a 413) or one the function refuses for good is set aside, marked with why, and the
 * take says so under its line (ui/songs/Take.tsx); a passing failure leaves that one for the next carry and goes on to
 * the next (the review of PR 112: a refused clip had stopped the carry, the other worlds and the pocket with it).
 */
export async function sendClips(h: Handed, world: string, token: string, fetcher?: typeof fetch): Promise<number> {
  let n = 0;
  const mark = async (id: string, aside?: 'size' | 'refused') => {
    const now = await h.get('takes', id);
    if (!now || now.locked) return;
    const { locked: _, ...row } = now as Take & { locked?: true };
    await h.writeDown({ takes: [{ ...row, clip: { world, at: Date.now(), ...(aside ? { aside } : {}) } }] });
  };
  for (const t of await owed(h)) {
    if (t.audio.byteLength > CLIP_MAX_BYTES) { await mark(t.id, 'size'); continue; }
    let result;
    try {
      result = (await postClip(token, world, t.id, Math.max(1, Math.round(t.at)), t.audio, t.audioType || 'audio/mp4', fetcher)).result;
    } catch (e) {
      if (e instanceof BridgeError && e.status === 'offline') throw e;
      const aside = e instanceof BridgeError && typeof e.status === 'number' ? ASIDE[e.status] : undefined;
      if (aside) await mark(t.id, aside);
      continue;
    }
    if (result === 'refused') { await mark(t.id, 'refused'); continue; }
    if (!CLEARS.includes(result)) continue;
    await mark(t.id);
    n++;
  }
  return n;
}
