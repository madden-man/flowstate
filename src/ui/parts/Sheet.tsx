// Sheets rise from the bottom over a scrim; nothing is a modal dialog (DESIGN.md rule 8). Close with a
// swipe down on the handle, a tap on the scrim, Done, or Escape. A sheet sits above the page and below
// the tab bar, so the four tabs stay in reach, and it unmounts completely once it has gone down. Under the thumb
// (PLAN-MOTION.md M3): the scrim thins as the sheet is drawn down, a flick puts it away short of the line, and let
// go short and slow it settles back on --ease-settle.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

const COMMIT_PX = 80;
/** A gesture constant, not a duration: a drag moving down faster than this (px per ms) when the finger lifts is a
 *  flick, and puts the sheet away even short of COMMIT_PX. About what a deliberate flick of the thumb reaches. */
const FLICK_PX_PER_MS = 0.5;
/** How far back the flick's speed is read: the last few move events, so a pause before lifting is not a flick. */
const FLICK_WINDOW = 4;

/** A duration token in milliseconds, as the current light sets it (0 under reduced motion). */
export function tokenMs(name: string): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return 0;
  return v.endsWith('ms') ? n : n * 1000;
}

/** An optional word beside Done (a save that stays print-grey and inert until it can act). */
export type SheetAction = { label: string; inert?: boolean; onPress: () => void };
/** back (V7): a word above the title that goes back a screen inside the same sheet ("Playlists"). lead
 *  (PLAN-ENERGIZE.md X5): one more word in the title row, before action ("Spark it" before Edit). */
type Props = { open: boolean; onClose: () => void; title: string; action?: SheetAction; lead?: SheetAction; back?: SheetAction; children?: ComponentChildren };

export function Sheet({ open, onClose, title, action, lead, back, children }: Props) {
  const [shown, setShown] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const sheet = useRef<HTMLElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; dy: number; id: number; seen: { y: number; t: number }[] } | null>(null);

  useEffect(() => {
    if (open) {
      if (sheet.current) sheet.current.style.transform = '';
      if (scrim.current) scrim.current.style.opacity = '';
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
    drag.current = { y0: e.clientY, dy: 0, id: e.pointerId, seen: [{ y: e.clientY, t: e.timeStamp }] };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    sheet.current?.classList.remove('settle');
    scrim.current?.classList.remove('settle');
    sheet.current?.classList.add('drag');
    scrim.current?.classList.add('drag');
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    d.dy = Math.max(0, e.clientY - d.y0);
    d.seen = [...d.seen, { y: e.clientY, t: e.timeStamp }].slice(-FLICK_WINDOW);
    const el = sheet.current;
    if (!el) return;
    el.style.transform = `translateY(${d.dy}px)`;
    // the scrim's darkness follows the sheet: half way down, half as dark
    if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - d.dy / (el.offsetHeight || 1)));
  };
  const up = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const el = sheet.current;
    if (!el) return;
    el.classList.remove('drag');
    scrim.current?.classList.remove('drag');
    const a = d.seen[0], b = d.seen[d.seen.length - 1];
    const flick = b.t > a.t && (b.y - a.y) / (b.t - a.t) > FLICK_PX_PER_MS;
    // Past the line, or flicked, it carries on down from where the finger left it; short and slow, it settles back.
    if (d.dy > COMMIT_PX || (flick && d.dy > 0)) {
      el.style.transform = 'translateY(100%)';
      // on from where the finger left it, never back up to dark first (the next opening clears it)
      if (scrim.current) scrim.current.style.opacity = '0';
      onClose();
      return;
    }
    el.classList.add('settle');
    scrim.current?.classList.add('settle');
    el.style.transform = '';
    if (scrim.current) scrim.current.style.opacity = '';
  };

  return (
    <>
      <div ref={scrim} class={`fs-scrim${leaving ? ' out' : ''}`} onClick={onClose} />
      <section ref={sheet} class={`fs-sheet${leaving ? ' out' : ''}`} aria-label={title} tabIndex={-1} data-sheet={title}>
        <div class="fs-sheet-head" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <div class="fs-grab" />
          {back && <button type="button" class="fs-word fs-sheet-back" onClick={back.onPress}>{back.label}</button>}
          <div class="fs-sheet-title">
            <h2>{title}</h2>
            <span class="fs-sheet-words">
              {lead && <button type="button" class="fs-word fs-lead" onClick={lead.onPress}>{lead.label}</button>}
              {action && (
                <button type="button" class={`fs-word fs-go${action.inert ? ' inert' : ''}`} aria-disabled={action.inert ? 'true' : undefined}
                  onClick={() => { if (!action.inert) action.onPress(); }}>{action.label}</button>
              )}
              <button type="button" class="fs-word" onClick={onClose}>Done</button>
            </span>
          </div>
        </div>
        <div class="fs-sheet-body">{children}</div>
      </section>
    </>
  );
}
