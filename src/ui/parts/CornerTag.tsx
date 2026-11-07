// A corner tag (DESIGN.md rule 10): a line across the corner of the spread with the pole's value written
// along it, its shadow in brackets after it ("thoughtful (obsessive)"). Pole A takes the top-left corner,
// pole B the bottom-right; both lines run at 45 degrees, parallel, so the diagonal joins them.
import { useId } from 'preact/hooks';

type Props = { corner: 'tl' | 'br'; value: string; shadow?: string; size: number };

const CHAR_PX = 7; // a generous average advance at --fs-chip in ui-serif

/** The side of the square a tag needs for its words to fit along the corner line. */
export function tagSize(value: string, shadow?: string): number {
  const chars = value.length + (shadow ? shadow.length + 3 : 0);
  return Math.max(72, Math.ceil((chars * CHAR_PX + 24) / Math.SQRT2));
}

export function CornerTag({ corner, value, shadow, size }: Props) {
  const id = `fs-ct-${useId().replace(/[^\w-]/g, '')}`;
  const s = size;
  return (
    <svg class={`fs-ctag ${corner}`} width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="false" role="img"
      aria-label={shadow ? `${value} (${shadow})` : value}>
      <path id={id} d={`M0 ${s} L${s} 0`} class="fs-ctag-line" />
      <text class="fs-ctag-text" dy={corner === 'tl' ? -5 : 15}>
        <textPath href={`#${id}`} startOffset="50%" text-anchor="middle">
          {value}
          {shadow && <tspan class="fs-ctag-shadow"> ({shadow})</tspan>}
        </textPath>
      </text>
    </svg>
  );
}
