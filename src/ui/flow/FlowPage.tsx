// A flow's page (PLAN-FLOWS.md sections 4 and 6, F1): #/flow/:id and #/flow/:id/:step. The drawing (parts/Cycle) with
// the dot where you are; under it, on the rules and left like a page: the step's own line in italic serif (Tommy's),
// what the page says in print grey serif, and "Usually: ..." in print. At rest: the flow's line and one "last time"
// line. In Still (rule 13, "no counts, states"): the drawing, the line and the step's words-only usual; no said
// line, no last time, no number anywhere.
//
// Walk it once (3.7): a tap on a step word only reads that step; an episode starts when the dot is dragged off rest.
//
// doorOnly (F5, the door without the PIN, 3.7): the journal is locked and the lock let this page through. The flow
// reads as its seed (model/door.ts doorRead), the dot moves in memory only (ui/flow/door.ts doorDot) and nothing is
// written until the PIN; "last time" stays behind the PIN, and the header's moon and Flow word ask for it. Anything
// added under the step (F2's tip rows, the clock, the journal link; F6's notes and ghost rings) reads doorOnly too:
// behind the PIN go kept lines, notes, "last time", ghost rings, the journal link, the Edit word and every write.
import { useEffect, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { Page } from '../parts/Page';
import { Cycle } from '../parts/Cycle';
import { NewStep } from './NewStep';
import { PrintLines } from './PrintLines';
import { dataVersion } from '../sheets';
import { shortDate } from '../date';
import type { Episode, Flow } from '../../db/schema';
import type { Read } from '../../db/fields';
import { doorRead } from '../../model/door';
import { doorDot, askPin } from './door';
import {
  flowById, liveEpisode, lastEnded, moveDot, placeOf, currentStepId, stepAt, lastTimeOf, spanWords,
} from '../../model/flows';

type Loaded = { flow: Read<Flow>; live?: Read<Episode>; last?: Read<Episode> } | 'none';

export function FlowPage({ id, step, doorOnly }: { id: string; step?: string; doorOnly?: boolean }) {
  const { route } = useLocation();
  const [data, setData] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);
  // the dot drawn at once where it was let go; the write follows (rule 20)
  const [moved, setMoved] = useState<number | null>(null);
  const [writing, setWriting] = useState(0);

  useEffect(() => {
    let on = true;
    (async () => {
      const stored = await flowById(id);
      if (!stored) return on && setData('none');
      const flow = doorOnly ? doorRead(stored) : stored;
      const [live, last] = await Promise.all([liveEpisode(id), doorOnly ? undefined : lastEnded(id)]);
      if (on) { setData({ flow, live, last }); setMoved(null); }
    })();
    return () => { on = false; };
  }, [id, version, dataVersion.value]);

  const door = doorOnly ? { ask: askPin } : undefined;
  if (data === 'none' || !data) return <Page label="Flow" back={{ word: 'Flow', href: '#/flow' }} keepSettings door={door}><div class="fs-sheetof fs-rules" /></Page>;

  const { flow, live, last } = data;
  const n = flow.steps.length;
  const held = doorOnly && doorDot.value?.flowId === flow.id ? placeOf(flow, doorDot.value.stepId) : 0;
  const at = moved ?? (held || (live ? placeOf(flow, currentStepId(live)) : 0));
  const asked = step ? Number(step) : 0;
  const showing = asked >= 1 && asked <= n ? asked : at;
  const shown = stepAt(flow, showing);

  const read = (k: number) => route(`/flow/${flow.id}/${k}`, true);
  const move = async (visits: number[], to: number) => {
    if (doorOnly) {
      // through the door the dot is held in memory; the PIN writes it. Back on rest it lets go (and the page stays,
      // since #/flow/:id alone is behind the PIN).
      doorDot.value = to ? { flowId: flow.id, stepId: flow.steps[to - 1].id } : null;
      setMoved(to || null);
      if (to) route(`/flow/${flow.id}/${to}`, true);
      return;
    }
    setMoved(to);
    route(to ? `/flow/${flow.id}/${to}` : `/flow/${flow.id}`, true);
    setWriting(w => w + 1);
    try {
      await moveDot(flow.id, visits.map(k => flow.steps[k - 1].id), to ? flow.steps[to - 1].id : 'rest');
    } finally {
      setWriting(w => w - 1);
      setVersion(v => v + 1);
    }
  };

  const lt = !doorOnly && last && lastTimeOf(flow, last);
  return (
    <Page label={flow.name} back={{ word: 'Flow', href: '#/flow' }} keepSettings door={door}>
      <div class="fs-sheetof fs-rules fs-flowpage" data-saved={writing ? 'false' : 'true'} data-showing={showing} data-door={doorOnly ? '' : undefined}>
        <Cycle diagram={flow.diagram} steps={flow.steps} at={at} showing={showing} live={(!!live || held > 0) && moved !== 0}
          disabled={!doorOnly && !!flow.locked} onRead={read} onMove={(v, to) => void move(v, to)} />
        {shown ? (
          <section class="fl-step-page" aria-label={shown.name}>
            {shown.line && <p class="fl-line">{shown.line}</p>}
            {shown.said && <p class="fl-said fs-notstill">{shown.said}</p>}
            {shown.usual && <p class="fl-usual fs-notstill">Usually: {shown.usual}</p>}
            {shown.usualShort && <p class="fl-usual fs-stillonly">{shown.usualShort}</p>}
          </section>
        ) : (
          <section class="fl-step-page" aria-label="At rest">
            {flow.line && <p class="fl-line">{flow.line}</p>}
            {flow.restLine && <p class="fl-said fl-print">{flow.restLine}</p>}
            {lt && (
              <p class="fl-last fs-notstill">
                Last time · {shortDate(new Date(lt.at))}
                {lt.minutes !== undefined && ` · ${spanWords(lt.minutes)} from the ${lt.from} to clear`}
              </p>
            )}
          </section>
        )}
        {shown && <PrintLines step={shown} />}
        {!shown && <NewStep flow={flow} onSaved={() => setVersion(v => v + 1)} />}
      </div>
    </Page>
  );
}
