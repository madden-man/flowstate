// A chip: a voice's dot and name, or "+ voice". Pressed means "speaks next".
import type { JSX } from 'preact';

type Props = {
  label: string;
  colour?: string;
  deep?: boolean;
  add?: boolean;
  pressed?: boolean;
  onPress?: () => void;
};

export function Chip({ label, colour, deep, add, pressed, onPress }: Props) {
  const style = colour ? ({ '--vc': colour } as JSX.CSSProperties) : undefined;
  return (
    <button type="button" class={`fs-chip${deep ? ' deep' : ''}${add ? ' add' : ''}`} style={style} aria-pressed={add ? undefined : !!pressed} onClick={onPress}>
      {colour && <i />}
      {label}
    </button>
  );
}
