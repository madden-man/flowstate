// A word struck through with a drawn stroke, never hidden (DESIGN.md rule 10): the notebook's
// "Sojourner/Wanderer" line. The stroke is an SVG path over the word, in ink, slightly uneven.
import type { ComponentChildren } from 'preact';

export function Strike({ children }: { children?: ComponentChildren }) {
  return (
    <s class="fs-struck">
      {children}
      <svg class="fs-struck-line" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
        <path d="M1 6.2 C 24 4.9, 44 6.5, 66 5.3 S 92 4.7, 99 4.5" />
      </svg>
    </s>
  );
}
