// parts/Gate (PLAN-MOUNTAIN.md section 5, R3; R2 puts the compact one on the mountain under each sign's name): how far
// a sign's gate is shut, 0 open to 1 shut. A short drawn rule with a mark, dragged sideways: right shuts it.
//
// A touch is not a drag until it is decided. Nothing moves on pointerdown: the touch must travel SLOP_PX sideways, more
// than it travels down, before the mark is taken (parts/Spread decides a press the same way). A touch that goes down
// first is the page's scroll (touch-action pan-y): the gate lets it go, and nothing moves, ticks or is written. Once
// taken, the mark follows the finger by how far it has moved (it does not jump to the finger), with no transition
// (DESIGN.md rule 20); onInput says where it is on every move, so the sign and the water answer live, and onCommit says
// where it was let go, once, on release (the reading is written there, never while dragging). A plain tap writes
// nothing. A cancel (the browser took the touch after all) puts the mark back where it was before the touch, the last
// value committed, and says so through onCancel (or onInput, for a parent without onCancel).
//
// role="slider": arrows move it a twentieth, Home and End to the ends. A key moves it live (onInput); the reading is
// committed once, on key up or when the gate loses focus, so a held arrow writes one reading, not thirty a second.
//
// The percent prints in grey at the rule's end while above zero (a state he sets, not a count, rule 15). A reading
// older than a day is drawn dashed until touched (stale). A tick through parts/Haptic when the mark lands on fully shut
// and on fully open during a drag or a key, nothing else, and no sound (rule 19 amended in R5). In Still the gate is
// not shown at all (rule 13: no states): it carries fs-notstill, so the light alone decides. disabled (the journal is
// locked) takes no touch and no key.
import { useEffect, useRef, useState } from 'preact/hooks';
import { tick } from './Haptic';
import './gate.css';

type Props = {
  /** The gate as stored, 0 open to 1 shut. */
  value: number;
  /** While dragging, or between keys: where the mark is now. */
  onInput?: (live: number) => void;
  /** Let go (or the keys settled): where it settled. Write the reading here. Never called with the value it began at. */
  onCommit: (final: number) => void;
  /** The browser took the touch for a scroll: the mark is back at value, and nothing was committed. */
  onCancel?: () => void;
  /** The sign's hue angle (the voice formula, rule 3): the mark and the shut share of the rule. */
  hue: number;
  /** The reading is older than a day: dashed until touched. */
  stale?: boolean;
  /** Under a sign's name on the mountain: shorter, no gap above. */
  compact?: boolean;
  /** What it is the gate of, for a screen reader ("Heart"). */
  label?: string;
  disabled?: boolean;
};

const clamp = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
/** Near an end is the end, so both ends can be reached under a thumb. */
const SNAP = 0.03;
export const snapGate = (x: number) => { const v = clamp(x); return v < SNAP ? 0 : v > 1 - SNAP ? 1 : v; };
/** The percent printed at the rule's end ("35%"), or nothing when open. */
export const gateWords = (v: number) => { const p = Math.round(clamp(v) * 100); return p > 0 ? `${p}%` : ''; };
/** How far a touch travels before it is a drag of the mark or the page's scroll (parts/Spread's SLOP_PX). */
export const SLOP_PX = 8;

const end = (v: number) => (v === 0 ? 0 : v === 1 ? 1 : null);

type Drag = {
  pointer: number; x0: number; y0: number;
  /** The value before the touch: what a cancel goes back to. */
  from: number;
  /** Where the mark is (only once taken). */
  value: number;
  taken: boolean;
};

export function Gate({ value, onInput, onCommit, onCancel, hue, stale, compact, label, disabled }: Props) {
  const rule = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  /** Keys pressed and not yet committed: the value they began from. */
  const keyed = useRef<{ from: number; to: number } | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const shown = clamp(live ?? value);

  // locked under the thumb: whatever was in hand is let go, unwritten
  useEffect(() => {
    if (!disabled) return;
    if (drag.current || keyed.current) { drag.current = null; keyed.current = null; setLive(null); onCancel?.(); }
  }, [disabled]);

  const width = () => Math.max(1, rule.current!.getBoundingClientRect().width);
  const land = (next: number, prev: number) => {
    const e = end(next);
    if (e !== null && e !== end(prev)) tick('gate');
  };
  const show = (v: number) => { setLive(v); onInput?.(v); };

  const down = (e: PointerEvent) => {
    if (disabled || e.button > 0 || drag.current) return;
    const from = clamp(value);
    drag.current = { pointer: e.pointerId, x0: e.clientX, y0: e.clientY, from, value: from, taken: false };
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.taken) {
      // down first is the page's scroll; sideways first is the mark
      if (Math.abs(dy) > SLOP_PX && Math.abs(dy) >= Math.abs(dx)) { drag.current = null; return; }
      if (Math.abs(dx) <= SLOP_PX) return;
      d.taken = true;
      // from here the mark moves by the finger's travel past the slop, so it does not jump as it is taken
      d.x0 = e.clientX;
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* the pointer has gone */ }
      setTouched(true);
    }
    const v = snapGate(d.from + (e.clientX - d.x0) / width());
    land(v, d.value);
    d.value = v;
    show(v);
  };
  const up = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    if (!d.taken) return; // a tap writes nothing
    setLive(null);
    if (d.value !== d.from) onCommit(d.value);
    else if (onCancel) onCancel();
  };
  const cancel = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    if (!d.taken) return;
    setLive(null);
    if (onCancel) onCancel(); else onInput?.(d.from);
  };

  const settle = () => {
    const k = keyed.current;
    if (!k) return;
    keyed.current = null;
    setLive(null);
    if (k.to !== k.from) onCommit(k.to);
    else if (onCancel) onCancel();
  };
  const key = (e: KeyboardEvent) => {
    if (disabled) return;
    const now = keyed.current?.to ?? clamp(value);
    const by = { ArrowLeft: -0.05, ArrowDown: -0.05, ArrowRight: 0.05, ArrowUp: 0.05 }[e.key];
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? 1 : by !== undefined ? snapGate(Math.round((now + by) * 20) / 20) : undefined;
    if (to === undefined) return;
    e.preventDefault();
    keyed.current = { from: keyed.current?.from ?? clamp(value), to };
    land(to, now);
    setTouched(true);
    show(to);
  };

  const pct = `${(shown * 100).toFixed(1)}%`;
  const words = gateWords(shown);
  return (
    <div class={`fs-gate fs-notstill${compact ? ' compact' : ''}`} style={{ '--gh': String(hue), '--gate': String(shown) }}
      data-stale={stale && !touched ? '' : undefined} data-drag={live !== null ? '' : undefined} data-disabled={disabled ? '' : undefined}>
      <div ref={rule} class="fs-gate-rule" role="slider" tabIndex={disabled ? -1 : 0}
        aria-label={label ? `${label} gate` : 'Gate'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(shown * 100)}
        aria-valuetext={words ? `${words} shut` : 'open'} aria-disabled={disabled || undefined}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={up}
        onKeyDown={key} onKeyUp={settle} onBlur={settle}>
        <svg class="fs-gate-ink" aria-hidden="true">
          <line class="fs-gate-line" x1="0" y1="50%" x2="100%" y2="50%" />
          <line class="fs-gate-shut" x1="0" y1="50%" x2={pct} y2="50%" />
          <line class="fs-gate-end" x1="99.6%" y1="30%" x2="99.6%" y2="70%" />
        </svg>
        <svg class="fs-gate-mark" style={{ left: pct }} viewBox="0 0 12 24" width="12" height="24" aria-hidden="true">
          <path d="M6.4 2.5 C5.8 8 6.2 15 5.6 21.5" />
        </svg>
      </div>
      <small class="fs-gate-pct" aria-hidden="true">{words}</small>
    </div>
  );
}
