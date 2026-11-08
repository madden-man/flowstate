// The ring (DESIGN.md rule 13): in Still it takes the moon's place, breathes on --t-breath (4s in, 6s out)
// and is the way out. A tap leaves Still with no tick and no bell. The same ring, not a button, breathes
// once on the threshold.
import { rise } from '../still';

/** The breathing circle itself, for the moon's place in Still and the threshold. */
export function RingMark() {
  return <span class="fs-ring-mark" aria-hidden="true" />;
}

export function Ring() {
  return (
    <button type="button" class="fs-moon fs-ring" aria-label="Leave Still" aria-pressed="true" onClick={rise}>
      <RingMark />
    </button>
  );
}
