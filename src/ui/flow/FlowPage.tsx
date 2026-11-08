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
  flowById, liveEpisode, lastEnded, moveDot, placeOf, currentStepId, stepAt, lastTimeOf, spanWords, spanOf,
} from '../../model/flows';
import { clockFrom, washLeft, whatHelped } from '../../model/tips';
import { light } from '../light';
import { Tips } from './Tips';
import { Clock, Wash } from './Clock';
import { StepSheet } from './StepSheet';
import { useBreath, useNow } from './breath';

type Loaded = { flow: Read<Flow>; live?: Read<Episode>; last?: Read<Episode> } | 'none';

export function FlowPage({ id, step }: { id: string; step?: string }) {
  const { route } = useLocation();
  const [data, setData] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);
  // the dot drawn at once where it was let go; the write follows (rule 20)
  const [moved, setMoved] = useState<number | null>(null);
  const [writing, setWriting] = useState(0);
  // F2: the minute the clock redraws on, the breath a held thumb runs, the step sheet
  const now = useNow();
  const breath = useBreath();
  const [editing, setEditing] = useState(false);

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
  // F2: the dot is on the step the page shows, in a live episode: the clock, the halo, the wake lock at the peak, the wash
  const still = light.value === 'still';
  const onStep = !!live && moved === null && showing > 0 && showing === at;
  const mark = onStep ? live.marks.filter(m => m.stepId === shown?.id).at(-1) : undefined;
  const ringy = !!shown?.tips.some(t => t.helper === 'ring' && !t.struck) && !flow.locked;
  const wash = onStep && showing === n && mark ? washLeft(mark.at, spanOf(shown), now) : 0;
  const helped = last ? whatHelped(flow, last) : [];

  return (
    <Page label={flow.name} back={{ word: 'Flow', href: '#/flow' }} keepSettings>
      <div class="fs-sheetof fs-rules fs-flowpage" data-saved={writing ? 'false' : 'true'} data-showing={showing}>
        <div class="fl-drawing">
          {wash > 0 && <Wash left={wash} />}
          <Cycle diagram={flow.diagram} steps={flow.steps} at={at} showing={showing} live={!!live && moved !== 0}
            disabled={!!flow.locked} onRead={read} onMove={(v, to) => void move(v, to)}
            halo={ringy && (onStep || breath.held) ? breath.since ?? 0 : false} held={breath.held} />
          <Clock from={onStep ? clockFrom(flow, live) : undefined} now={now} under={shown?.usualShort} holdable={ringy} breath={breath}
            awake={onStep && !!shown?.peak} />
        </div>
        {shown ? (
          <section class="fl-step-page" aria-label={shown.name}>
            {shown.line && <p class="fl-line">{shown.line}</p>}
            {shown.said && <p class="fl-said fs-notstill">{shown.said}</p>}
            {shown.usual && <p class="fl-usual fs-notstill">Usually: {shown.usual}</p>}
            {shown.usualShort && <p class="fl-usual fs-stillonly">{shown.usualShort}</p>}
            {!flow.locked && (
              <Tips step={shown} flowTips={flow.steps.flatMap(s => s.tips)} live={live} still={still} now={now} onChanged={() => setVersion(v => v + 1)} />
            )}
            {!live && !flow.locked && <p class="fl-edit fs-notstill"><button type="button" class="fs-word" onClick={() => setEditing(true)}>Edit</button></p>}
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
            {helped.length > 0 && <p class="fl-helped fs-notstill"><small>What helped</small> {helped.join(', ')}</p>}
          </section>
        )}
      </div>
      {shown && !flow.locked && (
        <StepSheet flow={flow} step={shown} open={editing} onClose={() => setEditing(false)} onSaved={() => setVersion(v => v + 1)} />
      )}
    </Page>
  );
}
