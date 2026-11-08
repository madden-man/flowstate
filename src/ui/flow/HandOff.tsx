// One episode, two flows (PLAN-FLOWS.md 3.7, F4). A printed line that names another flow ("If it's hot: the Fight
// flow.") is a link: a tap ends the episode here where it is, starts one on that flow with the dot on that step and
// `from` set, and opens it (model/flows.ts handOff). The new page carries a link row at its top, "From Shame · I'm
// worthless · 15:02", back to the step it left; the time is digits, so Still keeps the words only (rule 13).
// With no episode open the line only opens the other flow's step, which reads (walk it once). Through the door
// (doorOnly) the dot moves in memory, like any door move, and nothing is written until the PIN.
import { useEffect, useState } from 'preact/hooks';
import type { Episode, Tip } from '../../db/schema';
import type { Read } from '../../db/fields';
import { dataVersion } from '../sheets';
import { clockTime } from '../date';
import { flowById, handOff, handedFrom, placeOf, type HandOffFrom } from '../../model/flows';
import { doorDot } from './door';

/** Follow a hand-off line from this page: write it (unless only reading or through the door), then open its step. */
export async function followHandOff(
  tip: Pick<Tip, 'handoff'>, stepId: string, live: Read<Episode> | undefined, route: (to: string) => void, doorOnly?: boolean,
) {
  const to = tip.handoff;
  if (!to) return;
  const target = await flowById(to.flowId);
  const place = target ? placeOf(target, to.stepId) : 0;
  if (doorOnly) doorDot.value = { flowId: to.flowId, stepId: to.stepId };
  else if (live) await handOff(live.id, to, stepId);
  route(place ? `/flow/${to.flowId}/${place}` : `/flow/${to.flowId}`);
}

/** The link row at the top of a page a hand-off opened: where the dot came from, and when. */
export function HandOff({ live }: { live?: Read<Episode> }) {
  const [from, setFrom] = useState<HandOffFrom | undefined>(undefined);
  useEffect(() => {
    let on = true;
    void handedFrom(live).then(f => { if (on) setFrom(f); });
    return () => { on = false; };
  }, [live?.id, live?.from, dataVersion.value]);
  if (!from) return null;
  return (
    <nav class="fs-links fl-from" aria-label="Handed off from">
      <a class="fs-link" href={from.place ? `#/flow/${from.flowId}/${from.place}` : `#/flow/${from.flowId}`}>
        <small>From {from.flow}{from.step && ` · ${from.step}`}<b class="fs-notstill"> · {clockTime(new Date(from.at))}</b></small>
      </a>
    </nav>
  );
}
