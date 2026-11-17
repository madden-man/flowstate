// parts/Versus (PLAN-SIGN-LINES.md section 4, L1): the struggle a sign comes down to, drawn on one rule. The sign lit
// (parts/Sign, closed 0) and what he wants in ink, "vs." in print sans, then what works against it in print grey and the
// sign emptied (closed 1). Both signs are fixed: they say what the two ends mean, not where the gate is (the large sign
// on the plate already shows today's reading). No new drawing code, no canvas, no filter; the signs are the size of the
// rule (parts.css, the L1 section).
//
// Still (rules 13 and 34): the hue and the gate's states leave, so the two signs would look the same. They leave (fs-notstill)
// and the words stay, all in print, on the same rule, so the block keeps its height. Nothing here is tappable, counted
// or animated; Reduce Motion has nothing to stop.
import type { SignKind } from '../../model/mountain';
import { Sign } from './Sign';

type Props = {
  /** The sign's drawing (model/mountain.ts CHAKRAS sign). */
  kind: SignKind;
  /** The voice formula's hue angle (CHAKRAS hue). */
  hue: number;
  /** What he wants, then what works against it (CHAKRAS versus): "Safety", "fear". */
  words: readonly [string, string];
  /** A class of the screen's own, to place it. */
  class?: string;
};

export function Versus({ kind, hue, words: [want, against], class: cls }: Props) {
  return (
    <p class={`fs-versus${cls ? ` ${cls}` : ''}`} data-versus="">
      <span class="fs-versus-sign fs-notstill" data-end="lit"><Sign kind={kind} hue={hue} closed={0} size="small" /></span>
      <span class="fs-versus-want">{want}</span>
      <span class="fs-versus-vs">vs.</span>
      <span class="fs-versus-against">{against}</span>
      <span class="fs-versus-sign fs-notstill" data-end="emptied"><Sign kind={kind} hue={hue} closed={1} size="small" /></span>
    </p>
  );
}
