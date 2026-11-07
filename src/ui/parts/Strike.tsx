// A revision struck through with a drawn stroke, never hidden (DESIGN.md rule 10): never silently
// overwritten. Generic: a voice's old name ("Sojourner/Wanderer"), a paradox's old middle, any
// kept-but-replaced words. The stroke is an SVG path over the words, in ink, slightly uneven.
import type { ComponentChildren } from 'preact';

type Props = { children?: ComponentChildren; class?: string; title?: string };

export function Strike({ children, class: cls, title }: Props) {
  return (
    <s class={`fs-struck${cls ? ` ${cls}` : ''}`} title={title} data-struck="">
      {children}
      <svg class="fs-struck-line" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
        <path d="M1 6.2 C 24 4.9, 44 6.5, 66 5.3 S 92 4.7, 99 4.5" />
      </svg>
    </s>
  );
}
