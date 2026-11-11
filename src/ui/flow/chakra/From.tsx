// The link row at the top of a stop's page a hand-off opened (PLAN-FLOWS.md 3.7, F4; PLAN-MOUNTAIN.md section 6, R3):
// where the dot came from, and when, as ui/flow/HandOff.tsx draws it, but naming the sign it came from ("From Solar
// plexus chakra · I'm worthless · 15:02"), never the flow. The time is digits, so Still keeps the words (rule 13).
import { useEffect, useState } from 'preact/hooks';
import type { Episode } from '../../../db/schema';
import type { Read } from '../../../db/fields';
import { dataVersion } from '../../sheets';
import { clockTime } from '../../date';
import { handedFrom, type HandOffFrom } from '../../../model/flows';
import { chakraOf, type ChakraId } from '../../../model/mountain';

export function FromRow({ live, homes }: { live?: Read<Episode>; homes: ReadonlyMap<string, ChakraId | undefined> }) {
  const [from, setFrom] = useState<HandOffFrom | undefined>(undefined);
  useEffect(() => {
    let on = true;
    void handedFrom(live).then(f => { if (on) setFrom(f); });
    return () => { on = false; };
  }, [live?.id, live?.from, dataVersion.value]);
  if (!from) return null;
  const home = homes.get(from.flowId);
  // a flow with no sign keeps its own page, and its own name: it is not one of the drawings under a sign
  const where = home ? chakraOf(home).pageName : from.flow;
  return (
    <nav class="fs-links fl-from" aria-label="Handed off from">
      <a class="fs-link" href={from.place ? `#/flow/${from.flowId}/${from.place}` : `#/flow/${from.flowId}`}>
        <small>From {where}{from.step && ` · ${from.step}`}<b class="fs-notstill"> · {clockTime(new Date(from.at))}</b></small>
      </a>
    </nav>
  );
}
