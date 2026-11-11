// Who speaks a line (V10): the name Tommy gave the voice, in its colour, above the line. A voice with a given
// name shows its role beside it on a tap ("GUS · ARCHITECT"), and a second tap hides it; the tap is the
// label's own, so it never replies to the line or moves the caret. A voice with no given name goes by its
// role and the label is plain print. A line confirmed as spoken for a value (PLAN-VALUES.md C4) prints
// "· FOR HONESTY" after it, in the same print: drawn on at the confirm, lifted at a take-back (parts/SpokeFor).
import { useState } from 'preact/hooks';
import type { Voice } from '../../db/schema';
import { voiceLabel, voiceRole } from '../../model/council';
import type { SpokeLabel } from './SpokeFor';

/** The label is an inline block (so it can be drawn on), which would drop a leading space: the space is a fixed one. */
function For({ spoke }: { spoke?: SpokeLabel }) {
  if (!spoke) return null;
  return <span key={`${spoke.word}:${spoke.state ?? ''}`} class={`fs-sp-role fs-sp-for${spoke.state ? ` ${spoke.state}` : ''}`}>{'\u00a0· for '}{spoke.word}</span>;
}

export function Speaker({ v, spoke }: { v: Pick<Voice, 'name' | 'given'>; spoke?: SpokeLabel }) {
  const [shown, setShown] = useState(false);
  const role = voiceRole(v);
  if (!role) return <span class="fs-sp">{v.name}<For spoke={spoke} /></span>;
  const stop = (e: Event) => e.stopPropagation();
  const said = spoke && spoke.state !== 'lift' ? `, for ${spoke.word}` : '';
  return (
    <button type="button" class="fs-sp fs-sp-tap" aria-expanded={shown} aria-label={shown ? `${voiceLabel(v)}, ${role}${said}` : `${voiceLabel(v)}${said}: show the role`}
      onMouseDown={e => e.preventDefault()} onPointerDown={stop}
      onClick={e => { e.stopPropagation(); setShown(s => !s); }}>
      {voiceLabel(v)}{shown && <span class="fs-sp-role"> · {role}</span>}<For spoke={spoke} />
    </button>
  );
}
