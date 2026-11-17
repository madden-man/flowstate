// Resolve (PLAN-BLOCKERS.md decision 2, section 7; K1): one gesture resolves a question everywhere, a tap on a word.
// At rest the print word "Resolve", a thumb wide and one rule tall; tapped, the app's drawn check (rule 7) is drawn in
// ink in its place over --t-draw with the check's tick (rules 19 and 27), and a tap on the check lifts it over --t-ui
// and the word comes back. It says nothing about what it resolves: the ? tab, a question's page, a sign's three and a
// journal line all hand it a state and a change. It leaves in Still (fs-notstill), as states do (rule 13).
import { useState } from 'preact/hooks';
import { tick } from './Haptic';

type Props = {
  /** Resolved: the check stands where the word was. */
  on: boolean;
  onChange: (on: boolean) => void;
  /** What a screen reader hears; the checkbox's state says whether it is. */
  label?: string;
  /** A class of the screen's own, to place it (the ? tab's row, a question's title). */
  class?: string;
  disabled?: boolean;
};

export function Resolve({ on, onChange, label = 'Resolved', class: cls, disabled }: Props) {
  // the pen's weight belongs to a check a thumb just drew, not to one already there when the screen came up
  const [inked, setInked] = useState(false);
  return (
    <button type="button" role="checkbox" aria-checked={on} aria-label={label} disabled={disabled}
      class={`fs-resolve fs-notstill${on ? ' done' : ''}${on && inked ? ' inked' : ''}${cls ? ` ${cls}` : ''}`}
      onClick={e => {
        // on a row that is itself a link, the word answers and the row does not
        e.preventDefault(); e.stopPropagation();
        if (!on) tick('check');
        setInked(!on);
        onChange(!on);
      }}>
      <span class="fs-resolve-word" aria-hidden="true">Resolve</span>
      <svg class="fs-resolve-mark" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
        <path class="fs-check-ink" pathLength="1" d="M5.2 10.6 L8.6 14 L17.6 2.6" />
      </svg>
    </button>
  );
}
