// Who speaks a line (V10): the name Tommy gave the voice, in its colour, above the line. A voice with a given
// name shows its role beside it on a tap ("GUS · ARCHITECT"), and a second tap hides it; the tap is the
// label's own, so it never replies to the line or moves the caret. A voice with no given name goes by its
// role and the label is plain print.
import { useState } from 'preact/hooks';
import type { Voice } from '../../db/schema';
import { voiceLabel, voiceRole } from '../../model/council';

export function Speaker({ v }: { v: Pick<Voice, 'name' | 'given'> }) {
  const [shown, setShown] = useState(false);
  const role = voiceRole(v);
  if (!role) return <span class="fs-sp">{v.name}</span>;
  const stop = (e: Event) => e.stopPropagation();
  return (
    <button type="button" class="fs-sp fs-sp-tap" aria-expanded={shown} aria-label={shown ? `${voiceLabel(v)}, ${role}` : `${voiceLabel(v)}: show the role`}
      onMouseDown={e => e.preventDefault()} onPointerDown={stop}
      onClick={e => { e.stopPropagation(); setShown(s => !s); }}>
      {voiceLabel(v)}{shown && <span class="fs-sp-role"> · {role}</span>}
    </button>
  );
}
