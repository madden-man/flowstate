// The ring (DESIGN.md rule 13): in Still it takes the moon's place, breathes on --t-breath (4s in, 6s out)
// and is the way out. A tap leaves Still with no tick and no bell. The same ring, not a button, breathes
// once on the threshold and waits under the blind.
import { rise } from '../still';

/** The breathing circle itself, for the threshold and the blind. */
export function RingMark({ still: holdStill }: { still?: boolean }) {
  return <span class={`fs-ring-mark${holdStill ? ' hold' : ''}`} aria-hidden="true" />;
}

export function Ring() {
  return (
    <button type="button" class="fs-moon fs-ring" aria-label="Leave Still" aria-pressed="true" onClick={rise}>
      <RingMark />
    </button>
  );
}
