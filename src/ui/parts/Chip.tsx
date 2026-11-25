// A chip: a voice's dot and name, or "+ voice". Pressed means "speaks next".
import type { JSX } from 'preact';

type Props = {
  label: string;
  colour?: string;
  deep?: boolean;
  add?: boolean;
  pressed?: boolean;
  onPress?: () => void;
  /** A spoken name in place of the visible one: plain ink reads "Ink" and is called "Plain ink". */
  ariaLabel?: string;
  /** Dimmed, still pressable: a character not yet born or already dead in the council's year (PLAN-WORLDS.md W4). */
  gone?: boolean;
};

export function Chip({ label, colour, deep, add, pressed, onPress, ariaLabel, gone }: Props) {
  const style = colour ? ({ '--vc': colour } as JSX.CSSProperties) : undefined;
  return (
    <button type="button" class={`fs-chip${deep ? ' deep' : ''}${add ? ' add' : ''}`} style={style} aria-pressed={add ? undefined : !!pressed} aria-label={ariaLabel} data-gone={gone ? '' : undefined} onClick={onPress}>
      {colour && <i />}
      {label}
    </button>
  );
}
