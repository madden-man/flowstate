// Haptics, only here (DESIGN.md rule 19). iPhone Safari has no navigator.vibrate; tapping a hidden
// <input type="checkbox" switch> fires the Taptic Engine (iOS 17.4+, one tick from 26.5). It must run
// inside a direct tap, silent mode may mute it, and everywhere else it degrades to nothing.
import { settings } from '../settings';

/** The ticks DESIGN.md rule 19 allows, and nowhere else. swap and deal: a fixation put in a slot, and Deal me one
 *  (PLAN-ENERGIZE.md X3, ui/flow/DeckSheet.tsx). for: a line confirmed as spoken for a value (PLAN-VALUES.md C4,
 *  parts/SpokeFor.tsx). champion: a voice takes up a value or leaves it (PLAN-VALUES.md C3, ui/be/ChampionSheet.tsx). */
export type TickName = 'unlock' | 'tab' | 'check' | 'drop' | 'detent' | 'still' | 'keep' | 'sheet' | 'breath' | 'album' | 'sit' | 'swap' | 'deal' | 'for' | 'champion';

export function tick(_name: TickName): void {
  if (!settings.value.haptics || typeof document === 'undefined') return;
  try {
    const label = document.createElement('label');
    label.ariaHidden = 'true';
    label.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.body.appendChild(label);
    label.click();
    label.remove();
  } catch {
    // nothing to feel; nothing to report
  }
}
