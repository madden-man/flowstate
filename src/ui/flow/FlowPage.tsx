// A flow's page (PLAN-FLOWS.md sections 4 and 6, F1): #/flow/:id and #/flow/:id/:step. The drawing (parts/Cycle) with
// the dot where you are; under it, on the rules and left like a page: the step's own line in italic serif (Tommy's),
// what the page says in print grey serif, and "Usually: ..." in print. At rest: the flow's line and one "last time"
// line. In Still (rule 13, "no counts, states"): the drawing, the line and the step's words-only usual; no said
// line, no last time, no number anywhere.
//
// Walk it once (3.7): a tap on a step word only reads that step; an episode starts when the dot is dragged off rest.
import { useEffect, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { Page } from '../parts/Page';
import { Cycle } from '../parts/Cycle';
import { dataVersion } from '../sheets';
import { shortDate } from '../date';
import type { Episode, Flow } from '../../db/schema';
import type { Read } from '../../db/fields';
import {
  flowById, liveEpisode, lastEnded, moveDot, placeOf, currentStepId, stepAt, lastTimeOf, spanWords,
} from '../../model/flows';

type Loaded = { flow: Read<Flow>; live?: Read<Episode>; last?: Read<Episode> } | 'none';

export function FlowPage({ id, step }: { id: string; step?: string }) {
  const { route } = useLocation();
  const [data, setData] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);
  // the dot drawn at once where it was let go; the write follows (rule 20)
  const [moved, setMoved] = useState<number | null>(null);
  const [writing, setWriting] = useState(0);

  useEffect(() => {
    let on = true;
    (async () => {
      const flow = await flowById(id);
      if (!flow) return on && setData('none');
      const [live, last] = await Promise.all([liveEpisode(id), lastEnded(id)]);
      if (on) { setData({ flow, live, last }); setMoved(null); }
    })();
    return () => { on = false; };
  }, [id, version, dataVersion.value]);

  if (data === 'none') return <Page label="Flow" back={{ word: 'Flow', href: '#/flow' }} keepSettings><div class="fs-sheetof fs-rules" /></Page>;
  if (!data) return <Page label="Flow" back={{ word: 'Flow', href: '#/flow' }} keepSettings><div class="fs-sheetof fs-rules" /></Page>;

  const { flow, live, last } = data;
  const n = flow.steps.length;
  const at = moved ?? (live ? placeOf(flow, currentStepId(live)) : 0);
  const asked = step ? Number(step) : 0;
  const showing = asked >= 1 && asked <= n ? asked : at;
  const shown = stepAt(flow, showing);

  const read = (k: number) => route(`/flow/${flow.id}/${k}`, true);
  const move = async (visits: number[], to: number) => {
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

  const lt = last && lastTimeOf(flow, last);
  return (
    <Page label={flow.name} back={{ word: 'Flow', href: '#/flow' }} keepSettings>
      <div class="fs-sheetof fs-rules fs-flowpage" data-saved={writing ? 'false' : 'true'} data-showing={showing}>
        <Cycle diagram={flow.diagram} steps={flow.steps} at={at} showing={showing} live={!!live && moved !== 0}
          disabled={!!flow.locked} onRead={read} onMove={(v, to) => void move(v, to)} />
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
            {lt && (
              <p class="fl-last fs-notstill">
                Last time · {shortDate(new Date(lt.at))}
                {lt.minutes !== undefined && ` · ${spanWords(lt.minutes)} from the ${lt.from} to clear`}
              </p>
            )}
          </section>
        )}
      </div>
    </Page>
  );
}
