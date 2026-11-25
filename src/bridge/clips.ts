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
import { postClip } from './net';

/** The takes of this notebook that owe a clip now. Locked: none. */
export async function owed(h: Handed): Promise<Take[]> {
  if (!h.open()) return [];
  const waiting = new Set((await h.db.outbox.toArray()).filter(o => o.table === 'takes').map(o => o.id));
  const takes = await h.query('takes', t => t.toCollection());
  return takes.filter(t => !t.locked && !t.clip && !waiting.has(t.id) && t.audio.byteLength > 0 && t.audio.byteLength <= CLIP_MAX_BYTES) as Take[];
}

/** Sends every clip owed, one at a time, and marks each acknowledged. Returns how many were acknowledged. Throws
 *  BridgeError (offline, or a status) at the first that fails, the rest left for the next carry. */
export async function sendClips(h: Handed, world: string, token: string, fetcher?: typeof fetch): Promise<number> {
  let n = 0;
  for (const t of await owed(h)) {
    const r = await postClip(token, world, t.id, Math.max(1, Math.round(t.at)), t.audio, t.audioType || 'audio/mp4', fetcher);
    if (!CLEARS.includes(r.result)) continue;
    const now = await h.get('takes', t.id);
    if (!now || now.locked) continue;
    const { locked: _, ...row } = now as Take & { locked?: true };
    await h.writeDown({ takes: [{ ...row, clip: { world, at: Date.now() } }] });
    n++;
  }
  return n;
}
