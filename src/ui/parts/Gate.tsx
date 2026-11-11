// parts/Gate (PLAN-MOUNTAIN.md section 5, R3; R2 puts the compact one on the mountain under each sign's name): how far
// a sign's gate is shut, 0 open to 1 shut. A short drawn rule with a mark, dragged sideways: right shuts it.
//
// The gesture is parts/RuleDrag (shared with the meter since R2). A touch is not a drag until it is decided. Nothing
// moves on pointerdown: the touch must travel SLOP_PX sideways, more than it travels down, before the mark is taken (as parts/Spread did, before PLAN-VALUES.md C6 took it out). A touch that goes down
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
import { useRuleDrag, snapRule, SLOP_PX } from './RuleDrag';
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
export const snapGate = snapRule;
/** The percent printed at the rule's end ("35%"), or nothing when open. */
export const gateWords = (v: number) => { const p = Math.round(clamp(v) * 100); return p > 0 ? `${p}%` : ''; };
export { SLOP_PX };

export function Gate({ value, onInput, onCommit, onCancel, hue, stale, compact, label, disabled }: Props) {
  // the gesture is parts/RuleDrag's, shared with the mountain's Depression meter (R2)
  const { rule, live, touched, pressed, shown, handlers } = useRuleDrag({ value, onInput, onCommit, onCancel, disabled, tickName: 'gate' });

  const pct = `${(shown * 100).toFixed(1)}%`;
  const words = gateWords(shown);
  return (
    <div class={`fs-gate fs-notstill${compact ? ' compact' : ''}`} style={{ '--gh': String(hue), '--gate': String(shown) }}
      data-stale={stale && !touched ? '' : undefined} data-drag={live !== null ? '' : undefined} data-disabled={disabled ? '' : undefined}
      data-open={shown === 0 ? '' : undefined} data-press={pressed ? '' : undefined}>
      <div ref={rule} class="fs-gate-rule" role="slider" tabIndex={disabled ? -1 : 0}
        aria-label={label ? `${label} gate` : 'Gate'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(shown * 100)}
        aria-valuetext={words ? `${words} shut` : 'open'} aria-disabled={disabled || undefined}
        {...handlers}>
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
