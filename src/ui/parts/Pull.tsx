// The pull (DESIGN.md rules 13 and 20; V6): on any page, pull the page down from the top and the rail of
// earlier pages comes down above it. The page follows the finger with no transition while dragging; let go
// past 80px and the rail stays open, the page held at the rail's height; short of it, the page goes back up.
// Open, the rail closes on a row tap, a tap on the page beneath, an upward drag past 40px or a tab change.
// It never changes the light: Still is the moon's (V6), and in Still the pull does nothing.
// It only arms when the touch starts on a scroll area already at its top and the drag is downward, so
// ordinary scrolling, the composer, the chip row, the sliders and the sheets keep their own gestures.
// Touch events, not pointer events: Safari hands a vertical pan to the scroller and cancels the pointer,
// so the only way to hold the page at scrollTop 0 is a non-passive touchmove. A mouse uses pointer events.
import { useEffect, useRef } from 'preact/hooks';
import type { RefObject } from 'preact';
import { effect } from '@preact/signals';
import { still } from '../light';
import { earlierOpen } from './Earlier';

export const PULL_COMMIT_PX = 80;
/** Open, an upward drag this far puts the rail back up. */
export const PULL_CLOSE_PX = 40;
/** How far the decision waits before calling a drag a pull, a scroll or a sideways swipe. */
const DECIDE_PX = 8;
/** A pull starts at once; a finger that rests first is a long press (pick up, keep close, reply). */
const PROMPT_MS = 350;
/** What keeps its own gesture: fields, the chip row, sliders, sheets, anything marked. */
const OWN = 'textarea, input, select, [contenteditable], .fs-composer, .fs-composer-wrap, .fs-chips, [role="slider"], .fs-sheet, .fs-scrim, [data-nopull]';
/** The rail itself: its rows are taps and it scrolls on its own; a drag that starts there is not the page's. */
const RAIL = '.fs-earlier';

/** The touch is free for the pull: every scroller between it and the page is at its top, and nothing on
 *  the way has taken the touch for itself (touch-action: none, as the spread's goals do). */
function free(target: Element, page: Element): boolean {
  if (target.closest(OWN)) return false;
  for (let el: Element | null = target; el && el !== page; el = el.parentElement) {
    if (el.scrollTop > 0 || getComputedStyle(el).touchAction === 'none') return false;
  }
  return true;
}

type Drag = { y0: number; x0: number; t0: number; dy: number; from: number; state: 'maybe' | 'pull' | 'no'; id?: number };

/** Wires the pull onto a page. The page element moves; the rail inside it hangs above its top.
 *  `onArm` runs as a pull may begin (the touch is down and free), so the rows are read before the finger
 *  has moved far enough to decide. */
export function usePull(pageRef: RefObject<HTMLElement>, railRef: RefObject<HTMLElement>, onArm: () => void): void {
  const drag = useRef<Drag | null>(null);
  const arm = useRef(onArm);
  arm.current = onArm;
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const railHeight = () => railRef.current?.offsetHeight ?? 0;
    const set = (dy: number, moving: boolean) => {
      page.classList.toggle('fs-pulling', moving);
      page.style.transform = dy ? `translateY(${dy}px)` : '';
      railRef.current?.classList.toggle('ready', dy >= PULL_COMMIT_PX);
    };
    // when the last pull ended: the click that follows it is swallowed, unless a new touch has begun since
    let pulledAt = 0;
    const start = (x: number, y: number, target: EventTarget | null, id?: number) => {
      drag.current = null;
      pulledAt = 0;
      if (still.peek() || !(target instanceof Element)) return;
      const open = earlierOpen.peek();
      // open, the whole page beneath is the rail's handle (pull it up to close); closed, only a free touch arms
      if (open ? !!target.closest(RAIL) : !free(target, page)) return;
      drag.current = { x0: x, y0: y, t0: Date.now(), dy: 0, from: open ? railHeight() : 0, state: 'maybe', id };
      if (!open) arm.current();
    };
    /** Returns true while the page is being pulled (the caller then stops the browser's own pan). */
    const move = (x: number, y: number): boolean => {
      const d = drag.current;
      if (!d || d.state === 'no') return false;
      const dy = y - d.y0, dx = x - d.x0;
      if (d.state === 'maybe') {
        if (Math.abs(dy) < DECIDE_PX && Math.abs(dx) < DECIDE_PX) return false;
        const vertical = Math.abs(dy) > Math.abs(dx) * 1.2 && Date.now() - d.t0 < PROMPT_MS;
        d.state = vertical && (d.from > 0 || dy > 0) ? 'pull' : 'no';
        if (d.state === 'no') return false;
      }
      // the page follows the finger, up to about half the screen (the rail's own cap)
      d.dy = dy;
      set(Math.max(0, Math.min(d.from + dy, page.clientHeight * 0.45)), true);
      return true;
    };
    const end = () => {
      const d = drag.current;
      drag.current = null;
      if (!d || d.state !== 'pull') return;
      pulledAt = Date.now();
      const open = d.from > 0 ? d.dy > -PULL_CLOSE_PX : d.dy >= PULL_COMMIT_PX;
      // no tick and no bell: opening a list is not one of rule 19's ticks
      earlierOpen.value = open;
      set(open ? railHeight() : 0, false);
    };
    // the rail opens and closes from outside too (a row tap, a tab change, Still): the page follows the signal
    const stop = effect(() => {
      const open = earlierOpen.value;
      if (still.value && open) { earlierOpen.value = false; return; }
      if (!drag.current || drag.current.state !== 'pull') set(open ? railHeight() : 0, false);
    });

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { drag.current = null; return; }
      const t = e.touches[0];
      start(t.clientX, t.clientY, e.target);
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t && move(t.clientX, t.clientY) && e.cancelable) e.preventDefault();
    };
    const onPointerDown = (e: PointerEvent) => { if (e.pointerType === 'mouse' && e.button === 0) start(e.clientX, e.clientY, e.target, e.pointerId); };
    const onPointerMove = (e: PointerEvent) => {
      const d = drag.current;
      if (e.pointerType !== 'mouse' || !d || d.id !== e.pointerId) return;
      if (move(e.clientX, e.clientY)) { e.preventDefault(); page.setPointerCapture?.(e.pointerId); }
    };
    const onPointerUp = (e: PointerEvent) => { if (e.pointerType === 'mouse' && drag.current?.id === e.pointerId) end(); };
    const onClick = (e: MouseEvent) => {
      // a pull is not a tap: the click that follows it lands nowhere
      if (Date.now() - pulledAt < 400) { e.preventDefault(); e.stopPropagation(); return; }
      if (!earlierOpen.peek()) return;
      // open: a row (or All pages) goes where it links and the rail goes up; the page beneath only closes it
      const onRail = e.target instanceof Element && !!e.target.closest(RAIL);
      if (!onRail) { e.preventDefault(); e.stopPropagation(); }
      earlierOpen.value = false;
    };

    page.addEventListener('touchstart', onTouchStart, { passive: true });
    page.addEventListener('touchmove', onTouchMove, { passive: false });
    page.addEventListener('touchend', end);
    page.addEventListener('touchcancel', end);
    page.addEventListener('pointerdown', onPointerDown);
    page.addEventListener('pointermove', onPointerMove);
    page.addEventListener('pointerup', onPointerUp);
    page.addEventListener('pointercancel', onPointerUp);
    page.addEventListener('click', onClick, true);
    return () => {
      stop();
      // the rail belongs to this page: a page that goes takes it up with it, before the next page mounts
      earlierOpen.value = false;
      page.removeEventListener('click', onClick, true);
      page.removeEventListener('touchstart', onTouchStart);
      page.removeEventListener('touchmove', onTouchMove);
      page.removeEventListener('touchend', end);
      page.removeEventListener('touchcancel', end);
      page.removeEventListener('pointerdown', onPointerDown);
      page.removeEventListener('pointermove', onPointerMove);
      page.removeEventListener('pointerup', onPointerUp);
      page.removeEventListener('pointercancel', onPointerUp);
      set(0, false);
    };
  }, []);
}
