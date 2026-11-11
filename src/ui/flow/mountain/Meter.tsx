// The Depression meter (PLAN-MOUNTAIN.md sections 4 and 5, pass 6; R2): one drawn rule across the top of the plate's
// sky, the weather over the whole mountain. Dragged right the day gets heavier: the snow comes down the horn and holds
// more back, the mist gathers over the stars and comes down round the peak, slow snow fills the air and the spring
// gives less water (model/mountain.ts spring). It is a state he sets, never a count (DESIGN.md rule 15): no number is
// printed; the weather is the reading.
//
// It is the cloud line itself: a chalk line drawn across the top of the sky, and the share he has set is mist heaping
// along it as far as he draws it, so the control is the sky it sets. The mark is the pen stroke every rule in the app
// is held by (the lean slider, the gate). The word sits small above the line's start.
//
// The touch is the gate's own (parts/RuleDrag, shared): nothing moves until a touch is decided as sideways, a touch that
// goes down first is the page's scroll, the mark follows the finger with no transition (rule 20) while onInput drives
// the weather live, and one reading is committed on release (never on a tap, never while dragging); a cancel puts it
// back. Keys move it live and commit once. A tick through parts/Haptic when the mark lands on either end, no sound.
// A reading older than a day is drawn dashed until touched (stale). In Still it is not shown (fs-notstill, rule 13);
// disabled (the journal is locked) takes no touch and no key.
import { useRuleDrag, snapRule } from '../../parts/RuleDrag';

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
export const snapMeter = snapRule;

/** What a screen reader hears: the weather in words, not a number. */
export const meterWords = (v: number) => {
  const x = clamp(v);
  return x === 0 ? 'clear' : x < 0.34 ? 'light' : x < 0.67 ? 'heavy' : x < 1 ? 'very heavy' : 'the heaviest';
};

export function Meter({ value, onInput, onCommit, onCancel, stale, disabled }: Props) {
  const { rule, live, touched, shown, handlers } = useRuleDrag({ value, onInput, onCommit, onCancel, disabled, tickName: 'meter' });

  const pct = `${(shown * 100).toFixed(2)}%`;
  return (
    <div class="mt-meter fs-notstill" style={{ '--d': shown.toFixed(4) }}
      data-stale={stale && !touched ? '' : undefined} data-drag={live !== null ? '' : undefined} data-disabled={disabled ? '' : undefined}>
      <span class="mt-meter-name" aria-hidden="true">Depression</span>
      <div ref={rule} class="mt-meter-rule" role="slider" tabIndex={disabled ? -1 : 0}
        aria-label="Depression" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(shown * 100)}
        aria-valuetext={meterWords(shown)} aria-disabled={disabled || undefined} data-value={shown.toFixed(3)}
        {...handlers}>
        <svg class="mt-meter-ink" aria-hidden="true">
          <line class="mt-meter-line" x1="0" y1="64%" x2="100%" y2="64%" />
        </svg>
        <i class="mt-meter-mist" aria-hidden="true" style={{ '--at': pct }} />
        <svg class="mt-meter-mark" style={{ left: pct }} viewBox="0 0 12 24" width="12" height="24" aria-hidden="true">
          <path d="M6.4 2.5 C5.8 8 6.2 15 5.6 21.5" />
        </svg>
      </div>
    </div>
  );
}
