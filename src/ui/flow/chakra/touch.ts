// The one dispatcher for a sign's touches (PLAN-TASKS.md T1). A touch word on the plate (./Touches.tsx) calls onTouch;
// onTouch marks the word active and runs the handler registered for it, if any. T1 registers none, so for now every
// touch only lights its word. Later packages fill in their kinds, each in a file of its own under ./handlers/ (loaded by
// ./handlers/index.ts, so no package edits another's lines or this file):
//   T2 in the place   ./handlers/place.tsx   registerTouch({ lands: 'place' }, ...) or by id ({ id: 'grieve' })
//   T3 into the app   ./handlers/into.ts     registerTouch({ lands: 'today' }, ...), { lands: 'council' }, ...
//   T4 out of the app ./handlers/out.ts      registerTouch({ lands: 'messages' }, ...), { lands: 'calendar' }, ...
// The most specific key wins: chakra and id, then id, then lands, then kind. A handler may act (route, open, leave the
// app), draw on the plate while its word is active (View), and say the touch is done (done), which is what the surge
// (T2, PLAN-TASKS.md section 5) hangs off: touchDone carries the last one, and onTouchDone subscribes to it.
import type { ComponentType } from 'preact';
import { signal } from '@preact/signals';
import type { Lands, Touch, TouchKind } from '../../../model/acts';
import type { ChakraId } from '../../../model/mountain';

/** What a handler is registered for. Give one of: chakra with id, id, lands, kind. */
export type TouchKey = { chakra: ChakraId; id: string } | { id: string } | { lands: Lands } | { kind: TouchKind };

/** What a handler gets on a touch, and what its View gets while its word is active. */
export type TouchAct = {
  chakra: ChakraId;
  touch: Touch;
  /** Through the door without the PIN: only touches with door: true reach a handler here, and nothing may be written. */
  door: boolean;
  /** In Still: touches work, no hue, no pool, no surge (section 5). */
  still: boolean;
  /** The router's route (preact-iso): to a hash path such as '/journal', replace for no turn. */
  route: (to: string, replace?: boolean) => void;
  /** The touch happened: sets touchDone, once per call. A touch that leaves the app calls it when he comes back. */
  done: () => void;
  /** Puts the word back at rest (the lead lit again) and runs the handler's cleanup. */
  close: () => void;
};

export type TouchHandler = {
  /** Runs on the tap, after the word is marked active. May return a cleanup, run when another word is touched, this
   *  word is tapped again, close is called or the page goes. */
  act?: (a: TouchAct) => void | (() => void) | Promise<void>;
  /** Drawn over the plate while this word is active, in the plate's own box (.ck-stage). */
  View?: ComponentType<TouchAct>;
};

/** The last touch done, for the surge: which sign, which touch, when. */
export type TouchDone = { chakra: ChakraId; touch: string; at: number };
export const touchDone = signal<TouchDone | null>(null);

/** Calls fn for every touch done from now on; returns its undo. */
export function onTouchDone(fn: (d: TouchDone) => void): () => void {
  let first = true;
  return touchDone.subscribe(d => { if (first) { first = false; return; } if (d) fn(d); });
}

const byKey = new Map<string, TouchHandler>();
const keyOf = (k: TouchKey): string =>
  'chakra' in k ? `sign:${k.chakra}/${k.id}` : 'id' in k ? `id:${k.id}` : 'lands' in k ? `lands:${k.lands}` : `kind:${k.kind}`;

/** Registers a handler; a second one for the same key replaces the first. Returns its undo. */
export function registerTouch(key: TouchKey, handler: TouchHandler): () => void {
  const k = keyOf(key);
  byKey.set(k, handler);
  return () => { if (byKey.get(k) === handler) byKey.delete(k); };
}

/** The handler for this touch on this sign, most specific first, or undefined (the word only lights). */
export function handlerFor(chakra: ChakraId, touch: Touch): TouchHandler | undefined {
  return byKey.get(keyOf({ chakra, id: touch.id })) ?? byKey.get(keyOf({ id: touch.id }))
    ?? byKey.get(keyOf({ lands: touch.lands })) ?? byKey.get(keyOf({ kind: touch.kind }));
}

/** Says a touch is done (what TouchAct.done calls). */
export function markDone(chakra: ChakraId, touch: string, at = Date.now()): void {
  touchDone.value = { chakra, touch, at };
}

/** The dispatcher: runs the touch's handler, if any, with what it needs. The page has already marked the word
 *  active. Returns the handler's cleanup, if it gave one. Through the door a touch without door: true does nothing. */
export function onTouch(chakra: ChakraId, touch: Touch, ctx: Omit<TouchAct, 'chakra' | 'touch' | 'done'>): (() => void) | undefined {
  if (ctx.door && !touch.door) return undefined;
  const h = handlerFor(chakra, touch);
  const out = h?.act?.({ ...ctx, chakra, touch, done: () => markDone(chakra, touch.id) });
  return typeof out === 'function' ? out : undefined;
}
