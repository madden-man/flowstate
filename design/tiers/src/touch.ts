// The Be walkthroughs' hand (design/tiers and design/folds, PLAN-TIERS.md B3 and PLAN-FOLDS.md G3): taps and touch
// pointer events dispatched where a thumb would be, as test/e2e/be-drag.spec.ts drives the drag. A lift is a long press
// on a row's word; a carry is short moves to a landing rule, a row, or a folded place's line; and there is no pointerup
// unless the step drops, so the row stays held where the finger left it. While a row is held the page takes no touch of
// its own (a stray mouse over the phone would move it).

export const frames = (n = 2) => new Promise<void>(r => { const f = (k: number) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); });
export const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
export async function seen<T extends Element>(sel: string, ms = 4000): Promise<T | null> {
  for (const until = performance.now() + ms; performance.now() < until; await wait(25)) {
    const el = document.querySelector<T>(sel);
    if (el) return el;
  }
  return null;
}

/** A tap where a thumb would put it: the middle of the element, as a click the app's own handlers read. */
export function tap(el: Element | null | undefined): void {
  if (!el) return;
  const r = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
}

/** A place's heading button (PLAN-FOLDS.md section 2): a tap folds or opens the place. */
export const headingOf = (place: string) => document.querySelector<HTMLElement>(`.fs-values [data-heading="${place}"] > button`);

/** One touch pointer event at (x, y), on whatever is under it, a frame after the last (be-drag.spec.ts's fire). */
export async function fire(type: string, x: number, y: number): Promise<void> {
  const el = document.elementFromPoint(x, y) ?? document.body;
  el.dispatchEvent(new PointerEvent(type, { pointerId: 11, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
  await frames(1);
}

const POSE = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'click', 'contextmenu', 'touchstart', 'touchmove', 'touchend', 'wheel'];
const stop = (e: Event) => { if (e.isTrusted) { e.stopImmediatePropagation(); e.preventDefault(); } };
/** While a row is held the page takes no touch of its own: a real pointer (trusted) stops at the window. */
export function holdThePose(): void {
  for (const t of POSE) addEventListener(t, stop, { capture: true, passive: false });
}
/** Once the row is let go the page answers again. */
const letThePoseGo = () => { for (const t of POSE) removeEventListener(t, stop, { capture: true }); };

export const lifted = () => document.querySelector<HTMLElement>('.fs-values .fs-be-row.lift');
const list = () => document.querySelector<HTMLElement>('.fs-values');
const landOf = (place: string) => document.querySelector(`.fs-values [data-land="${place}"]`);
const foldedLine = (place: string) => document.querySelector(`.fs-values [data-heading="${place}"][data-folded]`);

export type Hold = { x: number; y: number; grab: number; h: number };
/** A long press on a row's word, held until it lifts. */
export async function lift(row: Element | null): Promise<Hold | null> {
  const w = row?.querySelector('.fs-dichotomy');
  if (!w) return null;
  w.scrollIntoView({ block: 'nearest' });
  await frames(2);
  const b = w.getBoundingClientRect();
  const x = b.left + b.width / 3, y = b.top + b.height / 2;
  await fire('pointerdown', x, y);
  for (let k = 0; k < 60 && !lifted(); k++) await wait(25);
  const r = lifted()?.getBoundingClientRect();
  if (!r) return null;
  await frames(3);
  const r2 = lifted()!.getBoundingClientRect();
  return { x, y, grab: y - r2.top, h: r.height };
}

/** Moves the finger to y in short moves. */
async function moveTo(hold: Hold, y: number): Promise<void> {
  const steps = 16, from = hold.y;
  for (let i = 1; i <= steps; i++) { await fire('pointermove', hold.x, from + ((y - from) * i) / steps); await wait(16); }
  hold.y = y;
}

/** Carries the held row until its top edge is just past the middle of `to`, measured as if the row were not in the
 *  list (a slot below it sits a row higher once it is taken out), as be-drag.spec.ts's carry. */
async function carry(hold: Hold, to: Element): Promise<void> {
  const t = to.getBoundingClientRect(), r = lifted()!.getBoundingClientRect();
  const below = t.top >= r.bottom - 1;
  await moveTo(hold, t.top - (below ? hold.h : 0) + t.height / 2 + 3 + hold.grab);
}

/** Moves the finger by however far the held row now stands off its slot (its translate, less the lift's 2px). */
async function settleInSlot(hold: Hold): Promise<void> {
  const off = new DOMMatrixReadOnly(getComputedStyle(lifted()!).transform).m42 + 2;
  if (Math.abs(off) > 1) await moveTo(hold, hold.y - off);
}

/** Until the list has not scrolled for a few frames (the edge scroll runs while the finger sits near an edge). */
async function scrollSettles(): Promise<void> {
  const sc = list();
  if (!sc) return;
  let last = sc.scrollTop, still = 0;
  for (let k = 0; k < 400 && still < 8; k++) { await frames(1); still = sc.scrollTop === last ? still + 1 : 0; last = sc.scrollTop; }
}

/**
 * Lifts a row and carries it, and leaves it held there (or holds it where it lifted, with no `to`). `to` is a place
 * (its landing rule, or its line when it is folded: the finger goes onto the line, PLAN-FOLDS.md section 5) or a row's
 * element (the row rides into the gap after it). The list is first scrolled so the mark sits mid-list, as a thumb
 * would scroll before it reached for it, so the finger comes to rest outside the edge bands where it can; where it
 * cannot (Legacy is the foot), the list is at its end and stops. Returns the hold, for a drop.
 */
export async function pose(row: Element | null, to?: string | Element): Promise<Hold | null> {
  holdThePose();
  const hold = await lift(row);
  const sc = list();
  if (!hold || !to || !sc) return hold;
  const mark = () => (typeof to === 'string' ? foldedLine(to) ?? landOf(to) : to);
  const first = mark();
  if (!first) return hold;
  const lr = sc.getBoundingClientRect(), t = first.getBoundingClientRect();
  sc.scrollTop += (t.top + t.bottom) / 2 - (lr.top + lr.bottom) / 2;
  // the finger has not moved: the row is drawn where it now is in the list
  await fire('pointermove', hold.x, hold.y);
  const place = typeof to === 'string' ? to : (to as HTMLElement).dataset.place;
  for (let k = 0; k < 4; k++) {
    const target = mark();
    if (!target) return hold;
    if (typeof to === 'string' && target.matches('[data-folded]')) {
      // onto the folded line itself: the finger on it is that place's foot. The line moves up as the row leaves the
      // places above it, so the finger follows it until it rests on its middle.
      for (let j = 0; j < 4; j++) {
        const r = target.getBoundingClientRect(), mid = (r.top + r.bottom) / 2;
        if (j && Math.abs(mid - hold.y) < 2) break;
        await moveTo(hold, mid);
      }
    } else await carry(hold, target);
    await scrollSettles();
    if (lifted()?.dataset.place === place) {
      // carried into a gap between rows, the finger settles so the row sits in its slot, not over the row above it
      if (typeof to !== 'string') await settleInSlot(hold);
      return hold;
    }
  }
  return hold;
}

/** Lets the held row go where it is, and gives the page its touch back. */
export async function drop(hold: Hold): Promise<void> {
  await fire('pointerup', hold.x, hold.y);
  letThePoseGo();
}
