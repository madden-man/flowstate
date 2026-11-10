// Flow is your flows (PLAN-FLOWS.md sections 4 and 6, F1): one row per flow in its order, the name on the rule, its
// drawn shape small in print at the right, and under the name the shape's name and "last time" in print. A flow
// with an episode open carries the dot on its little drawing. No counts anywhere (DESIGN.md rule 15); Still keeps
// the rows and drops "last time" (rule 13). Right now and Meditate are the two fixed rows above the flows; Meditate's
// meta line says when the last sit was ("The circle · last sat 11 / 8", S2), a date only, and drops it in Still.
// Energize's meta line names the three in slot order in place of the shape's name (PLAN-ENERGIZE.md X2, "FlowState ·
// East Winds · Japan Trip", cut with an ellipsis when long); a row read locked keeps the shape's name.
import { useEffect, useState } from 'preact/hooks';
import { Page } from '../parts/Page';
import { Cycle } from '../parts/Cycle';
import { CircleMark } from '../parts/Circle';
import { NewFlow } from './NewFlow';
import { StampAsk } from './Stamps';
import { shapeOf } from '../parts/cycle/index';
import { dataVersion } from '../sheets';
import { shortDate } from '../date';
import { flowStates, placeOf, currentStepId, type FlowState } from '../../model/flows';
import { lastSit } from '../../model/sits';
import { FIXATION_FLOW, three } from '../../model/fixations';
import { namesOf } from './Fixations';

export function Flow() {
  const [rows, setRows] = useState<FlowState[] | null>(null);
  const [sat, setSat] = useState<number | undefined>(undefined);
  const [names, setNames] = useState<string | undefined>(undefined);
  useEffect(() => {
    let live = true;
    flowStates().then(r => { if (live) setRows(r); });
    lastSit().then(s => { if (live) setSat(s?.startedAt); }).catch(() => undefined);
    three().then(t => { if (live) setNames(namesOf(t)); }).catch(() => undefined);
    return () => { live = false; };
  }, [dataVersion.value]);

  return (
    <Page label="Flow" drawn={rows !== null}>
      <div class="fs-sheetof fs-rules fs-flows">
        {/* the morning after a worry (F6): the prediction and two chips, once */}
        <StampAsk />
        {/* Right now (F5): his own step lines across every flow, the door's page */}
        <a class="fs-row fs-list-row fl-flow fl-now" href="#/flow/now">
          <span class="fs-list-line">Right now</span>
          <small class="fs-list-meta">Your lines; tap the one that fits</small>
        </a>
        {/* Meditate (PLAN-MEDITATE.md, S1): not a flow, a fixed second row; the circle with nothing on it at the right */}
        <a class="fs-row fs-list-row fl-flow md-row" href="#/flow/meditate">
          <span class="fs-list-line">Meditate</span>
          <small class="fs-list-meta">
            The circle
            {sat !== undefined && <span class="fs-notstill"> · last sat {shortDate(new Date(sat))}</span>}
          </small>
          <span class="fl-mini" aria-hidden="true"><CircleMark /></span>
        </a>
        {rows?.map(({ flow, live, last }) => (
          <a key={flow.id} class="fs-row fs-list-row fl-flow" href={`#/flow/${flow.id}`} data-live={live ? 'true' : undefined}>
            <span class="fs-list-line">{flow.name}</span>
            <small class="fs-list-meta">
              {(flow.id === FIXATION_FLOW && !flow.locked && names) || shapeOf(flow.diagram).title}
              {last && <span class="fs-notstill"> · last time {shortDate(new Date(last.startedAt))}</span>}
            </small>
            <span class="fl-mini" aria-hidden="true">
              <Cycle small diagram={flow.diagram} steps={flow.steps} at={live ? placeOf(flow, currentStepId(live)) : 0} />
            </span>
          </a>
        ))}
        {/* "+ flow" comes last (F3). */}
        <NewFlow />
      </div>
    </Page>
  );
}
