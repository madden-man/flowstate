// Sheets rise from the bottom over a scrim; nothing is a modal dialog (DESIGN.md rule 8). Close with a
// swipe down on the handle, a tap on the scrim, Done, or Escape. A sheet sits above the page and below
// the tab bar, so the four tabs stay in reach, and it unmounts completely once it has gone down.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

const COMMIT_PX = 80;

/** A duration token in milliseconds, as the current light sets it (0 under reduced motion). */
function tokenMs(name: string): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return 0;
  return v.endsWith('ms') ? n : n * 1000;
}

type Props = { open: boolean; onClose: () => void; title: string; children?: ComponentChildren };

export function Sheet({ open, onClose, title, children }: Props) {
  const [shown, setShown] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const sheet = useRef<HTMLElement>(null);
  const drag = useRef<{ y0: number; dy: number; id: number } | null>(null);

  useEffect(() => {
    if (open) {
      if (sheet.current) sheet.current.style.transform = '';
      setShown(true);
      setLeaving(false);
      return;
    }
    if (!shown) return;
    setLeaving(true);
    const t = setTimeout(() => { setShown(false); setLeaving(false); }, tokenMs('--t-page') + 40);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    requestAnimationFrame(() => sheet.current?.focus({ preventScroll: true }));
    return () => removeEventListener('keydown', onKey);
  }, [open]);

  if (!shown) return null;

  const down = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { y0: e.clientY, dy: 0, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    sheet.current?.classList.add('drag');
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    d.dy = Math.max(0, e.clientY - d.y0);
    if (sheet.current) sheet.current.style.transform = `translateY(${d.dy}px)`;
  };
  const up = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const el = sheet.current;
    if (!el) return;
    el.classList.remove('drag');
    // Past the line it carries on down from where the finger left it; short of it, it settles back.
    el.style.transform = d.dy > COMMIT_PX ? 'translateY(100%)' : '';
    if (d.dy > COMMIT_PX) onClose();
  };

  return (
    <>
      <div class={`fs-scrim${leaving ? ' out' : ''}`} onClick={onClose} />
      <section ref={sheet} class={`fs-sheet${leaving ? ' out' : ''}`} aria-label={title} tabIndex={-1} data-sheet={title}>
        <div class="fs-sheet-head" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <div class="fs-grab" />
          <div class="fs-sheet-title">
            <h2>{title}</h2>
            <button type="button" class="fs-word" onClick={onClose}>Done</button>
          </div>
        </div>
        <div class="fs-sheet-body">{children}</div>
      </section>
    </>
  );
}
