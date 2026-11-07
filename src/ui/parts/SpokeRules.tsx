// Who spoke on a page, as a row of short colour rules in order of first speaking (a deep twin doubled).
// Used by the Pages list (v2); the Council list draws the same rules from the same .fs-spoke class.
import type { JSX } from 'preact';
import { voiceColour } from '../voice';
import type { Read } from '../../db/fields';
import type { Voice } from '../../db/schema';

export function SpokeRules({ ids, byId }: { ids: string[]; byId: Map<string, Read<Voice>> }) {
  const vs = ids.map(id => byId.get(id)).filter((v): v is Read<Voice> => !!v);
  if (!vs.length) return null;
  return (
    <span class="fs-spoke" aria-label={vs.map(v => v.name).join(', ')}>
      {vs.map(v => <i key={v.id} class={v.shade === 'deep' ? 'deep' : undefined} style={{ '--vc': voiceColour(v.colour, v.shade) } as JSX.CSSProperties} />)}
    </span>
  );
}
