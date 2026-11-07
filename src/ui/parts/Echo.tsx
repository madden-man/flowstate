// The echo (DESIGN.md rule 16): one of your own kept lines above a new page, in print grey italic with
// its page's date. Tap to link this page to that one; swipe it away for today. In Still it is the line
// only: no date, nothing to tap.
import { useRef } from 'preact/hooks';
import { notebookDate } from '../date';

const COMMIT_PX = 70;

type Props = { text: string; date: Date; still: boolean; onLink: () => void; onDismiss: () => void };

export function Echo({ text, date, still, onLink, onDismiss }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x0: number; dx: number; id: number } | null>(null);
  const moved = useRef(false);
  const set = (dx: number) => {
    if (!el.current) return;
    el.current.style.transform = dx ? `translateX(${dx}px)` : '';
    el.current.style.opacity = dx ? String(Math.max(0.1, 1 - Math.abs(dx) / 160)) : '';
  };
  return (
    <div ref={el} class="fs-echo" data-echo
      onPointerDown={e => { drag.current = { x0: e.clientX, dx: 0, id: e.pointerId }; moved.current = false; el.current?.classList.add('drag'); }}
      onPointerMove={e => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        d.dx = e.clientX - d.x0;
        if (Math.abs(d.dx) > 6) { moved.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
        if (moved.current) set(d.dx);
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        el.current?.classList.remove('drag');
        if (!d) return;
        if (Math.abs(d.dx) > COMMIT_PX) { set(d.dx > 0 ? 480 : -480); onDismiss(); } else set(0);
      }}
      onPointerCancel={() => { drag.current = null; el.current?.classList.remove('drag'); set(0); }}
    >
      {still ? (
        <span class="fs-echo-line">{text}</span>
      ) : (
        <button type="button" class="fs-echo-tap" aria-label="Link this page to that one"
          onClick={() => { if (!moved.current) onLink(); }}>
          <small class="fs-echo-date">{notebookDate(date)}</small>
          <span class="fs-echo-line">{text}</span>
        </button>
      )}
    </div>
  );
}
