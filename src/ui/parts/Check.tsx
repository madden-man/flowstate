// The drawn check (DESIGN.md rule 7: one of the four drawn marks). A row you tap: a box drawn in print
// grey and a check stroked in ink over --t-draw, landing heavy and lifting light (rule 27); tapping a drawn
// check lifts it over --t-ui. The tick is felt only when a check is drawn (DESIGN.md rule 19).
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { tick } from './Haptic';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Shown beside the box, on the rule. */
  children?: ComponentChildren;
  /** A small printed word at the right ("daily"); a state, so it leaves in Still. */
  aside?: string;
  /** A small printed word at the right that is not a state, so it stays in Still (a flow tip's helper: "Ring", F2). */
  word?: string;
  disabled?: boolean;
};

export function Check({ checked, onChange, children, aside, word, disabled }: Props) {
  // the pen's weight belongs to a check a thumb just drew, not to one already there when the page came up
  const [inked, setInked] = useState(false);
  return (
    <button type="button" role="checkbox" aria-checked={checked} class={`fs-check${checked ? ' done' : ''}${checked && inked ? ' inked' : ''}`} disabled={disabled}
      onClick={() => { if (!checked) tick('check'); setInked(!checked); onChange(!checked); }}>
      <svg class="fs-check-mark" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
        <path class="fs-check-box" d="M3.2 3.6 C7 3.1 13 3.3 16.6 3.4 C16.9 7.5 16.8 12.6 16.5 16.5 C12.4 16.9 7.6 16.8 3.4 16.6 C3.1 12.4 3 8 3.2 3.6 Z" />
        <path class="fs-check-ink" pathLength="1" d="M5.2 10.6 L8.6 14 L17.6 2.6" />
      </svg>
      <span class="fs-check-text">{children}</span>
      {aside && <small class="fs-state">{aside}</small>}
      {word && <small>{word}</small>}
    </button>
  );
}
