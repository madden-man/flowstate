// The lean line (PLAN.md section 5 item 4): where you have stood between two poles over time, drawn as
// one ink path on the page's rule. Time runs left to right, the lean top (pole A) to bottom (pole B).
// No axes, no numbers, no chart library: a line on paper. It scales with its box, so nothing is measured.
import { leanPath } from '../../model/flow';

const W = 300, H = 40;

export function LeanLine({ points, now, label }: { points: { at: number; lean: number }[]; now: number; label: string }) {
  if (!points.length) return null;
  return (
    <svg class="fs-leanline" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <line class="fs-leanline-mid" x1={0} y1={H / 2} x2={W} y2={H / 2} vector-effect="non-scaling-stroke" />
      <path class="fs-leanline-ink" d={leanPath(points, now, W, H)} vector-effect="non-scaling-stroke" />
    </svg>
  );
}
