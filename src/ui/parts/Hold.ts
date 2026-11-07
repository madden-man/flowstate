// Long press (DESIGN.md rule 8: long press means pick up, keep close or reply). A 500ms pointer hold that
// does not wander; no context menu, no text selection while holding (parts.css .fs-hold), and a short tap
// still reaches onTap. Used on every message.
import { useRef } from 'preact/hooks';

export const HOLD_MS = 500;
const SLOP_PX = 8;

export function useHold(onHold: () => void, onTap?: () => void) {
  const st = useRef<{ x: number; y: number; t: ReturnType<typeof setTimeout>; el: HTMLElement } | null>(null);
  const fired = useRef(false);
  const end = () => {
    const s = st.current;
    if (!s) return;
    clearTimeout(s.t);
    s.el.classList.remove('holding');
    st.current = null;
  };
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.button > 0) return;
      end();
      fired.current = false;
      const el = e.currentTarget as HTMLElement;
      el.classList.add('holding');
      st.current = { x: e.clientX, y: e.clientY, el, t: setTimeout(() => { fired.current = true; end(); onHold(); }, HOLD_MS) };
    },
    onPointerMove: (e: PointerEvent) => {
      const s = st.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > SLOP_PX) end();
    },
    onPointerUp: end,
    onPointerCancel: end,
    onPointerLeave: end,
    onContextMenu: (e: Event) => e.preventDefault(),
    onClick: (e: Event) => {
      if (fired.current) { e.preventDefault(); fired.current = false; return; }
      onTap?.();
    },
  };
}
