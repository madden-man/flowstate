// The blind (DESIGN.md rules 13 and 20): on any page, pull the page down from the top and Still comes down
// behind it like a blind. The page follows the finger with no transition while dragging; let go past 80px
// and Still settles in (one tick, the long low tone); short of it, the page goes back up.
// It only arms when the touch starts on a scroll area already at its top and the drag is downward, so
// ordinary scrolling, the composer, the chip row, the sliders and the sheets keep their own gestures.
// Touch events, not pointer events: Safari hands a vertical pan to the scroller and cancels the pointer,
// so the only way to hold the page at scrollTop 0 is a non-passive touchmove. A mouse uses pointer events.
import { useEffect, useRef } from 'preact/hooks';
import type { RefObject } from 'preact';
import { still } from '../light';
import { settle } from '../still';
import { RingMark } from './Ring';

export const BLIND_COMMIT_PX = 80;
/** How far the decision waits before calling a drag a pull, a scroll or a sideways swipe. */
const DECIDE_PX = 8;
/** What keeps its own gesture: fields, the chip row, sliders, the spread, sheets, anything marked. */
const OWN = 'textarea, input, select, [contenteditable], .fs-composer, .fs-composer-wrap, .fs-chips, [role="slider"], .fs-spread, .fs-sheet, .fs-scrim, [data-noblind]';

/** Every scroller between the touch and the page is at its top. */
function atTop(target: Element, page: Element): boolean {
  for (let el: Element | null = target; el && el !== page; el = el.parentElement) {
    if (el.scrollTop > 0) return false;
  }
  return true;
}

type Drag = { y0: number; x0: number; dy: number; state: 'maybe' | 'pull' | 'no'; id?: number };

/** Wires the blind onto a page. The page element moves; the blind panel inside it hangs above its top. */
export function useBlind(pageRef: RefObject<HTMLElement>, blindRef: RefObject<HTMLElement>): void {
  const drag = useRef<Drag | null>(null);
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const set = (dy: number, moving: boolean) => {
      page.classList.toggle('fs-pulling', moving);
      page.style.transform = dy ? `translateY(${dy}px)` : '';
      blindRef.current?.classList.toggle('ready', dy >= BLIND_COMMIT_PX);
    };
    const start = (x: number, y: number, target: EventTarget | null, id?: number) => {
      drag.current = null;
      if (still.peek() || !(target instanceof Element) || target.closest(OWN) || !atTop(target, page)) return;
      drag.current = { x0: x, y0: y, dy: 0, state: 'maybe', id };
    };
    /** Returns true while the page is being pulled (the caller then stops the browser's own pan). */
    const move = (x: number, y: number): boolean => {
      const d = drag.current;
      if (!d || d.state === 'no') return false;
      const dy = y - d.y0, dx = x - d.x0;
      if (d.state === 'maybe') {
        if (Math.abs(dy) < DECIDE_PX && Math.abs(dx) < DECIDE_PX) return false;
        d.state = dy > 0 && dy > Math.abs(dx) * 1.2 ? 'pull' : 'no';
        if (d.state === 'no') return false;
      }
      // the page follows the finger, up to about half the screen
      d.dy = Math.max(0, Math.min(dy, page.clientHeight * 0.45));
      set(d.dy, true);
      return true;
    };
    let pulledAt = 0;
    const end = () => {
      const d = drag.current;
      drag.current = null;
      if (!d || d.state !== 'pull') return;
      pulledAt = Date.now();
      set(0, false);
      if (d.dy >= BLIND_COMMIT_PX) settle();
    };

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
    // a pull is not a tap: the click that follows it lands nowhere
    const onClick = (e: MouseEvent) => { if (Date.now() - pulledAt < 400) { e.preventDefault(); e.stopPropagation(); } };

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

/** Still, waiting above the page: the ring, held, in Still's own light. */
export function BlindPanel({ panel }: { panel: RefObject<HTMLDivElement> }) {
  return (
    <div ref={panel} class="fs-blind" data-light="still" aria-hidden="true">
      <RingMark still />
    </div>
  );
}
