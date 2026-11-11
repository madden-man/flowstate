// parts/Gate (PLAN-MOUNTAIN.md section 5, R3; R2 puts the compact one on the mountain under each sign's name): how far
// a sign's gate is shut, 0 open to 1 shut. A short drawn rule with a mark, dragged sideways: right shuts it. The mark is
// under the finger with no transition while dragging (DESIGN.md rule 20); onInput says where it is on every move, so
// the sign and the water answer live, and onCommit says where it was let go, once, on release (the reading is written
// there, never while dragging). Horizontal only (touch-action pan-y), so the page still scrolls under a vertical drag.
// role="slider": arrows move it a twentieth, Home and End to the ends, and each key commits like a release.
//
// The percent prints in grey at the rule's end while above zero (a state he sets, not a count, rule 15). A reading
// older than a day is drawn dashed until touched (stale). A tick through parts/Haptic when the mark lands on fully shut
// and on fully open, nothing else, and no sound (rule 19 amended in R5). In Still the gate is not shown at all (rule 13:
// no states): it carries fs-notstill, so the light alone decides.
import { useRef, useState } from 'preact/hooks';
import { tick } from './Haptic';
import './gate.css';

type Props = {
  /** The gate as stored, 0 open to 1 shut. */
  value: number;
  /** While dragging: where the mark is now. */
  onInput?: (live: number) => void;
  /** Let go (or a key): where it settled. Write the reading here. */
  onCommit: (final: number) => void;
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

const end = (v: number) => (v === 0 ? 0 : v === 1 ? 1 : null);

export function Gate({ value, onInput, onCommit, hue, stale, compact, label, disabled }: Props) {
  const rule = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; value: number } | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const shown = clamp(live ?? value);

  const fromX = (x: number) => {
    const r = rule.current!.getBoundingClientRect();
    return snapGate((x - r.left) / Math.max(1, r.width));
  };
  const land = (next: number, prev: number) => {
    const e = end(next);
    if (e !== null && e !== end(prev)) tick('gate');
  };
  const down = (e: PointerEvent) => {
    if (disabled || e.button > 0) return;
    const v = fromX(e.clientX);
    land(v, shown);
    drag.current = { pointer: e.pointerId, value: v };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* the pointer has gone */ }
    setTouched(true);
    setLive(v);
    onInput?.(v);
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    const v = fromX(e.clientX);
    land(v, d.value);
    d.value = v;
    setLive(v);
    onInput?.(v);
  };
  const up = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    onCommit(d.value);
    setLive(null);
  };
  const cancel = () => {
    if (!drag.current) return;
    drag.current = null;
    setLive(null);
    onInput?.(clamp(value));
  };
  const key = (e: KeyboardEvent) => {
    if (disabled) return;
    const by = { ArrowLeft: -0.05, ArrowDown: -0.05, ArrowRight: 0.05, ArrowUp: 0.05 }[e.key];
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? 1 : by !== undefined ? snapGate(Math.round((clamp(value) + by) * 20) / 20) : undefined;
    if (to === undefined) return;
    e.preventDefault();
    land(to, clamp(value));
    setTouched(true);
    onInput?.(to);
    onCommit(to);
  };

  const pct = `${(shown * 100).toFixed(1)}%`;
  const words = gateWords(shown);
  return (
    <div class={`fs-gate fs-notstill${compact ? ' compact' : ''}`} style={{ '--gh': String(hue), '--gate': String(shown) }}
      data-stale={stale && !touched ? '' : undefined} data-drag={live !== null ? '' : undefined}>
      <div ref={rule} class="fs-gate-rule" role="slider" tabIndex={disabled ? -1 : 0}
        aria-label={label ? `${label} gate` : 'Gate'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(shown * 100)}
        aria-valuetext={words ? `${words} shut` : 'open'} aria-disabled={disabled || undefined}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={e => up(e)} onKeyDown={key}>
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
