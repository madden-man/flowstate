// parts/RuleDrag (PLAN-MOUNTAIN.md section 5; R3's gate gesture, shared in R2 with the Depression meter): the one way a
// drawn rule's mark is dragged, so the gate and the meter keep the same touch rules.
//
// A touch is not a drag until it is decided. Nothing moves on pointerdown: the touch must travel SLOP_PX sideways, more
// than it travels down, before the mark is taken (parts/Spread decides a press the same way). A touch that goes down
// first is the page's scroll (touch-action pan-y on the rule): it is let go, and nothing moves, ticks or is written.
// Once taken, the mark follows the finger by how far it has moved (it does not jump to the finger), with no transition
// (DESIGN.md rule 20); onInput says where it is on every move, and onCommit says where it was let go, once, on release
// (never with the value it began at). A plain tap writes nothing. A cancel (the browser took the touch after all) puts
// the mark back where it was before the touch and says so through onCancel (or onInput, for a parent without one).
//
// Keys: arrows a twentieth, Home and End to the ends; a key moves it live, and it is committed once, on key up or blur,
// so a held arrow writes one reading. A tick through parts/Haptic when the mark lands on either end, nothing else.
// disabled takes no touch and no key, and lets go of whatever was in hand, unwritten.
import { useEffect, useRef, useState } from 'preact/hooks';
import { tick, type TickName } from './Haptic';

const clamp = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
/** Near an end is the end, so both ends can be reached under a thumb. */
const SNAP = 0.03;
export const snapRule = (x: number) => { const v = clamp(x); return v < SNAP ? 0 : v > 1 - SNAP ? 1 : v; };
/** How far a touch travels before it is a drag of the mark or the page's scroll (parts/Spread's SLOP_PX). */
export const SLOP_PX = 8;
const end = (v: number) => (v === 0 ? 0 : v === 1 ? 1 : null);

type Drag = { pointer: number; x0: number; y0: number; from: number; value: number; taken: boolean };

export type RuleDragOptions = {
  value: number;
  onInput?: (live: number) => void;
  onCommit: (final: number) => void;
  onCancel?: () => void;
  disabled?: boolean;
  /** The tick for landing on an end (rule 19). */
  tickName: TickName;
};

/** The gesture: the ref for the rule, the mark's value now, whether it has been touched since mounting (a stale
 *  reading stops being dashed), whether a drag or a key holds it, and the rule's handlers. */
export function useRuleDrag({ value, onInput, onCommit, onCancel, disabled, tickName }: RuleDragOptions) {
  const rule = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const keyed = useRef<{ from: number; to: number } | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  /** A finger is down on the rule (taken or not yet): a resting control may show itself in full. */
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (!disabled) return;
    if (drag.current || keyed.current) { drag.current = null; keyed.current = null; setLive(null); onCancel?.(); }
  }, [disabled]);

  const width = () => Math.max(1, rule.current!.getBoundingClientRect().width);
  const land = (next: number, prev: number) => { const e = end(next); if (e !== null && e !== end(prev)) tick(tickName); };
  const show = (v: number) => { setLive(v); onInput?.(v); };

  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      if (disabled || e.button > 0 || drag.current) return;
      const from = clamp(value);
      drag.current = { pointer: e.pointerId, x0: e.clientX, y0: e.clientY, from, value: from, taken: false };
      setPressed(true);
    },
    onPointerMove: (e: PointerEvent) => {
      const d = drag.current;
      if (!d || d.pointer !== e.pointerId) return;
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
      if (!d.taken) {
        // down first is the page's scroll; sideways first is the mark
        if (Math.abs(dy) > SLOP_PX && Math.abs(dy) >= Math.abs(dx)) { drag.current = null; setPressed(false); return; }
        if (Math.abs(dx) <= SLOP_PX) return;
        d.taken = true;
        // from here the mark moves by the finger's travel past the slop, so it does not jump as it is taken
        d.x0 = e.clientX;
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* the pointer has gone */ }
        setTouched(true);
      }
      const v = snapRule(d.from + (e.clientX - d.x0) / width());
      land(v, d.value);
      d.value = v;
      show(v);
    },
    onPointerUp: (e: PointerEvent) => {
      const d = drag.current;
      if (!d || d.pointer !== e.pointerId) return;
      drag.current = null;
      setPressed(false);
      if (!d.taken) return; // a tap writes nothing
      setLive(null);
      if (d.value !== d.from) onCommit(d.value);
      else if (onCancel) onCancel();
    },
    onPointerCancel: (e: PointerEvent) => {
      const d = drag.current;
      if (!d || d.pointer !== e.pointerId) return;
      drag.current = null;
      setPressed(false);
      if (!d.taken) return;
      setLive(null);
      if (onCancel) onCancel(); else onInput?.(d.from);
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (disabled) return;
      const now = keyed.current?.to ?? clamp(value);
      const by = { ArrowLeft: -0.05, ArrowDown: -0.05, ArrowRight: 0.05, ArrowUp: 0.05 }[e.key];
      const to = e.key === 'Home' ? 0 : e.key === 'End' ? 1 : by !== undefined ? snapRule(Math.round((now + by) * 20) / 20) : undefined;
      if (to === undefined) return;
      e.preventDefault();
      keyed.current = { from: keyed.current?.from ?? clamp(value), to };
      land(to, now);
      setTouched(true);
      show(to);
    },
    onKeyUp: () => settle(),
    onBlur: () => settle(),
  };
  const settle = () => {
    const k = keyed.current;
    if (!k) return;
    keyed.current = null;
    setLive(null);
    if (k.to !== k.from) onCommit(k.to);
    else if (onCancel) onCancel();
  };
  return { rule, live, touched, pressed, shown: clamp(live ?? value), handlers: { ...handlers, onLostPointerCapture: handlers.onPointerUp } };
}
