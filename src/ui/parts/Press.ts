// Press (DESIGN.md rule 26, PLAN-MOTION.md): down is instant, up is eased. One listener for the whole app puts
// data-down on the control under the thumb at pointerdown, and takes it off at up, at cancel (the browser took the
// touch for a scroll) or once the finger has wandered. parts.css says what "down" looks like for each part, with no
// transition going down and --t-ui coming back, so the page answers the touch itself and not the click after it.
// An attribute, not a class: a re-render may rewrite a part's class while it is held, and must not lift it.

/** What can be pressed. parts.css decides which of these show it. */
export const PRESSABLE = 'button, a, [role="button"], [role="checkbox"], [data-press]';
const OFF = ':disabled, [aria-disabled="true"], .inert';
/** A finger that has moved this far is scrolling or dragging, not pressing. */
const SLOP_PX = 10;

/** Starts the one listener; returns its undo. */
export function startPress(root: Document | HTMLElement = document): () => void {
  let el: Element | null = null, x = 0, y = 0;
  const lift = () => { el?.removeAttribute('data-down'); el = null; };
  const down = (e: Event) => {
    const p = e as PointerEvent;
    if (p.button > 0) return;
    lift();
    const t = (p.target as Element | null)?.closest?.(PRESSABLE);
    if (!t || t.matches(OFF)) return;
    el = t; x = p.clientX; y = p.clientY;
    t.setAttribute('data-down', '');
  };
  const move = (e: Event) => {
    const p = e as PointerEvent;
    if (el && Math.hypot(p.clientX - x, p.clientY - y) > SLOP_PX) lift();
  };
  const opts = { passive: true, capture: true } as const;
  root.addEventListener('pointerdown', down, opts);
  root.addEventListener('pointermove', move, opts);
  root.addEventListener('pointerup', lift, opts);
  root.addEventListener('pointercancel', lift, opts);
  addEventListener('blur', lift);
  return () => {
    lift();
    root.removeEventListener('pointerdown', down, opts);
    root.removeEventListener('pointermove', move, opts);
    root.removeEventListener('pointerup', lift, opts);
    root.removeEventListener('pointercancel', lift, opts);
    removeEventListener('blur', lift);
  };
}
