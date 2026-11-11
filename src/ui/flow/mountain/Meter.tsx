// The Depression meter (PLAN-MOUNTAIN.md sections 4 and 5, pass 6; R2): one drawn rule across the top of the plate's
// sky, the weather over the whole mountain. Dragged right the day gets heavier: the snow comes down the horn and holds
// more back, the mist gathers over the stars and comes down round the peak, slow snow fills the air and the spring
// gives less water (model/mountain.ts spring). It is a state he sets, never a count (DESIGN.md rule 15): no number is
// printed; the weather is the reading.
//
// The rule is drawn in the plate's chalk. The share he has set is the mist itself gathered on the rule: a heavier line
// with a soft band of mist round it, as long as the day is heavy, so the meter reads as the sky it sets. The mark is
// the pen stroke every rule in the app is held by (the lean slider, the gate).
//
// A touch is not a drag until it is decided, as on the gate (parts/Gate, R3): it must travel SLOP_PX sideways, more
// than it travels down, before the mark is taken, and a touch that goes down first is the page's scroll (touch-action
// pan-y): nothing moves, ticks or is written. Once taken, the mark follows the finger by how far it has moved, with no
// transition (rule 20); onInput says where it is on every move so the weather answers live, and onCommit says where it
// was let go, once, on release (the reading is written there, never while dragging). A plain tap writes nothing; a
// cancel puts the mark back where it was. Keys: arrows a twentieth, Home and End to the ends, moved live and committed
// once on key up or blur. A tick through parts/Haptic when the mark lands on either end, nothing else, and no sound.
// A reading older than a day is drawn dashed until touched (stale). In Still it is not shown (fs-notstill, rule 13);
// disabled (the journal is locked) takes no touch and no key.
import { useEffect, useRef, useState } from 'preact/hooks';
import { tick } from '../../parts/Haptic';

type Props = {
  /** The meter as stored, 0 clear to 1 the heaviest. */
  value: number;
  onInput: (live: number) => void;
  /** Let go (or the keys settled) somewhere new: write the reading here. */
  onCommit: (final: number) => void;
  /** The touch was the page's after all, or it came back where it began: nothing to write. */
  onCancel: () => void;
  stale?: boolean;
  disabled?: boolean;
};

const clamp = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
/** Near an end is the end, so both can be reached under a thumb. */
const SNAP = 0.03;
export const snapMeter = (x: number) => { const v = clamp(x); return v < SNAP ? 0 : v > 1 - SNAP ? 1 : v; };
/** How far a touch travels before it is the mark's or the page's (parts/Gate's SLOP_PX). */
export const SLOP_PX = 8;
const end = (v: number) => (v === 0 ? 0 : v === 1 ? 1 : null);

/** What a screen reader hears: the weather in words, not a number. */
export const meterWords = (v: number) => {
  const x = clamp(v);
  return x === 0 ? 'clear' : x < 0.34 ? 'light' : x < 0.67 ? 'heavy' : x < 1 ? 'very heavy' : 'the heaviest';
};

type Drag = { pointer: number; x0: number; y0: number; from: number; value: number; taken: boolean };

export function Meter({ value, onInput, onCommit, onCancel, stale, disabled }: Props) {
  const rule = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const keyed = useRef<{ from: number; to: number } | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const shown = clamp(live ?? value);

  // locked under the thumb: whatever was in hand is let go, unwritten
  useEffect(() => {
    if (!disabled) return;
    if (drag.current || keyed.current) { drag.current = null; keyed.current = null; setLive(null); onCancel(); }
  }, [disabled]);

  const width = () => Math.max(1, rule.current!.getBoundingClientRect().width);
  const land = (next: number, prev: number) => { const e = end(next); if (e !== null && e !== end(prev)) tick('meter'); };
  const show = (v: number) => { setLive(v); onInput(v); };

  const down = (e: PointerEvent) => {
    if (disabled || e.button > 0 || drag.current) return;
    const from = clamp(value);
    drag.current = { pointer: e.pointerId, x0: e.clientX, y0: e.clientY, from, value: from, taken: false };
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    if (!d.taken) {
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
      // down first is the page's scroll; sideways first is the mark
      if (Math.abs(dy) > SLOP_PX && Math.abs(dy) >= Math.abs(dx)) { drag.current = null; return; }
      if (Math.abs(dx) <= SLOP_PX) return;
      d.taken = true;
      // from here the mark moves by the finger's travel past the slop, so it does not jump as it is taken
      d.x0 = e.clientX;
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* the pointer has gone */ }
      setTouched(true);
    }
    const v = snapMeter(d.from + (e.clientX - d.x0) / width());
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
    if (d.value !== d.from) onCommit(d.value); else onCancel();
  };
  const cancel = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    if (!d.taken) return;
    setLive(null);
    onCancel();
  };

  const settle = () => {
    const k = keyed.current;
    if (!k) return;
    keyed.current = null;
    setLive(null);
    if (k.to !== k.from) onCommit(k.to); else onCancel();
  };
  const key = (e: KeyboardEvent) => {
    if (disabled) return;
    const now = keyed.current?.to ?? clamp(value);
    const by = { ArrowLeft: -0.05, ArrowDown: -0.05, ArrowRight: 0.05, ArrowUp: 0.05 }[e.key];
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? 1 : by !== undefined ? snapMeter(Math.round((now + by) * 20) / 20) : undefined;
    if (to === undefined) return;
    e.preventDefault();
    keyed.current = { from: keyed.current?.from ?? clamp(value), to };
    land(to, now);
    setTouched(true);
    show(to);
  };

  const pct = `${(shown * 100).toFixed(2)}%`;
  return (
    <div class="mt-meter fs-notstill" style={{ '--d': shown.toFixed(4) }}
      data-stale={stale && !touched ? '' : undefined} data-drag={live !== null ? '' : undefined} data-disabled={disabled ? '' : undefined}>
      <span class="mt-meter-name" aria-hidden="true">Depression</span>
      <div ref={rule} class="mt-meter-rule" role="slider" tabIndex={disabled ? -1 : 0}
        aria-label="Depression" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(shown * 100)}
        aria-valuetext={meterWords(shown)} aria-disabled={disabled || undefined} data-value={shown.toFixed(3)}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={up}
        onKeyDown={key} onKeyUp={settle} onBlur={settle}>
        <svg class="mt-meter-ink" aria-hidden="true">
          <line class="mt-meter-line" x1="0" y1="50%" x2="100%" y2="50%" />
          <line class="mt-meter-mist" x1="0" y1="50%" x2={pct} y2="50%" />
          <line class="mt-meter-held" x1="0" y1="50%" x2={pct} y2="50%" />
          <line class="mt-meter-end" x1="99.6%" y1="32%" x2="99.6%" y2="68%" />
        </svg>
        <svg class="mt-meter-mark" style={{ left: pct }} viewBox="0 0 12 24" width="12" height="24" aria-hidden="true">
          <path d="M6.4 2.5 C5.8 8 6.2 15 5.6 21.5" />
        </svg>
      </div>
    </div>
  );
}
