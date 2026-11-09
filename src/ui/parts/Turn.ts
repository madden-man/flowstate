// Turn (DESIGN.md rules 28 and 29, PLAN-MOTION.md): one view transition at a time, named. turn('still', update)
// sets html[data-turn="still"], runs update inside document.startViewTransition, and takes the name off when it is
// over; parts.css says how each kind moves (::view-transition-old/new under html[data-turn="..."]) and which parts
// travel (view-transition-name). Where the browser has no view transitions, or Reduce Motion is on, update just
// runs: every turn is a nicety on top of a change that already works without it.
//
// Preact renders a signal's change on a microtask, so the new page is not in the DOM when update returns; turn waits
// one task after update before the browser takes the "after" picture. A caller whose page fills later (a read from
// the database) passes `ready`, awaited too, but never for longer than WAIT_MS: a turn must not hold a tap up.

/** The longest a turn waits for the new page before showing whatever is there. */
export const WAIT_MS = 120;

type VT = { finished: Promise<void>; skipTransition(): void };
type Doc = Document & { startViewTransition?: (update: () => void | Promise<void>) => VT };

let running = 0;

export const canTurn = () =>
  typeof document !== 'undefined' && typeof (document as Doc).startViewTransition === 'function'
  && !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

const task = () => new Promise<void>(r => setTimeout(r, 0));

/** Runs update as the named turn. vars are set on <html> for its length (where a circle opens from, say). Resolves
 *  when the turn is over (at once, where there is none). */
export async function turn(kind: string, update: () => void | Promise<void>, opts: { vars?: Record<string, string>; ready?: () => Promise<unknown> } = {}): Promise<void> {
  if (!canTurn()) { await update(); return; }
  const html = document.documentElement, mine = ++running;
  const vars = Object.entries(opts.vars ?? {});
  html.dataset.turn = kind;
  for (const [k, v] of vars) html.style.setProperty(k, v);
  try {
    const vt = (document as Doc).startViewTransition!(async () => {
      await update();
      await task();
      if (opts.ready) await Promise.race([opts.ready(), new Promise(r => setTimeout(r, WAIT_MS))]);
    });
    await vt.finished;
  } catch {
    // skipped by a newer turn, or the page went away: the change itself has happened
  } finally {
    // a newer turn owns the name now; leave it be
    if (mine === running) {
      delete html.dataset.turn;
      for (const [k] of vars) html.style.removeProperty(k);
    }
  }
}
