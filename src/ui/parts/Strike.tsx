// A revision, struck through with a drawn stroke (DESIGN.md rule 10): never hidden, never silently
// overwritten. Generic: a voice's old name, a paradox's old middle, any kept-but-replaced words.
// The stroke is .fs-strike's ::after in parts.css, a slightly tilted hand-drawn line.
import type { ComponentChildren } from 'preact';

type Props = { children?: ComponentChildren; class?: string; title?: string };

export function Strike({ children, class: cls, title }: Props) {
  return <span class={`fs-strike${cls ? ` ${cls}` : ''}`} title={title} data-struck="">{children}</span>;
}
